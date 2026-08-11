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
// FIX (multi-anak per wali): sejak `siswa.id` di-decouple dari
// `auth.users.id`, satu akun Wali Siswa (satu `wali_auth_id`) bisa
// menaungi LEBIH DARI SATU baris di tabel `siswa`. Untuk aksi yang
// menyentuh source "wali" (updateAkunWali, toggleAkunStatus, deleteAkun),
// `id` yang diterima dari form SEKARANG ADALAH `wali_auth_id`
// (= auth.users.id si wali), dan operasinya harus match SEMUA baris siswa
// dengan `wali_auth_id` tsb, bukan cuma satu baris `id`.
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
  id: z.string().min(1), // wali_auth_id
  email: z.string().email("Format email tidak valid"),
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

// Helper: deteksi pesan error "email sudah dipakai" dari Supabase Auth dan
// ubah jadi pesan yang ramah dibaca (dipakai untuk Wali Siswa & Bendahara).
function pesanErrorAuth(message: string): string {
  const isDuplicateEmail =
    message.toLowerCase().includes("already been registered") ||
    message.toLowerCase().includes("already registered") ||
    message.toLowerCase().includes("already exists");
  return isDuplicateEmail
    ? "Email ini sudah digunakan oleh akun lain. Silakan gunakan email yang berbeda."
    : message;
}

// ─── Ubah Email & Password akun Wali Siswa ──────────────────────────────────
// FIX (multi-anak per wali): dulu `.eq("id", id)` cukup karena 1 wali = 1
// baris siswa. Sekarang `id` = wali_auth_id, jadi update email di tabel
// `siswa` harus kena SEMUA baris anak milik wali ini sekaligus — pakai
// `.eq("wali_auth_id", id)` dan `.select()` tanpa `.maybeSingle()` karena
// baris yang ter-update bisa lebih dari satu.
export async function updateAkunWali(prevState: any, formData: FormData) {
  const parsed = updateAkunWaliSchema.safeParse({
    id: formData.get("id"),
    email: formData.get("email"),
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

  const { id, email, new_password } = parsed.data;
  const supabase = await createClient({ isAdmin: true });

  const authUpdate: { email?: string; password?: string } = { email };
  if (new_password) authUpdate.password = new_password;

  const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate);
  if (authError) {
    return {
      status: "error",
      errors: { _form: [pesanErrorAuth(authError.message)] },
    };
  }

  // FIX: sinkronkan kolom email di SEMUA baris siswa milik wali ini
  // (dulu 1 baris, sekarang bisa banyak).
  const { error: dbError, data: siswaRows } = await supabase
    .from("siswa")
    .update({ email, updatedat: new Date().toISOString() })
    .eq("wali_auth_id", id)
    .select("namasiswa");

  if (dbError) {
    return {
      status: "error",
      errors: { _form: [`Gagal update data: ${dbError.message}`] },
    };
  }

  const namaAnak = (siswaRows || []).map((s: any) => s.namasiswa).filter(Boolean).join(", ");

  await writeChangelog({
    supabase,
    namamenu: "Kelola Akun",
    jenisaksi: "UBAH",
    deskripsi: `Mengubah akun Wali Siswa (orang tua dari: ${namaAnak || id}) — email jadi ${email}${
      new_password ? ", password diganti" : ""
    }`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Aktifkan / nonaktifkan akun (Wali Siswa ATAU Bendahara) ─────────────────
// FIX (multi-anak per wali): untuk source "wali", `id` = wali_auth_id dan
// harus match kolom `wali_auth_id` di tabel `siswa` (bukan `id`) supaya
// SEMUA anak dari wali ini ikut ter-nonaktifkan/aktifkan sekaligus —
// sesuai keputusan: "is_active disinkron ke semua anak". Untuk source
// "bendahara" tidak berubah (tetap `.eq("id", id)` di tabel `admin`).
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
  // FIX: kolom pencocokan beda untuk wali (wali_auth_id, bisa banyak baris)
  // vs bendahara (id, selalu satu baris).
  const matchColumn = source === "wali" ? "wali_auth_id" : "id";

  const { error } = await supabase
    .from(table)
    .update({ is_active: newStatus, updatedat: new Date().toISOString() })
    .eq(matchColumn, id);

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
      source === "wali" ? "Wali Siswa (beserta semua anaknya)" : "Bendahara"
    } (id: ${id})`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Update akun Bendahara (tidak berubah) ─────────────────────────────────
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
      errors: { _form: [pesanErrorAuth(authError.message)] },
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
// FIX (multi-anak per wali): untuk source "wali", `id` = wali_auth_id.
// Menghapus akun wali harus menghapus SEMUA baris siswa yang menaunginya,
// bukan cuma satu. Baris siswa dihapus SECARA EKSPLISIT dulu (bukan
// mengandalkan ON DELETE CASCADE dari FK wali_auth_id -> auth.users),
// supaya tidak bergantung pada apakah cascade tsb benar-benar terpasang
// setelah migrasi decouple — cek ulang DDL constraint `wali_auth_id` di
// DB kamu untuk pastikan konsisten dengan asumsi ini.
export async function deleteAkun(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const source = formData.get("source") as "wali" | "bendahara";
  const namaAkun = (formData.get("nama_akun") as string) || "-";

  if (!id || !source) {
    return { status: "error", errors: { _form: ["Data tidak valid"] } };
  }

  const supabase = await createClient({ isAdmin: true });

  let namaAnakTerhapus: string[] = [];

  if (source === "wali") {
    const { data: siswaRows, error: fetchError } = await supabase
      .from("siswa")
      .select("id, namasiswa")
      .eq("wali_auth_id", id);

    if (fetchError) {
      return {
        status: "error",
        errors: { _form: [`Gagal mengambil data anak: ${fetchError.message}`] },
      };
    }

    namaAnakTerhapus = (siswaRows || []).map((s: any) => s.namasiswa || "-");

    if (siswaRows && siswaRows.length > 0) {
      // FIX: kalau ada anak yang masih punya tagihan/pembayaran (FK dari
      // tagihan_siswa/pembayaran/rekapan_* ke siswa.id), delete ini akan
      // gagal karena FK constraint — perilaku ini SAMA seperti sebelum
      // multi-anak (dulu juga bergantung pada cascade DB untuk tabel-
      // tabel turunan itu). UI sudah memblokir hapus kalau ada tagihan
      // yang SUDAH dibayar (hasPaidTagihan), tapi tagihan yang BELUM
      // dibayar tetap bisa menyebabkan FK violation di sini — kalau
      // proyek kamu punya helper "siswa-delete-guard" untuk pembersihan
      // ini, pertimbangkan dipanggil di sini juga per baris siswa,
      // bukan raw `.delete()`.
      const { error: deleteSiswaError } = await supabase
        .from("siswa")
        .delete()
        .eq("wali_auth_id", id);

      if (deleteSiswaError) {
        return {
          status: "error",
          errors: { _form: [`Gagal menghapus data siswa: ${deleteSiswaError.message}`] },
        };
      }
    }
  }

  // Hapus user dari Supabase Auth. Untuk source "bendahara", baris di
  // tabel `admin` ikut terhapus lewat ON DELETE CASCADE (pola lama, tidak
  // berubah — relasi admin.id -> auth.users.id tetap 1:1). Untuk source
  // "wali", baris siswa sudah dihapus eksplisit di atas, jadi di sini
  // tinggal hapus user Auth-nya saja.
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
    deskripsi:
      source === "wali"
        ? `Menghapus akun Wali Siswa: ${namaAkun}${
            namaAnakTerhapus.length > 0
              ? ` (beserta data anak: ${namaAnakTerhapus.join(", ")})`
              : ""
          }`
        : `Menghapus akun Bendahara: ${namaAkun}`,
  });

  revalidatePath("/superadmin/bendahara");
  return { status: "success" };
}

// ─── Create Bendahara (tidak berubah) ──────────────────────────────────────
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
      errors: { _form: [pesanErrorAuth(authError?.message || "Gagal membuat akun")] },
    };
  }

  const { error: dbError } = await supabase
    .from("admin")
    .upsert(
      {
        id: authData.user.id,
        nama,
        email,
        nohp: no_hp,
        updatedat: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

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