"use server";

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { AuthFormState } from "@/types/auth";
import { createUserSchema, updateUserSchema } from "@/validations/auth-validation";
import { revalidatePath } from "next/cache";
import {
  cekSiswaBisaDihapus,
  pesanTidakBisaDihapus,
  bersihkanDataTagihanSiswa,
} from "@/lib/siswa-delete-guard";

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
    alamat: formData.get("alamat") || undefined,
    tipe_spp: formData.get("tipe_spp") || "reguler",
    role: formData.get("role") || "siswa",
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    console.error("[createUser] Validation error:", fieldErrors);
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
      alamat: validatedFields.data.alamat || null,
      tipe_spp: validatedFields.data.tipe_spp || "reguler",
      // FIX: `status: "aktif"` dihapus — kolom itu sudah tidak dipakai lagi
      // (digantikan `is_active`, yang otomatis default `true` dari skema
      // database, jadi tidak perlu diisi manual di sini).
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
    alamat: formData.get("alamat") || undefined,
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
      alamat: validatedFields.data.alamat || null,
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

  // FIX: guard sebelumnya (patch #8) mengecek `tagihan_siswa` secara umum —
  // terlalu ketat, karena tagihan yang belum pernah dibayar sepeser pun
  // sebenarnya aman ikut terhapus. Sekarang dicek ke tabel `pembayaran`
  // (status SUCCESS) — representasi uang yang benar-benar sudah masuk,
  // bukan sekadar invoice kosong. Lihat src/lib/siswa-delete-guard.ts.
  const { bisaDihapus, jumlahTransaksi } = await cekSiswaBisaDihapus(supabase, userId);

  if (!bisaDihapus) {
    return {
      status: "error",
      errors: {
        _form: [
          jumlahTransaksi === -1
            ? "Gagal memverifikasi riwayat pembayaran siswa ini, coba lagi."
            : pesanTidakBisaDihapus(jumlahTransaksi),
        ],
      },
    };
  }

  // Aman dihapus (belum pernah ada pembayaran sukses) — bersihkan dulu
  // tagihan (yang masih "BELUM BAYAR"/belum ada transaksi jadi) beserta
  // data turunannya, supaya tidak ada baris yatim (orphan) tersisa.
  await bersihkanDataTagihanSiswa(supabase, userId);

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

  // ─── Import Users dari Excel (Bulk) ───────────────────────────────────────────
export type ImportRow = {
  nama_siswa: string;
  NIS: string;
  jenis_kelamin: string;
  kelas: string;
  angkatan: string;
  nama_wali: string;
  no_wa: string;
  email: string;
  password?: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat?: string;
  tipe_spp?: string;
};

export type ImportResult = {
  total: number;
  berhasil: number;
  gagal: number;
  detailGagal: { baris: number; nama: string; pesan: string }[];
};

export async function importUsersBulk(rows: ImportRow[]): Promise<ImportResult> {
  const supabase = await createClient({ isAdmin: true });

  const result: ImportResult = {
    total: rows.length,
    berhasil: 0,
    gagal: 0,
    detailGagal: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const baris = i + 2; // +2 karena baris 1 di Excel adalah header

    // Normalisasi jenis kelamin (sama seperti updateUser)
    const jkLower = (row.jenis_kelamin || "").toLowerCase().trim();
    let jenisKelamin: "Laki-laki" | "Perempuan" | undefined;
    if (jkLower === "laki-laki" || jkLower === "l" || jkLower === "laki") {
      jenisKelamin = "Laki-laki";
    } else if (jkLower === "perempuan" || jkLower === "p") {
      jenisKelamin = "Perempuan";
    }

    const validated = createUserSchema.safeParse({
      email: row.email,
      password: row.password || `siswa${row.NIS || "123456"}`,
      nama_siswa: row.nama_siswa,
      NIS: row.NIS,
      jenis_kelamin: jenisKelamin,
      kelas: row.kelas,
      angkatan: String(row.angkatan || ""),
      nama_wali: row.nama_wali,
      no_wa: String(row.no_wa || ""),
      tempat_lahir: row.tempat_lahir,
      tanggal_lahir: row.tanggal_lahir,
      alamat: row.alamat || undefined,
      tipe_spp: row.tipe_spp?.toLowerCase() === "subsidi" ? "subsidi" : "reguler",
      role: "siswa",
    });

    if (!validated.success) {
      const msgs = Object.values(validated.error.flatten().fieldErrors)
        .flat()
        .join(", ");
      result.gagal++;
      result.detailGagal.push({
        baris,
        nama: row.nama_siswa || "-",
        pesan: msgs || "Data tidak valid",
      });
      continue;
    }

    const { error: authError, data } = await supabase.auth.admin.createUser({
      email: validated.data.email,
      password: validated.data.password,
      email_confirm: true,
      user_metadata: { role: "siswa", nama_siswa: validated.data.nama_siswa },
    });

    if (authError || !data?.user) {
      result.gagal++;
      result.detailGagal.push({
        baris,
        nama: row.nama_siswa || "-",
        pesan: authError?.message || "Gagal membuat akun (kemungkinan email sudah dipakai)",
      });
      continue;
    }

    const { error: insertError } = await supabase.from("siswa").upsert({
      id: data.user.id,
      email: validated.data.email,
      namasiswa: validated.data.nama_siswa,
      nis: validated.data.NIS || null,
      jeniskelamin: validated.data.jenis_kelamin || null,
      kelas: validated.data.kelas,
      angkatan: validated.data.angkatan || null,
      namawali: validated.data.nama_wali,
      nowa: validated.data.no_wa,
      tempatlahir: validated.data.tempat_lahir || null,
      tanggallahir: validated.data.tanggal_lahir || null,
      alamat: validated.data.alamat || null,
      tipe_spp: validated.data.tipe_spp || "reguler",
    });

    if (insertError) {
      // Rollback akun auth yang sudah terlanjur dibuat supaya tidak jadi akun yatim
      await supabase.auth.admin.deleteUser(data.user.id);
      result.gagal++;
      result.detailGagal.push({
        baris,
        nama: row.nama_siswa || "-",
        pesan: insertError.message,
      });
      continue;
    }

    result.berhasil++;
  }

  if (result.berhasil > 0) {
    await writeChangelog({
      supabase,
      namamenu: "Data Siswa",
      jenisaksi: "TAMBAH",
      deskripsi: `Impor massal data siswa dari Excel: ${result.berhasil} berhasil, ${result.gagal} gagal`,
    });
  }

  revalidatePath("/admin/user");
  return result;
}