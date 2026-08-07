// lib/pengaturan-sekolah.ts
// Helper untuk membaca & menyimpan profil sekolah (dipakai dashboard + kwitansi/laporan)

import { createClient } from "@/lib/supabase/client";

export interface PengaturanSekolah {
  id: number;
  nama_sekolah: string;
  alamat_sekolah: string;
  logo_url: string | null;
  nama_bendahara: string;
  tanda_tangan_bendahara_url: string | null;
  updatedat: string;
}

const DEFAULT_PENGATURAN: PengaturanSekolah = {
  id: 1,
  nama_sekolah: "KB TK AISYIYAH BUSTANUL ATHFAL 1",
  alamat_sekolah: "BUDURAN — SIDOARJO",
  logo_url: null,
  nama_bendahara: "Sri Wahyuni",
  tanda_tangan_bendahara_url: null,
  updatedat: new Date().toISOString(),
};

// Dipakai di client component (React Query)
export async function fetchPengaturanSekolah(): Promise<PengaturanSekolah> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pengaturan_sekolah")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    console.error("[pengaturan-sekolah] gagal memuat, pakai default:", error);
    return DEFAULT_PENGATURAN;
  }
  return data as PengaturanSekolah;
}

export interface UpdatePengaturanInput {
  nama_sekolah: string;
  alamat_sekolah: string;
  nama_bendahara: string;
  logo_url?: string | null;
  tanda_tangan_bendahara_url?: string | null;
}

export async function updatePengaturanSekolah(input: UpdatePengaturanInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pengaturan_sekolah")
    .update({ ...input, updatedat: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;
  return data as PengaturanSekolah;
}

// Upload logo atau tanda tangan ke bucket "sekolah-assets".
// `folder` membedakan "logo" vs "tanda-tangan" supaya nama file tidak bentrok.
export async function uploadSekolahAsset(file: File, folder: "logo" | "tanda-tangan") {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${folder}/${folder}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("sekolah-assets")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from("sekolah-assets")
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
}

// Dipakai di server (route handler / server action) yang generate PDF kwitansi,
// jika di sana kamu pakai supabase server client alih-alih client biasa.
// Cukup ganti `createClient` di atas dengan versi server saat dipanggil dari situ.