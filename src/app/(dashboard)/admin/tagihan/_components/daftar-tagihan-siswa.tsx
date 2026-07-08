"use client";

import DataTable from "@/components/common/data-table";
import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import DialogDeleteTagihanSiswa from "./dialog-delete-tagihan-siswa";
import DialogBayarManual from "./dialog-bayar-manual";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const KELAS_OPTIONS = [
  { value: "semua", label: "Semua Kelas" },
  { value: "KB", label: "KB" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

const STATUS_OPTIONS = [
  { value: "semua", label: "Semua Status" },
  { value: "BELUM BAYAR", label: "Belum Bayar" },
  { value: "LUNAS", label: "Sudah Bayar" },
];

function getTagihanPermissions(item: any) {
  const pembayaran: any[] = item.pembayaran ?? [];
  const hasMidtrans = pembayaran.some(
    (p) => p.statuspembayaran === "SUCCESS" && p.metodepembayaran !== "cash"
  );
  const hasAnySuccess = pembayaran.some((p) => p.statuspembayaran === "SUCCESS");
  return {
    canBayarManual: !hasMidtrans && item.statuspembayaran !== "LUNAS",
    canDelete: !hasAnySuccess,
    hasMidtrans,
  };
}

export default function DaftarTagihanSiswa() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    currentPage, currentLimit, currentSearch,
    handleChangePage, handleChangeLimit, handleChangeSearch,
  } = useDataTable();

  const [filterKelas, setFilterKelas] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["tagihan-admin-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("tagihan_siswa").select("*", { count: "exact", head: true });
      const { count: belumBayar } = await supabase
        .from("tagihan_siswa").select("*", { count: "exact", head: true })
        .eq("statuspembayaran", "BELUM BAYAR");
      const { count: lunas } = await supabase
        .from("tagihan_siswa").select("*", { count: "exact", head: true })
        .eq("statuspembayaran", "LUNAS");
      return { total: total || 0, belumBayar: belumBayar || 0, lunas: lunas || 0 };
    },
  });

  const { data: tagihanList, isLoading } = useQuery({
    queryKey: ["tagihan-siswa-list", currentPage, currentLimit, currentSearch, filterKelas, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("tagihan_siswa")
        .select(
          // Kolom "Periode Ditagihkan" diambil dari `bulan`/`tahun` yang
          // sudah otomatis ikut ter-select lewat `*` (kolom tagihan_siswa
          // itu sendiri) — tidak butuh join tambahan.
          `*, siswa!idsiswa(id, namasiswa, kelas),
          master_tagihan!idmastertagihan(id_mastertagihan, namatagihan, jenjang, jenistagihan),
          pembayaran(idpembayaran, statuspembayaran, metodepembayaran)`,
          { count: "exact" }
        );

      if (filterStatus !== "semua") query = query.eq("statuspembayaran", filterStatus);
      if (filterKelas !== "semua") query = query.eq("siswa.kelas", filterKelas);

      if (currentSearch) {
        query = query.or(
          `siswa.namasiswa.ilike.%${currentSearch}%,master_tagihan.namatagihan.ilike.%${currentSearch}%`
        );
      }

      const { data, count, error } = await query
        .range((currentPage - 1) * currentLimit, currentPage * currentLimit - 1)
        .order("createdat", { ascending: false });

      if (error) toast.error("Gagal memuat tagihan", { description: error.message });

      let result = data || [];
      if (filterKelas !== "semua") {
        result = result.filter((item: any) => item.siswa?.kelas === filterKelas);
      }

      return { data: result, count: count || 0 };
    },
  });

  const [selectedAction, setSelectedAction] = useState<{ data: any; type: "bayar" | "delete" } | null>(null);
  const handleChangeAction = (open: boolean) => { if (!open) setSelectedAction(null); };

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

  const filteredData = useMemo(() => {
    return (tagihanList?.data || []).map((item: any, index: number) => {
      const perms = getTagihanPermissions(item);
      return [
        currentLimit * (currentPage - 1) + index + 1,
        <span key={`id-${item.idtagihansiswa}`} className="font-mono text-sm">#{item.idtagihansiswa}</span>,
        <div key={`siswa-${item.idtagihansiswa}`}>
          <p className="font-medium">{item.siswa?.namasiswa || "-"}</p>
          <p className="text-xs text-muted-foreground">{item.siswa?.kelas || ""}</p>
        </div>,
        <div key={`tagihan-${item.idtagihansiswa}`}>
          <p className="font-semibold">{item.master_tagihan?.namatagihan || "-"}</p>
          <p className="text-xs text-muted-foreground">
            {item.bulan}/{item.tahun} · {item.master_tagihan?.jenjang || ""}
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
              {perms.hasMidtrans ? "via Midtrans" : "via Cash"}
            </span>
          )}
        </div>,
        new Date(item.createdat).toLocaleDateString("id-ID", {
          day: "numeric", month: "short", year: "numeric",
        }),
        // FIX (klarifikasi): kolom baru "Periode Ditagihkan" — bukan
        // "Jenis". Isinya bulan/tahun yang dipilih admin waktu menerbitkan
        // tagihan ini (langkah setelah memilih Master Tagihan di form Buat
        // Tagihan), ditampilkan sebagai "Juli 2026" dst.
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
  }, [tagihanList, currentLimit, currentPage]);

  return (
    <div className="w-full space-y-6">
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
          <Select value={filterKelas} onValueChange={setFilterKelas}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KELAS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => router.push("/admin/tagihan/buat")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Buat Tagihan
          </Button>
        </div>
      </div>

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
            <CardTitle className="text-sm">Belum Bayar</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.belumBayar || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Lunas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.lunas || 0}</div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        header={["No", "ID", "Nama Siswa", "Tagihan", "Nominal", "Sisa Tagihan", "Status", "Tanggal", "Periode Ditagihkan", "Aksi"]}
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
