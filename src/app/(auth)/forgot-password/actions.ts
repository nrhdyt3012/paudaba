"use server";

import { createClient } from "@/lib/supabase/server";

export type AjukanResetPasswordState = {
  status?: "success" | "error";
  message?: string;
};

// ════════════════════════════════════════════════════════════════════════
// FIX (fitur lupa password): server action lama (sendResetPasswordEmail,
// pakai supabase.auth.resetPasswordForEmail) DIGANTI TOTAL. Sekarang alurnya:
//
//   1. User (bendahara ATAU wali siswa) kirim email lewat form publik ini.
//   2. Kalau email cocok dengan salah satu akun (tabel admin/siswa), sistem
//      insert 1 baris ke `password_reset_requests` (status "pending") —
//      TANPA mengirim WA apa pun di titik ini (supaya kuota Fonnte tidak
//      terpakai untuk submit iseng/spam).
//   3. Superadmin melihat & memproses request ini dari halaman Kelola Akun
//      (lihat password-reset-actions.ts di folder superadmin/bendahara).
//
// Pesan yang dikembalikan ke user SELALU generik, baik email terdaftar
// maupun tidak — supaya form ini tidak bisa dipakai untuk menebak email
// mana saja yang punya akun di sistem (email enumeration).
// ════════════════════════════════════════════════════════════════════════

const GENERIC_MESSAGE =
  "Jika email tersebut terdaftar di sistem kami, permintaan reset password Anda telah kami terima dan akan segera diproses oleh admin sekolah.";

export async function ajukanResetPassword(
  prevState: AjukanResetPasswordState,
  formData: FormData
): Promise<AjukanResetPasswordState> {
  const email = (formData.get("email") as string || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Masukkan alamat email yang valid." };
  }

  // Pakai service role — form ini publik/belum login, jadi butuh akses
  // baca tabel admin/siswa & tulis ke password_reset_requests tanpa RLS.
  const supabase = await createClient({ isAdmin: true });

  const [{ data: adminRow }, { data: siswaRow }] = await Promise.all([
    supabase
      .from("admin")
      .select("id, nama, nohp, is_active")
      .eq("email", email)
      .maybeSingle(),
    supabase
      .from("siswa")
      .select("id, namasiswa, namawali, nowa, is_active")
      .eq("email", email)
      .maybeSingle(),
  ]);

  // Email tidak ditemukan di akun manapun — tetap balas pesan generik,
  // jangan insert apa pun.
  if (!adminRow && !siswaRow) {
    return { status: "success", message: GENERIC_MESSAGE };
  }

  const account = adminRow
    ? {
        id: adminRow.id as string,
        role: "admin" as const,
        name: (adminRow.nama as string) || null,
        phone: (adminRow.nohp as string) || null,
      }
    : {
        id: siswaRow!.id as string,
        role: "siswa" as const,
        namasiswa: (siswaRow!.namasiswa as string) || null,
        phone: (siswaRow!.nowa as string) || null,
      };

  const { error: insertError } = await supabase
    .from("password_reset_requests")
    .insert({
      email,
      account_id: account.id,
      account_role: account.role,
      account_name: account.name,
      account_phone: account.phone,
    });

  if (insertError) {
    // Kode 23505 = unique violation → sudah ada request PENDING untuk
    // email ini (lihat index unik di sql/password_reset_requests.sql).
    // Ini BUKAN error dari sudut pandang user — cukup anggap permintaan
    // sudah tercatat, jangan buat baris duplikat.
    if (insertError.code !== "23505") {
      console.error("[ajukanResetPassword] Insert error:", insertError.message);
    }
  }

  return { status: "success", message: GENERIC_MESSAGE };
}
