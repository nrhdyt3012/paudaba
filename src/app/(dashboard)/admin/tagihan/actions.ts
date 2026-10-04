"use server";

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { hapusRekapanTunggakan } from "@/lib/rekapan-helper";
import { revalidatePath } from "next/cache";
import { getCakupanBulan, isTagihanSPP } from "@/lib/periode-tagihan";

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
      namatagihan,
      siswa:siswa!idsiswa(namasiswa),
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
// Menerima `tipepembayaran` ("cash" | "transfer") dan `buktipembayaranurl`
// (link gambar bukti yang sudah diunggah ke Supabase Storage sebelum action
// ini dipanggil — lihat dialog-bayar-manual.tsx untuk alur upload-nya).
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

  const namaSiswa = first(tagihan.siswa)?.namasiswa || "-";
  const namaTagihan = tagihan.namatagihan || "-";

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

// ─── Delete Tagihan (dialog delete biasa, hanya untuk yang TANPA pembayaran) ──
// Tetap dipertahankan seperti semula: menolak kalau sudah ada pembayaran
// SUCCESS. Untuk tagihan berpembayaran, pakai deleteTagihanSiswaBatch(force).
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
  const namaTagihan = tagihan.namatagihan || "-";

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

  // Hapus snapshot dari rekapan_tunggakan sebelum menghapus tagihan
  // (untuk menghindari foreign key constraint error)
  await hapusRekapanTunggakan(supabase, parseInt(idTagihan));

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

  await writeChangelog({
    supabase,
    namamenu: "Tagihan Siswa",
    jenisaksi: "HAPUS",
    deskripsi: `Menghapus tagihan #${idTagihan} — ${namaSiswa}: ${namaTagihan} (${tagihan.bulan}/${tagihan.tahun})`,
  });

  revalidatePath("/admin/tagihan");
  return { status: "success" };
}

// ─── Hapus tagihan (cascade) — dipakai untuk hapus biasa & hapus paksa ───────
// Satu tagihan: cek permission → panggil RPC (transaksi atomik) → tulis changelog.
async function hapusSatuTagihanCascade(
  supabase: any,
  idTagihan: number,
  force: boolean
): Promise<{ ok: boolean; message?: string }> {
  const perm = await getTagihanPermission(supabase, String(idTagihan));
  if (!perm.ok || !perm.tagihan) {
    return { ok: false, message: perm.reason ?? "Tagihan tidak ditemukan" };
  }

  const tagihan: any = perm.tagihan;
  const jumlahTerbayar = parseFloat(tagihan.jumlahterbayar ?? "0") || 0;
  const pembayaranList: any[] = Array.isArray(tagihan.pembayaran)
    ? tagihan.pembayaran
    : tagihan.pembayaran
    ? [tagihan.pembayaran]
    : [];
  const jumlahTransaksiSukses = pembayaranList.filter(
    (p) => p.statuspembayaran === "SUCCESS"
  ).length;

  // Aturan ini harus sama dengan `needsStrongConfirm` di sisi client.
  const needsStrongConfirm =
    !!perm.hasSuccessPayment ||
    jumlahTerbayar > 0 ||
    tagihan.statuspembayaran !== "BELUM BAYAR";

  // Penjaga di sisi server: tagihan berpembayaran WAJIB lewat konfirmasi khusus
  if (needsStrongConfirm && !force) {
    return {
      ok: false,
      message:
        "Tagihan ini sudah memiliki riwayat pembayaran dan membutuhkan konfirmasi khusus.",
    };
  }

  const { error } = await supabase.rpc("hapus_tagihan_siswa_cascade", {
    p_idtagihan: idTagihan,
  });

  if (error) {
    console.error("[hapusSatuTagihanCascade] RPC error:", error);
    return { ok: false, message: error.message };
  }

  const namaSiswa = first(tagihan.siswa)?.namasiswa || "-";
  const namaTagihan = tagihan.namatagihan || "-";

  await writeChangelog({
    supabase,
    namamenu: "Tagihan Siswa",
    jenisaksi: "HAPUS",
    deskripsi: needsStrongConfirm
      ? `[HAPUS PAKSA] Menghapus tagihan #${idTagihan} — ${namaSiswa}: ${namaTagihan} (${tagihan.bulan}/${tagihan.tahun}). ` +
        `Status terakhir: ${tagihan.statuspembayaran}, sudah terbayar Rp${jumlahTerbayar.toLocaleString("id-ID")} ` +
        `dari ${jumlahTransaksiSukses} transaksi berhasil. Seluruh data pembayaran & rekapan terkait ikut dihapus.`
      : `Menghapus tagihan #${idTagihan} — ${namaSiswa}: ${namaTagihan} (${tagihan.bulan}/${tagihan.tahun})`,
  });

  return { ok: true };
}

// ─── Hapus banyak tagihan sekaligus (juga dipakai untuk hapus 1 tagihan) ─────
export async function deleteTagihanSiswaBatch(ids: number[], force: boolean) {
  const uniqueIds = Array.from(
    new Set((ids ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
  );

  if (uniqueIds.length === 0) {
    return {
      status: "error" as const,
      deleted: 0,
      failed: [{ id: 0, message: "Tidak ada tagihan yang dipilih" }],
    };
  }

  const supabase = await createClient({ isAdmin: true });

  let deleted = 0;
  const failed: { id: number; message: string }[] = [];

  for (const id of uniqueIds) {
    const res = await hapusSatuTagihanCascade(supabase, id, force);
    if (res.ok) deleted++;
    else failed.push({ id, message: res.message ?? "Gagal menghapus" });
  }

  revalidatePath("/admin/tagihan");
  revalidatePath("/admin/rekapan-pembayaran");

  return {
    status: (failed.length === 0
      ? "success"
      : deleted > 0
      ? "partial"
      : "error") as "success" | "partial" | "error",
    deleted,
    failed,
  };
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

const bulanNum = parseInt(bulan as string);
const tahunNum = parseInt(tahun as string);

let existing: any[] | null;
if (isTagihanSPP(masterTagihan.namatagihan)) {
  const cakupanBaru = getCakupanBulan(masterTagihan.namatagihan, bulanNum);
  const { data } = await supabase
    .from("tagihan_siswa")
    .select("idsiswa, bulan, namatagihan, siswa!idsiswa(namasiswa)")
    .in("idsiswa", siswaIds)
    .ilike("namatagihan", "SPP%")
    .eq("tahun", tahunNum)
    .or(`bulan.in.(${cakupanBaru.join(",")}),namatagihan.ilike.*Semester*`);
  existing = (data || []).filter((t: any) =>
    getCakupanBulan(t.namatagihan, t.bulan).some((b) => cakupanBaru.includes(b))
  );
} else {
  const { data } = await supabase
    .from("tagihan_siswa")
    .select("idsiswa, siswa!idsiswa(namasiswa)")
    .eq("idmastertagihan", masterTagihanId)
    .eq("bulan", bulanNum)
    .eq("tahun", tahunNum)
    .in("idsiswa", siswaIds);
  existing = data;
}

  if (existing && existing.length > 0) {
    const names = existing
      .map((t: any) => first(t.siswa)?.namasiswa || t.idsiswa)
      .join(", ");
    return {
      status: "error",
      errors: {
_form: [`Siswa berikut sudah memiliki tagihan pada periode ini (termasuk yang tercakup SPP semester/bulanan): ${names}`],      },
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
    // "namatagihan", "jenjang", dan "jenistagihan" di-SNAPSHOT ke
    // tagihan_siswa saat diterbitkan, persis seperti "jumlahtagihan".
    // Kalau Master Tagihan diedit belakangan, tagihan yang SUDAH
    // diterbitkan TIDAK ikut berubah.
    namatagihan: masterTagihan.namatagihan,
    jenjang: masterTagihan.jenjang,
    jenistagihan: masterTagihan.jenistagihan,
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

  await writeChangelog({
    supabase,
    namamenu: "Tagihan Siswa",
    jenisaksi: "TAMBAH",
    deskripsi: `Membuat ${siswaIds.length} tagihan "${masterTagihan.namatagihan}" untuk periode ${bulan}/${tahun}`,
  });

  revalidatePath("/admin/tagihan");

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