"use server";

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { AuthFormState } from "@/types/auth";
import { createUserSchema, updateUserSchema } from "@/validations/auth-validation";
import { revalidatePath } from "next/cache";

// ─── Create User ──────────────────────────────────────────────────────────────
export async function createUser(prevState: AuthFormState, formData: FormData) {
  const validatedFields = createUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    nama_siswa: formData.get("nama_siswa"),
    NIS: formData.get("NIS"),
    jenis_kelamin: formData.get("jenis_kelamin") || undefined,
    kelas: formData.get("kelas"),
    angkatan: formData.get("angkatan"),
    nama_wali: formData.get("nama_wali"),
    no_wa: formData.get("no_wa"),
    email_wali: formData.get("email_wali") || undefined,
    tempat_lahir: formData.get("tempat_lahir"),
    tanggal_lahir: formData.get("tanggal_lahir"),
    tipe_spp: formData.get("tipe_spp") || "reguler",
    role: formData.get("role") || "siswa",
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    console.error("[createUser] Validation error:", fieldErrors);
    return {
      status: "error",
      errors: {
        ...fieldErrors,
        _form: [] as string[],
      },
    };
  }

  const supabase = await createClient({ isAdmin: true });

  const { error: authError, data } = await supabase.auth.admin.createUser({
    email: validatedFields.data.email,
    password: validatedFields.data.password,
    email_confirm: true,
    user_metadata: {
      role: validatedFields.data.role,
      nama_siswa: validatedFields.data.nama_siswa,
    },
  });

  if (authError) {
    return {
      status: "error",
      errors: { ...prevState?.errors, _form: [authError.message] },
    };
  }

  if (data?.user) {
    const { error: insertError } = await supabase.from("siswa").upsert({
      id: data.user.id,
      email: validatedFields.data.email,
      namasiswa: validatedFields.data.nama_siswa,
      nis: validatedFields.data.NIS || null,
      jeniskelamin: validatedFields.data.jenis_kelamin || null,
      kelas: validatedFields.data.kelas,
      angkatan: validatedFields.data.angkatan || null,
      namawali: validatedFields.data.nama_wali,
      nowa: validatedFields.data.no_wa,
      tempatlahir: validatedFields.data.tempat_lahir || null,
      tanggallahir: validatedFields.data.tanggal_lahir || null,
      tipe_spp: validatedFields.data.tipe_spp || "reguler",
      status: "aktif",
    });

    if (insertError) {
      console.error("[createUser] Insert siswa error:", insertError.message);
    } else {
      await writeChangelog({
        supabase,
        namamenu: "Data Siswa",
        jenisaksi: "TAMBAH",
        deskripsi: `Menambahkan data siswa: ${validatedFields.data.nama_siswa} (${validatedFields.data.kelas} - SPP ${validatedFields.data.tipe_spp})`,
      });
    }
  }

  revalidatePath("/admin/user");
  return { status: "success" };
}

// ─── Update User ──────────────────────────────────────────────────────────────
export async function updateUser(prevState: AuthFormState, formData: FormData) {
  const jenisKelaminRaw = formData.get("jenis_kelamin") as string;

  // Normalisasi jenis kelamin agar cocok dengan enum Zod
  let jenisKelamin: "Laki-laki" | "Perempuan" | undefined;
  if (jenisKelaminRaw) {
    const jkLower = jenisKelaminRaw.toLowerCase().trim();
    if (jkLower === "laki-laki" || jkLower === "l" || jkLower === "laki") {
      jenisKelamin = "Laki-laki";
    } else if (jkLower === "perempuan" || jkLower === "p") {
      jenisKelamin = "Perempuan";
    }
  }

  const validatedFields = updateUserSchema.safeParse({
    nama_siswa: formData.get("nama_siswa"),
    NIS: formData.get("NIS"),
    jenis_kelamin: jenisKelamin,
    kelas: formData.get("kelas"),
    angkatan: formData.get("angkatan"),
    nama_wali: formData.get("nama_wali"),
    no_wa: formData.get("no_wa"),
    email_wali: formData.get("email_wali") || undefined,
    tempat_lahir: formData.get("tempat_lahir"),
    tanggal_lahir: formData.get("tanggal_lahir"),
    tipe_spp: formData.get("tipe_spp") || "reguler",
    role: formData.get("role") || "siswa",
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    console.error("[updateUser] Validation error:", fieldErrors);
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
      .join(" | ");
    return {
      status: "error",
      errors: {
        ...fieldErrors,
        _form: [errorMessages || "Validasi form gagal"],
      },
    };
  }

  const supabase = await createClient({ isAdmin: true });
  const userId = formData.get("id") as string;

  if (!userId) {
    return {
      status: "error",
      errors: { _form: ["ID siswa tidak ditemukan"] },
    };
  }

  const { error: siswaError } = await supabase
    .from("siswa")
    .update({
      namasiswa: validatedFields.data.nama_siswa,
      nis: validatedFields.data.NIS || null,
      jeniskelamin: validatedFields.data.jenis_kelamin || null,
      kelas: validatedFields.data.kelas,
      angkatan: validatedFields.data.angkatan || null,
      namawali: validatedFields.data.nama_wali,
      nowa: validatedFields.data.no_wa,
      tempatlahir: validatedFields.data.tempat_lahir || null,
      tanggallahir: validatedFields.data.tanggal_lahir || null,
      tipe_spp: validatedFields.data.tipe_spp || "reguler",
      updatedat: new Date().toISOString(),
    })
    .eq("id", userId);

  if (siswaError) {
    console.error("[updateUser] Supabase error:", siswaError);
    return {
      status: "error",
      errors: {
        ...prevState?.errors,
        _form: [`Gagal update: ${siswaError.message}`],
      },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Data Siswa",
    jenisaksi: "UBAH",
    deskripsi: `Mengubah data siswa: ${validatedFields.data.nama_siswa} (SPP ${validatedFields.data.tipe_spp})`,
  });

  revalidatePath("/admin/user");
  return { status: "success" };
}

// ─── Delete User ──────────────────────────────────────────────────────────────
export async function deleteUser(prevState: AuthFormState, formData: FormData) {
  const supabase = await createClient({ isAdmin: true });
  const userId = formData.get("id") as string;

  if (!userId) {
    return {
      status: "error",
      errors: { _form: ["ID siswa tidak valid"] },
    };
  }

  const { data: siswaData } = await supabase
    .from("siswa")
    .select("namasiswa")
    .eq("id", userId)
    .maybeSingle();

  const namaSiswa = siswaData?.namasiswa || userId;

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return {
      status: "error",
      errors: { ...prevState?.errors, _form: [error.message] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Data Siswa",
    jenisaksi: "HAPUS",
    deskripsi: `Menghapus data siswa: ${namaSiswa}`,
  });

  revalidatePath("/admin/user");
  return { status: "success" };
}