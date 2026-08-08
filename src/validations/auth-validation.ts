// src/validations/auth-validation.ts
import z from "zod";

export const loginSchemaForm = z.object({
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const createUserSchema = z.object({
  mode: z.enum(["baru", "existing"]).default("baru"),
  wali_auth_id: z.string().optional(), // dipakai kalau mode = "existing"
  email: z.string().optional(),
  password: z.string().optional(),
  nama_siswa: z.string().min(1, "Nama siswa wajib diisi"),
  NIS: z.string().min(1, "NIS wajib diisi"),
  jenis_kelamin: z.enum(["Laki-laki", "Perempuan"], { message: "Jenis kelamin wajib dipilih" }),
  kelas: z.string().min(1, "Kelas wajib dipilih"),
  angkatan: z.string().min(1, "Angkatan wajib diisi"),
  nama_wali: z.string().min(1, "Nama wali wajib diisi"),
  no_wa: z.string().min(1, "Nomor WhatsApp wali wajib diisi"),
  email_wali: z.string().email("Format email wali tidak valid").optional().or(z.literal("")),
  tempat_lahir: z.string().min(1, "Tempat lahir wajib diisi"),
  tanggal_lahir: z.string().min(1, "Tanggal lahir wajib diisi"),
  alamat: z.string().optional(),
  tipe_spp: z.enum(["reguler", "subsidi"]).default("reguler"),
  role: z.string().default("siswa"),
}).superRefine((data, ctx) => {
  // Email & password HANYA wajib kalau bikin wali baru.
  // Kalau nyambung ke wali yang sudah ada, wali_auth_id yang wajib.
  if (data.mode === "baru") {
    if (!data.email || !z.string().email().safeParse(data.email).success) {
      ctx.addIssue({ path: ["email"], code: z.ZodIssueCode.custom, message: "Email wajib diisi dengan format valid" });
    }
    if (!data.password || data.password.length < 6) {
      ctx.addIssue({ path: ["password"], code: z.ZodIssueCode.custom, message: "Password minimal 6 karakter" });
    }
  } else {
    if (!data.wali_auth_id) {
      ctx.addIssue({ path: ["wali_auth_id"], code: z.ZodIssueCode.custom, message: "Pilih wali terlebih dahulu" });
    }
  }
});

export const updateUserSchema = z.object({
  wali_auth_id_baru: z.string().optional(), // ← baru: diisi kalau bendahara pilih "pindah wali" di form Edit
  nama_siswa: z.string().min(1, "Nama siswa wajib diisi"),
  NIS: z.string().min(1, "NIS wajib diisi"),
  jenis_kelamin: z.enum(["Laki-laki", "Perempuan"], { message: "Jenis kelamin wajib dipilih" }),
  kelas: z.string().min(1, "Kelas wajib dipilih"),
  angkatan: z.string().min(1, "Angkatan wajib diisi"),
  nama_wali: z.string().min(1, "Nama wali wajib diisi"),
  no_wa: z.string().min(1, "Nomor WhatsApp wali wajib diisi"),
  email_wali: z.string().email("Format email wali tidak valid").optional().or(z.literal("")),
  tempat_lahir: z.string().min(1, "Tempat lahir wajib diisi"),
  tanggal_lahir: z.string().min(1, "Tanggal lahir wajib diisi"),
  alamat: z.string().optional(),
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