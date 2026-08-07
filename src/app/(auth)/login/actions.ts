"use server";

import { INITIAL_STATE_LOGIN_FORM } from "@/constants/auth-constant";
import { createClient } from "@/lib/supabase/server";
import { AuthFormState } from "@/types/auth";
import { loginSchemaForm } from "@/validations/auth-validation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function login(
  prevState: AuthFormState,
  formData: FormData | null
) {
  if (!formData) return INITIAL_STATE_LOGIN_FORM;

  const validatedFields = loginSchemaForm.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      errors: {
        ...validatedFields.error.flatten().fieldErrors,
        _form: [],
      },
    };
  }

  try {
    const supabase = await createClient();

    const {
      error,
      data: { user },
    } = await supabase.auth.signInWithPassword(validatedFields.data);

if (error) {
  let message = error.message;

  if (error.message === "Invalid login credentials") {
    message = "Email atau password yang Anda masukkan salah.";
  }

  return {
    status: "error",
    errors: {
      _form: [message],
    },
  };
}
    if (!user) {
      return { status: "error", errors: { _form: ["User tidak ditemukan"] } };
    }

    const authSupabase = await createClient();

    // ── Cek tabel superadmin (prioritas tertinggi) ──────────────────────────
    const { data: superadminData } = await authSupabase
      .from("superadmin")
      .select("id, nama")
      .eq("id", user.id)
      .maybeSingle();

    // ── Cek tabel admin / bendahara ─────────────────────────────────────────
    const { data: adminData } = await authSupabase
      .from("admin")
      .select("id, nama, is_active")
      .eq("id", user.id)
      .maybeSingle();

// ── Cek tabel siswa — sekarang bisa MENGEMBALIKAN LEBIH DARI 1 BARIS
// (satu wali/auth account bisa menaungi beberapa anak) ────────────────────
const { data: siswaRows } = await authSupabase
  .from("siswa")
  .select("id, namasiswa, avatarurl, kelas, nis, is_active, namawali")
  .eq("wali_auth_id", user.id);

let profile = null;

if (superadminData) {
  profile = {
    id: superadminData.id,
    name: superadminData.nama,
    role: "superadmin" as const,
    avatar_url: null,
  };
} else if (adminData) {
  profile = {
    id: adminData.id,
    name: adminData.nama,
    role: "admin" as const,
    avatar_url: null,
  };
} else if (siswaRows && siswaRows.length > 0) {
  // Hanya anak yang masih aktif yang ditampilkan/boleh dipilih.
  // Kalau SEMUA anak nonaktif, baru login ditolak (lihat isDeactivated di bawah).
  const anakAktif = siswaRows.filter((s: any) => s.is_active !== false);

  profile = {
    id: user.id, // ID akun WALI (auth.users) — bukan id siswa
    name: siswaRows[0].namawali || anakAktif[0]?.namasiswa || "Wali Siswa",
    role: "siswa" as const,
    avatar_url: anakAktif[0]?.avatarurl ?? null,
    children: anakAktif.map((s: any) => ({
      id: s.id,
      namaSiswa: s.namasiswa,
      kelas: s.kelas,
      NIS: s.nis,
      avatar_url: s.avatarurl,
    })),
    // Kalau anak cuma 1 → langsung aktifkan. Kalau >1 → biarkan null,
    // nanti dipilih dulu di halaman /siswa/pilih-anak.
    activeSiswaId: anakAktif.length === 1 ? anakAktif[0].id : null,
  };
} else {
  await supabase.auth.signOut();
  return {
    status: "error",
    errors: { _form: ["Profil pengguna tidak ditemukan. Hubungi administrator."] },
  };
}

// FIX: cek status aktif/nonaktif.
// - Bendahara (admin): tetap dicek dari adminData.is_active seperti sebelumnya.
// - Wali siswa: dianggap nonaktif hanya kalau SEMUA anaknya nonaktif
//   (bukan tabel wali terpisah, jadi statusnya diturunkan dari anak-anaknya).
const isDeactivated =
  (adminData && adminData.is_active === false) ||
  (profile?.role === "siswa" && (!profile.children || profile.children.length === 0));

if (isDeactivated) {
  await supabase.auth.signOut();
  return {
    status: "error",
    errors: {
      _form: ["Akun Anda telah dinonaktifkan. Hubungi admin/superadmin sekolah untuk bantuan."],
    },
  };
}

const cookiesStore = await cookies();
cookiesStore.set("user_profile", JSON.stringify(profile), {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
});

revalidatePath("/", "layout");

const redirectUrl =
  profile.role === "superadmin"
    ? "/superadmin"
    : profile.role === "admin"
    ? "/admin"
    : profile.role === "siswa" && !profile.activeSiswaId
    ? "/siswa/pilih-anak" // anak >1 dan belum dipilih
    : "/siswa/info";

return { status: "success", data: { profile, redirectUrl } };

  } catch (error: any) {
    return {
      status: "error",
      errors: { _form: [error.message || "Terjadi kesalahan saat login"] },
    };
  }
}