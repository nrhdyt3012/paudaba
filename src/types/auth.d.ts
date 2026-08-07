// src/types/auth.d.ts
export type AuthFormState = {
  status?: string;
  errors?: {
    email?: string[];
    password?: string[];
    name?: string[];
    role?: string[];
    avatar_url?: string[];
    NIS?: string[];
    kelas?: string[];
    angkatan?: string[];
    nama_wali?: string[];
    no_wa?: string[];
    tempat_lahir?: string[];
    tanggal_lahir?: string[];
    _form?: string[];
  };
  data?: {
    profile?: any;
    redirectUrl?: string;
  };
};

export type SiswaChild = {
  id: string;          // siswa.id (UUID siswa, bukan auth id)
  namaSiswa: string;
  kelas?: string;
  angkatan?: string;
};


export type Profile = {
  id?: string;
  name?: string;
  avatar_url?: string;
  role?: string;
   children?: SiswaChild[];  // hanya terisi kalau role === "siswa"
  activeSiswaId?: string;   // siswa.id yang sedang aktif ditampilkan
  // Data siswa (camelCase sesuai database)
  NIS?: string;
  namaSiswa?: string;
  kelas?: string;
  angkatan?: string;
  namaWali?: string;
  noWa?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  status?: string;
  // snake_case alias untuk form
  nama_siswa?: string;
  nama_wali?: string;
  no_wa?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
};

