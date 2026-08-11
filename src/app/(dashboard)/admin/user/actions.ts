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
    mode: (formData.get("mode") as string) || "baru",
    wali_auth_id: formData.get("wali_auth_id") || undefined,
    email: formData.get("email") || undefined,
    password: formData.get("password") || undefined,
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
      errors: { ...fieldErrors, _form: [errorMessages || "Validasi form gagal"] },
    };
  }

  const supabase = await createClient({ isAdmin: true });
  const data_ = validatedFields.data;

  let waliAuthId: string;
  let emailSiswa: string;
  let akunAuthBaruDibuat = false;

  if (data_.mode === "existing") {
    // ── Anak dari wali yang sudah ada — TIDAK bikin akun auth baru ──────────
    waliAuthId = data_.wali_auth_id!;

    const { data: waliExisting } = await supabase
      .from("siswa")
      .select("email")
      .eq("wali_auth_id", waliAuthId)
      .limit(1)
      .maybeSingle();

    if (!waliExisting) {
      return { status: "error", errors: { _form: ["Data wali tidak ditemukan, silakan pilih ulang."] } };
    }
    emailSiswa = waliExisting.email;
  } else {
    // ── Wali baru — bikin akun auth seperti sebelumnya ───────────────────────
    const { error: authError, data: authData } = await supabase.auth.admin.createUser({
      email: data_.email!,
      password: data_.password!,
      email_confirm: true,
      user_metadata: { role: data_.role, nama_siswa: data_.nama_siswa },
    });

    if (authError) {
      return { status: "error", errors: { ...prevState?.errors, _form: [authError.message] } };
    }
    if (!authData?.user) {
      return { status: "error", errors: { _form: ["Gagal membuat akun wali"] } };
    }
    waliAuthId = authData.user.id;
    emailSiswa = data_.email!;
    akunAuthBaruDibuat = true;
  }

  const { error: insertError } = await supabase.from("siswa").insert({
    // id TIDAK diisi manual — otomatis gen_random_uuid() dari default kolom
    wali_auth_id: waliAuthId,
    email: emailSiswa,
    namasiswa: data_.nama_siswa,
    nis: data_.NIS || null,
    jeniskelamin: data_.jenis_kelamin || null,
    kelas: data_.kelas,
    angkatan: data_.angkatan || null,
    namawali: data_.nama_wali,
    nowa: data_.no_wa,
    tempatlahir: data_.tempat_lahir || null,
    tanggallahir: data_.tanggal_lahir || null,
    alamat: data_.alamat || null,
    tipe_spp: data_.tipe_spp || "reguler",
  });

  if (insertError) {
    console.error("[createUser] Insert siswa error:", insertError.message);
    // Kalau wali baru saja dibuat dan insert siswa gagal, rollback akun
    // auth-nya supaya tidak ada akun "yatim" tanpa data siswa.
    if (akunAuthBaruDibuat) {
      await supabase.auth.admin.deleteUser(waliAuthId);
    }
    return { status: "error", errors: { _form: [`Gagal menyimpan data siswa: ${insertError.message}`] } };
  }

  await writeChangelog({
    supabase,
    namamenu: "Data Siswa",
    jenisaksi: "TAMBAH",
    deskripsi: `Menambahkan data siswa: ${data_.nama_siswa} (${data_.kelas} - SPP ${data_.tipe_spp})${
      data_.mode === "existing" ? " — anak tambahan dari wali yang sudah terdaftar" : ""
    }`,
  });

  revalidatePath("/admin/user");
  return { status: "success" };
}

// ─── Cari Wali yang Sudah Terdaftar (untuk form Tambah Siswa) ─────────────────
// Bisa dicari lewat email, nama wali, atau nomor WA — tidak cuma email saja.
export async function searchWaliByEmail(query: string) {
  if (!query || query.trim().length < 2) return [];
  const supabase = await createClient({ isAdmin: true });
  const q = query.trim();

  const { data } = await supabase
    .from("siswa")
    .select("wali_auth_id, email, namawali, nowa")
    .or(`email.ilike.%${q}%,namawali.ilike.%${q}%,nowa.ilike.%${q}%`)
    .limit(10);

  // Unikkan per wali_auth_id — satu wali bisa punya beberapa baris anak,
  // jangan sampai muncul dobel di hasil pencarian.
  const seen = new Set<string>();
  const result: { wali_auth_id: string; email: string; namawali: string; nowa: string }[] = [];
  for (const row of data || []) {
    if (row.wali_auth_id && !seen.has(row.wali_auth_id)) {
      seen.add(row.wali_auth_id);
      result.push(row as any);
    }
  }
  return result;
}

export async function updateUser(prevState: AuthFormState, formData: FormData) {
  const jenisKelaminRaw = formData.get("jenis_kelamin") as string;

  let jenisKelamin: "Laki-laki" | "Perempuan" | undefined;
  if (jenisKelaminRaw) {
    const jkLower = jenisKelaminRaw.toLowerCase().trim();
    if (jkLower === "laki-laki" || jkLower === "l" || jkLower === "laki") jenisKelamin = "Laki-laki";
    else if (jkLower === "perempuan" || jkLower === "p") jenisKelamin = "Perempuan";
  }

  const validatedFields = updateUserSchema.safeParse({
    wali_auth_id_baru: formData.get("wali_auth_id_baru") || undefined,
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
      errors: { ...fieldErrors, _form: [errorMessages || "Validasi form gagal"] },
    };
  }

  const supabase = await createClient({ isAdmin: true });
  const userId = formData.get("id") as string;

  if (!userId) {
    return { status: "error", errors: { _form: ["ID siswa tidak ditemukan"] } };
  }

  const data_ = validatedFields.data;

  const updatePayload: Record<string, any> = {
    namasiswa: data_.nama_siswa,
    nis: data_.NIS || null,
    jeniskelamin: data_.jenis_kelamin || null,
    kelas: data_.kelas,
    angkatan: data_.angkatan || null,
    namawali: data_.nama_wali,
    nowa: data_.no_wa,
    tempatlahir: data_.tempat_lahir || null,
    tanggallahir: data_.tanggal_lahir || null,
    alamat: data_.alamat || null,
    tipe_spp: data_.tipe_spp || "reguler",
    updatedat: new Date().toISOString(),
  };

  let waliLamaIdUntukDibersihkan: string | null = null;
  let deskripsiTambahan = "";

  // ── Kalau bendahara pilih "pindah wali" di form Edit ini ──────────────────
  if (data_.wali_auth_id_baru) {
    const { data: siswaSekarang } = await supabase
      .from("siswa")
      .select("wali_auth_id")
      .eq("id", userId)
      .maybeSingle();

    if (siswaSekarang && siswaSekarang.wali_auth_id !== data_.wali_auth_id_baru) {
      const { data: waliBaruData } = await supabase
        .from("siswa")
        .select("email")
        .eq("wali_auth_id", data_.wali_auth_id_baru)
        .limit(1)
        .maybeSingle();

      if (!waliBaruData) {
        return { status: "error", errors: { _form: ["Wali tujuan tidak ditemukan"] } };
      }

      updatePayload.wali_auth_id = data_.wali_auth_id_baru;
      updatePayload.email = waliBaruData.email;
      waliLamaIdUntukDibersihkan = siswaSekarang.wali_auth_id;
      deskripsiTambahan = " — dipindahkan ke wali yang sudah terdaftar";
    }
  }

  const { error: siswaError } = await supabase
    .from("siswa")
    .update(updatePayload)
    .eq("id", userId);

  if (siswaError) {
    console.error("[updateUser] Supabase error:", siswaError);
    return {
      status: "error",
      errors: { ...prevState?.errors, _form: [`Gagal update: ${siswaError.message}`] },
    };
  }

  // Kalau wali lama sudah tidak punya anak lain, hapus akun login-nya
  // (kasus: tadinya salah keinput sebagai wali baru)
  if (waliLamaIdUntukDibersihkan) {
    const { count: sisaAnak } = await supabase
      .from("siswa")
      .select("id", { count: "exact", head: true })
      .eq("wali_auth_id", waliLamaIdUntukDibersihkan);

    if ((sisaAnak ?? 0) === 0) {
      await supabase.auth.admin.deleteUser(waliLamaIdUntukDibersihkan);
    }
  }

  await writeChangelog({
    supabase,
    namamenu: "Data Siswa",
    jenisaksi: "UBAH",
    deskripsi: `Mengubah data siswa: ${data_.nama_siswa} (SPP ${data_.tipe_spp})${deskripsiTambahan}`,
  });

  revalidatePath("/admin/user");
  return { status: "success" };
}

// ─── Ubah status akademik siswa (aktif / tidak aktif) — satuan & dipanggil
//     berulang untuk aksi massal dari client ─────────────────────────────────
// FIX (checkbox multi-select di Data Siswa): field `status` di sini BEDA
// dari `is_active` yang dikelola di Kelola Akun. `is_active` = akses login
// wali (disinkron ke semua anak dari wali yang sama). `status` = status
// akademik SATU ANAK (aktif belajar / sudah tidak aktif — lulus, pindah,
// dsb), independen per siswa walau satu wali punya beberapa anak. Jadi
// action ini TIDAK menyentuh tabel auth / kolom is_active sama sekali.
export async function updateStatusSiswa(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const statusBaru = formData.get("status") as string;

  if (!id || (statusBaru !== "aktif" && statusBaru !== "tidak aktif")) {
    return { status: "error", errors: { _form: ["Data tidak valid"] } };
  }

  const supabase = await createClient({ isAdmin: true });

  const { data: siswaRow, error } = await supabase
    .from("siswa")
    .update({ status: statusBaru, updatedat: new Date().toISOString() })
    .eq("id", id)
    .select("namasiswa")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      errors: { _form: [`Gagal mengubah status siswa: ${error.message}`] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Data Siswa",
    jenisaksi: "UBAH",
    deskripsi: `Mengubah status siswa ${siswaRow?.namasiswa || id} menjadi "${statusBaru}"`,
  });

  revalidatePath("/admin/user");
  return { status: "success" };
}

// ─── Promosikan kelas siswa (KB → TK A → TK B) — satuan & dipanggil
//     berulang untuk aksi massal dari client ─────────────────────────────────
const KELAS_VALID = ["KB", "TK A", "TK B"];

export async function promoteKelasSiswa(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const kelasBaru = formData.get("kelas_baru") as string;

  if (!id || !kelasBaru || !KELAS_VALID.includes(kelasBaru)) {
    return { status: "error", errors: { _form: ["Data tidak valid"] } };
  }

  const supabase = await createClient({ isAdmin: true });

  const { data: siswaRow, error } = await supabase
    .from("siswa")
    .update({ kelas: kelasBaru, updatedat: new Date().toISOString() })
    .eq("id", id)
    .select("namasiswa")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      errors: { _form: [`Gagal memindahkan kelas: ${error.message}`] },
    };
  }

  await writeChangelog({
    supabase,
    namamenu: "Data Siswa",
    jenisaksi: "UBAH",
    deskripsi: `Mempromosikan kelas siswa ${siswaRow?.namasiswa || id} ke ${kelasBaru}`,
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

  const result: ImportResult = { total: rows.length, berhasil: 0, gagal: 0, detailGagal: [] };

  // Cache email → wali_auth_id, supaya baris kakak-adik dengan email sama
  // DALAM SATU FILE otomatis nyambung ke wali yang sama — baik yang sudah
  // ada di database, maupun yang baru saja dibuat di baris sebelumnya.
  const emailToWaliId = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const baris = i + 2;
    const emailLower = (row.email || "").toLowerCase().trim();

    const jkLower = (row.jenis_kelamin || "").toLowerCase().trim();
    let jenisKelamin: "Laki-laki" | "Perempuan" | undefined;
    if (jkLower === "laki-laki" || jkLower === "l" || jkLower === "laki") jenisKelamin = "Laki-laki";
    else if (jkLower === "perempuan" || jkLower === "p") jenisKelamin = "Perempuan";

    const validated = createUserSchema.safeParse({
      mode: "baru",
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
      const msgs = Object.values(validated.error.flatten().fieldErrors).flat().join(", ");
      result.gagal++;
      result.detailGagal.push({ baris, nama: row.nama_siswa || "-", pesan: msgs || "Data tidak valid" });
      continue;
    }

    let waliAuthId = emailToWaliId.get(emailLower);

    if (!waliAuthId) {
      const { data: waliExisting } = await supabase
        .from("siswa")
        .select("wali_auth_id")
        .eq("email", validated.data.email)
        .limit(1)
        .maybeSingle();

      if (waliExisting) {
        // Email ini sudah terdaftar sebagai wali → sambungkan sebagai anak baru,
        // TIDAK bikin akun login baru.
        waliAuthId = waliExisting.wali_auth_id;
      } else {
        const { error: authError, data: authData } = await supabase.auth.admin.createUser({
          email: validated.data.email!,
          password: validated.data.password!,
          email_confirm: true,
          user_metadata: { role: "siswa", nama_siswa: validated.data.nama_siswa },
        });

        if (authError || !authData?.user) {
          result.gagal++;
          result.detailGagal.push({
            baris, nama: row.nama_siswa || "-",
            pesan: authError?.message || "Gagal membuat akun",
          });
          continue;
        }
        waliAuthId = authData.user.id;
      }

      emailToWaliId.set(emailLower, waliAuthId!);
    }

    const { error: insertError } = await supabase.from("siswa").insert({
      wali_auth_id: waliAuthId!,
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
      result.gagal++;
      result.detailGagal.push({ baris, nama: row.nama_siswa || "-", pesan: insertError.message });
      continue;
    }

    result.berhasil++;
  }

  if (result.berhasil > 0) {
    await writeChangelog({
      supabase, namamenu: "Data Siswa", jenisaksi: "TAMBAH",
      deskripsi: `Impor massal data siswa dari Excel: ${result.berhasil} berhasil, ${result.gagal} gagal`,
    });
  }

  revalidatePath("/admin/user");
  return result;
}