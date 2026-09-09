// src/constants/menu-constant.ts
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
  // PPDB fields
  gelombangPPDB: "",
  tahunPPDB: "",
  // Daftar Ulang fields
  semesterDaftarUlang: "",
  tahunDaftarUlang: "",
  // SPP fields
  tipeSPP: "",           // "Bulanan" | "Semesteran"
  bulanSPP: "",          // only for Bulanan
  tahunSPP: "",
  semesterSPP: "",       // only for Semesteran
  // Lainnya fields
  namaTagihanManual: "",
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

// FIX: tambah opsi "Lainnya" untuk tagihan bebas (nama diketik manual)
export const JENIS_TAGIHAN_LIST = [
  { value: "PPDB", label: "PPDB" },
  { value: "Daftar Ulang", label: "Daftar Ulang" },
  { value: "SPP Reguler", label: "SPP Reguler" },
  { value: "SPP Subsidi", label: "SPP Subsidi" },
  { value: "Lainnya", label: "Lainnya" },
];

// FIX: opsi gelombang PPDB
export const GELOMBANG_LIST = [
  { value: "1", label: "Gelombang 1" },
  { value: "2", label: "Gelombang 2" },
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
  gelombangPPDB?: string;
  tahunPPDB?: string;
  tipeSPP?: string;
  semesterDaftarUlang?: string;
  tahunDaftarUlang?: string;
  bulanSPP?: string;
  tahunSPP?: string;
  semesterSPP?: string;
  namaTagihanManual?: string;
  jenjang?: string;
}): { namaTagihan: string; dbJenisTagihan: string } {
  const { jenisTagihan, jenjang } = values;
  const jenjangLabel = jenjang || "";

  if (jenisTagihan === "PPDB") {
    // FIX: PPDB sekarang punya detail Gelombang + Tahun
    const gelombang = values.gelombangPPDB || "";
    const tahun = values.tahunPPDB || "";
    const gelombangLabel = gelombang ? `Gelombang ${gelombang}` : "";
    return {
      namaTagihan: `PPDB ${jenjangLabel} ${gelombangLabel} ${tahun}`.trim(),
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

    return {
      namaTagihan: `SPP ${jenjangLabel} ${tipeLabel}`.trim(),
      dbJenisTagihan,
    };
  }

  // FIX: "Lainnya" -> nama tagihan diketik manual oleh user, tidak di-generate
  if (jenisTagihan === "Lainnya") {
    return {
      namaTagihan: (values.namaTagihanManual || "").trim(),
      dbJenisTagihan: "Reguler",
    };
  }

  return { namaTagihan: "", dbJenisTagihan: "Reguler" };
}