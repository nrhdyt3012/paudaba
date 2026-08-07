// src/hooks/use-active-siswa-id.ts
"use client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * ID siswa (bukan ID wali) yang sedang aktif dilihat.
 * Hanya valid dipakai di halaman-halaman siswa (info, tagihan, riwayat).
 */
export function useActiveSiswaId() {
  return useAuthStore((state) => state.profile.activeSiswaId);
}