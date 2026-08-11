"use client";

import {
  useState, useEffect, useMemo, useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import FormInput from "@/components/common/form-input";
import DataTable from "@/components/common/data-table";
import DropdownAction from "@/components/common/dropdown-action";
import {
  Plus, Search, Loader2, Pencil, Trash2, KeyRound, ShieldCheck, Users,
  Power, PowerOff, Settings,
} from "lucide-react";
import { useForm } from "react-hook-form";
import {
  updateAkunWali, updateAkunBendahara, deleteAkun, createBendahara,
  toggleAkunStatus,
} from "../actions";
import PasswordResetPanel from "./password-reset-panel";

const ITEMS_PER_PAGE = 10;

const ROLE_OPTIONS = [
  { value: "semua", label: "Semua Role" },
  { value: "wali", label: "Wali Siswa" },
  { value: "bendahara", label: "Bendahara" },
];

// ─── FIX (multi-anak per wali): tipe baru untuk data anak dalam satu akun wali ──
type AnakRow = {
  id: string;   // siswa.id
  nama: string;
  nis: string;
};

type AkunRow = {
  // FIX: untuk source "wali", `id` sekarang adalah wali_auth_id
  // (= auth.users.id si wali), BUKAN siswa.id lagi — karena satu akun
  // wali bisa punya banyak baris siswa. Semua aksi (nonaktifkan/hapus/
  // ganti password) harus beroperasi lewat id ini.
  id: string;
  source: "wali" | "bendahara";
  namaAkun: string; // nama wali (untuk bendahara: nama bendahara)
  anak?: AnakRow[]; // FIX: daftar anak, hanya terisi untuk source "wali"
  email: string;
  noTelp: string;
  role: string;
  isActive: boolean;
  // FIX: true kalau SALAH SATU anak di akun wali ini sudah punya minimal
  // 1 tagihan yang pernah dibayar (statuspembayaran SUCCESS) -> dasar
  // memudarkan/memblokir tombol Hapus (satuan maupun massal), karena
  // menghapus akun wali = menghapus akses ke SEMUA anaknya sekaligus.
  hasPaidTagihan: boolean;
};

export default function BendaharaManagement() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [optimisticAkunList, setOptimisticAkunList] = useState<AkunRow[] | null>(null);
  const [selectedAction, setSelectedAction] = useState<
    { data: AkunRow; type: "edit" | "ganti-password" | "toggle-status" | "delete" } | null
  >(null);

  // FIX (multi-anak per wali): query sekarang mengambil semua baris siswa,
  // lalu di-GROUP di client berdasarkan `wali_auth_id` jadi satu baris
  // AkunRow per wali (bukan lagi 1 baris = 1 siswa). `namawali`, `email`,
  // dan `nowa` diasumsikan konsisten di semua baris siswa milik wali yang
  // sama (satu sumber login = satu wali).
  const { data: akunList, isLoading } = useQuery({
    queryKey: ["kelola-akun-list"],
    queryFn: async () => {
      const [{ data: siswaData }, { data: adminData }, { data: paidPembayaran }] = await Promise.all([
        supabase
          .from("siswa")
          .select("id, namasiswa, nis, namawali, email, nowa, is_active, wali_auth_id")
          .order("namasiswa"),
        supabase.from("admin").select("id, nama, email, nohp, is_active").order("nama"),
        supabase
          .from("pembayaran")
          .select("idsiswa")
          .eq("statuspembayaran", "SUCCESS"),
      ]);

      const paidSiswaIds = new Set(
        (paidPembayaran || []).map((p: any) => p.idsiswa).filter(Boolean)
      );

      // FIX: group siswa -> satu AkunRow per wali_auth_id
      const waliMap = new Map<string, AkunRow>();
      (siswaData || []).forEach((s: any) => {
        const waliId = s.wali_auth_id;
        if (!waliId) return; // data siswa yang belum terhubung wali (seharusnya tidak terjadi)

        if (!waliMap.has(waliId)) {
          waliMap.set(waliId, {
            id: waliId,
            source: "wali",
            namaAkun: s.namawali || "-",
            anak: [],
            email: s.email || "-",
            noTelp: s.nowa || "-",
            role: "Wali Siswa",
            isActive: false, // di-OR dari tiap anak di bawah
            hasPaidTagihan: false,
          });
        }

        const row = waliMap.get(waliId)!;
        row.anak!.push({ id: s.id, nama: s.namasiswa || "-", nis: s.nis || "" });

        // FIX: kalau minimal satu baris anak masih is_active, tampilkan
        // akun sebagai "Aktif". Normalnya semua baris anak akan selalu
        // sinkron (karena toggleAkunStatus meng-update semua sekaligus),
        // OR di sini cuma jaga-jaga kalau ada data yang belum konsisten.
        if (s.is_active !== false) row.isActive = true;

        if (paidSiswaIds.has(s.id)) row.hasPaidTagihan = true;
      });

      const waliRows: AkunRow[] = Array.from(waliMap.values());

      const bendaharaRows: AkunRow[] = (adminData || []).map((a: any) => ({
        id: a.id,
        source: "bendahara",
        namaAkun: a.nama || "-",
        email: a.email || "-",
        noTelp: a.nohp || "-",
        role: "Bendahara",
        isActive: a.is_active !== false,
        // Bendahara tidak terkait tagihan siswa, jadi selalu boleh dihapus
        hasPaidTagihan: false,
      }));

      return [...waliRows, ...bendaharaRows];
    },
  });

  useEffect(() => { setCurrentPage(1); }, [search, filterRole]);
  useEffect(() => {
    if (akunList) {
      setOptimisticAkunList(akunList);
    }
  }, [akunList]);

  const handleAkunStatusChange = (id: string, isActive: boolean) => {
    setOptimisticAkunList((prev) =>
      prev
        ? prev.map((item) => (item.id === id ? { ...item, isActive } : item))
        : null
    );

    queryClient.setQueryData<AkunRow[]>(["kelola-akun-list"], (old) =>
      old ? old.map((item) => (item.id === id ? { ...item, isActive } : item)) : undefined
    );
  };

  const allAkun = optimisticAkunList ?? akunList ?? [];

  const filteredAkun = useMemo(() => {
    let result = allAkun;
    if (filterRole !== "semua") result = result.filter((a) => a.source === filterRole);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => {
        // FIX: pencarian sekarang juga menjangkau nama & NIS tiap anak,
        // supaya bendahara tetap bisa cari lewat nama/NIS siswa meski
        // tabelnya sekarang berbasis wali.
        const anakMatch = (a.anak || []).some(
          (c) => c.nama.toLowerCase().includes(q) || c.nis.toLowerCase().includes(q)
        );
        return (
          a.namaAkun.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.noTelp.toLowerCase().includes(q) ||
          anakMatch
        );
      });
    }
    return result;
  }, [allAkun, filterRole, search]);

  const totalPages = Math.ceil(filteredAkun.length / ITEMS_PER_PAGE);
  const paginated = filteredAkun.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kelola-akun-list"] });
  const handleChangeAction = (open: boolean) => { if (!open) setSelectedAction(null); };

  // ─── bulk select (tidak berubah secara struktural, cuma sekarang per-wali) ──
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeactivateDialog, setShowBulkDeactivateDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkPending, startBulkAction] = useTransition();

  const currentPageIds = useMemo(() => paginated.map((item) => item.id), [paginated]);
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

  const selectedAkunObjects = useMemo(
    () => allAkun.filter((a) => selectedIds.includes(a.id)),
    [allAkun, selectedIds]
  );

  const blockedDeleteAccounts = useMemo(
    () => selectedAkunObjects.filter((a) => a.hasPaidTagihan),
    [selectedAkunObjects]
  );
  const hasBlockedDelete = blockedDeleteAccounts.length > 0;

  // FIX: total anak yang bakal kena efek aksi massal, biar copy dialog
  // bisa bilang "beserta N anak" dan bendahara tidak kaget.
  const totalAnakTerdampak = useMemo(
    () => selectedAkunObjects.reduce((sum, a) => sum + (a.anak?.length || 0), 0),
    [selectedAkunObjects]
  );

  const handleBulkDeactivateClick = () => {
    setShowBulkDeactivateDialog(true);
  };

  const handleBulkDeleteClick = () => {
    if (hasBlockedDelete) {
      toast.error(
        `${blockedDeleteAccounts.length} akun yang dipilih sudah memiliki tagihan yang dibayar`,
        { description: "Disarankan untuk menonaktifkan akun tersebut saja, bukan menghapusnya. Hapus dibatalkan." }
      );
      return;
    }
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkDeactivate = () => {
    startBulkAction(async () => {
      const results = await Promise.all(
        selectedAkunObjects.map(async (akun) => {
          const formData = new FormData();
          formData.append("id", akun.id); // wali_auth_id untuk source "wali"
          formData.append("source", akun.source);
          formData.append("is_active", "false");
          return toggleAkunStatus({}, formData);
        })
      );

      const failedCount = results.filter((r) => r.status === "error").length;
      const successCount = results.length - failedCount;

      if (successCount > 0) {
        selectedAkunObjects.forEach((akun) => handleAkunStatusChange(akun.id, false));
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} akun gagal dinonaktifkan`);
      }
      if (successCount > 0) {
        toast.success(`${successCount} akun berhasil dinonaktifkan`);
      }

      setSelectedIds([]);
      setShowBulkDeactivateDialog(false);
      invalidate();
    });
  };

  const confirmBulkDelete = () => {
    if (hasBlockedDelete) return; // safety net, tombol pemicu sudah diblokir di atas

    startBulkAction(async () => {
      const results = await Promise.all(
        selectedAkunObjects.map(async (akun) => {
          const formData = new FormData();
          formData.append("id", akun.id); // wali_auth_id untuk source "wali"
          formData.append("source", akun.source);
          formData.append("nama_akun", akun.namaAkun);
          return deleteAkun({}, formData);
        })
      );

      const failedCount = results.filter((r) => r.status === "error").length;
      const successCount = results.length - failedCount;

      if (failedCount > 0) {
        toast.error(`${failedCount} akun gagal dihapus`);
      }
      if (successCount > 0) {
        toast.success(`${successCount} akun berhasil dihapus`);
      }

      setSelectedIds([]);
      setShowBulkDeleteDialog(false);
      invalidate();
    });
  };
  // ────────────────────────────────────────────────────────────────────────

  const tableData = paginated.map((item, index) => [
    <Checkbox
      key={`select-${item.id}`}
      checked={selectedIds.includes(item.id)}
      onCheckedChange={(checked) => handleToggleRow(item.id, !!checked)}
      aria-label={`Pilih ${item.namaAkun}`}
    />,
    (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
    <div key={`nama-${item.id}`}>
      <p className="font-medium">{item.namaAkun}</p>
      {/* FIX: dulu subtext-nya NIS satu siswa, sekarang jadi daftar
          chip semua anak di akun wali ini (nama + NIS masing-masing). */}
      {item.source === "wali" && item.anak && item.anak.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {item.anak.map((c) => (
            <span
              key={c.id}
              className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
            >
              {c.nama}{c.nis ? ` (${c.nis})` : ""}
            </span>
          ))}
        </div>
      )}
    </div>,
    item.email,
    item.noTelp,
    <span
      key={`role-${item.id}`}
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        item.source === "bendahara"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
      }`}
    >
      {item.role}
    </span>,
    <span
      key={`status-${item.id}`}
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        item.isActive
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
          : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      {item.isActive ? "Aktif" : "Nonaktif"}
    </span>,
    <DropdownAction
      key={`act-${item.id}`}
      menu={[
        item.source === "wali"
          ? {
              label: (
                <span className="flex items-center gap-2 text-green-600">
                  <Settings className="w-4 h-4" /> Ubah Email &amp; Password
                </span>
              ),
              action: () => setSelectedAction({ data: item, type: "ganti-password" }),
            }
          : {
              label: (
                <span className="flex items-center gap-2 text-green-600">
                  <Pencil className="w-4 h-4" /> Edit
                </span>
              ),
              action: () => setSelectedAction({ data: item, type: "edit" }),
            },
        {
          label: (
            <span className="flex items-center gap-2 text-amber-600">
              {item.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              {item.isActive ? "Nonaktifkan" : "Aktifkan"} (Ubah Hak Akses)
            </span>
          ),
          action: () => setSelectedAction({ data: item, type: "toggle-status" }),
        },
        {
          label: (
            <span className={`flex items-center gap-2 text-red-500 ${item.hasPaidTagihan ? "opacity-40" : ""}`}>
              <Trash2 className="w-4 h-4" /> Hapus
            </span>
          ),
          variant: "destructive",
          action: () => {
            if (item.hasPaidTagihan) {
              toast.error("Akun ini sudah memiliki tagihan yang dibayar", {
                description: "Disarankan untuk menonaktifkan akun ini saja, bukan menghapusnya.",
              });
              return;
            }
            setSelectedAction({ data: item, type: "delete" });
          },
        },
      ]}
    />,
  ]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kelola Akun</h1>
          <p className="text-sm text-muted-foreground">
            Manajemen akun Wali Siswa &amp; Bendahara
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <PasswordResetPanel/>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama wali, nama anak, email, NIS, atau no. telp..."
              className="pl-8 w-full sm:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreate(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Bendahara
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" />
        Akun baru untuk <strong>Wali Siswa</strong> dibuat lewat menu{" "}
        <strong>Data Siswa</strong>. Satu akun wali bisa menaungi lebih dari
        satu anak — <strong>nonaktifkan/hapus</strong> di sini berlaku untuk
        akses login wali tersebut secara keseluruhan (semua anaknya ikut
        terdampak). Nama &amp; no WA tiap anak tetap diubah lewat Data Siswa.
      </p>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/50 border rounded-lg px-4 py-2">
          <p className="text-sm">
            <span className="font-semibold">{selectedIds.length}</span> akun dipilih
            {totalAnakTerdampak > 0 && (
              <span className="text-muted-foreground"> ({totalAnakTerdampak} anak terdampak)</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Batal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={handleBulkDeactivateClick}
            >
              <PowerOff className="w-4 h-4 mr-2" />
              Nonaktifkan Terpilih
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className={hasBlockedDelete ? "opacity-40" : ""}
              onClick={handleBulkDeleteClick}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus Terpilih
            </Button>
          </div>
        </div>
      )}

      {paginated.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={isAllSelectedOnPage}
            onCheckedChange={(checked) => handleToggleSelectAll(!!checked)}
            aria-label="Pilih semua di halaman ini"
          />
          Pilih semua di halaman ini
        </label>
      )}

      <DataTable
        header={["Pilih", "No", "Nama Akun / Anak", "Email", "No. Telepon", "Role", "Status", "Aksi"]}
        data={tableData}
        isLoading={isLoading}
        totalPages={totalPages}
        currentPage={currentPage}
        currentLimit={ITEMS_PER_PAGE}
        onChangePage={setCurrentPage}
        onChangeLimit={() => {}}
      />

      <DialogCreateBendahara
        open={showCreate}
        onOpenChange={setShowCreate}
        refetch={invalidate}
      />

      <DialogGantiPasswordWali
        open={selectedAction?.type === "ganti-password"}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
        refetch={invalidate}
      />

      <DialogEditBendahara
        open={selectedAction?.type === "edit"}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
        refetch={invalidate}
      />

      <DialogToggleStatus
        open={selectedAction?.type === "toggle-status"}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
        onStatusUpdated={handleAkunStatusChange}
        refetch={invalidate}
      />

      <DialogDeleteAkun
        open={selectedAction?.type === "delete"}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
        refetch={invalidate}
      />

      <Dialog open={showBulkDeactivateDialog} onOpenChange={setShowBulkDeactivateDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <PowerOff className="w-5 h-5" />
              Nonaktifkan {selectedIds.length} Akun?
            </DialogTitle>
            <DialogDescription>
              Akun-akun yang dipilih akan ditolak saat mencoba login
              {totalAnakTerdampak > 0 && <> (total <strong>{totalAnakTerdampak} anak</strong> terdampak)</>},
              tapi datanya <strong>tidak dihapus</strong> — bisa diaktifkan lagi kapan saja.
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
              onClick={confirmBulkDeactivate}
              disabled={isBulkPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isBulkPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Ya, Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Hapus {selectedIds.length} Akun?
            </DialogTitle>
            <DialogDescription>
              Tindakan ini <strong>tidak dapat dibatalkan</strong>
              {totalAnakTerdampak > 0 && <> dan akan menghapus akses <strong>{totalAnakTerdampak} anak</strong> sekaligus</>}.
              Kalau cuma ingin membatasi akses sementara, gunakan &quot;Nonaktifkan Terpilih&quot; saja.
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

// ─── Dialog: Tambah Bendahara (tidak berubah) ────────────────────────────────
function DialogCreateBendahara({
  open, onOpenChange, refetch,
}: { open: boolean; onOpenChange: (o: boolean) => void; refetch: () => void }) {
  const form = useForm({ defaultValues: { nama: "", email: "", password: "", no_hp: "" } });
  const [isPending, setIsPending] = useState(false);

  const onSubmit = form.handleSubmit(async (data) => {
    setIsPending(true);
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => formData.append(k, v as string));
    const state = await createBendahara({}, formData);
    setIsPending(false);

    if (state.status === "error") {
      toast.error("Gagal menambah akun", { description: state.errors?._form?.[0] });
    } else {
      toast.success("Akun Bendahara berhasil dibuat");
      form.reset();
      onOpenChange(false);
      refetch();
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <Form {...form}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Tambah Akun Bendahara
            </DialogTitle>
            <DialogDescription>Buat akun baru untuk bendahara sekolah</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormInput form={form} name="nama" label="Nama" placeholder="Nama lengkap" />
            <FormInput form={form} name="email" label="Email" placeholder="email@example.com" type="email" />
            <FormInput form={form} name="password" label="Password" placeholder="Minimal 6 karakter" type="password" />
            <FormInput form={form} name="no_hp" label="No. Telepon" placeholder="08xxxxxxxxxx" />
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isPending}>Batal</Button></DialogClose>
              <Button type="submit" disabled={isPending} className="bg-green-600 hover:bg-green-700">
                {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Ubah Email & Password (khusus Wali Siswa) ───────────────────────
// FIX: `currentData.id` sekarang = wali_auth_id. Ini kemungkinan besar TIDAK
// perlu perubahan di actions.ts, karena updateAkunWali sepertinya sudah
// mengubah Supabase Auth lewat admin API pakai id = auth.users.id — dan
// wali_auth_id itu MEMANG auth.users.id-nya. Tolong cek ulang isi
// updateAkunWali di actions.ts kamu untuk pastikan asumsi ini benar.
function DialogGantiPasswordWali({
  open, currentData, handleChangeAction, refetch,
}: {
  open: boolean;
  currentData?: AkunRow;
  handleChangeAction: (open: boolean) => void;
  refetch: () => void;
}) {
  const form = useForm({ defaultValues: { email: "", new_password: "" } });
  const [isPending, setIsPending] = useState(false);
  const [showPassInput, setShowPassInput] = useState(false);

  useEffect(() => {
    if (open && currentData) {
      form.reset({ email: currentData.email, new_password: "" });
      setShowPassInput(false);
    }
  }, [open, currentData]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (!currentData) return;
    setIsPending(true);
    const formData = new FormData();
    formData.append("id", currentData.id); // wali_auth_id
    formData.append("email", data.email);
    if (data.new_password) formData.append("new_password", data.new_password);
    const state = await updateAkunWali({}, formData);
    setIsPending(false);

    if (state.status === "error") {
      toast.error("Gagal menyimpan perubahan", { description: state.errors?._form?.[0] });
    } else {
      toast.success(`Akun ${currentData.namaAkun} berhasil diperbarui`);
      handleChangeAction(false);
      refetch();
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleChangeAction}>
      <DialogContent className="sm:max-w-[380px]">
        <Form {...form}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-green-600" />
              Ubah Email &amp; Password
            </DialogTitle>
            <DialogDescription>
              Akun Wali Siswa: <strong>{currentData?.namaAkun}</strong>
              {currentData?.anak && currentData.anak.length > 0 && (
                <> — orang tua dari{" "}
                  <strong>{currentData.anak.map((c) => c.nama).join(", ")}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormInput
              form={form}
              name="email"
              label="Email"
              placeholder="email@example.com"
              type="email"
            />

            {!showPassInput ? (
              <button
                type="button"
                onClick={() => setShowPassInput(true)}
                className="flex items-center gap-2 text-sm text-green-600 hover:underline"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Ganti password akun ini juga
              </button>
            ) : (
              <FormInput
                form={form}
                name="new_password"
                label="Password Baru"
                placeholder="Kosongkan kalau tidak ingin ganti"
                type="password"
              />
            )}

            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isPending}>Batal</Button></DialogClose>
              <Button type="submit" disabled={isPending} className="bg-green-600 hover:bg-green-700">
                {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Edit Bendahara (tidak berubah) ──────────────────────────────────
function DialogEditBendahara({
  open, currentData, handleChangeAction, refetch,
}: {
  open: boolean;
  currentData?: AkunRow;
  handleChangeAction: (open: boolean) => void;
  refetch: () => void;
}) {
  const form = useForm({
    defaultValues: { nama: "", email: "", no_telp: "", new_password: "" },
  });
  const [isPending, setIsPending] = useState(false);
  const [showPassInput, setShowPassInput] = useState(false);

  useEffect(() => {
    if (currentData && open) {
      form.reset({
        nama: currentData.namaAkun,
        email: currentData.email,
        no_telp: currentData.noTelp,
        new_password: "",
      });
      setShowPassInput(false);
    }
  }, [currentData, open]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (!currentData) return;
    setIsPending(true);

    const formData = new FormData();
    formData.append("id", currentData.id);
    formData.append("nama", data.nama);
    formData.append("email", data.email);
    formData.append("no_hp", data.no_telp);
    if (data.new_password) formData.append("new_password", data.new_password);

    const state = await updateAkunBendahara({}, formData);
    setIsPending(false);

    if (state.status === "error") {
      toast.error("Gagal menyimpan perubahan", { description: state.errors?._form?.[0] });
    } else {
      toast.success("Akun berhasil diperbarui");
      handleChangeAction(false);
      refetch();
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleChangeAction}>
      <DialogContent className="sm:max-w-[420px]">
        <Form {...form}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-green-600" />
              Edit Akun Bendahara
            </DialogTitle>
            <DialogDescription>Ubah data akun di bawah ini</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormInput form={form} name="nama" label="Nama" placeholder="Nama lengkap" />
            <FormInput form={form} name="email" label="Email" placeholder="email@example.com" type="email" />
            <FormInput form={form} name="no_telp" label="No. Telepon" placeholder="08xxxxxxxxxx" />

            {!showPassInput ? (
              <button
                type="button"
                onClick={() => setShowPassInput(true)}
                className="flex items-center gap-2 text-sm text-green-600 hover:underline"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Ganti password akun ini
              </button>
            ) : (
              <FormInput
                form={form}
                name="new_password"
                label="Password Baru"
                placeholder="Kosongkan kalau tidak ingin ganti"
                type="password"
              />
            )}

            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isPending}>Batal</Button></DialogClose>
              <Button type="submit" disabled={isPending} className="bg-green-600 hover:bg-green-700">
                {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Aktifkan / Nonaktifkan (Ubah Hak Akses) ─────────────────────────
// FIX: description sekarang menyebutkan semua anak yang ikut terdampak,
// karena satu toggle di sini = toggle akses login wali (semua anaknya).
function DialogToggleStatus({
  open, currentData, handleChangeAction, onStatusUpdated, refetch,
}: {
  open: boolean;
  currentData?: AkunRow;
  handleChangeAction: (open: boolean) => void;
  onStatusUpdated: (id: string, isActive: boolean) => void;
  refetch: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const willActivate = currentData ? !currentData.isActive : false;
  const anakList = currentData?.anak?.map((c) => c.nama).join(", ");

  const handleConfirm = async () => {
    if (!currentData) return;
    setIsPending(true);
    const formData = new FormData();
    formData.append("id", currentData.id); // wali_auth_id untuk source "wali"
    formData.append("source", currentData.source);
    formData.append("is_active", willActivate ? "true" : "false");
    const state = await toggleAkunStatus({}, formData);
    setIsPending(false);

    if (state.status === "error") {
      toast.error("Gagal mengubah status akun", { description: state.errors?._form?.[0] });
      return;
    }

    toast.success(
      willActivate
        ? `Akun ${currentData.namaAkun} diaktifkan kembali`
        : `Akun ${currentData.namaAkun} dinonaktifkan`
    );

    onStatusUpdated(currentData.id, willActivate);

    handleChangeAction(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleChangeAction}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            {willActivate ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
            {willActivate ? "Aktifkan Akun" : "Nonaktifkan Akun"}
          </DialogTitle>
          <DialogDescription>
            {willActivate ? (
              <>
                Akun <strong>{currentData?.namaAkun}</strong> akan bisa login
                kembali seperti biasa
                {anakList && <> untuk semua anaknya (<strong>{anakList}</strong>)</>}.
              </>
            ) : (
              <>
                Akun <strong>{currentData?.namaAkun}</strong> ({currentData?.role}) akan
                ditolak saat mencoba login
                {anakList && <>, berlaku untuk semua anaknya (<strong>{anakList}</strong>)</>},
                tapi datanya <strong>tidak dihapus</strong> —
                bisa diaktifkan lagi kapan saja.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isPending}>Batal</Button></DialogClose>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className={willActivate ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}
          >
            {isPending ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : willActivate ? (
              "Ya, Aktifkan"
            ) : (
              "Ya, Nonaktifkan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Hapus Akun ───────────────────────────────────────────────────────
// FIX: description sekarang menyebutkan semua anak yang ikut kehapus,
// karena menghapus akun wali = menghapus akses ke SEMUA anaknya.
function DialogDeleteAkun({
  open, currentData, handleChangeAction, refetch,
}: {
  open: boolean;
  currentData?: AkunRow;
  handleChangeAction: (open: boolean) => void;
  refetch: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const anakList = currentData?.anak?.map((c) => c.nama).join(", ");

  const handleDelete = async () => {
    if (!currentData) return;
    setIsPending(true);
    const formData = new FormData();
    formData.append("id", currentData.id); // wali_auth_id untuk source "wali"
    formData.append("source", currentData.source);
    formData.append("nama_akun", currentData.namaAkun);
    const state = await deleteAkun({}, formData);
    setIsPending(false);

    if (state.status === "error") {
      toast.error("Gagal menghapus akun", { description: state.errors?._form?.[0] });
    } else {
      toast.success("Akun berhasil dihapus");
      handleChangeAction(false);
      refetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleChangeAction}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            Hapus Akun
          </DialogTitle>
          <DialogDescription>
            Yakin ingin menghapus akun <strong>{currentData?.namaAkun}</strong>{" "}
            ({currentData?.role})
            {anakList && <> beserta akses semua anaknya (<strong>{anakList}</strong>)</>}?
            Tindakan ini <strong>tidak dapat dibatalkan</strong>{" "}
            — kalau cuma ingin membatasi akses sementara, gunakan &quot;Nonaktifkan&quot;
            saja.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isPending}>Batal</Button></DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Ya, Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}