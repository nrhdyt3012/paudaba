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
  // ← Baru
  tipe_spp: z.enum(["reguler", "subsidi"]).default("reguler"),
  role: z.string().default("siswa"),
});

export type LoginForm = z.infer<typeof loginSchemaForm>;
export type CreateUserForm = z.infer<typeof createUserSchema>;
export type UpdateUserForm = z.infer<typeof updateUserSchema>;