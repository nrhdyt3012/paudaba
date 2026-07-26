// src/lib/rekapan-helper.ts
//
// FIX (arahan dosen pembimbing): setiap pembayaran (baik via Midtrans
// maupun manual/cash/transfer) sekarang di-SNAPSHOT ke tabel
// `rekapan_pembayaran`, dan status tunggakan disinkronkan ke tabel
// `rekapan_tunggakan`. Dipusatkan di sini supaya logic-nya SATU tempat
// saja, dipanggil dari 3 titik: webhook Midtrans, bayar manual, dan
// pembuatan tagihan baru.
//
// Perilaku kedua tabel BEDA sifatnya:
// - rekapan_pembayaran = LOG PERMANEN. Tiap transaksi sukses = 1 baris
//   baru, tidak pernah diupdate/dihapus (riwayat, seperti buku kas).
// - rekapan_tunggakan = SNAPSHOT LIVE. Cuma berisi tagihan yang MASIH
//   nunggak sekarang — di-UPSERT (insert/update sisa) selama belum lunas,
//   lalu barisnya DIHAPUS begitu status jadi LUNAS (karena sudah bukan
//   tunggakan lagi).

import { SupabaseClient } from "@supabase/supabase-js";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type StatusTagihan = "BELUM BAYAR" | "BELUM LUNAS" | "LUNAS";

async function getSnapshotData(supabase: SupabaseClient, idtagihansiswa: number) {
  const { data: tagihan, error } = await supabase
    .from("tagihan_siswa")
    .select(`
      idsiswa, bulan, tahun,
      siswa:siswa!idsiswa(namasiswa, kelas),
      master_tagihan:master_tagihan!idmastertagihan(namatagihan, jenjang)
    `)
    .eq("idtagihansiswa", idtagihansiswa)
    .single();

  if (error || !tagihan) {
    console.error("[rekapan-helper] Tagihan tidak ditemukan:", idtagihansiswa, error?.message);
    return null;
  }

  const siswa: any = Array.isArray(tagihan.siswa) ? tagihan.siswa[0] : tagihan.siswa;
  const master: any = Array.isArray(tagihan.master_tagihan)
    ? tagihan.master_tagihan[0]
    : tagihan.master_tagihan;

  return {
    idsiswa: tagihan.idsiswa,
    namasiswa: siswa?.namasiswa || "-",
    kelas: siswa?.kelas || null,
    periode: `${BULAN_NAMA[tagihan.bulan] || tagihan.bulan} ${tagihan.tahun}`,
    namatagihan: master?.namatagihan || "-",
    jenjang: master?.jenjang || null,
  };
}

/**
 * Dipanggil setiap kali ada pembayaran SUKSES (Midtrans ataupun manual).
 * 1) Insert 1 baris baru ke rekapan_pembayaran (log permanen).
 * 2) Sinkronkan rekapan_tunggakan: upsert kalau masih nunggak, hapus
 *    barisnya kalau statusnya sudah LUNAS.
 */
export async function syncRekapanSetelahPembayaran(
  supabase: SupabaseClient,
  params: {
    idpembayaran: number;
    idtagihansiswa: number;
    jumlahdibayar: number;
    tanggalpembayaran: string;
    metodepembayaran: string;
    sisaSetelahTransaksiIni: number;
    statusTagihanTerbaru: StatusTagihan;
  }
) {
  const {
    idpembayaran, idtagihansiswa, jumlahdibayar, tanggalpembayaran,
    metodepembayaran, sisaSetelahTransaksiIni, statusTagihanTerbaru,
  } = params;

  const snapshot = await getSnapshotData(supabase, idtagihansiswa);
  if (!snapshot) return;

  // 1) LOG PERMANEN — insert baris baru (upsert by idpembayaran cuma
  // jaga-jaga kalau ada retry/duplikat pemanggilan, bukan berarti baris
  // ini boleh diedit ulang di kemudian hari).
  const { error: errPembayaran } = await supabase
    .from("rekapan_pembayaran")
    .upsert(
      {
        idpembayaran,
        idtagihansiswa,
        idsiswa: snapshot.idsiswa,
        namasiswa: snapshot.namasiswa,
        kelas: snapshot.kelas,
        periode: snapshot.periode,
        namatagihan: snapshot.namatagihan,
        jenjang: snapshot.jenjang,
        jumlahdibayar,
        tanggalpembayaran,
        metodepembayaran,
        sisa_setelah_transaksi_ini: sisaSetelahTransaksiIni,
      },
      { onConflict: "idpembayaran" }
    );

  if (errPembayaran) {
    console.error("[rekapan-helper] Gagal insert rekapan_pembayaran:", errPembayaran.message);
  }

  // 2) SNAPSHOT LIVE — upsert kalau masih nunggak, hapus kalau lunas.
  await upsertOrHapusRekapanTunggakan(supabase, {
    idtagihansiswa,
    statusTagihan: statusTagihanTerbaru,
    sisa: sisaSetelahTransaksiIni,
    snapshot,
  });
}

/**
 * Dipanggil setiap kali tagihan BARU diterbitkan (createTagihanBatch) —
 * supaya langsung muncul di rekapan_tunggakan sejak awal (status BELUM
 * BAYAR, sisa = nominal penuh), tidak perlu nunggu ada cicilan dulu.
 */
export async function seedRekapanTunggakanBaru(
  supabase: SupabaseClient,
  idtagihansiswa: number,
  jumlahTagihanPenuh: number
) {
  const snapshot = await getSnapshotData(supabase, idtagihansiswa);
  if (!snapshot) return;

  await upsertOrHapusRekapanTunggakan(supabase, {
    idtagihansiswa,
    statusTagihan: "BELUM BAYAR",
    sisa: jumlahTagihanPenuh,
    snapshot,
  });
}

/**
 * Dipanggil saat tagihan DIHAPUS (deleteTagihanSiswa) — baris snapshot
 * tunggakan-nya ikut dibersihkan (kalau ada), karena tagihannya sendiri
 * sudah tidak ada lagi.
 */
export async function hapusRekapanTunggakan(
  supabase: SupabaseClient,
  idtagihansiswa: number
) {
  const { error } = await supabase
    .from("rekapan_tunggakan")
    .delete()
    .eq("idtagihansiswa", idtagihansiswa);

  if (error) {
    console.error("[rekapan-helper] Gagal hapus rekapan_tunggakan:", error.message);
    throw new Error(`Gagal menghapus data tunggakan: ${error.message}`);
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────
async function upsertOrHapusRekapanTunggakan(
  supabase: SupabaseClient,
  args: {
    idtagihansiswa: number;
    statusTagihan: StatusTagihan;
    sisa: number;
    snapshot: NonNullable<Awaited<ReturnType<typeof getSnapshotData>>>;
  }
) {
  const { idtagihansiswa, statusTagihan, sisa, snapshot } = args;

  if (statusTagihan === "LUNAS" || sisa <= 0) {
    // Sudah lunas → bukan tunggakan lagi, hapus barisnya dari tabel ini.
    const { error } = await supabase
      .from("rekapan_tunggakan")
      .delete()
      .eq("idtagihansiswa", idtagihansiswa);

    if (error) {
      console.error("[rekapan-helper] Gagal hapus rekapan_tunggakan (lunas):", error.message);
    }
    return;
  }

  const { error } = await supabase
    .from("rekapan_tunggakan")
    .upsert(
      {
        idtagihansiswa,
        idsiswa: snapshot.idsiswa,
        namasiswa: snapshot.namasiswa,
        kelas: snapshot.kelas,
        periode: snapshot.periode,
        namatagihan: snapshot.namatagihan,
        jenjang: snapshot.jenjang,
        jumlahtunggakan: sisa,
        statuspembayaran: statusTagihan,
        updatedat: new Date().toISOString(),
      },
      { onConflict: "idtagihansiswa" }
    );

  if (error) {
    console.error("[rekapan-helper] Gagal upsert rekapan_tunggakan:", error.message);
  }
}
