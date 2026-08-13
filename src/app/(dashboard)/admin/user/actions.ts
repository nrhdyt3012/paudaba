"use server";

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { AuthFormState } from "@/types/auth";
import { createUserSchema, updateUserSchema, importUserSchema } from "@/validations/auth-validation";
import { revalidatePath } from "next/cache";
import {
  cekSiswaBisaDihapus,
  pesanTidakBisaDihapus,
  bersihkanDataTagihanSiswa,
} from "@/lib/siswa-delete-guard";

// ─── Helper: slug nama wali → dipakai untuk generate email otomatis ───────────
function slugifyNamaWali(nama: string): string {
  const s = (nama || "wali")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // buang diakritik
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, "");
  return s || "wali";
}

// ─── Helper: cari slug email yang belum kepakai di DB (loop sampai unik) ──────
async function generateEmailUnik(supabase: any, namaWali: string): Promise<string> {
  const slug = slugifyNamaWali(namaWali);
  let candidate = `${slug}@gmail.com`;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: emailTerpakai } = await supabase
      .from("siswa")
      .select("id")
      .eq("email", candidate)
      .maybeSingle();
    if (!emailTerpakai) return candidate;
    n++;
    candidate = `${slug}${n}@gmail.com`;
  }
}

// ─── Helper: family key untuk pengelompokan import (dipakai preview & apply) ──
function familyKey(r: ImportRow): string {
  const email = (r.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;
  const wali = (r.nama_wali || "").trim().toLowerCase();
  const wa = String(r.no_wa || "").replace(/\D/g, "");
  return `auto:${wali}|${wa}`;
}

// ─── Create User ──────────────────────────────────────────────────────────────
export async function createUser(prevState: AuthFormState, formData: FormData) : Promise<AuthFormState> {
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
  // ── BARU: dilaporkan balik ke form kalau email/password digenerate otomatis
  let akunDigenerate: { email: string; password: string } | null = null;

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
    // ── Wali baru — bikin akun auth. Email/password boleh dikosongkan ───────
    // dan digenerate otomatis: email dari slug Nama Wali (+@gmail.com),
    // password dari NIS siswa.
    let emailBaru = (data_.email || "").trim();
    let passwordBaru = (data_.password || "").trim();
    let digenerate = false;

    if (!emailBaru) {
      emailBaru = await generateEmailUnik(supabase, data_.nama_wali);
      digenerate = true;
    }
    if (!passwordBaru) {
      passwordBaru = data_.NIS ? String(data_.NIS).trim() : `siswa${Date.now()}`;
      digenerate = true;
    }

    const { error: authError, data: authData } = await supabase.auth.admin.createUser({
      email: emailBaru,
      password: passwordBaru,
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
    emailSiswa = emailBaru;
    akunAuthBaruDibuat = true;
    if (digenerate) akunDigenerate = { email: emailBaru, password: passwordBaru };
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
    }${akunDigenerate ? " — akun wali digenerate otomatis" : ""}`,
  });

  revalidatePath("/admin/user");
  // ── BARU: akunDigenerate ikut dikembalikan supaya UI bisa menampilkannya
  return { status: "success", akunDigenerate };
}

// ─── Cari Wali yang Sudah Terdaftar (untuk form Tambah Siswa) ─────────────────
export async function searchWaliByEmail(query: string) {
  if (!query || query.trim().length < 2) return [];
  const supabase = await createClient({ isAdmin: true });
  const q = query.trim();

  const { data } = await supabase
    .from("siswa")
    .select("wali_auth_id, email, namawali, nowa")
    .or(`email.ilike.%${q}%,namawali.ilike.%${q}%,nowa.ilike.%${q}%`)
    .limit(10);

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

// ─── Update User ──────────────────────────────────────────────────────────────
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

// ─── Ubah status akademik siswa (aktif / tidak aktif) ──────────────────────────
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

// ─── Promosikan kelas siswa (KB → TK A → TK B) ─────────────────────────────────
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

// ─── Import Users dari Excel (Bulk) ────────────────────────────────────────────
// 1. NIS jadi kunci pencocokan: NIS sudah ada di DB -> UPDATE (data akademik
//    saja, akun/email TIDAK disentuh). NIS belum ada -> INSERT + generate
//    akun wali baru.
// 2. Mode UPDATE cuma menimpa field yang ADA ISINYA di file impor.
// 3. Email & Password boleh dikosongkan di file — digenerate otomatis:
//    email dari slug Nama Wali (+@gmail.com), password dari NIS anak
//    pertama dalam "keluarga" yang sama.
// 4. Pakai importUserSchema (JK & No WA opsional).
// 5. previewImportUsersBulk() — TIDAK menulis ke DB, cuma mensimulasikan
//    hasilnya (dipakai untuk tombol "Preview" sebelum "Terapkan Import").
export type ImportRow = {
  nama_siswa: string;
  NIS: string;
  jenis_kelamin: string;
  kelas: string;
  angkatan: string;
  nama_wali: string;
  no_wa: string;
  email?: string;      // opsional — kosong = digenerate otomatis
  password?: string;   // opsional — kosong = digenerate otomatis
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat?: string;
  tipe_spp?: string;
};

export type ImportResult = {
  total: number;
  berhasil: number;
  ditambahkan: number;   // siswa baru (insert)
  diperbarui: number;    // siswa lama, NIS sudah ada (update)
  gagal: number;
  detailGagal: { baris: number; nama: string; pesan: string }[];
  akunDigenerate: { baris: number; nama: string; email: string; password: string }[];
};

// ── Tipe untuk hasil Preview (simulasi, belum menulis apa pun ke DB) ──────────
export type ImportPlanRow = {
  baris: number;
  nama: string;
  nis: string;
  aksi: "TAMBAH" | "PERBARUI" | "GAGAL";
  keterangan: string;
  email?: string;
  password?: string;
  pesan?: string;
};

export type ImportPlanResult = {
  total: number;
  akanDitambahkan: number;
  akanDiperbarui: number;
  akanGagal: number;
  rows: ImportPlanRow[];
};

// ─── Preview Import (read-only, TIDAK menulis ke DB) ───────────────────────────
export async function previewImportUsersBulk(rows: ImportRow[]): Promise<ImportPlanResult> {
  const supabase = await createClient({ isAdmin: true });

  const plan: ImportPlanResult = {
    total: rows.length,
    akanDitambahkan: 0,
    akanDiperbarui: 0,
    akanGagal: 0,
    rows: [],
  };

  // ── 1. Cek NIS mana saja yang SUDAH ADA di database ────────────────────────
  const nisList = rows.map((r) => String(r.NIS || "").trim()).filter(Boolean);
  const { data: existingSiswa } = nisList.length
    ? await supabase.from("siswa").select("id, nis").in("nis", nisList)
    : { data: [] as any[] };
  const nisAda = new Set((existingSiswa || []).map((s: any) => String(s.nis).trim()));

  // ── 2. Kelompokkan baris yang akan INSERT per "keluarga" ───────────────────
  const insertRows = rows.filter((r) => {
    const nis = String(r.NIS || "").trim();
    return !(nis && nisAda.has(nis));
  });

  const groups = new Map<string, { rows: ImportRow[]; email?: string; password?: string }>();
  for (const r of insertRows) {
    const key = familyKey(r);
    if (!groups.has(key)) groups.set(key, { rows: [] });
    groups.get(key)!.rows.push(r);
  }

  // ── 3. Simulasikan email & password per grup ────────────────────────────────
  const usedSlugs = new Map<string, number>();
  for (const [, group] of groups) {
    const explicitEmail = group.rows.find((r) => (r.email || "").trim())?.email?.trim();
    const explicitPassword = group.rows.find((r) => (r.password || "").trim())?.password?.trim();

    if (explicitEmail) {
      group.email = explicitEmail;
    } else {
      const slug = slugifyNamaWali(group.rows[0].nama_wali);
      const n = usedSlugs.get(slug) || 0;
      usedSlugs.set(slug, n + 1);
      group.email = n === 0 ? `${slug}@gmail.com` : `${slug}${n + 1}@gmail.com`;
    }

    if (explicitPassword) {
      group.password = explicitPassword;
    } else {
      const firstWithNis = group.rows.find((r) => String(r.NIS || "").trim());
      group.password = firstWithNis ? String(firstWithNis.NIS).trim() : undefined;
    }
  }

  // ── 4. Cek email grup mana yang kebetulan sudah ada wali-nya di DB ─────────
  const groupEmails = Array.from(
    new Set(Array.from(groups.values()).map((g) => g.email).filter(Boolean))
  ) as string[];
  const { data: waliTerdaftar } = groupEmails.length
    ? await supabase.from("siswa").select("email").in("email", groupEmails)
    : { data: [] as any[] };
  const emailSudahAda = new Set((waliTerdaftar || []).map((w: any) => w.email));

  // ── 5. Susun rencana per baris ───────────────────────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const baris = i + 2; // baris 1 = header Excel
    const nis = String(row.NIS || "").trim();

    if (nis && nisAda.has(nis)) {
      plan.rows.push({
        baris,
        nama: row.nama_siswa || "-",
        nis,
        aksi: "PERBARUI",
        keterangan: "NIS sudah terdaftar — data akademik diperbarui, akun wali tidak disentuh",
      });
      plan.akanDiperbarui++;
      continue;
    }

    const group = groups.get(familyKey(row))!;

    const jkLower = (row.jenis_kelamin || "").toLowerCase().trim();
    let jenisKelamin: "Laki-laki" | "Perempuan" | undefined;
    if (jkLower === "laki-laki" || jkLower === "l" || jkLower === "laki") jenisKelamin = "Laki-laki";
    else if (jkLower === "perempuan" || jkLower === "p") jenisKelamin = "Perempuan";

    const validated = importUserSchema.safeParse({
      email: group.email,
      password: group.password || `siswa${nis || "123456"}`,
      nama_siswa: row.nama_siswa,
      NIS: nis,
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
      plan.rows.push({
        baris,
        nama: row.nama_siswa || "-",
        nis,
        aksi: "GAGAL",
        keterangan: "Data tidak valid",
        pesan: msgs || "Data tidak valid",
      });
      plan.akanGagal++;
      continue;
    }

    const gabungAkunLama = emailSudahAda.has(group.email!);
    plan.rows.push({
      baris,
      nama: row.nama_siswa || "-",
      nis,
      aksi: "TAMBAH",
      keterangan: gabungAkunLama
        ? "Siswa baru — digabung ke akun wali yang sudah ada"
        : "Siswa baru — akun wali baru akan dibuat",
      email: group.email,
      password: gabungAkunLama ? undefined : group.password,
    });
    plan.akanDitambahkan++;
  }

  return plan;
}

// ─── Terapkan Import (menulis ke DB) ───────────────────────────────────────────
export async function importUsersBulk(rows: ImportRow[]): Promise<ImportResult> {
  const supabase = await createClient({ isAdmin: true });

  const result: ImportResult = {
    total: rows.length,
    berhasil: 0,
    ditambahkan: 0,
    diperbarui: 0,
    gagal: 0,
    detailGagal: [],
    akunDigenerate: [],
  };

  // ── 1. Cek NIS mana saja yang SUDAH ADA di database (batch, sekali query) ──
  const nisList = rows.map((r) => String(r.NIS || "").trim()).filter(Boolean);
  const { data: existingSiswa } = nisList.length
    ? await supabase.from("siswa").select("id, nis, wali_auth_id").in("nis", nisList)
    : { data: [] as any[] };

  const nisToExisting = new Map<string, { id: string; wali_auth_id: string }>();
  (existingSiswa || []).forEach((s: any) => {
    if (s.nis) nisToExisting.set(String(s.nis).trim(), { id: s.id, wali_auth_id: s.wali_auth_id });
  });

  // ── 2. Kelompokkan baris yang butuh INSERT (NIS belum ada) per "keluarga" ──
  type Group = { rows: ImportRow[]; email?: string; password?: string };
  const groups = new Map<string, Group>();

  const insertRows = rows.filter((r) => {
    const nis = String(r.NIS || "").trim();
    return !(nis && nisToExisting.has(nis));
  });

  for (const r of insertRows) {
    const key = familyKey(r);
    if (!groups.has(key)) groups.set(key, { rows: [] });
    groups.get(key)!.rows.push(r);
  }

  // ── 3. Generate email & password per grup (kalau belum diisi manual) ──────
  const usedSlugs = new Map<string, number>();
  for (const [, group] of groups) {
    const explicitEmail = group.rows.find((r) => (r.email || "").trim())?.email?.trim();
    const explicitPassword = group.rows.find((r) => (r.password || "").trim())?.password?.trim();

    if (explicitEmail) {
      group.email = explicitEmail;
    } else {
      const slug = slugifyNamaWali(group.rows[0].nama_wali);
      const n = usedSlugs.get(slug) || 0;
      usedSlugs.set(slug, n + 1);
      group.email = n === 0 ? `${slug}@gmail.com` : `${slug}${n + 1}@gmail.com`;
    }

    if (explicitPassword) {
      group.password = explicitPassword;
    } else {
      const firstWithNis = group.rows.find((r) => String(r.NIS || "").trim());
      group.password = firstWithNis ? String(firstWithNis.NIS).trim() : undefined;
    }
  }

  const groupToWaliId = new Map<string, string>();

  // ── 4. Proses tiap baris ──────────────────────────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const baris = i + 2;
    const nis = String(row.NIS || "").trim();

    const jkLower = (row.jenis_kelamin || "").toLowerCase().trim();
    let jenisKelamin: "Laki-laki" | "Perempuan" | undefined;
    if (jkLower === "laki-laki" || jkLower === "l" || jkLower === "laki") jenisKelamin = "Laki-laki";
    else if (jkLower === "perempuan" || jkLower === "p") jenisKelamin = "Perempuan";

    const existing = nis ? nisToExisting.get(nis) : undefined;

    if (existing) {
      // ── MODE UPDATE: siswa lama, JANGAN sentuh akun/email ──────────────
      const updatePayload: Record<string, any> = { updatedat: new Date().toISOString() };

      if (row.nama_siswa?.trim()) updatePayload.namasiswa = row.nama_siswa.trim();
      if (jenisKelamin) updatePayload.jeniskelamin = jenisKelamin;
      if (row.kelas?.trim()) updatePayload.kelas = row.kelas.trim();
      if (String(row.angkatan || "").trim()) updatePayload.angkatan = row.angkatan;
      if (row.nama_wali?.trim()) updatePayload.namawali = row.nama_wali.trim();
      if (String(row.no_wa || "").trim()) updatePayload.nowa = row.no_wa;
      if (row.tempat_lahir?.trim()) updatePayload.tempatlahir = row.tempat_lahir.trim();
      if (row.tanggal_lahir?.trim()) updatePayload.tanggallahir = row.tanggal_lahir.trim();
      if (row.alamat?.trim()) updatePayload.alamat = row.alamat.trim();
      if (row.tipe_spp?.trim()) {
        updatePayload.tipe_spp = row.tipe_spp.toLowerCase() === "subsidi" ? "subsidi" : "reguler";
      }

      const { error } = await supabase
        .from("siswa")
        .update(updatePayload)
        .eq("id", existing.id);

      if (error) {
        result.gagal++;
        result.detailGagal.push({ baris, nama: row.nama_siswa || "-", pesan: error.message });
        continue;
      }

      result.berhasil++;
      result.diperbarui++;
      continue;
    }

    // ── MODE INSERT: siswa baru ───────────────────────────────────────────
    const key = familyKey(row);
    const group = groups.get(key)!;

    const validated = importUserSchema.safeParse({
      email: group.email,
      password: group.password || `siswa${nis || "123456"}`,
      nama_siswa: row.nama_siswa,
      NIS: nis,
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

    let waliAuthId = groupToWaliId.get(key);

    if (!waliAuthId) {
      const { data: waliExisting } = await supabase
        .from("siswa")
        .select("wali_auth_id")
        .eq("email", validated.data.email)
        .limit(1)
        .maybeSingle();

      if (waliExisting) {
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

        result.akunDigenerate.push({
          baris, nama: row.nama_siswa || "-",
          email: validated.data.email!, password: validated.data.password!,
        });
      }

      groupToWaliId.set(key, waliAuthId!);
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
    result.ditambahkan++;
  }

  if (result.berhasil > 0) {
    await writeChangelog({
      supabase, namamenu: "Data Siswa", jenisaksi: "TAMBAH",
      deskripsi: `Impor massal data siswa dari Excel: ${result.ditambahkan} siswa baru ditambahkan, ${result.diperbarui} siswa lama diperbarui, ${result.gagal} gagal`,
    });
  }

  revalidatePath("/admin/user");
  return result;
}