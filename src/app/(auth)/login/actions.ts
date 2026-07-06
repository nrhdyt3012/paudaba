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
      .select("id, nama")
      .eq("id", user.id)
      .maybeSingle();

    // ── Cek tabel siswa ─────────────────────────────────────────────────────
    const { data: siswaData } = await authSupabase
      .from("siswa")
      .select("id, namasiswa, avatarurl, kelas, nis")
      .eq("id", user.id)
      .maybeSingle();

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
    } else if (siswaData) {
      profile = {
        id: siswaData.id,
        name: siswaData.namasiswa,
        role: "siswa" as const,
        avatar_url: siswaData.avatarurl,
        kelas: siswaData.kelas,
        NIS: siswaData.nis,
      };
    } else {
      // PENTING: sign out dari Supabase Auth supaya session tidak nyangkut
      // di browser ketika profil tidak ditemukan di tabel manapun.
      // Tanpa ini, cookie sb-*-auth-token tetap tersimpan walau login
      // dianggap gagal, sehingga user harus hapus cookie manual.
      await supabase.auth.signOut();

      return {
        status: "error",
        errors: {
          _form: ["Profil pengguna tidak ditemukan. Hubungi administrator."],
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

    // ── Redirect berdasarkan role ────────────────────────────────────────────
    const redirectUrl =
      profile.role === "superadmin"
        ? "/superadmin"
        : profile.role === "admin"
        ? "/admin"
        : "/siswa/info";

    return { status: "success", data: { profile, redirectUrl } };
  } catch (error: any) {
    return {
      status: "error",
      errors: { _form: [error.message || "Terjadi kesalahan saat login"] },
    };
  }
}