"use client";

import DataTable from "@/components/common/data-table";
import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import useDataTable from "@/hooks/use-data-table";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Pencil, Plus, Trash2, Download, Loader2, PowerOff, Power, ArrowUpCircle,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { HEADER_TABLE_USER } from "@/constants/user-constant";
import DialogCreateUser from "./dialog-create-user";
import DialogUpdateUser from "./dialog-update-user";
import DialogDeleteUser from "./dialog-delete-user";
import { Profile } from "@/types/auth";
import * as XLSX from "xlsx";
import DialogImportUser from "./dialog-import-user";
import { deleteUser, updateStatusSiswa, promoteKelasSiswa } from "../actions";

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

// FIX (checkbox multi-select): urutan jenjang untuk fitur "Promosikan
// Kelas Terpilih". Siswa di jenjang tertinggi (TK B) otomatis dilewati
// kalau ikut terpilih — tidak ada jenjang berikutnya untuk dipromosikan.
const URUTAN_KELAS = ["KB", "TK A", "TK B"];
function kelasBerikutnya(kelasSekarang: string | null | undefined): string | null {
  const idx = URUTAN_KELAS.indexOf(kelasSekarang || "");
  if (idx === -1 || idx === URUTAN_KELAS.length - 1) return null;
  return URUTAN_KELAS[idx + 1];
}

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

  const handleExportExcel = () => {
  const exportData = filteredSorted.map((item: any, index: number) => ({
    "No": index + 1,
    "NIS": item.nis || "",
    "Nama Siswa": item.namasiswa || "",
    "Jenis Kelamin": item.jeniskelamin || "",
    "Tempat Lahir": item.tempatlahir || "",
    "Tanggal Lahir": item.tanggallahir
      ? new Date(item.tanggallahir).toLocaleDateString("id-ID")
      : "",
    "Nama Wali": item.namawali || "",
    "No WA": item.nowa || "",
    "Alamat": item.alamat || "",
    "Kelas": item.kelas || "",
    "Angkatan": item.angkatan || "",
    "Tipe SPP": item.tipe_spp || "reguler",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet["!cols"] = Object.keys(exportData[0] || {}).map(() => ({ wch: 18 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");
  XLSX.writeFile(workbook, `Data-Siswa-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

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

  // ─── FIX: checkbox multi-select & aksi massal ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeactivateDialog, setShowBulkDeactivateDialog] = useState(false);
  const [showBulkActivateDialog, setShowBulkActivateDialog] = useState(false);
  const [showBulkPromoteDialog, setShowBulkPromoteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkPending, startBulkAction] = useTransition();

  const currentPageIds = useMemo(() => paginatedRows.map((r: any) => r.id), [paginatedRows]);
  const isAllSelectedOnPage =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    }
  };

  const handleToggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  // Diambil dari `filteredSorted` (bukan cuma halaman aktif), supaya
  // seleksi tetap konsisten kalau bendahara pindah halaman.
  const selectedRows = useMemo(
    () => filteredSorted.filter((r: any) => selectedIds.includes(r.id)),
    [filteredSorted, selectedIds]
  );

  // Preview untuk dialog promosi: kelompokkan per kelas asal, tandai mana
  // yang punya jenjang berikutnya vs yang akan dilewati (sudah TK B).
  const promotePreview = useMemo(() => {
    const groups = new Map<string, { total: number; tujuan: string | null }>();
    selectedRows.forEach((r: any) => {
      const asal = r.kelas || "-";
      const tujuan = kelasBerikutnya(r.kelas);
      if (!groups.has(asal)) groups.set(asal, { total: 0, tujuan });
      groups.get(asal)!.total += 1;
    });
    return Array.from(groups.entries()).map(([asal, v]) => ({ asal, ...v }));
  }, [selectedRows]);

  const jumlahBisaDipromosikan = selectedRows.filter((r: any) => kelasBerikutnya(r.kelas)).length;
  const jumlahDilewatiPromosi = selectedRows.length - jumlahBisaDipromosikan;

  const confirmBulkStatus = (statusBaru: "aktif" | "tidak aktif") => {
    startBulkAction(async () => {
      const results = await Promise.all(
        selectedRows.map(async (r: any) => {
          const formData = new FormData();
          formData.append("id", r.id);
          formData.append("status", statusBaru);
          return updateStatusSiswa({}, formData);
        })
      );

      const failedCount = results.filter((res) => res.status === "error").length;
      const successCount = results.length - failedCount;

      if (successCount > 0) {
        toast.success(
          `${successCount} siswa berhasil ${statusBaru === "aktif" ? "diaktifkan" : "dinonaktifkan"}`
        );
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} siswa gagal diubah statusnya`);
      }

      setSelectedIds([]);
      setShowBulkDeactivateDialog(false);
      setShowBulkActivateDialog(false);
      refetch();
    });
  };

  const confirmBulkPromote = () => {
    startBulkAction(async () => {
      const promotable = selectedRows.filter((r: any) => kelasBerikutnya(r.kelas));

      if (promotable.length === 0) {
        toast.error("Tidak ada siswa yang bisa dipromosikan", {
          description: "Semua siswa terpilih sudah berada di jenjang tertinggi (TK B).",
        });
        setShowBulkPromoteDialog(false);
        return;
      }

      const results = await Promise.all(
        promotable.map(async (r: any) => {
          const formData = new FormData();
          formData.append("id", r.id);
          formData.append("kelas_baru", kelasBerikutnya(r.kelas)!);
          return promoteKelasSiswa({}, formData);
        })
      );

      const failedCount = results.filter((res) => res.status === "error").length;
      const successCount = results.length - failedCount;

      if (successCount > 0) toast.success(`${successCount} siswa berhasil dipromosikan kelas`);
      if (failedCount > 0) toast.error(`${failedCount} siswa gagal dipromosikan`);

      setSelectedIds([]);
      setShowBulkPromoteDialog(false);
      refetch();
    });
  };

  const confirmBulkDelete = () => {
    startBulkAction(async () => {
      const results = await Promise.all(
        selectedRows.map(async (r: any) => {
          const formData = new FormData();
          formData.append("id", r.id);
          const res = await deleteUser({} as any, formData);
          return { nama: r.namasiswa || "-", res };
        })
      );

      const gagal = results.filter((r) => r.res.status === "error");
      const berhasil = results.length - gagal.length;

      if (berhasil > 0) toast.success(`${berhasil} siswa berhasil dihapus`);
      if (gagal.length > 0) {
        toast.error(`${gagal.length} siswa gagal dihapus`, {
          description: gagal
            .map((g) => `${g.nama}: ${g.res.errors?._form?.[0] || "gagal"}`)
            .join(" | "),
        });
      }

      setSelectedIds([]);
      setShowBulkDeleteDialog(false);
      refetch();
    });
  };
  // ────────────────────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    return paginatedRows.map((item: any, index: number) => [
      // FIX: kolom checkbox pilih baris, ditaruh paling depan
      <Checkbox
        key={`select-${item.id}`}
        checked={selectedIds.includes(item.id)}
        onCheckedChange={(checked) => handleToggleRow(item.id, !!checked)}
        aria-label={`Pilih ${item.namasiswa}`}
      />,

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
      // FIX: kalau status akademik siswa "tidak aktif", tampilkan penanda
      // kecil di sebelah badge Kelas — BUKAN mengembalikan kolom Status
      // yang sudah sengaja dihapus (itu soal is_active/login, sudah
      // dipindah ke Kelola Akun). Ini murni indikator visual status
      // akademik per-anak biar efek "Nonaktifkan Terpilih" kelihatan.
      <div key={`kelas-${item.id}`} className="flex items-center gap-1.5">
        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          {item.kelas || "-"}
        </span>
        {item.status === "tidak aktif" && (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            Nonaktif
          </span>
        )}
      </div>,

      // Angkatan
      item.angkatan || "-",

      // Tipe SPP
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
  }, [paginatedRows, selectedIds]);

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
          <Button variant="outline" onClick={handleExportExcel}>
  <Download className="w-4 h-4 mr-2" />
  Ekspor Excel
</Button>
<DialogImportUser refetch={refetch} />
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

      {/* FIX: bar aksi massal, cuma muncul kalau ada baris yang dipilih */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/50 border rounded-lg px-4 py-2 mb-3">
          <p className="text-sm">
            <span className="font-semibold">{selectedIds.length}</span> siswa dipilih
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Batal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => setShowBulkActivateDialog(true)}
            >
              <Power className="w-4 h-4 mr-2" />
              Aktifkan Terpilih
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => setShowBulkDeactivateDialog(true)}
            >
              <PowerOff className="w-4 h-4 mr-2" />
              Nonaktifkan Terpilih
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => setShowBulkPromoteDialog(true)}
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Promosikan Kelas Terpilih
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus Terpilih
            </Button>
          </div>
        </div>
      )}

      {/* FIX: kontrol "pilih semua" terpisah di atas tabel, karena prop
          `header` DataTable bertipe string[] jadi tidak bisa diselipi
          elemen Checkbox langsung di dalam array header. */}
      {paginatedRows.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none mb-2">
          <Checkbox
            checked={isAllSelectedOnPage}
            onCheckedChange={(checked) => handleToggleSelectAll(!!checked)}
            aria-label="Pilih semua di halaman ini"
          />
          Pilih semua di halaman ini
        </label>
      )}

      <DataTable
        header={["Pilih", ...HEADER_TABLE_USER]}
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

      {/* FIX: dialog konfirmasi nonaktifkan massal (status akademik, BUKAN
          is_active/login — lihat komentar di actions.ts) */}
      <Dialog open={showBulkDeactivateDialog} onOpenChange={setShowBulkDeactivateDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <PowerOff className="w-5 h-5" />
              Nonaktifkan {selectedIds.length} Siswa?
            </DialogTitle>
            <DialogDescription>
              Status akademik siswa terpilih akan diubah jadi{" "}
              <strong>&quot;tidak aktif&quot;</strong> (misalnya karena lulus atau pindah
              sekolah). Ini <strong>tidak memengaruhi akses login</strong> wali mereka —
              itu tetap dikelola terpisah lewat menu Kelola Akun.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeactivateDialog(false)}
              disabled={isBulkPending}
            >
              Batal
            </Button>
            <Button
              onClick={() => confirmBulkStatus("tidak aktif")}
              disabled={isBulkPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isBulkPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Ya, Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIX: dialog konfirmasi aktifkan massal (kebalikan dari di atas) */}
      <Dialog open={showBulkActivateDialog} onOpenChange={setShowBulkActivateDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Power className="w-5 h-5" />
              Aktifkan {selectedIds.length} Siswa?
            </DialogTitle>
            <DialogDescription>
              Status akademik siswa terpilih akan diubah kembali jadi{" "}
              <strong>&quot;aktif&quot;</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkActivateDialog(false)}
              disabled={isBulkPending}
            >
              Batal
            </Button>
            <Button
              onClick={() => confirmBulkStatus("aktif")}
              disabled={isBulkPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isBulkPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Ya, Aktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIX: dialog konfirmasi promosi kelas massal, dengan preview
          breakdown per kelas asal -> tujuan */}
      <Dialog open={showBulkPromoteDialog} onOpenChange={setShowBulkPromoteDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <ArrowUpCircle className="w-5 h-5" />
              Promosikan {selectedIds.length} Siswa?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <ul className="text-sm list-disc list-inside">
                  {promotePreview.map((g) => (
                    <li key={g.asal}>
                      {g.total} siswa {g.asal}{" "}
                      {g.tujuan ? (
                        <>→ <strong>{g.tujuan}</strong></>
                      ) : (
                        <span className="text-muted-foreground">(dilewati, sudah jenjang tertinggi)</span>
                      )}
                    </li>
                  ))}
                </ul>
                {jumlahDilewatiPromosi > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {jumlahDilewatiPromosi} siswa TK B dilewati karena tidak ada jenjang
                    berikutnya.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkPromoteDialog(false)}
              disabled={isBulkPending}
            >
              Batal
            </Button>
            <Button
              onClick={confirmBulkPromote}
              disabled={isBulkPending || jumlahBisaDipromosikan === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isBulkPending ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                `Ya, Promosikan (${jumlahBisaDipromosikan})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIX: dialog konfirmasi hapus massal — tiap siswa tetap dicek lewat
          guard pembayaran yang sudah ada (cekSiswaBisaDihapus), jadi kalau
          ada yang sudah pernah bayar, baris itu akan gagal & dilaporkan
          lewat toast, bukan diam-diam ke-skip. */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Hapus {selectedIds.length} Siswa?
            </DialogTitle>
            <DialogDescription>
              Tindakan ini <strong>tidak dapat dibatalkan</strong>. Siswa yang sudah
              punya riwayat pembayaran akan otomatis ditolak sistem dan dilaporkan,
              bukan ikut terhapus. Kalau cuma ingin menandai siswa sudah tidak
              aktif sekolah, gunakan &quot;Nonaktifkan Terpilih&quot; saja.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={isBulkPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={isBulkPending}
            >
              {isBulkPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}