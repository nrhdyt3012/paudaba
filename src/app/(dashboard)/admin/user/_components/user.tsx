"use client";

import DataTable from "@/components/common/data-table";
import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import useDataTable from "@/hooks/use-data-table";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HEADER_TABLE_USER } from "@/constants/user-constant";
import DialogCreateUser from "./dialog-create-user";
import DialogUpdateUser from "./dialog-update-user";
import DialogDeleteUser from "./dialog-delete-user";
import { Profile } from "@/types/auth";

const KELAS_FILTER_OPTIONS = [
  { value: "semua", label: "Semua Kelas" },
  { value: "KB", label: "KB" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

const JENIS_KELAMIN_FILTER_OPTIONS = [
  { value: "semua", label: "Semua Jenis Kelamin" },
  { value: "laki-laki", label: "Laki-laki" },
  { value: "perempuan", label: "Perempuan" },
];

const SORT_OPTIONS = [
  { value: "terbaru", label: "Terbaru Ditambahkan" },
  { value: "nis", label: "NIS (Kecil → Besar)" },
  { value: "nama", label: "Nama (A → Z)" },
];

// FIX: helper normalisasi jenis kelamin — data lama kadang tersimpan
// beda-beda casing/singkatan ("Laki-laki"/"laki-laki"/"L"), jadi filter
// jenis kelamin dilakukan di client (bukan `.eq()` langsung ke Supabase)
// supaya tetap akurat untuk data lama maupun baru. Pola yang sama dengan
// yang dipakai di popup dashboard (siswa-list-dialog.tsx).
function isLakiLaki(jk: string | null | undefined) {
  const v = (jk || "").toLowerCase();
  return v === "laki-laki" || v === "l";
}
function isPerempuan(jk: string | null | undefined) {
  const v = (jk || "").toLowerCase();
  return v === "perempuan" || v === "p";
}

export default function UserManagement() {
  const supabase = createClient();
  const {
    currentPage,
    currentLimit,
    currentSearch,
    handleChangePage,
    handleChangeLimit,
    handleChangeSearch,
  } = useDataTable();

  const [filterKelas, setFilterKelas] = useState("semua");
  const [filterJenisKelamin, setFilterJenisKelamin] = useState("semua");
  const [sortBy, setSortBy] = useState("terbaru");

  // FIX: query sekarang ambil SEMUA baris yang cocok search+kelas (tanpa
  // `.range()` server-side) — karena filter Jenis Kelamin & sortir NIS/Nama
  // dilakukan di client (lihat alasan di helper isLakiLaki/isPerempuan di
  // atas), jadi pagination juga digeser jadi di client supaya hasilnya
  // tetap akurat & konsisten.
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["siswa-list", currentSearch, filterKelas],
    queryFn: async () => {
      let query = supabase.from("siswa").select("*");

      if (currentSearch) {
        query = query.or(
          `namasiswa.ilike.%${currentSearch}%,nis.ilike.%${currentSearch}%,kelas.ilike.%${currentSearch}%`
        );
      }
      if (filterKelas !== "semua") {
        query = query.eq("kelas", filterKelas);
      }

      const result = await query;
      if (result.error) {
        toast.error("Gagal memuat data siswa", { description: result.error.message });
      }
      return result;
    },
  });

  const [selectedAction, setSelectedAction] = useState<{
    data: Profile;
    type: "update" | "delete";
  } | null>(null);

  const handleChangeAction = (open: boolean) => {
    if (!open) setSelectedAction(null);
  };

  // FIX: filter Jenis Kelamin + sortir (NIS naik / Nama A-Z / terbaru)
  // diterapkan di sini, sebelum data dipotong per halaman.
  const filteredSorted = useMemo(() => {
    let rows = users?.data || [];

    if (filterJenisKelamin === "laki-laki") {
      rows = rows.filter((r: any) => isLakiLaki(r.jeniskelamin));
    } else if (filterJenisKelamin === "perempuan") {
      rows = rows.filter((r: any) => isPerempuan(r.jeniskelamin));
    }

    rows = [...rows].sort((a: any, b: any) => {
      if (sortBy === "nis") {
        const nisA = parseInt(a.nis, 10);
        const nisB = parseInt(b.nis, 10);
        const validA = !isNaN(nisA);
        const validB = !isNaN(nisB);
        if (validA && validB) return nisA - nisB;
        if (validA) return -1; // NIS valid didahulukan dari yang kosong/non-angka
        if (validB) return 1;
        return (a.nis || "").localeCompare(b.nis || "");
      }
      if (sortBy === "nama") {
        return (a.namasiswa || "").localeCompare(b.namasiswa || "");
      }
      // "terbaru" (default)
      return (
        new Date(b.createdat).getTime() - new Date(a.createdat).getTime()
      );
    });

    return rows;
  }, [users, filterJenisKelamin, sortBy]);

  const totalPages = useMemo(
    () => Math.ceil(filteredSorted.length / currentLimit),
    [filteredSorted, currentLimit]
  );

  const paginatedRows = useMemo(
    () =>
      filteredSorted.slice(
        (currentPage - 1) * currentLimit,
        currentPage * currentLimit
      ),
    [filteredSorted, currentPage, currentLimit]
  );

  const filteredData = useMemo(() => {
    return paginatedRows.map((item: any, index: number) => [
      currentLimit * (currentPage - 1) + index + 1,

      // NIS
      <span key={`nis-${item.id}`} className="font-mono text-sm">
        {item.nis || "-"}
      </span>,

      // Nama Siswa
      <div key={`nama-${item.id}`}>
        <p className="font-medium">{item.namasiswa || "-"}</p>
      </div>,

      // Jenis Kelamin
      item.jeniskelamin || "-",

      // Tempat Lahir
      item.tempatlahir || "-",

      // Tanggal Lahir
      item.tanggallahir
        ? new Date(item.tanggallahir).toLocaleDateString("id-ID")
        : "-",

      // Nama Wali
      item.namawali || "-",

      // No WA
      item.nowa || "-",

      // FIX: kolom Alamat baru — supaya konsisten, sekarang juga tampil
      // di tabel Data Siswa (sebelumnya cuma bisa diisi lewat form, tidak
      // kelihatan di listnya).
      <span key={`alamat-${item.id}`} className="text-sm max-w-[200px] truncate block" title={item.alamat || "-"}>
        {item.alamat || "-"}
      </span>,

      // Kelas
      <span
        key={`kelas-${item.id}`}
        className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
      >
        {item.kelas || "-"}
      </span>,

      // Angkatan
      item.angkatan || "-",

      // Tipe SPP ← kolom baru
      <span
        key={`tipe-${item.id}`}
        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
          item.tipe_spp === "subsidi"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
            : "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100"
        }`}
      >
        {item.tipe_spp || "reguler"}
      </span>,

      // FIX: kolom Status dihapus dari halaman ini (arahan kamu) — status
      // keaktifan akun sekarang dikendalikan terpusat dari menu Kelola
      // Akun (kolom `is_active`), tidak perlu duplikasi konsep di sini.

      // Aksi
      <DropdownAction
        key={`act-${item.id}`}
        menu={[
          {
            label: (
              <span className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Edit
              </span>
            ),
            action: () =>
              setSelectedAction({
                data: {
                  id: item.id,
                  name: item.namasiswa,
                  namaSiswa: item.namasiswa,
                  NIS: item.nis,
                  kelas: item.kelas,
                  angkatan: item.angkatan,
                  namaWali: item.namawali,
                  noWa: item.nowa,
                  tempatLahir: item.tempatlahir,
                  tanggalLahir: item.tanggallahir,
                  jeniskelamin: item.jeniskelamin,
                  tipe_spp: item.tipe_spp || "reguler",
                  // FIX: alamat sebelumnya kelewat, belum ikut ke-prefill
                  // di dialog Edit (cuma tampil di tabel). "status" dihapus
                  // dari sini (kolomnya sudah tidak dipakai lagi).
                  alamat: item.alamat,
                  role: "siswa",
                } as Profile & { jeniskelamin?: string; tipe_spp?: string },
                type: "update",
              }),
          },
          {
            label: (
              <span className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                Hapus
              </span>
            ),
            variant: "destructive" as const,
            action: () =>
              setSelectedAction({
                data: {
                  id: item.id,
                  name: item.namasiswa,
                  namaSiswa: item.namasiswa,
                  avatar_url: item.avatarurl,
                  role: "siswa",
                } as Profile,
                type: "delete",
              }),
          },
        ]}
      />,
    ]);
  }, [paginatedRows]);

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row mb-4 gap-2 justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold">Data Siswa</h1>
          <p className="text-sm text-muted-foreground">Kelola data siswa KB, TK A, dan TK B</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Cari nama, NIS, atau kelas..."
            className="w-full sm:w-56"
            onChange={(e) => handleChangeSearch(e.target.value)}
          />
          {/* FIX: filter Kelas & Jenis Kelamin (pola sama seperti popup
              dashboard), plus dropdown sortir NIS/Nama. */}
          <Select
            value={filterKelas}
            onValueChange={(v) => { setFilterKelas(v); handleChangePage(1); }}
          >
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KELAS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterJenisKelamin}
            onValueChange={(v) => { setFilterJenisKelamin(v); handleChangePage(1); }}
          >
            <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JENIS_KELAMIN_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortBy}
            onValueChange={(v) => { setSortBy(v); handleChangePage(1); }}
          >
            <SelectTrigger className="w-full sm:w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Tambah
              </Button>
            </DialogTrigger>
            <DialogCreateUser refetch={refetch} />
          </Dialog>
        </div>
      </div>

      <DataTable
        header={HEADER_TABLE_USER}
        data={filteredData}
        isLoading={isLoading}
        totalPages={totalPages}
        currentPage={currentPage}
        currentLimit={currentLimit}
        onChangePage={handleChangePage}
        onChangeLimit={handleChangeLimit}
      />

      <DialogUpdateUser
        open={selectedAction?.type === "update"}
        refetch={refetch}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />

      <DialogDeleteUser
        open={selectedAction?.type === "delete"}
        refetch={refetch}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />
    </div>
  );
}