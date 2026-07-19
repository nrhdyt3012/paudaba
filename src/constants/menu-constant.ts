// src/constants/menu-constant.ts
// FIX: kolom "Jenis Tagihan" dihapus dari tabel — sudah otomatis "terbaca"
// lewat Nama Tagihan yang di-generate (mis. "SPP Bulanan TK A ... Reguler"
// sudah menyebutkan jenisnya di dalam namanya sendiri), jadi kolom
// terpisah untuk itu redundan. Kolom "Keterangan" ditambahkan (sebelumnya
// datanya ada tapi cuma nongol sebagai subtext kecil di bawah nama, sekarang
// jadi kolom sendiri biar jelas kebaca).
export const HEADER_TABLE_MENU = [
  "No",
  "Nama Tagihan",
  "Jenjang",
  "Nominal",
  "Keterangan",
  "Action",
];

export const INITIAL_MENU = {
  jenisTagihan: "",
  // Daftar Ulang fields
  semesterDaftarUlang: "",
  tahunDaftarUlang: "",
  // SPP fields
  tipeSPP: "",           // "Bulanan" | "Semesteran"
  bulanSPP: "",          // only for Bulanan
  tahunSPP: "",
  semesterSPP: "",       // only for Semesteran
  // Common fields
  jenjang: "",
  nominal: "",
  description: "",
};

export const INITIAL_STATE_MENU = {
  status: "idle",
  errors: {
    id: [],
    namaTagihan: [],
    jenjang: [],
    jenisTagihan: [],
    nominal: [],
    description: [],
    _form: [],
  },
};

export const JENJANG_LIST = [
  { value: "KB", label: "Kelompok Bermain (KB)" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

// Jenis tagihan utama (pilihan pertama di form)
export const JENIS_TAGIHAN_LIST = [
  { value: "PPDB", label: "PPDB" },
  { value: "Daftar Ulang", label: "Daftar Ulang" },
  { value: "SPP Reguler", label: "SPP Reguler" },
  { value: "SPP Subsidi", label: "SPP Subsidi" },
];

export const SEMESTER_LIST = [
  { value: "Ganjil", label: "Semester Ganjil" },
  { value: "Genap", label: "Semester Genap" },
];

export const TIPE_SPP_LIST = [
  { value: "Bulanan", label: "SPP Bulanan" },
  { value: "Semesteran", label: "SPP Semesteran (1 semester)" },
];

export const BULAN_LIST = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

// Generate daftar tahun (5 tahun ke belakang s.d. 5 tahun ke depan)
export const TAHUN_LIST = (() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, i) => {
    const y = (currentYear - 5 + i).toString();
    return { value: y, label: y };
  });
})();

/**
 * Generate namatagihan otomatis berdasarkan pilihan form.
 * Juga return jenistagihan yang akan disimpan ke DB (kolom jenistagihan = "Reguler" | "Subsidi").
 */
export function generateNamaTagihan(values: {
  jenisTagihan: string;
  tipeSPP?: string;
  semesterDaftarUlang?: string;
  tahunDaftarUlang?: string;
  bulanSPP?: string;
  tahunSPP?: string;
  semesterSPP?: string;
  jenjang?: string;
}): { namaTagihan: string; dbJenisTagihan: string } {
  const { jenisTagihan, jenjang } = values;
  const jenjangLabel = jenjang || "";

  if (jenisTagihan === "PPDB") {
    return {
      namaTagihan: `PPDB ${jenjangLabel}`.trim(),
      dbJenisTagihan: "Reguler",
    };
  }

  if (jenisTagihan === "Daftar Ulang") {
    const semester = values.semesterDaftarUlang || "";
    const tahun = values.tahunDaftarUlang || "";
    return {
      namaTagihan: `Daftar Ulang ${jenjangLabel} Semester ${semester} ${tahun}`.trim(),
      dbJenisTagihan: "Reguler",
    };
  }

  if (jenisTagihan === "SPP Reguler" || jenisTagihan === "SPP Subsidi") {
    const tipeLabel = jenisTagihan === "SPP Subsidi" ? "Subsidi" : "Reguler";
    const dbJenisTagihan = jenisTagihan === "SPP Subsidi" ? "Subsidi" : "Reguler";

    if (values.tipeSPP === "Bulanan") {
      const bulanNama =
        BULAN_LIST.find((b) => b.value === values.bulanSPP)?.label || "";
      const tahun = values.tahunSPP || "";
      return {
        namaTagihan: `SPP Bulanan ${jenjangLabel} ${bulanNama} ${tahun} ${tipeLabel}`.trim(),
        dbJenisTagihan,
      };
    }

    if (values.tipeSPP === "Semesteran") {
      const semester = values.semesterSPP || "";
      const tahun = values.tahunSPP || "";
      return {
        namaTagihan: `SPP Semesteran ${jenjangLabel} Semester ${semester} ${tahun} ${tipeLabel}`.trim(),
        dbJenisTagihan,
      };
    }

    // Fallback sebelum tipeSPP dipilih
    return {
      namaTagihan: `SPP ${jenjangLabel} ${tipeLabel}`.trim(),
      dbJenisTagihan,
    };
  }

  return { namaTagihan: "", dbJenisTagihan: "Reguler" };
}