"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { convertIDR } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAngkatanFilterStore } from "@/stores/angkatan-filter-store";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Search,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import SiswaListDialog from "./siswa-list-dialog";
import PembayaranListDialog from "./pembayaran-list-dialog";

const STATUS_TUNGGAKAN = ["BELUM BAYAR", "BELUM LUNAS"] as const;

// FIX: dulu ada 2 file terpisah (dashboard.tsx untuk admin,
// superadmin-dashboard.tsx untuk superadmin) yang isinya identik 100%.
// Sekarang disatukan di sini — kedua wrapper-nya tinggal render komponen
// ini, supaya tidak ada 2 tempat yang harus diubah tiap kali ada perbaikan.
export default function DashboardShared() {
  const supabase = createClient();
  const router = useRouter();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const { angkatan } = useAngkatanFilterStore();

  const [showTunggakanDialog, setShowTunggakanDialog] = useState(false);
  const [searchTunggakan, setSearchTunggakan] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // FIX poin 1 (dashboard interaktif): state untuk 4 popup baru.
  const [showLakiLakiDialog, setShowLakiLakiDialog] = useState(false);
  const [showPerempuanDialog, setShowPerempuanDialog] = useState(false);
  const [showTotalSiswaDialog, setShowTotalSiswaDialog] = useState(false);
  const [showSudahBayarDialog, setShowSudahBayarDialog] = useState(false);

  // ─── Siswa sesuai filter angkatan ─────────────────────────────────────────
  // FIX: pakai `is_active` (bukan `status`) — sekarang satu-satunya sumber
  // kebenaran soal "siswa/akun ini aktif atau tidak" dikendalikan dari
  // Kelola Akun, bukan field `status` yang terpisah (yang sudah dihapus
  // dari halaman Data Siswa).
  const { data: siswaFiltered } = useQuery({
    queryKey: ["siswa-by-angkatan", angkatan],
    queryFn: async () => {
      let query = supabase.from("siswa").select("id, kelas, is_active, angkatan, jeniskelamin");
      if (angkatan !== "semua") query = query.eq("angkatan", angkatan);
      const { data } = await query;
      return data || [];
    },
  });

  const idList = (siswaFiltered || []).map((s: any) => s.id);

  const { data: siswaStats } = useQuery({
    queryKey: ["siswa-stats", angkatan, siswaFiltered],
    enabled: !!siswaFiltered,
    queryFn: async () => {
      const aktif = (siswaFiltered || []).filter((s: any) => s.is_active !== false);
      const lakiLaki = aktif.filter(
        (s: any) =>
          s.jeniskelamin === "Laki-laki" ||
          s.jeniskelamin === "laki-laki" ||
          s.jeniskelamin === "L"
      ).length;
      const perempuan = aktif.filter(
        (s: any) =>
          s.jeniskelamin === "Perempuan" ||
          s.jeniskelamin === "perempuan" ||
          s.jeniskelamin === "P"
      ).length;
      return { total: aktif.length, lakiLaki, perempuan };
    },
  });

  // ─── Statistik tagihan MENYELURUH (semua periode) ─────────────────────────
  const { data: tagihanStats } = useQuery({
    queryKey: ["tagihan-stats-all", angkatan, idList],
    enabled: !!siswaFiltered,
    queryFn: async () => {
      if (angkatan !== "semua" && idList.length === 0) {
        return { total: 0, lunas: 0, belumBayar: 0 };
      }

      const base = () => {
        let q = supabase
          .from("tagihan_siswa")
          .select("*", { count: "exact", head: true });
        if (angkatan !== "semua") q = q.in("idsiswa", idList);
        return q;
      };

      const { count: total } = await base();
      const { count: lunas } = await base().eq("statuspembayaran", "LUNAS");
      const { count: belumBayar } = await base().in("statuspembayaran", STATUS_TUNGGAKAN);

      return { total: total || 0, lunas: lunas || 0, belumBayar: belumBayar || 0 };
    },
  });

  // ─── Ringkasan keuangan BULAN INI (tetap per bulan) ──────────────────────
  const { data: pemasukanStats } = useQuery({
    queryKey: ["pemasukan-stats", currentMonth, currentYear, angkatan, idList],
    enabled: !!siswaFiltered,
    queryFn: async () => {
      if (angkatan !== "semua" && idList.length === 0) {
        return { bulanIni: 0, tunggakanBulanIni: 0 };
      }

      let lunasQuery = supabase
        .from("tagihan_siswa")
        .select("jumlahtagihan")
        .eq("bulan", currentMonth)
        .eq("tahun", currentYear)
        .eq("statuspembayaran", "LUNAS");
      if (angkatan !== "semua") lunasQuery = lunasQuery.in("idsiswa", idList);
      const { data: bulanIniData } = await lunasQuery;

      const bulanIni =
        bulanIniData?.reduce(
          (sum: number, item: any) => sum + parseFloat(item.jumlahtagihan || "0"),
          0
        ) || 0;

      let belumQuery = supabase
        .from("tagihan_siswa")
        .select("sisa")
        .eq("bulan", currentMonth)
        .eq("tahun", currentYear)
        .in("statuspembayaran", STATUS_TUNGGAKAN);
      if (angkatan !== "semua") belumQuery = belumQuery.in("idsiswa", idList);
      const { data: tunggakanData } = await belumQuery;

      const tunggakanBulanIni =
        tunggakanData?.reduce(
          (sum: number, item: any) => sum + parseFloat(item.sisa || "0"),
          0
        ) || 0;

      return { bulanIni, tunggakanBulanIni };
    },
  });

  // ─── Daftar tunggakan MENYELURUH untuk popup ──────────────────────────────
  const { data: daftarTunggakan, isLoading: isLoadingTunggakan } = useQuery({
    queryKey: ["dashboard-daftar-tunggakan-all", angkatan, idList],
    enabled: showTunggakanDialog,
    queryFn: async () => {
      if (angkatan !== "semua" && idList.length === 0) return [];

      let query = supabase
        .from("tagihan_siswa")
        .select(`
          idtagihansiswa,
          jumlahtagihan,
          sisa,
          statuspembayaran,
          bulan,
          tahun,
          createdat,
          siswa:siswa!idsiswa(id, namasiswa, kelas, nowa, nis),
          master_tagihan:master_tagihan!idmastertagihan(namatagihan, jenjang, jenistagihan)
        `)
        .in("statuspembayaran", STATUS_TUNGGAKAN)
        .order("createdat", { ascending: false });

      if (angkatan !== "semua") query = query.in("idsiswa", idList);

      const { data, error } = await query;
      if (error) {
        console.error("[Dashboard] Gagal memuat tunggakan:", error);
        return [];
      }
      return data || [];
    },
  });

  const filteredTunggakan = useMemo(() => {
    if (!searchTunggakan.trim()) return daftarTunggakan || [];
    const q = searchTunggakan.toLowerCase();
    return (daftarTunggakan || []).filter((item: any) => {
      const nama = item.siswa?.namasiswa?.toLowerCase() || "";
      const kelas = item.siswa?.kelas?.toLowerCase() || "";
      const tagihan = item.master_tagihan?.namatagihan?.toLowerCase() || "";
      return nama.includes(q) || kelas.includes(q) || tagihan.includes(q);
    });
  }, [daftarTunggakan, searchTunggakan]);

  const totalPages = Math.ceil((filteredTunggakan.length || 0) / ITEMS_PER_PAGE);
  const paginatedTunggakan = filteredTunggakan.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const bulanNama = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          KB/TK Aisyiyah Bustanul Athfal 1 Buduran
        </p>
      </div>

      {/* ─── Sensus Siswa — SEMUA kartu sekarang bisa diklik ─────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Sensus Siswa</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            onClick={() => setShowLakiLakiDialog(true)}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-blue-300"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Siswa Laki-laki</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {siswaStats?.lakiLaki ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">siswa aktif · klik untuk detail</p>
            </CardContent>
          </Card>
          <Card
            onClick={() => setShowPerempuanDialog(true)}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-pink-300"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Siswa Perempuan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-600">
                {siswaStats?.perempuan ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">siswa aktif · klik untuk detail</p>
            </CardContent>
          </Card>
          <Card
            onClick={() => setShowTotalSiswaDialog(true)}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-gray-400"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{siswaStats?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">siswa aktif · klik untuk detail</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Ringkasan Tagihan (MENYELURUH) ──────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Ringkasan Tagihan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* FIX: klik → redirect ke halaman Tagihan Siswa */}
          <Card
            onClick={() => router.push("/admin/tagihan")}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-gray-400"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Tagihan</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{tagihanStats?.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">dari semua periode · klik untuk detail</p>
            </CardContent>
          </Card>

          {/* FIX: klik → popup daftar siswa yang sudah bayar */}
          <Card
            onClick={() => setShowSudahBayarDialog(true)}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-green-300"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sudah Lunas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {tagihanStats?.lunas || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">dari semua periode · klik untuk detail</p>
            </CardContent>
          </Card>

          {/* Card ini bisa diklik → buka popup daftar tunggakan menyeluruh */}
          <Card
            onClick={() => setShowTunggakanDialog(true)}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-red-300"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Belum Lunas</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {tagihanStats?.belumBayar || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                dari semua periode · klik untuk detail
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Ringkasan Keuangan Bulan Ini (tetap per bulan) ─────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Ringkasan Keuangan — {bulanNama}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FIX: klik → redirect ke halaman Rekapan Pembayaran */}
          <Card
            onClick={() => router.push("/admin/rekapan-pembayaran")}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-green-300"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pemasukan Bulan Ini</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {convertIDR(pemasukanStats?.bulanIni || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total tagihan yang sudah lunas bulan ini · klik untuk detail
              </p>
            </CardContent>
          </Card>
          {/* FIX: klik → redirect ke halaman Rekapan Tunggakan */}
          <Card
            onClick={() => router.push("/admin/rekapan-tunggakan")}
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-red-300"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tunggakan Bulan Ini</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {convertIDR(pemasukanStats?.tunggakanBulanIni || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total tagihan yang belum dibayar bulan ini · klik untuk detail
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── POPUP: Daftar Tunggakan Menyeluruh (sudah ada sebelumnya) ──────── */}
      <Dialog
        open={showTunggakanDialog}
        onOpenChange={(open) => {
          setShowTunggakanDialog(open);
          if (!open) {
            setSearchTunggakan("");
            setCurrentPage(1);
          }
        }}
      >
        <DialogContent
          className="
            w-[96vw]
            max-w-[1500px]
            sm:max-w-[1500px]
            h-[92vh]
            p-0
            gap-0
            flex
            flex-col
            overflow-hidden
          "
        >
          <DialogHeader className="px-8 py-5 border-b shrink-0 bg-background">
            <div className="flex flex-col items-center text-center gap-1">
              <DialogTitle className="text-2xl font-bold">Daftar Tagihan Belum Terbayar</DialogTitle>
              <DialogDescription className="mt-1 text-base">
                {daftarTunggakan?.length || 0} tagihan belum lunas dari semua periode
              </DialogDescription>
            </div>
          </DialogHeader>

          {!isLoadingTunggakan && (daftarTunggakan?.length || 0) > 0 && (
            <div className="px-6 py-3 border-b shrink-0 flex justify-end">
              <div className="relative w-full max-w-lg">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Cari nama siswa, kelas, atau tagihan..."
                  value={searchTunggakan}
                  onChange={(e) => {
                    setSearchTunggakan(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 h-11 text-base"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-8 py-4">
            {isLoadingTunggakan ? (
              <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
            ) : !daftarTunggakan?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada tagihan yang belum terbayar 🎉
              </div>
            ) : filteredTunggakan.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ditemukan dengan kata kunci &quot;{searchTunggakan}&quot;
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse text-sm">
                <thead className="sticky top-0 bg-background z-20">
                  <tr className="border-b bg-muted">
                    <th className="w-16 p-3 text-left">No</th>
                    <th className="w-28 p-3 text-left">ID</th>
                    <th className="w-72 p-3 text-left">Nama Siswa</th>
                    <th className="p-3 text-left">Tagihan</th>
                    <th className="w-44 p-3 text-right">Nominal</th>
                    <th className="w-44 p-3 text-right">Sisa Tagihan</th>
                    <th className="w-44 p-3 text-left">Status</th>
                    <th className="w-40 p-3 text-left">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTunggakan.map((item: any, i: number) => (
                    <tr key={item.idtagihansiswa} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-muted-foreground">
                        {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                      </td>
                      <td className="p-3 font-mono text-sm">#{item.idtagihansiswa}</td>
                      <td className="p-3 font-medium">{item.siswa?.namasiswa || "-"}</td>
                      <td className="p-3">
                        <div className="font-semibold">{item.master_tagihan?.namatagihan || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.bulan}/{item.tahun} · {item.master_tagihan?.jenjang || ""}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-red-600">
                        {convertIDR(parseFloat(item.jumlahtagihan || 0))}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {convertIDR(parseFloat(item.sisa || 0))}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {item.statuspembayaran}
                        </span>
                      </td>
                      <td className="p-3">
                        {new Date(item.createdat).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoadingTunggakan && filteredTunggakan.length > 0 && (
            <div className="px-8 py-4 border-t shrink-0 flex flex-col items-center gap-2 bg-muted/30">
              <span className="text-sm text-muted-foreground text-center">
                Menampilkan{" "}
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTunggakan.length)}{" "}
                dari {filteredTunggakan.length} tagihan
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    «
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    ‹
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1
                    )
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                      ) : (
                        <Button
                          key={p}
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className={`h-8 w-8 p-0 ${currentPage === p ? "bg-red-600 hover:bg-red-700 border-red-600" : ""}`}
                          onClick={() => setCurrentPage(p as number)}
                        >
                          {p}
                        </Button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    ›
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    »
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── POPUP BARU: Siswa Laki-laki ──────────────────────────────────── */}
      <SiswaListDialog
        open={showLakiLakiDialog}
        onOpenChange={setShowLakiLakiDialog}
        title="Daftar Siswa Laki-laki"
        fixedGender="laki-laki"
      />

      {/* ─── POPUP BARU: Siswa Perempuan ──────────────────────────────────── */}
      <SiswaListDialog
        open={showPerempuanDialog}
        onOpenChange={setShowPerempuanDialog}
        title="Daftar Siswa Perempuan"
        fixedGender="perempuan"
      />

      {/* ─── POPUP BARU: Total Siswa (dengan dropdown gender) ───────────────── */}
      <SiswaListDialog
        open={showTotalSiswaDialog}
        onOpenChange={setShowTotalSiswaDialog}
        title="Daftar Seluruh Siswa"
      />

      {/* ─── POPUP BARU: Sudah Terbayar ──────────────────────────────────────── */}
      <PembayaranListDialog
        open={showSudahBayarDialog}
        onOpenChange={setShowSudahBayarDialog}
        idSiswaFilter={angkatan !== "semua" ? idList : null}
      />
    </div>
  );
}
