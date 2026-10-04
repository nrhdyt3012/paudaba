const BULAN_MAP: Record<string, number> = {
  Januari: 1, Februari: 2, Maret: 3, April: 4, Mei: 5, Juni: 6,
  Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12,
};

export function isTagihanSPP(nama?: string | null) {
  return !!nama?.trim().toUpperCase().startsWith("SPP");
}

// Daftar bulan yang dicakup sebuah tagihan.
export function getCakupanBulan(
  nama: string | null | undefined,
  bulan: number
): number[] {
  if (!isTagihanSPP(nama)) return [bulan];
  const n = (nama || "").toLowerCase();
  if (n.includes("semester ganjil")) return [7, 8, 9, 10, 11, 12];
  if (n.includes("semester genap")) return [1, 2, 3, 4, 5, 6];
  return [bulan];
}

// terdeteksi = true kalau bulan berhasil dibaca dari nama master
export function parsePeriodeDariNama(nama?: string | null) {
  const now = new Date();
  const fallback = {
    bulan: now.getMonth() + 1,
    tahun: now.getFullYear(),
    terdeteksi: false,
  };
  if (!nama) return fallback;

  const tahunMatch = nama.match(/(\d{4})/);
  const tahun = tahunMatch ? parseInt(tahunMatch[1]) : now.getFullYear();

  for (const [namaBulan, num] of Object.entries(BULAN_MAP)) {
    if (nama.includes(namaBulan)) return { bulan: num, tahun, terdeteksi: true };
  }
  if (nama.includes("Semester Ganjil")) return { bulan: 7, tahun, terdeteksi: true };
  if (nama.includes("Semester Genap")) return { bulan: 1, tahun, terdeteksi: true };
  return { ...fallback, tahun };
}

export function getTipeSiswaDariNama(
  nama?: string | null
): "reguler" | "subsidi" | "semua" {
  const n = (nama || "").toLowerCase();
  if (n.includes("subsidi")) return "subsidi"; // dicek dulu
  if (n.includes("reguler")) return "reguler";
  return "semua";
}