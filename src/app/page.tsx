// src/app/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const cookiesStore = await cookies();
  const userProfileCookie = cookiesStore.get("user_profile");

  let profile = { role: null };

  try {
    if (userProfileCookie?.value) {
      profile = JSON.parse(userProfileCookie.value);
    }
  } catch (error) {
    console.error("Error parsing user_profile cookie:", error);
  }

  // Redirect berdasarkan role
  if (profile.role === "admin" || profile.role === "kepala_sekolah") {
    redirect("/admin");
  } else if (profile.role === "siswa") {
    redirect("/siswa/info");
  }

  // Jika tidak ada role / belum login → ke beranda (halaman publik)
  redirect("/beranda");
}