"use client";

import {
  useState, useEffect, useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

const ITEMS_PER_PAGE = 10;

const ROLE_OPTIONS = [
  { value: "semua", label: "Semua Role" },
  { value: "wali", label: "Wali Siswa" },
  { value: "bendahara", label: "Bendahara" },
];

type AkunRow = {
  id: string;
  source: "wali" | "bendahara";
  namaAkun: string;
  nis?: string;
  email: string;
  noTelp: string;
  role: string;
  isActive: boolean;
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

  // FIX: "Nama Akun" untuk baris Wali Siswa dari `namasiswa` (nama ANAK),
  // bukan `namawali` — konsisten dengan halaman Info Siswa. NIS ikut
  // diambil untuk jadi pembeda visual kalau ada nama yang mirip/sama.
  // `is_active` ikut diambil untuk kolom Status & aksi
  // aktifkan/nonaktifkan.
  const { data: akunList, isLoading } = useQuery({
    queryKey: ["kelola-akun-list"],
    queryFn: async () => {
      const [{ data: siswaData }, { data: adminData }] = await Promise.all([
        supabase.from("siswa").select("id, namasiswa, nis, email, nowa, is_active").order("namasiswa"),
        supabase.from("admin").select("id, nama, email, nohp, is_active").order("nama"),
      ]);

      const waliRows: AkunRow[] = (siswaData || []).map((s: any) => ({
        id: s.id,
        source: "wali",
        namaAkun: s.namasiswa || "-",
        nis: s.nis || "",
        email: s.email || "-",
        noTelp: s.nowa || "-",
        role: "Wali Siswa",
        isActive: s.is_active !== false,
      }));

      const bendaharaRows: AkunRow[] = (adminData || []).map((a: any) => ({
        id: a.id,
        source: "bendahara",
        namaAkun: a.nama || "-",
        email: a.email || "-",
        noTelp: a.nohp || "-",
        role: "Bendahara",
        isActive: a.is_active !== false,
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

  const filteredAkun = useMemo(() => {
    const sourceData = optimisticAkunList ?? akunList ?? [];
    let result = sourceData;
    if (filterRole !== "semua") result = result.filter((a) => a.source === filterRole);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.namaAkun.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.noTelp.toLowerCase().includes(q) ||
          (a.nis || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [optimisticAkunList, akunList, filterRole, search]);

  const totalPages = Math.ceil(filteredAkun.length / ITEMS_PER_PAGE);
  const paginated = filteredAkun.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kelola-akun-list"] });
  const handleChangeAction = (open: boolean) => { if (!open) setSelectedAction(null); };

  const tableData = paginated.map((item, index) => [
    (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
    <div key={`nama-${item.id}`}>
      <p className="font-medium">{item.namaAkun}</p>
      {/* FIX: NIS sebagai subtext pembeda kalau ada nama mirip/sama
          (email di kolom sebelah juga selalu unik, jadi pembeda ganda). */}
      {item.source === "wali" && item.nis && (
        <p className="text-xs text-muted-foreground">NIS: {item.nis}</p>
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
    // FIX: kolom "Password" (yang lama, tidak berguna karena tidak bisa
    // ditampilkan) diganti kolom "Status" — Aktif/Nonaktif.
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
        // FIX (permintaan lanjutan): untuk Wali Siswa, sekarang bisa ubah
        // EMAIL juga (tidak cuma password) — nama/no WA tetap lewat menu
        // Data Siswa.
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
            <span className="flex items-center gap-2 text-red-500">
              <Trash2 className="w-4 h-4" /> Hapus
            </span>
          ),
          variant: "destructive",
          action: () => setSelectedAction({ data: item, type: "delete" }),
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
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, NIS, atau no. telp..."
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
        <strong>Data Siswa</strong>. Untuk akun Wali Siswa, halaman ini bisa
        mengubah <strong>email &amp; password</strong>, <strong>nonaktifkan/aktifkan</strong>,
        atau <strong>hapus</strong> — nama &amp; no WA tetap lewat Data Siswa.
      </p>

      <DataTable
        header={["No", "Nama Akun", "Email", "No. Telepon", "Role", "Status", "Aksi"]}
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
    </div>
  );
}

// ─── Dialog: Tambah Bendahara ────────────────────────────────────────────────
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

  // FIX: begitu dialog dibuka, email ke-prefill dari data yang ada
  // (tidak kosongan) — password tetap kosong (cuma diisi kalau memang
  // mau diganti).
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
    formData.append("id", currentData.id);
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
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            {/* FIX: email sekarang bisa diubah — Supabase Auth otomatis
                menolak kalau email baru sudah dipakai akun lain, dan
                pesan errornya sudah dibuat ramah dibaca di actions.ts. */}
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

// ─── Dialog: Edit Bendahara (full — nama/email/no telp/password) ────────────
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

  const handleConfirm = async () => {
    if (!currentData) return;
    setIsPending(true);
    const formData = new FormData();
    formData.append("id", currentData.id);
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
                kembali seperti biasa.
              </>
            ) : (
              <>
                Akun <strong>{currentData?.namaAkun}</strong> ({currentData?.role}) akan
                ditolak saat mencoba login, tapi datanya <strong>tidak dihapus</strong> —
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
function DialogDeleteAkun({
  open, currentData, handleChangeAction, refetch,
}: {
  open: boolean;
  currentData?: AkunRow;
  handleChangeAction: (open: boolean) => void;
  refetch: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    if (!currentData) return;
    setIsPending(true);
    const formData = new FormData();
    formData.append("id", currentData.id);
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
            ({currentData?.role})? Tindakan ini <strong>tidak dapat dibatalkan</strong>{" "}
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