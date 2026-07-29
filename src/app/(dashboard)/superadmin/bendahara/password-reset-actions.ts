"use server";

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { getWhatsAppNotificationService } from "@/lib/fonnte/whatsapp-sender";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ════════════════════════════════════════════════════════════════════════
// FIX (fitur lupa password): dua aksi untuk superadmin di halaman Kelola
// Akun, dipakai dari panel "Permintaan Reset Password":
//
//   1. kirimKonfirmasiWA  — kirim WA ke pemilik akun menanyakan apakah
//      benar dia yang mengajukan. Ini OPSIONAL (superadmin boleh langsung
//      ke aksi #2 kalau sudah yakin) — WA cuma terkirim kalau tombol ini
//      benar-benar diklik, supaya kuota Fonnte tidak terbuang untuk
//      request iseng/spam yang tidak pernah disentuh.
//
//   2. simpanPasswordBaru — set password baru untuk akun terkait (lewat
//      Supabase Auth, pola sama seperti updateAkunWali/updateAkunBendahara
//      di actions.ts), tandai request sebagai "resolved", lalu kirim WA
//      berisi password barunya.
// ════════════════════════════════════════════════════════════════════════

async function ambilRequest(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("password_reset_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as {
    id: string;
    email: string;
    account_id: string | null;
    account_role: "admin" | "siswa" | null;
    account_name: string | null;
    account_phone: string | null;
    status: "pending" | "resolved";
  };
}

// ─── Kirim WA konfirmasi permintaan ─────────────────────────────────────────
export async function kirimKonfirmasiWA(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { status: "error", message: "Data tidak valid." };

  const supabase = await createClient({ isAdmin: true });
  const request = await ambilRequest(supabase, id);

  if (!request) {
    return { status: "error", message: "Permintaan tidak ditemukan." };
  }

  if (!request.account_phone) {
    return {
      status: "error",
      message: "Nomor WhatsApp akun ini tidak terdaftar di sistem.",
    };
  }

  const waService = getWhatsAppNotificationService();
  const result = await waService.sendNotification({
    recipientPhone: request.account_phone,
    messageType: "PASSWORD_RESET_CONFIRM",
    recipientName: request.account_name || request.email,
    studentName: request.account_name || request.email,
    data: {},
  });

  if (!result.success) {
    return {
      status: "error",
      message: `Gagal mengirim WA: ${result.error || "unknown error"}`,
    };
  }

  await supabase
    .from("password_reset_requests")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", id);

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "UBAH",
    deskripsi: `Mengirim konfirmasi WA permintaan reset password: ${request.email}`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Simpan password baru & selesaikan permintaan ──────────────────────────
const simpanPasswordBaruSchema = z.object({
  id: z.string().min(1),
  password_baru: z.string().min(6, "Password baru minimal 6 karakter"),
});

export async function simpanPasswordBaru(prevState: any, formData: FormData) {
  const parsed = simpanPasswordBaruSchema.safeParse({
    id: formData.get("id"),
    password_baru: formData.get("password_baru"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
      .join(" | ");
    return { status: "error", message: errorMessages || "Validasi gagal." };
  }

  const { id, password_baru } = parsed.data;
  const supabase = await createClient({ isAdmin: true });
  const request = await ambilRequest(supabase, id);

  if (!request) {
    return { status: "error", message: "Permintaan tidak ditemukan." };
  }

  if (!request.account_id) {
    return {
      status: "error",
      message: "Akun terkait permintaan ini tidak ditemukan (mungkin sudah dihapus).",
    };
  }

  // Set password baru lewat Supabase Auth — sama seperti pola di
  // updateAkunWali / updateAkunBendahara (actions.ts).
  const { error: authError } = await supabase.auth.admin.updateUserById(
    request.account_id,
    { password: password_baru }
  );

  if (authError) {
    return { status: "error", message: `Gagal mengubah password: ${authError.message}` };
  }

  const { error: updateError } = await supabase
    .from("password_reset_requests")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("[simpanPasswordBaru] Gagal update status request:", updateError.message);
  }

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "UBAH",
    deskripsi: `Mereset password akun ${
      request.account_role === "admin" ? "Bendahara" : "Wali Siswa"
    }: ${request.account_name || request.email} (via permintaan lupa password)`,
  });

  // Kirim WA berisi password baru — kalau nomor tidak ada / gagal
  // terkirim, tetap anggap operasi utama (ganti password) SUKSES; cuma
  // beri pesan tambahan supaya superadmin tahu WA-nya gagal.
  if (request.account_phone) {
    const waService = getWhatsAppNotificationService();
    const waResult = await waService.sendNotification({
      recipientPhone: request.account_phone,
      messageType: "PASSWORD_RESET_DONE",
      recipientName: request.account_name || request.email,
      studentName: request.account_name || request.email,
      data: { passwordBaru: password_baru },
    });

    revalidatePath("/superadmin/bendahara");

    if (!waResult.success) {
      return {
        status: "success",
        message: `Password berhasil diubah, tetapi WA gagal terkirim: ${waResult.error}`,
      };
    }
  } else {
    revalidatePath("/superadmin/bendahara");
  }

  return { status: "success" };
}
