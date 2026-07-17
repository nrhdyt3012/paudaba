// src/middleware.ts
import { environment } from "./configs/environtment";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function getUserRole(request: NextRequest): string | null {
  const profileCookie = request.cookies.get("user_profile")?.value;
  if (!profileCookie) return null;
  try {
    const profile = JSON.parse(profileCookie);
    return profile.role || null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;

  // ✅ Bypass semua API route yang dipanggil server-to-server (tanpa cookie user)
  const isPublicApiRoute =
    pathname.startsWith("/api/payment/") ||
    pathname.startsWith("/api/send-receipt") ||
    pathname.startsWith("/api/notifications/");

  if (isPublicApiRoute) {
    return NextResponse.next();
  }

  const supabase = createServerClient(
    environment.SUPABASE_URL!,
    environment.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");

  const isSeoFile =
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap-0.xml";

  if (isSeoFile) {
    return supabaseResponse;
  }

  const publicPages = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/beranda",
    "/profil",
    "/fasilitas",
    "/info-sekolah",
    "/kontak",
    "/ppdb",
    "/berita",
    "/sitemap.xml",
    "/robots.txt",
    "/siswa/payment",
    "/kwitansi",
  ];

  const isPublicPage =
    pathname === "/" ||
    publicPages.some(
      (page) => pathname === page || pathname.startsWith(page + "/")
    );

  // ── FIX UTAMA: Jika session Supabase expired/null → bersihkan user_profile ──
  // Ini mencegah user stuck di beranda karena user_profile cookie masih ada
  // padahal session Supabase sudah mati.
  if (!user) {
    const hasProfileCookie = request.cookies.has("user_profile");

    if (hasProfileCookie) {
      // Tentukan response dulu (redirect ke login atau lanjut ke public page)
      let response: NextResponse;

      if (isPublicPage || isAuthPage) {
        // Tetap biarkan akses ke halaman publik, tapi hapus cookie stale
        response = NextResponse.next({ request });
      } else {
        // Redirect ke login untuk halaman protected
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        response = NextResponse.redirect(url);
      }

      // Hapus user_profile yang sudah tidak valid
      response.cookies.delete("user_profile");

      // Hapus juga semua cookie Supabase auth yang expired
      // (nama cookie Supabase mengandung "-auth-token")
      request.cookies.getAll().forEach(({ name }) => {
        if (name.includes("-auth-token") || name.includes("sb-")) {
          response.cookies.delete(name);
        }
      });

      return response;
    }
  }

  // API routes privat → wajib login
  if (isApiRoute) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return supabaseResponse;
  }

  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const userRole = getUserRole(request);

    if (userRole) {
      // Role diketahui dengan pasti dari cookie — user memang masih login
      // sah, langsung ke dashboard sesuai role-nya (tidak lewat "/" lagi,
      // supaya tidak ada hop tambahan yang berpotensi nyangkut).
      const url = request.nextUrl.clone();
      url.pathname =
        userRole === "superadmin"
          ? "/superadmin"
          : userRole === "admin"
          ? "/admin"
          : "/siswa/info";
      return NextResponse.redirect(url);
    }

    // FIX BUG "stuck di beranda tiap klik Login": Supabase auth token masih
    // dianggap valid (`user` ada), TAPI cookie `user_profile` (custom,
    // nyimpan role) sudah hilang/tidak sinkron. Kalau dibiarkan redirect ke
    // "/", root page juga akan gagal menemukan role dan melempar balik ke
    // "/beranda" — user jadi TIDAK PERNAH bisa mencapai halaman login lagi
    // selama Supabase masih menganggap sesi itu valid. Solusinya: paksa
    // logout total di sini (hapus semua cookie Supabase + user_profile)
    // supaya state-nya bersih, baru izinkan lanjut ke halaman login.
    const response = NextResponse.next({ request });
    await supabase.auth.signOut();
    response.cookies.delete("user_profile");
    request.cookies.getAll().forEach(({ name }) => {
      if (name.includes("-auth-token") || name.includes("sb-")) {
        response.cookies.delete(name);
      }
    });
    return response;
  }

  // ✅ ROLE-BASED ROUTE PROTECTION
  const userRole = getUserRole(request);

  if (pathname.startsWith("/superadmin")) {
    if (userRole !== "superadmin") {
      const url = request.nextUrl.clone();
      url.pathname = userRole ? "/" : "/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/admin")) {
    if (userRole !== "admin" && userRole !== "superadmin") {
      const url = request.nextUrl.clone();
      url.pathname = userRole === "siswa" ? "/siswa/info" : "/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/siswa")) {
    if (userRole !== "siswa") {
      const url = request.nextUrl.clone();
      url.pathname =
        userRole === "admin" || userRole === "superadmin" ? "/admin" : "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};