// src/constants/auth-constant.ts

export const INITIAL_CREATE_USER_FORM = {
  email: "",
  password: "",
  nama_siswa: "",
  NIS: "",
  jenis_kelamin: undefined as unknown as "Laki-laki" | "Perempuan",
  kelas: "",
  angkatan: "",
  nama_wali: "",
  no_wa: "",
  email_wali: "",
  tempat_lahir: "",
  tanggal_lahir: "",
  tipe_spp: "reguler" as "reguler" | "subsidi",
  role: "siswa",
};

export const INITIAL_STATE_CREATE_USER = {
  status: "idle",
  errors: { _form: [] as string[] },
};

export const INITIAL_STATE_UPDATE_USER = {
  status: "idle",
  errors: { _form: [] as string[] },
};

export const INITIAL_STATE_PROFILE = {
  id: undefined,
  name: undefined,
  avatar_url: undefined,
  role: undefined,
};

export const KELAS_LIST = [
  { value: "KB", label: "KB (Kelompok Bermain)" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

export const JENIS_KELAMIN_LIST = [
  { value: "Laki-laki", label: "Laki-laki" },
  { value: "Perempuan", label: "Perempuan" },
];

// Tipe SPP — hanya untuk keperluan administrasi, tidak ditampilkan ke wali siswa
export const TIPE_SPP_SISWA_LIST = [
  { value: "reguler", label: "Reguler" },
  { value: "subsidi", label: "Subsidi" },
];

export const INITIAL_LOGIN_FORM = {
  email: "",
  password: "",
};

export const INITIAL_STATE_LOGIN_FORM = {
  status: "idle",
  errors: { _form: [] as string[] },
  data: undefined as any,
};