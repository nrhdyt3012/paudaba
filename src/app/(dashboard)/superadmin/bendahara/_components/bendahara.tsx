"use client";

import {
  useState, useEffect, startTransition, useActionState, useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus, Search, Eye, Loader2, Pencil, Trash2, Lock, ShieldCheck, Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import {
  updateAkunWali, updateAkunBendahara, deleteAkun, createBendahara,
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
  email: string;
  noTelp: string;
  role: string;
};

// FIX (Kelola Akun): PENTING — password akun yang SUDAH ADA tidak pernah
// bisa ditampilkan apa adanya. Supabase Auth (dan semua sistem auth yang
// benar) cuma menyimpan HASH satu-arah, bukan teks asli, jadi tidak ada
// cara "membuka" password lama siapa pun, termasuk superadmin. Sel ini
// tetap punya ikon mata sesuai desain yang diminta, tapi mengklik-nya
// menampilkan penjelasan itu (bukan password asli) — satu-satunya cara
// mengganti password adalah RESET lewat tombol Edit.
function PasswordCell() {
  return (
    <button
      type="button"
      onClick={() =>
        toast.info("Password terenkripsi", {
          description:
            "Password tidak bisa ditampilkan demi keamanan (hanya tersimpan sebagai hash). Gunakan tombol Edit untuk mengatur ulang (reset) password.",
        })
      }
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="font-mono tracking-widest">••••••••</span>
      <Eye className="w-3.5 h-3.5" />
    </button>
  );
}

export default function BendaharaManagement() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    { data: AkunRow; type: "edit" | "delete" } | null
  >(null);

  // ─── Ambil data Wali Siswa + Bendahara, gabung jadi satu list ──────────
  const { data: akunList, isLoading } = useQuery({
    queryKey: ["kelola-akun-list"],
    queryFn: async () => {
      const [{ data: siswaData }, { data: adminData }] = await Promise.all([
        supabase.from("siswa").select("id, namawali, email, nowa").order("namawali"),
        supabase.from("admin").select("id, nama, email, nohp").order("nama"),
      ]);

      const waliRows: AkunRow[] = (siswaData || []).map((s: any) => ({
        id: s.id,
        source: "wali",
        namaAkun: s.namawali || "-",
        email: s.email || "-",
        noTelp: s.nowa || "-",
        role: "Wali Siswa",
      }));

      const bendaharaRows: AkunRow[] = (adminData || []).map((a: any) => ({
        id: a.id,
        source: "bendahara",
        namaAkun: a.nama || "-",
        email: a.email || "-",
        noTelp: a.nohp || "-",
        role: "Bendahara",
      }));

      return [...waliRows, ...bendaharaRows];
    },
  });

  useEffect(() => { setCurrentPage(1); }, [search, filterRole]);

  const filteredAkun = useMemo(() => {
    let result = akunList || [];
    if (filterRole !== "semua") result = result.filter((a) => a.source === filterRole);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.namaAkun.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.noTelp.toLowerCase().includes(q)
      );
    }
    return result;
  }, [akunList, filterRole, search]);

  const totalPages = Math.ceil(filteredAkun.length / ITEMS_PER_PAGE);
  const paginated = filteredAkun.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kelola-akun-list"] });
  const handleChangeAction = (open: boolean) => { if (!open) setSelectedAction(null); };

  const tableData = paginated.map((item, index) => [
    (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
    <span key={`nama-${item.id}`} className="font-medium">{item.namaAkun}</span>,
    item.email,
    <PasswordCell key={`pass-${item.id}`} />,
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
    <DropdownAction
      key={`act-${item.id}`}
      menu={[
        {
          label: (
            <span className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit
            </span>
          ),
          action: () => setSelectedAction({ data: item, type: "edit" }),
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
              placeholder="Cari nama, email, atau no. telp..."
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
          <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Bendahara
          </Button>
        </div>
      </div>

      {/* Info kecil: akun Wali Siswa dibuat dari halaman Data Siswa */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" />
        Akun baru untuk <strong>Wali Siswa</strong> dibuat lewat menu{" "}
        <strong>Data Siswa</strong> (butuh data NIS/kelas/angkatan). Halaman
        ini untuk mengedit/menghapus akun yang sudah ada, dan menambah akun{" "}
        <strong>Bendahara</strong> baru.
      </p>

      <DataTable
        header={["No", "Nama Akun", "Email", "Password", "No. Telepon", "Role", "Aksi"]}
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

      <DialogEditAkun
        open={selectedAction?.type === "edit"}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
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
              <ShieldCheck className="w-5 h-5 text-purple-600" />
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
              <Button type="submit" disabled={isPending} className="bg-purple-600 hover:bg-purple-700">
                {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Edit Akun (form berbeda tergantung source) ──────────────────────
function DialogEditAkun({
  open, currentData, handleChangeAction, refetch,
}: {
  open: boolean;
  currentData?: AkunRow;
  handleChangeAction: (open: boolean) => void;
  refetch: () => void;
}) {
  const isWali = currentData?.source === "wali";

  const form = useForm({
    defaultValues: {
      nama: "", email: "", no_telp: "", new_password: "",
    },
  });
  const [isPending, setIsPending] = useState(false);
  const [showPassInput, setShowPassInput] = useState(false);

  // FIX: begitu dialog dibuka, SEMUA field diisi dulu dari data yang
  // sudah ada (tidak kosongan) — sesuai request.
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
    if (data.new_password) formData.append("new_password", data.new_password);

    let state;
    if (isWali) {
      formData.append("nama_wali", data.nama);
      formData.append("email", data.email);
      formData.append("no_wa", data.no_telp);
      state = await updateAkunWali({}, formData);
    } else {
      formData.append("nama", data.nama);
      formData.append("email", data.email);
      formData.append("no_hp", data.no_telp);
      state = await updateAkunBendahara({}, formData);
    }

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
              <Pencil className="w-5 h-5 text-blue-600" />
              Edit Akun {isWali ? "Wali Siswa" : "Bendahara"}
            </DialogTitle>
            <DialogDescription>Ubah data akun di bawah ini</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormInput
              form={form}
              name="nama"
              label={isWali ? "Nama Wali" : "Nama"}
              placeholder="Nama lengkap"
            />
            <FormInput form={form} name="email" label="Email" placeholder="email@example.com" type="email" />
            <FormInput
              form={form}
              name="no_telp"
              label={isWali ? "No. WhatsApp" : "No. Telepon"}
              placeholder="08xxxxxxxxxx"
            />

            {/* FIX: password lama tidak bisa ditampilkan (lihat penjelasan
                di komponen PasswordCell) — di sini cuma opsi RESET,
                kosongkan kalau tidak mau ganti password. */}
            {!showPassInput ? (
              <button
                type="button"
                onClick={() => setShowPassInput(true)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Lock className="w-3.5 h-3.5" />
                Reset password akun ini
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
              <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
                {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
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
            ({currentData?.role})? Tindakan ini tidak dapat dibatalkan.
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
