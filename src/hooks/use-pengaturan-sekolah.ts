"use client";

// src/lib/hooks/use-pengaturan-sekolah.ts
//
// SATU-SATUNYA sumber query untuk queryKey ["pengaturan-sekolah"].
// Dipakai di: app-sidebar.tsx, rekapan-pembayaran, riwayat-pembayaran.
// JANGAN bikin useQuery lain dengan queryKey yang sama tapi bentuk
// data berbeda — itu penyebab bug kwitansi/sidebar saling menimpa cache
// (kadang nampilin "-", kadang benar, tergantung siapa yang fetch duluan).
//
// Kalau ada halaman lain yang butuh field mentah tambahan (updatedat,
// updated_by, dll — misal form Edit Profil Sekolah), pakai queryKey BEDA:
// ["pengaturan-sekolah-raw"] lewat fetchPengaturanSekolah() di
// lib/pengaturan-sekolah.ts, JANGAN pakai key ini.

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SekolahInfo } from "@/components/common/kwitansi-template";

export function usePengaturanSekolah() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["pengaturan-sekolah"],
    queryFn: async (): Promise<SekolahInfo | null> => {
      const { data, error } = await supabase
        .from("pengaturan_sekolah")
        .select(
          "nama_sekolah, alamat_sekolah, logo_url, nama_bendahara, tanda_tangan_bendahara_url"
        )
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.error("Gagal memuat pengaturan_sekolah:", error.message);
        return null;
      }
      if (!data) return null;

      return {
        namaSekolah: data.nama_sekolah,
        alamatSekolah: data.alamat_sekolah,
        logoUrl: data.logo_url,
        namaBendahara: data.nama_bendahara,
        tandaTanganUrl: data.tanda_tangan_bendahara_url,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 menit — data jarang berubah
  });
}