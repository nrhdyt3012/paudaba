// PATH SARAN: app/admin/rekapan-pembayaran/actions.ts
// Sesuaikan import "@/lib/supabase/server" dengan lokasi supabase server
// client di project kamu.
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// BARU: metode pembayaran untuk data impor sekarang cuma 2 opsi, sama
// seperti metode pembayaran normal di sistem (cash / transfer) —
// menggantikan nilai statis "Impor Data Lama" yang dipakai sebelumnya.
const METODE_VALID = new Set(["cash", "transfer"]);

type MetodePembayaran = "cash" | "transfer";

type ImportRiwayatRow = {
  idsiswa: string;
  jumlahdibayar: number;
  // ISO string, mis. new Date(inputDate).toISOString()
  tanggalpembayaran: string;
  // BARU: metode pembayaran per siswa/baris, dipilih di Step 4 halaman
  // Impor Riwayat Pembayaran.
  metodepembayaran: MetodePembayaran;
};

type ImportRiwayatInput = {
  idmastertagihan: number;
  bulan: number;
  tahun: number;
  rows: ImportRiwayatRow[];
};

type ActionState = {
  status: "idle" | "success" | "error";
  errors?: { _form?: string[] };
  data?: { berhasil: number; gagal: number };
};

// CATATAN PENTING: fungsi ini SENGAJA tidak memanggil endpoint/route
// notifikasi WhatsApp (Fonnte) di titik manapun. Ini jalur khusus untuk
// mencatat data historis (pembayaran yang sudah terjadi di dunia nyata
// sebelum sistem ini dipakai), jadi wali murid tidak boleh menerima
// notifikasi retroaktif soal transaksi setahun lalu.
export async function importRiwayatPembayaran(
  input: ImportRiwayatInput
): Promise<ActionState> {
  const supabase = await createClient();

  if (!input.rows?.length) {
    return { status: "error", errors: { _form: ["Tidak ada siswa yang dipilih"] } };
  }

  const { data: master, error: masterError } = await supabase
    .from("master_tagihan")
    .select("*")
    .eq("id_mastertagihan", input.idmastertagihan)
    .single();

  if (masterError || !master) {
    return { status: "error", errors: { _form: ["Master tagihan tidak ditemukan"] } };
  }

  // Ambil data siswa sekaligus di awal (bukan per baris di dalam loop)
  // supaya tidak query berulang — dipakai untuk isi kolom denormalisasi
  // (namasiswa, kelas) di rekapan_pembayaran & rekapan_tunggakan.
  const idsiswaUnik = [...new Set(input.rows.map((r) => r.idsiswa))];
  const { data: siswaRows } = await supabase
    .from("siswa")
    .select("id, namasiswa, kelas")
    .in("id", idsiswaUnik);
  const siswaMap = new Map((siswaRows || []).map((s: any) => [s.id, s]));

  const periodeStr = `${BULAN_NAMA[input.bulan]} ${input.tahun}`;

  let berhasil = 0;
  let gagal = 0;
  const pesanGagal: string[] = [];

  for (const row of input.rows) {
    try {
      if (!row.jumlahdibayar || row.jumlahdibayar <= 0) {
        gagal++;
        pesanGagal.push(`Nominal tidak valid untuk siswa ${row.idsiswa}`);
        continue;
      }

      // BARU: validasi metode pembayaran — cuma boleh "cash" atau
      // "transfer". Kalau kosong/tidak dikenal, fallback ke "cash" supaya
      // baris tidak gagal total hanya gara-gara metode tidak terkirim.
      const metode: MetodePembayaran = METODE_VALID.has(row.metodepembayaran)
        ? row.metodepembayaran
        : "cash";

      const siswaInfo = siswaMap.get(row.idsiswa);

      // 1. Cari atau buat tagihan_siswa untuk kombinasi
      //    (siswa, master_tagihan, bulan, tahun) ini.
      const { data: tagihanExisting, error: cekError } = await supabase
        .from("tagihan_siswa")
        .select("*")
        .eq("idsiswa", row.idsiswa)
        .eq("idmastertagihan", input.idmastertagihan)
        .eq("bulan", input.bulan)
        .eq("tahun", input.tahun)
        .maybeSingle();

      if (cekError) {
        gagal++;
        pesanGagal.push(`Gagal memeriksa tagihan siswa ${row.idsiswa}`);
        continue;
      }

      let tagihan = tagihanExisting;

      if (!tagihan) {
        const { data: tagihanBaru, error: insertTagihanError } = await supabase
          .from("tagihan_siswa")
          .insert({
            idsiswa: row.idsiswa,
            idmastertagihan: input.idmastertagihan,
            bulan: input.bulan,
            tahun: input.tahun,
            jumlahtagihan: master.nominal,
            namatagihan: master.namatagihan,
            jenjang: master.jenjang,
            jenistagihan: master.jenistagihan,
            jumlahterbayar: 0,
            statuspembayaran: "BELUM BAYAR",
          })
          .select()
          .single();

        if (insertTagihanError || !tagihanBaru) {
          gagal++;
          pesanGagal.push(`Gagal membuat tagihan untuk siswa ${row.idsiswa}`);
          continue;
        }
        tagihan = tagihanBaru;
      }

      const jumlahTerbayarBaru =
        parseFloat(tagihan.jumlahterbayar || "0") + row.jumlahdibayar;
      const totalTagihan = parseFloat(tagihan.jumlahtagihan || "0");
      const sisaBaru = Math.max(0, totalTagihan - jumlahTerbayarBaru);
      const statusBaru = sisaBaru <= 0 ? "LUNAS" : "BELUM LUNAS";

      // 2. Catat transaksi pembayaran. statuspembayaran langsung SUCCESS
      //    (bukan PENDING) karena ini pencatatan retroaktif. Metode
      //    pembayaran sekarang mengikuti pilihan bendahara di Step 4
      //    (cash / transfer), bukan lagi string statis.
      const { data: pembayaranBaru, error: insertPembayaranError } = await supabase
        .from("pembayaran")
        .insert({
          idtagihansiswa: tagihan.idtagihansiswa,
          idsiswa: row.idsiswa,
          jumlahdibayar: row.jumlahdibayar,
          tanggalpembayaran: row.tanggalpembayaran,
          metodepembayaran: metode,
          statuspembayaran: "SUCCESS",
          sisa_setelah_transaksi_ini: sisaBaru,
        })
        .select()
        .single();

      if (insertPembayaranError || !pembayaranBaru) {
        gagal++;
        pesanGagal.push(`Gagal mencatat pembayaran untuk siswa ${row.idsiswa}`);
        continue;
      }

      // 3. Update saldo & status di tagihan_siswa.
      const { error: updateTagihanError } = await supabase
        .from("tagihan_siswa")
        .update({
          jumlahterbayar: jumlahTerbayarBaru,
          statuspembayaran: statusBaru,
        })
        .eq("idtagihansiswa", tagihan.idtagihansiswa);

      if (updateTagihanError) {
        gagal++;
        pesanGagal.push(`Gagal update status tagihan untuk siswa ${row.idsiswa}`);
        continue;
      }

      // 4. Sinkron ke rekapan_pembayaran — supaya transaksi ini otomatis
      //    muncul di kartu "Daftar Transaksi Pembayaran" pada halaman
      //    Rekapan Pembayaran, sama seperti transaksi live.
      const { error: rekapPembayaranError } = await supabase
        .from("rekapan_pembayaran")
        .insert({
          idpembayaran: pembayaranBaru.idpembayaran,
          idtagihansiswa: tagihan.idtagihansiswa,
          idsiswa: row.idsiswa,
          namasiswa: siswaInfo?.namasiswa || "-",
          periode: periodeStr,
          namatagihan: master.namatagihan,
          jenjang: master.jenjang,
          jumlahdibayar: row.jumlahdibayar,
          tanggalpembayaran: row.tanggalpembayaran,
          kelas: siswaInfo?.kelas || "-",
          metodepembayaran: metode,
          sisa_setelah_transaksi_ini: sisaBaru,
        });

      if (rekapPembayaranError) {
        gagal++;
        pesanGagal.push(`Gagal sinkron rekapan pembayaran untuk siswa ${row.idsiswa}`);
        continue;
      }

      // 5. Sinkron ke rekapan_tunggakan. Tabel ini UNIQUE per
      //    idtagihansiswa dan isinya HANYA yang masih menunggak, jadi:
      //    - kalau masih ada sisa -> upsert (buat baru / update nominal)
      //    - kalau sudah LUNAS -> hapus barisnya (bukan diisi 0)
      if (sisaBaru > 0) {
        const { error: upsertTunggakanError } = await supabase
          .from("rekapan_tunggakan")
          .upsert(
            {
              idtagihansiswa: tagihan.idtagihansiswa,
              idsiswa: row.idsiswa,
              namasiswa: siswaInfo?.namasiswa || "-",
              periode: periodeStr,
              namatagihan: master.namatagihan,
              jenjang: master.jenjang,
              jumlahtunggakan: sisaBaru,
              kelas: siswaInfo?.kelas || "-",
              statuspembayaran: statusBaru,
              updatedat: new Date().toISOString(),
            },
            { onConflict: "idtagihansiswa" }
          );
        if (upsertTunggakanError) {
          gagal++;
          pesanGagal.push(`Gagal sinkron tunggakan untuk siswa ${row.idsiswa}`);
          continue;
        }
      } else {
        await supabase
          .from("rekapan_tunggakan")
          .delete()
          .eq("idtagihansiswa", tagihan.idtagihansiswa);
      }

      berhasil++;
    } catch (err) {
      gagal++;
      pesanGagal.push(String(err));
    }
  }

  revalidatePath("/admin/rekapan-pembayaran");
  revalidatePath("/admin/rekapan-tunggakan");

  if (berhasil === 0) {
    return {
      status: "error",
      errors: { _form: pesanGagal.length ? pesanGagal : ["Semua data gagal diimpor"] },
    };
  }

  return {
    status: "success",
    data: { berhasil, gagal },
    errors: gagal > 0 ? { _form: pesanGagal } : undefined,
  };
}