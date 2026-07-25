"use server";

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { revalidatePath } from "next/cache";
import {
  syncRekapanSetelahPembayaran,
  seedRekapanTunggakanBaru,
  hapusRekapanTunggakan,
} from "@/lib/rekapan-helper";

const first = (v: any) => (Array.isArray(v) ? v[0] : v);

// ─── Helper permission ────────────────────────────────────────────────────────
async function getTagihanPermission(supabase: any, idTagihan: string) {
  const { data: tagihan, error } = await supabase
    .from("tagihan_siswa")
    .select(`
      idtagihansiswa,
      idsiswa,
      bulan,
      tahun,
      statuspembayaran,
      jumlahtagihan,
      jumlahterbayar,
      siswa:siswa!idsiswa(namasiswa),
      master_tagihan:master_tagihan!idmastertagihan(namatagihan),
      pembayaran (
        idpembayaran,
        statuspembayaran,
        metodepembayaran
      )
    `)
    .eq("idtagihansiswa", idTagihan)
    .single();

  if (error || !tagihan) {
    console.error("[getTagihanPermission] error:", error);
    return { ok: false, reason: "Tagihan tidak ditemukan", tagihan: null };
  }

  const pembayaranList: any[] = Array.isArray(tagihan.pembayaran)
    ? tagihan.pembayaran
    : tagihan.pembayaran
    ? [tagihan.pembayaran]
    : [];

  const hasSuccessPayment = pembayaranList.some(
    (p: any) => p.statuspembayaran === "SUCCESS"
  );

  const hasMidtransPayment = pembayaranList.some(
    (p: any) =>
      p.statuspembayaran === "SUCCESS" &&
      p.metodepembayaran !== "cash" &&
      p.metodepembayaran !== "transfer"
  );

  const nonSuccessIds = pembayaranList
    .filter((p: any) => p.statuspembayaran !== "SUCCESS")
    .map((p: any) => p.idpembayaran);

  const allPembayaranIds = pembayaranList.map((p: any) => p.idpembayaran);

  return {
    ok: true,
    tagihan,
    hasSuccessPayment,
    hasMidtransPayment,
    canBayarManual:
      !hasMidtransPayment && tagihan.statuspembayaran !== "LUNAS",
    canDelete: !hasSuccessPayment,
    nonSuccessIds,
    allPembayaranIds,
  };
}

// ─── Bayar Manual (cash ATAU transfer manual, boleh cicilan) ─────────────────
// FIX: sekarang menerima juga `tipepembayaran` ("cash" | "transfer") dan
// `buktipembayaranurl` (link gambar bukti transfer/pembayaran yang sudah
// diunggah ke Supabase Storage sebelum action ini dipanggil — lihat
// dialog-bayar-manual.tsx untuk alur upload-nya).
export async function bayarTagihanManual(prevState: any, formData: FormData) {
  const idTagihan = formData.get("idtagihansiswa") as string;
  const jumlahBayar = parseFloat(formData.get("jumlahbayar") as string);
  const tipePembayaran = (formData.get("tipepembayaran") as string) || "cash";
  const buktiPembayaranUrl = (formData.get("buktipembayaranurl") as string) || null;

  if (!idTagihan || !jumlahBayar || jumlahBayar <= 0) {
    return {
      status: "error",
      errors: { _form: ["Data pembayaran tidak valid"] },
    };
  }

  if (tipePembayaran !== "cash" && tipePembayaran !== "transfer") {
    return {
      status: "error",
      errors: { _form: ["Tipe pembayaran tidak valid"] },
    };
  }

  const supabase = await createClient({ isAdmin: true });
  const perm = await getTagihanPermission(supabase, idTagihan);

  if (!perm.ok) {
    return { status: "error", errors: { _form: [perm.reason] } };
  }
  if (!perm.canBayarManual) {
    return {
      status: "error",
      errors: {
        _form: [
          perm.hasMidtransPayment
            ? "Tagihan sudah lunas via Midtrans, tidak dapat ditambah pembayaran manual"
            : "Tagihan sudah lunas",
        ],
      },
    };
  }

  const tagihan = perm.tagihan;
  const totalTagihan = parseFloat(tagihan.jumlahtagihan);
  const sudahBayar = parseFloat(tagihan.jumlahterbayar ?? "0");
  const sisaTagihan = totalTagihan - sudahBayar;

  if (jumlahBayar > sisaTagihan) {
    return {
      status: "error",
      errors: { _form: ["Jumlah pembayaran melebihi sisa tagihan"] },
    };
  }

  const terbayarBaru = sudahBayar + jumlahBayar;
  const sisaSetelahIni = Math.max(0, totalTagihan - terbayarBaru);

  const statusBaru =
    terbayarBaru >= totalTagihan
      ? "LUNAS"
      : terbayarBaru > 0
      ? "BELUM LUNAS"
      : "BELUM BAYAR";

  const { error: updateError } = await supabase
    .from("tagihan_siswa")
    .update({
      jumlahterbayar: terbayarBaru,
      statuspembayaran: statusBaru,
      updatedat: new Date().toISOString(),
    })
    .eq("idtagihansiswa", idTagihan);

  if (updateError) {
    return {
      status: "error",
      errors: { _form: [`Gagal update tagihan: ${updateError.message}`] },
    };
  }

  const { data: pembayaranData, error: insertError } = await supabase
    .from("pembayaran")
    .insert({
      idtagihansiswa: parseInt(idTagihan),
      idsiswa: tagihan.idsiswa,
      jumlahdibayar: jumlahBayar,
      tanggalpembayaran: new Date().toISOString(),
      metodepembayaran: tipePembayaran, // "cash" atau "transfer"
      statuspembayaran: "SUCCESS",
      sisa_setelah_transaksi_ini: sisaSetelahIni,
      bukti_pembayaran_url: buktiPembayaranUrl,
    })
    .select("idpembayaran")
    .single();

  if (insertError) {
    console.error("[bayarTagihanManual] Error insert pembayaran:", insertError);
  }

  // FIX (arahan dosen pembimbing): snapshot ke rekapan_pembayaran +
  // sinkronkan rekapan_tunggakan setiap ada pembayaran manual sukses.
  if (pembayaranData?.idpembayaran) {
    await syncRekapanSetelahPembayaran(supabase, {
      idpembayaran: pembayaranData.idpembayaran,
      idtagihansiswa: parseInt(idTagihan),
      jumlahdibayar: jumlahBayar,
      tanggalpembayaran: new Date().toISOString(),
      metodepembayaran: tipePembayaran,
      sisaSetelahTransaksiIni: sisaSetelahIni,
      statusTagihanTerbaru: statusBaru,
    });
  }

  const namaSiswa = first(tagihan.siswa)?.namasiswa || "-";
  const namaTagihan = first(tagihan.master_tagihan)?.namatagihan || "-";

  await writeChangelog({
    supabase,
    namamenu: "Tagihan Siswa",
    jenisaksi: "UBAH",
    deskripsi: `Mencatat pembayaran ${tipePembayaran} sebesar Rp${jumlahBayar.toLocaleString(
      "id-ID"
    )} untuk ${namaSiswa} - ${namaTagihan} (${tagihan.bulan}/${tagihan.tahun}) — status: ${statusBaru}`,
  });

  revalidatePath("/admin/tagihan");
  revalidatePath("/admin/rekapan-pembayaran");
  revalidatePath("/admin/rekapan-tunggakan");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (pembayaranData?.idpembayaran) {
    if (process.env.FONNTE_API_KEY) {
      try {
        await fetch(`${appUrl}/api/notifications/send-payment-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idPembayaran: pembayaranData.idpembayaran,
            idTagihan: parseInt(idTagihan),
            status: "SUCCESS",
          }),
        });
      } catch (e) {
        console.error("[WA] Gagal kirim notifikasi pembayaran:", e);
      }
    }
  }

  return {
    status: "success",
    data: {
      idpembayaran: pembayaranData?.idpembayaran,
      jumlahbayar: jumlahBayar,
      sisatagihan: sisaSetelahIni,
      statusbaru: statusBaru,
    },
  };
}

// ─── Delete Tagihan ───────────────────────────────────────────────────────────
export async function deleteTagihanSiswa(prevState: any, formData: FormData) {
  const idTagihan = formData.get("idtagihansiswa") as string;

  if (!idTagihan) {
    return {
      status: "error",
      errors: { _form: ["ID tagihan tidak valid"] },
    };
  }

  const supabase = await createClient({ isAdmin: true });
  const perm = await getTagihanPermission(supabase, idTagihan);

  if (!perm.ok) {
    return { status: "error", errors: { _form: [perm.reason] } };
  }

  if (!perm.canDelete) {
    return {
      status: "error",
      errors: {
        _form: [
          "Tidak dapat menghapus tagihan yang sudah memiliki riwayat pembayaran berhasil.",
        ],
      },
    };
  }

  const tagihan: any = perm.tagihan;
  const namaSiswa = first(tagihan.siswa)?.namasiswa || "-";
  const namaTagihan = first(tagihan.master_tagihan)?.namatagihan || "-";

  await supabase
    .from("whatsapp_notification_logs")
    .delete()
    .eq("target_id", parseInt(idTagihan));

  if (perm.nonSuccessIds && perm.nonSuccessIds.length > 0) {
    await supabase
      .from("payment_gateway_log")
      .delete()
      .in("idpembayaran", perm.nonSuccessIds);
  }

  if (perm.nonSuccessIds && perm.nonSuccessIds.length > 0) {
    const { error: deletePembayaranError } = await supabase
      .from("pembayaran")
      .delete()
      .in("idpembayaran", perm.nonSuccessIds);

    if (deletePembayaranError) {
      console.error(
        "[deleteTagihanSiswa] Gagal hapus pembayaran:",
        deletePembayaranError
      );
      return {
        status: "error",
        errors: {
          _form: [
            `Gagal membersihkan data pembayaran: ${deletePembayaranError.message}`,
          ],
        },
      };
    }
  }

  const { error: deleteError } = await supabase
    .from("tagihan_siswa")
    .delete()
    .eq("idtagihansiswa", idTagihan);

  if (deleteError) {
    console.error("[deleteTagihanSiswa] Gagal hapus tagihan:", deleteError);
    return {
      status: "error",
      errors: { _form: [deleteError.message] },
    };
  }

  // FIX: bersihkan juga baris snapshot-nya di rekapan_tunggakan (kalau
  // ada) — tagihannya sendiri sudah tidak ada lagi.
  await hapusRekapanTunggakan(supabase, parseInt(idTagihan));

  await writeChangelog({
    supabase,
    namamenu: "Tagihan Siswa",
    jenisaksi: "HAPUS",
    deskripsi: `Menghapus tagihan #${idTagihan} — ${namaSiswa}: ${namaTagihan} (${tagihan.bulan}/${tagihan.tahun})`,
  });

  revalidatePath("/admin/tagihan");
  revalidatePath("/admin/rekapan-tunggakan");
  return { status: "success" };
}

// ─── Create Batch ─────────────────────────────────────────────────────────────
export async function createTagihanBatch(
  prevState: any,
  formData: FormData | null
) {
  if (!formData) {
    return { status: "error", errors: { _form: ["Data tidak valid"] } };
  }

  const siswaIdsStr = formData.get("siswa_ids");
  const masterTagihanId = formData.get("master_tagihan_id");
  const bulan = formData.get("bulan");
  const tahun = formData.get("tahun");

  if (!siswaIdsStr || !masterTagihanId || !bulan || !tahun) {
    return {
      status: "error",
      errors: { _form: ["Semua field wajib diisi"] },
    };
  }

  let siswaIds: string[];
  try {
    siswaIds = JSON.parse(siswaIdsStr as string) as string[];
  } catch {
    return {
      status: "error",
      errors: { _form: ["Format data siswa tidak valid"] },
    };
  }

  if (!siswaIds || siswaIds.length === 0) {
    return {
      status: "error",
      errors: { _form: ["Pilih minimal 1 siswa"] },
    };
  }

  const supabase = await createClient({ isAdmin: true });

  const { data: masterTagihan, error: masterError } = await supabase
    .from("master_tagihan")
    .select("*")
    .eq("id_mastertagihan", masterTagihanId)
    .single();

  if (masterError || !masterTagihan) {
    return {
      status: "error",
      errors: { _form: ["Data master tagihan tidak ditemukan"] },
    };
  }

  const { data: existing } = await supabase
    .from("tagihan_siswa")
    .select("idsiswa, siswa!idsiswa(namasiswa)")
    .eq("idmastertagihan", masterTagihanId)
    .eq("bulan", parseInt(bulan as string))
    .eq("tahun", parseInt(tahun as string))
    .in("idsiswa", siswaIds);

  if (existing && existing.length > 0) {
    const names = existing
      .map((t: any) => first(t.siswa)?.namasiswa || t.idsiswa)
      .join(", ");
    return {
      status: "error",
      errors: {
        _form: [`Siswa berikut sudah memiliki tagihan periode ini: ${names}`],
      },
    };
  }

  const tagihanToInsert = siswaIds.map((siswaId: string) => ({
    idsiswa: siswaId,
    idmastertagihan: parseInt(masterTagihanId as string),
    bulan: parseInt(bulan as string),
    tahun: parseInt(tahun as string),
    jumlahtagihan: masterTagihan.nominal,
    jumlahterbayar: 0,
    statuspembayaran: "BELUM BAYAR",
  }));

  const { data: insertedTagihan, error: insertError } = await supabase
    .from("tagihan_siswa")
    .insert(tagihanToInsert)
    .select("idtagihansiswa");

  if (insertError) {
    return {
      status: "error",
      errors: { _form: [`Gagal membuat tagihan: ${insertError.message}`] },
    };
  }

  // FIX (arahan dosen pembimbing): seed rekapan_tunggakan untuk tiap
  // tagihan yang baru dibuat — langsung muncul sebagai tunggakan (status
  // BELUM BAYAR, sisa = nominal penuh) sejak awal, tidak perlu nunggu ada
  // cicilan dulu baru muncul di rekapan.
  if (insertedTagihan?.length) {
    await Promise.allSettled(
      insertedTagihan.map((t: any) =>
        seedRekapanTunggakanBaru(supabase, t.idtagihansiswa, parseFloat(masterTagihan.nominal))
      )
    );
  }

  await writeChangelog({
    supabase,
    namamenu: "Tagihan Siswa",
    jenisaksi: "TAMBAH",
    deskripsi: `Membuat ${siswaIds.length} tagihan "${masterTagihan.namatagihan}" untuk periode ${bulan}/${tahun}`,
  });

  revalidatePath("/admin/tagihan");
  revalidatePath("/admin/rekapan-tunggakan");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (process.env.FONNTE_API_KEY && insertedTagihan?.length) {
    await Promise.allSettled(
      insertedTagihan.map(async (t: any) => {
        try {
          await fetch(`${appUrl}/api/notifications/send-bill`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idTagihan: t.idtagihansiswa }),
          });
        } catch (e) {
          console.error(
            `[WA] Gagal kirim notif tagihan ${t.idtagihansiswa}:`,
            e
          );
        }
      })
    );
  }

  return { status: "success" };
}
