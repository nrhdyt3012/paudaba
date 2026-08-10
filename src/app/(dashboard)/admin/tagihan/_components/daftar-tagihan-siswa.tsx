"use client";

import DataTable from "@/components/common/data-table";
import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useDataTable from "@/hooks/use-data-table";
import { createClient } from "@/lib/supabase/client";
import { convertIDR, cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Banknote,
  Lock,
  MessageSquare,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import DialogDeleteTagihanSiswa from "./dialog-delete-tagihan-siswa";
import DialogBayarManual from "./dialog-bayar-manual";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const KELAS_OPTIONS = [
  { value: "KB", label: "KB" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

const STATUS_OPTIONS = [
  { value: "LUNAS", label: "Sudah Bayar" },
  { value: "BELUM LUNAS", label: "Belum Lunas" },
  { value: "BELUM BAYAR", label: "Belum Bayar" },
];

// Jeda pengiriman reminder massal — pola sama seperti halaman Reminder
// Tunggakan (anti-banned Fonnte: 30-60 detik antar siswa).
const MIN_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60_000;
const randomDelay = () =>
  Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getTagihanPermissions(item: any) {
  const pembayaran: any[] = item.pembayaran ?? [];
  const hasMidtrans = pembayaran.some(
    (p) =>
      p.statuspembayaran === "SUCCESS" &&
      p.metodepembayaran !== "cash" &&
      p.metodepembayaran !== "transfer"
  );
  const hasAnySuccess = pembayaran.some((p) => p.statuspembayaran === "SUCCESS");

  const successPembayaran = pembayaran.find((p) => p.statuspembayaran === "SUCCESS");
  const metodeLabel =
    successPembayaran?.metodepembayaran === "transfer"
      ? "via Transfer"
      : successPembayaran?.metodepembayaran === "cash"
      ? "via Cash"
      : "via Midtrans";

  return {
    canBayarManual: !hasMidtrans && item.statuspembayaran !== "LUNAS",
    // Boleh dihapus kalau belum pernah ada pembayaran SUCCESS sama sekali.
    canDelete: !hasAnySuccess,
    hasMidtrans,
    metodeLabel,
  };
}

// ─── Dropdown filter multi-select (checkbox), hanya dipakai di toolbar
// default (bukan saat mode pilih-banyak) ──────────────────────────────
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const displayLabel = selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        className="w-[150px] justify-between font-normal"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-[200px] rounded-md border bg-popover p-2 shadow-md">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggleValue(opt.value)}
              />
              {opt.label}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Reset filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DaftarTagihanSiswa() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    currentPage, currentLimit, currentSearch,
    handleChangePage, handleChangeLimit, handleChangeSearch,
  } = useDataTable();

  const [filterKelas, setFilterKelas] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  const { data: stats } = useQuery({
    queryKey: ["tagihan-admin-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("tagihan_siswa").select("*", { count: "exact", head: true });
      const { count: belumLunas } = await supabase
        .from("tagihan_siswa").select("*", { count: "exact", head: true })
        .in("statuspembayaran", ["BELUM BAYAR", "BELUM LUNAS"]);
      const { count: lunas } = await supabase
        .from("tagihan_siswa").select("*", { count: "exact", head: true })
        .eq("statuspembayaran", "LUNAS");
      return { total: total || 0, belumLunas: belumLunas || 0, lunas: lunas || 0 };
    },
  });

  const { data: tagihanList, isLoading } = useQuery({
    queryKey: ["tagihan-siswa-list", currentPage, currentLimit, currentSearch, filterKelas, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("tagihan_siswa")
        .select(
          `*, siswa!idsiswa(id, namasiswa, kelas, nowa),
          pembayaran(idpembayaran, statuspembayaran, metodepembayaran)`,
          { count: "exact" }
        );

      if (filterStatus.length > 0) query = query.in("statuspembayaran", filterStatus);
      if (filterKelas.length > 0) query = query.in("siswa.kelas", filterKelas);

      if (currentSearch) {
        query = query.or(
          `siswa.namasiswa.ilike.%${currentSearch}%,namatagihan.ilike.%${currentSearch}%`
        );
      }

      const { data, count, error } = await query
        .range((currentPage - 1) * currentLimit, currentPage * currentLimit - 1)
        .order("createdat", { ascending: false });

      if (error) toast.error("Gagal memuat tagihan", { description: error.message });

      let result = data || [];
      if (filterKelas.length > 0) {
        result = result.filter((item: any) => filterKelas.includes(item.siswa?.kelas));
      }

      return { data: result, count: count || 0 };
    },
  });

  const [selectedAction, setSelectedAction] = useState<{ data: any; type: "bayar" | "delete" } | null>(null);
  const handleChangeAction = (open: boolean) => { if (!open) setSelectedAction(null); };

  // ─── Seleksi baris untuk aksi massal ──────────────────────────────────
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderProgress, setReminderProgress] = useState({ done: 0, total: 0 });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const invalidateTagihanQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["tagihan-siswa-list"] });
    queryClient.invalidateQueries({ queryKey: ["tagihan-admin-stats"] });
  };

  useEffect(() => {
    const channel = supabase
      .channel("tagihan_siswa-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tagihan_siswa" }, () => {
        invalidateTagihanQueries();
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const rawItems: any[] = tagihanList?.data || [];

  // FIX: bukan reset total setiap ganti halaman/pencarian/filter, tapi
  // sinkronisasi — id yang masih ada di hasil terbaru tetap dipertahankan,
  // yang sudah tidak muncul lagi di tabel baru dibuang dari seleksi.
  // Karena filter tidak bisa diubah selama mode pilih-banyak aktif (lihat
  // toolbar di bawah), efek ini praktis hanya berperan saat pindah halaman
  // atau ganti kata pencarian.
  useEffect(() => {
    setSelectedRows((prev) => {
      if (prev.size === 0) return prev;
      const currentIds = new Set(rawItems.map((item) => item.idtagihansiswa));
      let changed = false;
      const next = new Set<number>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems]);

  const toggleRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllOnPageSelected = rawItems.length > 0 && rawItems.every((i) => selectedRows.has(i.idtagihansiswa));
  const toggleSelectAllOnPage = () => {
    if (isAllOnPageSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(rawItems.map((i) => i.idtagihansiswa)));
  };
  const clearSelection = () => setSelectedRows(new Set());

  const selectedItems = useMemo(
    () => rawItems.filter((item) => selectedRows.has(item.idtagihansiswa)),
    [rawItems, selectedRows]
  );

  // Hapus massal hanya boleh kalau SEMUA tagihan terpilih belum pernah
  // punya riwayat pembayaran SUCCESS sama sekali.
  const itemsNotDeletable = useMemo(
    () => selectedItems.filter((item) => !getTagihanPermissions(item).canDelete),
    [selectedItems]
  );
  const canBulkDelete = selectedItems.length > 0 && itemsNotDeletable.length === 0;

  // Reminder tunggakan hanya boleh kalau TIDAK ADA satupun tagihan
  // terpilih yang statusnya LUNAS. BELUM BAYAR & BELUM LUNAS boleh.
  const lunasItemsSelected = useMemo(
    () => selectedItems.filter((item) => item.statuspembayaran === "LUNAS"),
    [selectedItems]
  );
  const canBulkReminder = selectedItems.length > 0 && lunasItemsSelected.length === 0;

  const handleKirimReminderTerpilih = async () => {
    if (!canBulkReminder) {
      const namaSiswa = Array.from(
        new Set(lunasItemsSelected.map((item) => item.siswa?.namasiswa || "siswa"))
      ).join(", ");
      toast.error(
        `Tidak bisa mengirim reminder: terdapat tagihan yang sudah LUNAS pada ${namaSiswa}. ` +
          `Batalkan centang tagihan yang sudah lunas terlebih dahulu.`
      );
      return;
    }

    const map = new Map<string, { idsiswa: string; namasiswa: string; nowa: string; tagihanIds: number[] }>();
    let skippedNoWa = 0;

    selectedItems.forEach((item) => {
      const nowa = item.siswa?.nowa;
      if (!nowa || nowa.length < 10) {
        skippedNoWa++;
        return;
      }
      if (!map.has(item.siswa.id)) {
        map.set(item.siswa.id, {
          idsiswa: item.siswa.id,
          namasiswa: item.siswa.namasiswa,
          nowa,
          tagihanIds: [],
        });
      }
      map.get(item.siswa.id)!.tagihanIds.push(item.idtagihansiswa);
    });

    const targets = Array.from(map.values());

    if (targets.length === 0) {
      toast.error("Tidak ada siswa dengan nomor WhatsApp valid pada tagihan yang dipilih");
      return;
    }
    if (skippedNoWa > 0) {
      toast.warning(`${skippedNoWa} tagihan dilewati karena siswa tidak punya No. WA valid`);
    }

    setIsSendingReminder(true);
    setReminderProgress({ done: 0, total: targets.length });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const g = targets[i];
      try {
        const res = await fetch("/api/notifications/send-bill-massal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idSiswa: g.idsiswa, idTagihanList: g.tagihanIds }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mengirim");
        success++;
      } catch {
        failed++;
      }
      setReminderProgress({ done: i + 1, total: targets.length });
      if (i < targets.length - 1) await delay(randomDelay());
    }

    setIsSendingReminder(false);
    clearSelection();
    invalidateTagihanQueries();

    if (failed === 0) toast.success(`Reminder terkirim ke ${success} wali siswa`);
    else toast.warning(`Terkirim ${success}, gagal ${failed}. Coba lagi untuk yang gagal.`);
  };

  const handleHapusTerpilih = async () => {
    if (!canBulkDelete) {
      const namaSiswa = Array.from(
        new Set(itemsNotDeletable.map((item) => item.siswa?.namasiswa || "siswa"))
      ).join(", ");
      toast.error(
        `Tidak bisa menghapus: terdapat tagihan yang sudah memiliki riwayat pembayaran pada ${namaSiswa}. ` +
          `Batalkan centang tagihan tersebut terlebih dahulu.`
      );
      return;
    }

    const ids = selectedItems.map((item) => item.idtagihansiswa);
    const confirmed = window.confirm(
      `Hapus ${ids.length} tagihan terpilih? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setIsBulkDeleting(true);
    const { error } = await supabase.from("tagihan_siswa").delete().in("idtagihansiswa", ids);
    setIsBulkDeleting(false);

    if (error) {
      toast.error("Gagal menghapus tagihan", { description: error.message });
      return;
    }
    toast.success(`${ids.length} tagihan berhasil dihapus`);
    clearSelection();
    invalidateTagihanQueries();
  };

  const filteredData = useMemo(() => {
    return rawItems.map((item: any, index: number) => {
      const perms = getTagihanPermissions(item);
      return [
        <Checkbox
          key={`sel-${item.idtagihansiswa}`}
          checked={selectedRows.has(item.idtagihansiswa)}
          onCheckedChange={() => toggleRow(item.idtagihansiswa)}
        />,
        currentLimit * (currentPage - 1) + index + 1,
        <span key={`id-${item.idtagihansiswa}`} className="font-mono text-sm">#{item.idtagihansiswa}</span>,
        <div key={`siswa-${item.idtagihansiswa}`}>
          <p className="font-medium">{item.siswa?.namasiswa || "-"}</p>
          <p className="text-xs text-muted-foreground">{item.siswa?.kelas || ""}</p>
        </div>,
        <div key={`tagihan-${item.idtagihansiswa}`}>
          <p className="font-semibold">{item.namatagihan || "-"}</p>
          <p className="text-xs text-muted-foreground">
            {item.bulan}/{item.tahun} · {item.jenjang || ""}
          </p>
        </div>,
        <span key={`nominal-${item.idtagihansiswa}`} className="font-semibold">
          {convertIDR(parseFloat(item.jumlahtagihan) || 0)}
        </span>,
        <span
          key={`sisa-${item.idtagihansiswa}`}
          className={cn("font-semibold",
            parseFloat(item.sisa || 0) === 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {convertIDR(parseFloat(item.sisa) || 0)}
        </span>,
        <div key={`status-${item.idtagihansiswa}`} className="flex flex-col gap-1">
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium w-fit",
            item.statuspembayaran === "LUNAS"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              : item.statuspembayaran === "BELUM LUNAS"
              ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
          )}>
            {item.statuspembayaran}
          </span>
          {!perms.canDelete && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              {perms.metodeLabel}
            </span>
          )}
        </div>,
        new Date(item.createdat).toLocaleDateString("id-ID", {
          day: "numeric", month: "short", year: "numeric",
        }),
        <span
          key={`periode-${item.idtagihansiswa}`}
          className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 whitespace-nowrap"
        >
          {BULAN_NAMA[item.bulan] || item.bulan} {item.tahun}
        </span>,
        <DropdownAction
          key={`act-${item.idtagihansiswa}`}
          menu={[
            {
              label: (
                <span className="flex items-center gap-2">
                  <Banknote className={cn("w-4 h-4", perms.canBayarManual ? "text-green-600" : "text-gray-400")} />
                  {perms.canBayarManual ? "Bayar Manual" : "Bayar Manual (Terkunci)"}
                </span>
              ),
              action: () => {
                if (!perms.canBayarManual) {
                  toast.error(perms.hasMidtrans ? "Tagihan sudah lunas via Midtrans" : "Tagihan sudah lunas");
                  return;
                }
                setSelectedAction({ data: item, type: "bayar" });
              },
            },
            {
              label: (
                <span className="flex items-center gap-2">
                  <Trash2 className={cn("w-4 h-4", perms.canDelete ? "text-red-400" : "text-gray-400")} />
                  {perms.canDelete ? "Hapus" : "Hapus (Terkunci)"}
                </span>
              ),
              variant: perms.canDelete ? "destructive" : "default",
              action: () => {
                if (!perms.canDelete) {
                  toast.error("Tidak dapat menghapus tagihan yang sudah memiliki riwayat pembayaran");
                  return;
                }
                setSelectedAction({ data: item, type: "delete" });
              },
            },
          ]}
        />,
      ];
    });
  }, [rawItems, currentLimit, currentPage, selectedRows]);

  return (
    <div className="w-full space-y-6">
      {/* Dua tampilan toolbar yang sepenuhnya terpisah — tidak dicampur.
          Default: judul + search + filter Kelas/Status + Buat Tagihan.
          Mode pilih-banyak: HANYA jumlah terpilih + Batal + Kirim
          Reminder + Hapus. Filter sengaja tidak ditampilkan di sini;
          alurnya: filter dulu di tampilan default, baru pilih siswa. */}
      {selectedRows.size > 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center mb-4 gap-3 justify-between w-full rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">{selectedRows.size} tagihan dipilih</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={isSendingReminder || isBulkDeleting}
            >
              Batal
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleKirimReminderTerpilih}
              disabled={isSendingReminder || isBulkDeleting}
              title={
                !canBulkReminder
                  ? "Ada tagihan berstatus LUNAS pada seleksi — klik untuk lihat detail"
                  : undefined
              }
              className={cn(
                "border-blue-200",
                canBulkReminder ? "text-blue-600 hover:bg-blue-50" : "text-gray-400 opacity-50"
              )}
            >
              {isSendingReminder ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4 mr-2" />
              )}
              {isSendingReminder
                ? `Mengirim ${reminderProgress.done}/${reminderProgress.total}...`
                : "Kirim Reminder Tunggakan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleHapusTerpilih}
              disabled={isBulkDeleting || isSendingReminder}
              title={
                !canBulkDelete
                  ? "Ada tagihan dengan riwayat pembayaran pada seleksi — klik untuk lihat detail"
                  : undefined
              }
              className={cn(
                "border-red-200",
                canBulkDelete ? "text-red-600 hover:bg-red-50" : "text-gray-400 opacity-50"
              )}
            >
              {isBulkDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Hapus Tagihan Terpilih
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row mb-4 gap-2 justify-between w-full">
          <div>
            <h1 className="text-2xl font-bold">Tagihan Siswa</h1>
            <p className="text-sm text-muted-foreground">Kelola tagihan pembayaran siswa</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Cari siswa atau tagihan..."
              onChange={(e) => handleChangeSearch(e.target.value)}
              className="max-w-sm"
            />
            <MultiSelectDropdown
              label="Kelas"
              options={KELAS_OPTIONS}
              selected={filterKelas}
              onChange={setFilterKelas}
            />
            <MultiSelectDropdown
              label="Status"
              options={STATUS_OPTIONS}
              selected={filterStatus}
              onChange={setFilterStatus}
            />
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => router.push("/admin/tagihan/buat")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Buat Tagihan
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Tagihan</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Belum Lunas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.belumLunas || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Sudah Bayar</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.lunas || 0}</div>
          </CardContent>
        </Card>
      </div>

      {rawItems.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
          <Checkbox checked={isAllOnPageSelected} onCheckedChange={toggleSelectAllOnPage} />
          Pilih semua di halaman ini ({rawItems.length})
        </label>
      )}

      <DataTable
        header={["", "No", "ID", "Nama Siswa", "Tagihan", "Nominal", "Sisa Tagihan", "Status", "Tanggal", "Periode Ditagihkan", "Aksi"]}
        data={filteredData}
        isLoading={isLoading}
        totalPages={tagihanList?.count ? Math.ceil(tagihanList.count / currentLimit) : 0}
        currentPage={currentPage}
        currentLimit={currentLimit}
        onChangePage={handleChangePage}
        onChangeLimit={handleChangeLimit}
      />

      <DialogBayarManual
        open={selectedAction?.type === "bayar"}
        refetch={invalidateTagihanQueries}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />
      <DialogDeleteTagihanSiswa
        open={selectedAction?.type === "delete"}
        refetch={invalidateTagihanQueries}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />
    </div>
  );
}