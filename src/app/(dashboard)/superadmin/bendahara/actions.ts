"use server";

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ════════════════════════════════════════════════════════════════════════
// FIX (Kelola Akun): halaman ini sekarang mengelola 2 jenis akun sekaligus
// — Wali Siswa (baris di tabel `siswa`) dan Bendahara (baris di tabel
// `admin`). Keduanya sama-sama akun Supabase Auth, jadi update email &
// reset password memakai `supabase.auth.admin.updateUserById`, sama
// seperti pola yang sudah ada sebelumnya di halaman "Kelola Bendahara".
//
// PENTING soal PASSWORD: Supabase Auth (seperti semua sistem auth yang
// benar) TIDAK PERNAH menyimpan password asli — hanya hash satu-arah
// (bcrypt) yang tidak bisa dibalik jadi teks asli. Jadi password yang
// SUDAH ADA tidak mungkin "dilihat" oleh siapa pun, termasuk superadmin.
// Yang bisa dilakukan cuma RESET (set password baru), bukan lihat yang
// lama. Kolom "Password" di tabel & dialog edit dibuat mengikuti batasan
// ini — lihat komentar di komponen bendahara.tsx.
// ════════════════════════════════════════════════════════════════════════

const updateAkunWaliSchema = z.object({
  id: z.string().min(1),
  // FIX: Nama Akun untuk akun siswa sekarang mengedit `namasiswa` (nama
  // anak), BUKAN `namawali` (nama orang tua) — konsisten dengan halaman
  // Info Siswa (pojok kiri bawah sidebar) yang juga pakai nama anak.
  nama_siswa: z.string().min(1, "Nama siswa wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  no_wa: z.string().min(1, "Nomor WhatsApp wajib diisi"),
  new_password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 6, "Password baru minimal 6 karakter"),
});

const updateAkunBendaharaSchema = z.object({
  id: z.string().min(1),
  nama: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  no_hp: z.string().min(1, "Nomor telepon wajib diisi"),
  new_password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 6, "Password baru minimal 6 karakter"),
});

// ─── Update akun Wali Siswa ────────────────────────────────────────────────
export async function updateAkunWali(prevState: any, formData: FormData) {
  const parsed = updateAkunWaliSchema.safeParse({
    id: formData.get("id"),
    nama_siswa: formData.get("nama_siswa"),
    email: formData.get("email"),
    no_wa: formData.get("no_wa"),
    new_password: formData.get("new_password") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
      .join(" | ");
    return {
      status: "error",
      errors: { ...fieldErrors, _form: [errorMessages || "Validasi form gagal"] },
    };
  }

  const { id, nama_siswa, email, no_wa, new_password } = parsed.data;
  const supabase = await createClient({ isAdmin: true });

  // Update email/password di Supabase Auth kalau ada perubahan
  const authUpdate: { email?: string; password?: string } = {};
  authUpdate.email = email;
  if (new_password) authUpdate.password = new_password;

  const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate);
  if (authError) {
    return {
      status: "error",
      errors: { _form: [`Gagal update akun: ${authError.message}`] },
    };
  }

  const { error: dbError } = await supabase
    .from("siswa")
    .update({
      namasiswa: nama_siswa,
      email,
      nowa: no_wa,
      updatedat: new Date().toISOString(),
    })
    .eq("id", id);

  if (dbError) {
    return {
      status: "error",
      errors: { _form: [`Gagal update data: ${dbError.message}`] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "UBAH",
    deskripsi: `Mengubah akun Wali Siswa: ${nama_siswa} (${email})${
      new_password ? " — password diganti" : ""
    }`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Update akun Bendahara ─────────────────────────────────────────────────
export async function updateAkunBendahara(prevState: any, formData: FormData) {
  const parsed = updateAkunBendaharaSchema.safeParse({
    id: formData.get("id"),
    nama: formData.get("nama"),
    email: formData.get("email"),
    no_hp: formData.get("no_hp"),
    new_password: formData.get("new_password") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
      .join(" | ");
    return {
      status: "error",
      errors: { ...fieldErrors, _form: [errorMessages || "Validasi form gagal"] },
    };
  }

  const { id, nama, email, no_hp, new_password } = parsed.data;
  const supabase = await createClient({ isAdmin: true });

  const authUpdate: { email?: string; password?: string } = { email };
  if (new_password) authUpdate.password = new_password;

  const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate);
  if (authError) {
    return {
      status: "error",
      errors: { _form: [`Gagal update akun: ${authError.message}`] },
    };
  }

  const { error: dbError } = await supabase
    .from("admin")
    .update({
      nama,
      email,
      nohp: no_hp,
      updatedat: new Date().toISOString(),
    })
    .eq("id", id);

  if (dbError) {
    return {
      status: "error",
      errors: { _form: [`Gagal update data: ${dbError.message}`] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "UBAH",
    deskripsi: `Mengubah akun Bendahara: ${nama} (${email})${
      new_password ? " — password diganti" : ""
    }`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Hapus akun (Wali Siswa ATAU Bendahara) ────────────────────────────────
export async function deleteAkun(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const source = formData.get("source") as "wali" | "bendahara";
  const namaAkun = (formData.get("nama_akun") as string) || "-";

  if (!id || !source) {
    return { status: "error", errors: { _form: ["Data tidak valid"] } };
  }

  const supabase = await createClient({ isAdmin: true });

  // Hapus user dari Supabase Auth — baris di tabel `siswa`/`admin` akan
  // ikut terhapus lewat ON DELETE CASCADE (pola yang sama seperti
  // deleteUser/deleteBendahara sebelumnya).
  const { error: authError } = await supabase.auth.admin.deleteUser(id);
  if (authError) {
    return {
      status: "error",
      errors: { _form: [`Gagal menghapus akun: ${authError.message}`] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "HAPUS",
    deskripsi: `Menghapus akun ${source === "wali" ? "Wali Siswa" : "Bendahara"}: ${namaAkun}`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Create Bendahara (dipertahankan — akun Wali Siswa dibuat lewat
//     halaman "Data Siswa" karena butuh field spesifik siswa seperti
//     NIS/kelas/angkatan, tidak cocok dibuat dari sini) ────────────────────
const createBendaharaSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  no_hp: z.string().min(1, "Nomor telepon wajib diisi"),
});

export async function createBendahara(prevState: any, formData: FormData) {
  const parsed = createBendaharaSchema.safeParse({
    nama: formData.get("nama"),
    email: formData.get("email"),
    password: formData.get("password"),
    no_hp: formData.get("no_hp"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
      .join(" | ");
    return {
      status: "error",
      errors: { ...fieldErrors, _form: [errorMessages || "Validasi form gagal"] },
    };
  }

  const { nama, email, password, no_hp } = parsed.data;
  const supabase = await createClient({ isAdmin: true });

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin", nama },
  });

  if (authError || !authData.user) {
    return {
      status: "error",
      errors: { _form: [`Gagal membuat akun: ${authError?.message}`] },
    };
  }

  const { error: dbError } = await supabase.from("admin").insert({
    id: authData.user.id,
    nama,
    email,
    nohp: no_hp,
  });

  if (dbError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return {
      status: "error",
      errors: { _form: [`Gagal menyimpan data: ${dbError.message}`] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "TAMBAH",
    deskripsi: `Menambahkan akun Bendahara baru: ${nama} (${email})`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}
