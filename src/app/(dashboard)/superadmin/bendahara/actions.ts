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

// FIX (arahan dosen pembimbing): untuk akun Wali Siswa, superadmin di
// halaman Kelola Akun HANYA boleh mengganti password — edit nama/email/no
// WA tetap lewat menu Data Siswa (satu-satunya sumber kebenaran untuk data
// itu). Jadi `updateAkunWali` (full edit) diganti jadi `changePasswordWali`
// yang cuma menerima `id` + `new_password`.
const changePasswordWaliSchema = z.object({
  id: z.string().min(1),
  new_password: z.string().min(6, "Password baru minimal 6 karakter"),
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

// ─── Ganti password akun Wali Siswa (satu-satunya aksi edit yang tersedia
//     untuk role ini di halaman Kelola Akun) ────────────────────────────────
export async function changePasswordWali(prevState: any, formData: FormData) {
  const parsed = changePasswordWaliSchema.safeParse({
    id: formData.get("id"),
    new_password: formData.get("new_password"),
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

  const { id, new_password } = parsed.data;
  const supabase = await createClient({ isAdmin: true });

  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    password: new_password,
  });
  if (authError) {
    return {
      status: "error",
      errors: { _form: [`Gagal mengganti password: ${authError.message}`] },
    };
  }

  const { data: siswaRow } = await supabase
    .from("siswa")
    .select("namasiswa")
    .eq("id", id)
    .maybeSingle();

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "UBAH",
    deskripsi: `Mengganti password akun Wali Siswa: ${siswaRow?.namasiswa || id}`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Aktifkan / nonaktifkan akun (Wali Siswa ATAU Bendahara) ─────────────────
// FIX (arahan dosen pembimbing, disebut "Ubah Hak Akses" di UI): superadmin
// bisa menonaktifkan akun tanpa menghapusnya secara permanen. Akun yang
// dinonaktifkan tetap ada datanya, tapi ditolak saat mencoba login (lihat
// pengecekan `is_active` di src/app/(auth)/login/actions.ts).
const toggleAkunStatusSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["wali", "bendahara"]),
  is_active: z.enum(["true", "false"]),
});

export async function toggleAkunStatus(prevState: any, formData: FormData) {
  const parsed = toggleAkunStatusSchema.safeParse({
    id: formData.get("id"),
    source: formData.get("source"),
    is_active: formData.get("is_active"),
  });

  if (!parsed.success) {
    return { status: "error", errors: { _form: ["Data tidak valid"] } };
  }

  const { id, source, is_active } = parsed.data;
  const newStatus = is_active === "true";
  const supabase = await createClient({ isAdmin: true });

  const table = source === "wali" ? "siswa" : "admin";
  const { error } = await supabase
    .from(table)
    .update({ is_active: newStatus, updatedat: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      errors: { _form: [`Gagal mengubah status akun: ${error.message}`] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "UBAH",
    deskripsi: `${newStatus ? "Mengaktifkan kembali" : "Menonaktifkan"} akun ${
      source === "wali" ? "Wali Siswa" : "Bendahara"
    } (id: ${id})`,
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
