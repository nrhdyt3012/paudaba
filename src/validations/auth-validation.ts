// src/validations/auth-validation.ts
import z from "zod";

export const loginSchemaForm = z.object({
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const createUserSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  nama_siswa: z.string().min(1, "Nama siswa wajib diisi"),
  NIS: z.string().optional(),
  jenis_kelamin: z.enum(["Laki-laki", "Perempuan"]).optional().or(z.literal("")),
  kelas: z.string().min(1, "Kelas wajib dipilih"),
  angkatan: z.string().optional(),
  nama_wali: z.string().min(1, "Nama wali wajib diisi"),
  no_wa: z.string().min(1, "Nomor WhatsApp wali wajib diisi"),
  email_wali: z.string().email("Format email wali tidak valid").optional().or(z.literal("")),
  tempat_lahir: z.string().optional(),
  tanggal_lahir: z.string().optional(),
  // FIX: field alamat baru (opsional)
  alamat: z.string().optional(),
  // ← Baru: tipe SPP siswa (reguler/subsidi), default reguler
  tipe_spp: z.enum(["reguler", "subsidi"]).default("reguler"),
  role: z.string().default("siswa"),
});

export const updateUserSchema = z.object({
  nama_siswa: z.string().min(1, "Nama siswa wajib diisi"),
  NIS: z.string().optional(),
  jenis_kelamin: z.enum(["Laki-laki", "Perempuan"]).optional().or(z.literal("")),
  kelas: z.string().min(1, "Kelas wajib dipilih"),
  angkatan: z.string().optional(),
  nama_wali: z.string().min(1, "Nama wali wajib diisi"),
  no_wa: z.string().min(1, "Nomor WhatsApp wali wajib diisi"),
  email_wali: z.string().email("Format email wali tidak valid").optional().or(z.literal("")),
  tempat_lahir: z.string().optional(),
  tanggal_lahir: z.string().optional(),
  // FIX: field alamat baru (opsional)
  alamat: z.string().optional(),
  // ← Baru
  tipe_spp: z.enum(["reguler", "subsidi"]).default("reguler"),
  role: z.string().default("siswa"),
});

export type LoginForm = z.infer<typeof loginSchemaForm>;
// FIX: pakai z.input (bukan z.infer/z.output) — field yang punya .default()
// seperti `tipe_spp` dan `role` jadi tetap OPSIONAL di tipe form, sesuai
// yang diharapkan react-hook-form's zodResolver (yang mem-validasi input
// SEBELUM default diterapkan). Kalau pakai z.infer/z.output, field itu
// jadi wajib-ada di tipe form padahal resolver mengizinkannya kosong —
// itu penyebab error TS "Resolver<...> is not assignable to..." kemarin.
export type CreateUserForm = z.input<typeof createUserSchema>;
export type UpdateUserForm = z.input<typeof updateUserSchema>;