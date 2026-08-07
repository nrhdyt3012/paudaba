"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function pilihAnakAktif(siswaId: string) {
  const cookiesStore = await cookies();
  const profileCookie = cookiesStore.get("user_profile")?.value;

  if (!profileCookie) {
    return { status: "error", message: "Sesi tidak ditemukan, silakan login ulang." };
  }

  const profile = JSON.parse(profileCookie);

  // Pastikan siswaId yang dipilih memang anak dari wali yang sedang login
  const anakValid = profile.children?.some((c: any) => c.id === siswaId);
  if (!anakValid) {
    return { status: "error", message: "Data siswa tidak ditemukan pada akun ini." };
  }

  profile.activeSiswaId = siswaId;

  cookiesStore.set("user_profile", JSON.stringify(profile), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  revalidatePath("/", "layout");
  return { status: "success" };
}