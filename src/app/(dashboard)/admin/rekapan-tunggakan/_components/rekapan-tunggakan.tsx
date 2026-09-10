"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { convertIDR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  MessageSquare,
  Search,
  Infinity as InfinityIcon,
} from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { useAuthStore } from "@/stores/auth-store";

const BULAN_NAMA = [
  "",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const BULAN_SINGKAT = [
  "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agt", "Sep", "Okt", "Nov", "Des",
];

const COLOR_ACTIVE = "#dc2626";
const COLOR_INACTIVE = "#fca5a5";

// FIX poin 3: tunggakan sekarang mencakup status "BELUM BAYAR" DAN
// "BELUM LUNAS" (cicilan). Sebelumnya cuma "BELUM BAYAR", jadi tagihan
// yang sudah dicicil sebagian HILANG dari rekapan ini.
const STATUS_TUNGGAKAN = ["BELUM BAYAR", "BELUM LUNAS"];

// BARU: ukuran halaman untuk pagination tabel tunggakan
const PAGE_SIZE = 15;

// Helper: sisa tagihan = jumlahtagihan - jumlahterbayar (bukan nominal penuh)
const hitungSisa = (item: any) =>
  Math.max(
    0,
    parseFloat(item.jumlahtagihan || "0") - parseFloat(item.jumlahterbayar || "0")
  );

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  const breakdown: Record<string, number> = data.breakdown || {};
  const breakdownEntries = Object.entries(breakdown).filter(([, v]) => v > 0);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 min-w-[200px]">
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        📅 {label}
      </p>
      {breakdownEntries.length > 0 ? (
        <div className="space-y-1.5">
          {breakdownEntries.map(([key, count]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">{key}</span>
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {count} tunggakan
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Total</span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400">
              {data.total} tunggakan
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">Tidak ada tunggakan</p>
      )}
    </div>
  );
};

// ─── Month-Year Picker ─────────────────────────────────────────────────────────
// BARU: tambah opsi "Semua Waktu" — menampilkan seluruh tunggakan di semua
// periode sekaligus, bukan cuma bulan yang sedang dipilih.
const MonthYearPicker = ({
  selectedMonth,
  selectedYear,
  isAllTime,
  onChange,
  onSelectAllTime,
  onClose,
}: {
  selectedMonth: number;
  selectedYear: number;
  isAllTime: boolean;
  onChange: (month: number, year: number) => void;
  onSelectAllTime: () => void;
  onClose: () => void;
}) => {
  const [pickerYear, setPickerYear] = useState(selectedYear);
  const currentYear = new Date().getFullYear();

  return (
    <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 w-72">
      <button
        onClick={() => { onSelectAllTime(); onClose(); }}
        className={`w-full mb-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
          isAllTime
            ? "bg-red-600 text-white shadow-sm"
            : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900"
        }`}
      >
        <InfinityIcon className="h-3.5 w-3.5" />
        Semua Waktu
      </button>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setPickerYear((y) => y - 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{pickerYear}</span>
        <button
          onClick={() => setPickerYear((y) => y + 1)}
          disabled={pickerYear >= currentYear + 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {BULAN_SINGKAT.slice(1).map((nama, idx) => {
          const bulanIdx = idx + 1;
          const isActive = !isAllTime && bulanIdx === selectedMonth && pickerYear === selectedYear;
          return (
            <button
              key={bulanIdx}
              onClick={() => { onChange(bulanIdx, pickerYear); onClose(); }}
              className={`py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-red-600 text-white shadow-sm"
                  : "hover:bg-red-50 dark:hover:bg-red-950 text-gray-700 dark:text-gray-300"
              }`}
            >
              {nama}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Komponen Utama ────────────────────────────────────────────────────────────
export default function RekapanTunggakan() {
  const supabase = createClient();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  // Kepala Sekolah: read-only — cuma memantau tunggakan, tidak mengirim
  // reminder/penagihan (itu tetap tugas admin/bendahara).
  const isKepalaSekolah = profile?.role === "kepala_sekolah";
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // BARU: mode Semua Waktu — melepas filter bulan/tahun pada query tabel
  const [isAllTime, setIsAllTime] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // BARU: pencarian & pagination untuk tabel tunggakan
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedMonth, selectedYear, isAllTime]);

  const handlePilihBulan = (m: number, y: number) => {
    setIsAllTime(false);
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  // ─── Data tabel per periode terpilih (atau semua waktu) ──────────────────
  const { data: tunggakanData, isLoading } = useQuery({
    queryKey: ["rekapan-tunggakan", selectedMonth, selectedYear, isAllTime],
    queryFn: async () => {
      let query = supabase
        .from("tagihan_siswa")
        .select(`
          idtagihansiswa,
          jumlahtagihan,
          jumlahterbayar,
          statuspembayaran,
          bulan,
          tahun,
          createdat,
          namatagihan,
          jenjang,
          jenistagihan,
          siswa:siswa!idsiswa(id, namasiswa, kelas, nowa, nis)
        `)
        .in("statuspembayaran", STATUS_TUNGGAKAN)
        .order("createdat", { ascending: false });

      // BARU: filter bulan/tahun cuma diterapkan kalau BUKAN mode Semua Waktu
      if (!isAllTime) {
        query = query.eq("bulan", selectedMonth).eq("tahun", selectedYear);
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Gagal memuat data", { description: error.message });
        return [];
      }
      return data || [];
    },
  });

  // ─── Data grafik 6 bulan terakhir ────────────────────────────────────────
  const { data: chartData } = useQuery({
    queryKey: ["chart-tunggakan"],
    queryFn: async () => {
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();

        const { data } = await supabase
          .from("tagihan_siswa")
          .select(`
            idtagihansiswa,
            jumlahtagihan,
            jumlahterbayar,
            jenjang,
            jenistagihan
          `)
          .in("statuspembayaran", STATUS_TUNGGAKAN)
          .eq("bulan", m)
          .eq("tahun", y);

        const breakdown: Record<string, number> = {};
        (data || []).forEach((item: any) => {
          const jenjang = item.jenjang || "Lainnya";
          const jenis = item.jenistagihan || "";
          const key = jenis ? `${jenjang} ${jenis}` : jenjang;
          breakdown[key] = (breakdown[key] || 0) + 1;
        });

        const totalSisa = (data || []).reduce(
          (s: number, item: any) => s + hitungSisa(item),
          0
        );

        results.push({
          name: `${BULAN_SINGKAT[m]} ${y.toString().slice(2)}`,
          bulan: m,
          tahun: y,
          total: (data || []).length,
          totalSisa,
          breakdown,
        });
      }
      return results;
    },
  });

  // FIX poin 3: total nominal tunggakan pakai SISA, bukan jumlahtagihan penuh
  const totalNominal = useMemo(
    () => tunggakanData?.reduce((s: number, i: any) => s + hitungSisa(i), 0) || 0,
    [tunggakanData]
  );

  // BARU: filter client-side berdasarkan nama siswa, kelas, atau nama tagihan
  const filteredData = useMemo(() => {
    if (!tunggakanData) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tunggakanData;
    return tunggakanData.filter((item: any) => {
      return (
        item.siswa?.namasiswa?.toLowerCase().includes(q) ||
        item.siswa?.kelas?.toLowerCase().includes(q) ||
        item.namatagihan?.toLowerCase().includes(q)
      );
    });
  }, [tunggakanData, searchQuery]);

  const totalFiltered = useMemo(
    () => filteredData.reduce((s: number, i: any) => s + hitungSisa(i), 0),
    [filteredData]
  );

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const paginatedData = useMemo(
    () => filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredData, page]
  );

  const handlePrevMonth = () => {
    if (isAllTime) return;
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (isAllTime) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const handleExport = () => {
    if (!filteredData.length) { toast.error("Tidak ada data"); return; }
    const rows = filteredData.map((item: any, i: number) => ({
      No: i + 1,
      "ID Tagihan": item.idtagihansiswa,
      "Nama Siswa": item.siswa?.namasiswa || "-",
      Kelas: item.siswa?.kelas || "-",
      "No. WA Wali": item.siswa?.nowa || "-",
      "Nama Tagihan": item.namatagihan || "-",
      Jenjang: item.jenjang || "-",
      Bulan: BULAN_NAMA[item.bulan],
      Tahun: item.tahun,
      "Nominal Tagihan": parseFloat(item.jumlahtagihan || 0),
      "Sudah Dibayar": parseFloat(item.jumlahterbayar || 0),
      "Sisa Tunggakan": hitungSisa(item),
      Status: item.statuspembayaran,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tunggakan");
    const namaFile = isAllTime
      ? `Tunggakan_SemuaWaktu_${new Date().toISOString().slice(0, 10)}.xlsx`
      : `Tunggakan_${BULAN_NAMA[selectedMonth]}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, namaFile);
    toast.success("Data berhasil diekspor");
  };

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-bold">Rekapan Tunggakan</h1>

      {/* ─── Grafik ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Grafik Tunggakan (6 Bulan Terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend formatter={() => "Jumlah Tunggakan"} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Jumlah Tunggakan" radius={[6, 6, 0, 0]}>
                {(chartData || []).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      !isAllTime && entry.bulan === selectedMonth && entry.tahun === selectedYear
                        ? COLOR_ACTIVE
                        : COLOR_INACTIVE
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ─── Navigasi periode ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePrevMonth} disabled={isAllTime}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="relative" ref={pickerRef}>
          <Button
            variant="outline"
            className="gap-2 min-w-[160px] font-semibold"
            onClick={() => setShowPicker((v) => !v)}
          >
            {isAllTime ? (
              <InfinityIcon className="h-4 w-4 text-red-600" />
            ) : (
              <Calendar className="h-4 w-4 text-red-600" />
            )}
            {isAllTime ? "Semua Waktu" : `${BULAN_NAMA[selectedMonth]} ${selectedYear}`}
          </Button>
          {showPicker && (
            <MonthYearPicker
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              isAllTime={isAllTime}
              onChange={handlePilihBulan}
              onSelectAllTime={() => setIsAllTime(true)}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
        <Button variant="outline" size="icon" onClick={handleNextMonth} disabled={isAllTime}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ─── Kartu statistik ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Jumlah Siswa Menunggak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {new Set(tunggakanData?.map((item: any) => item.siswa?.id).filter(Boolean)).size} Siswa
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Sisa Tunggakan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{convertIDR(totalNominal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabel tunggakan ─────────────────────────────────────────────────── */}
      <Card>
        {/* Satu baris: judul di kiri, kolom pencarian di tengah, tombol
            aksi (Export Excel + Tagih via WhatsApp) di kanan. */}
<CardHeader>
  <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
    <CardTitle className="shrink-0">
      Daftar Siswa Menunggak
      <span className="ml-2 text-sm font-normal text-muted-foreground">
        {isAllTime ? "Semua Waktu" : `${BULAN_NAMA[selectedMonth]} ${selectedYear}`}
      </span>
    </CardTitle>

    <div className="flex items-center gap-2 ml-auto w-full lg:w-auto order-3 lg:order-none flex-wrap sm:flex-nowrap">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama siswa, kelas, atau nama tagihan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <Button
        onClick={handleExport}
        disabled={!filteredData.length}
        variant="outline"
        size="sm"
        className="shrink-0"
      >
        <Download className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      {!isKepalaSekolah && (
        <Button
          onClick={() => router.push("/admin/rekapan-tunggakan/reminder")}
          size="sm"
          className="bg-green-600 hover:bg-green-700 shrink-0"
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Tagih via WhatsApp
        </Button>
      )}
    </div>
  </div>
</CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Memuat data...</div>
          ) : !filteredData.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "Tidak ada tunggakan yang cocok dengan pencarian"
                : "Tidak ada tunggakan untuk periode ini 🎉"}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3">No</th>
                      <th className="text-left p-3">Nama Siswa</th>
                      <th className="text-left p-3">Kelas</th>
                      <th className="text-left p-3">No. WA Wali</th>
                      <th className="text-left p-3">Tagihan</th>
                      {isAllTime && <th className="text-left p-3">Periode</th>}
                      <th className="text-right p-3">Sisa</th>
                      <th className="text-center p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item: any, i: number) => (
                      <tr key={item.idtagihansiswa} className="border-b hover:bg-muted/50">
                        <td className="p-3">{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="p-3 font-medium">{item.siswa?.namasiswa || "-"}</td>
                        <td className="p-3">{item.siswa?.kelas || "-"}</td>
                        <td className="p-3">{item.siswa?.nowa || "-"}</td>
                        <td className="p-3">{item.namatagihan || "-"}</td>
                        {/* BARU: kolom periode cuma ditampilkan di mode Semua
                            Waktu, karena di mode per-bulan periodenya sudah
                            jelas dari label di atas tabel */}
                        {isAllTime && (
                          <td className="p-3 text-muted-foreground">
                            {BULAN_NAMA[item.bulan]} {item.tahun}
                          </td>
                        )}
                        <td className="p-3 text-right font-semibold">
                          {convertIDR(hitungSisa(item))}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              item.statuspembayaran === "BELUM LUNAS"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                            }`}
                          >
                            {item.statuspembayaran === "BELUM LUNAS" ? "Belum Lunas" : "Belum Bayar"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold bg-muted/30">
                      <td colSpan={isAllTime ? 5 : 4} className="p-3 text-right">
                        Total Sisa{searchQuery ? " (hasil pencarian)" : ""}:
                      </td>
                      <td className="p-3 text-right text-red-600">{convertIDR(totalFiltered)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* BARU: kontrol pagination — dipusatkan di tengah bawah */}
              <div className="flex flex-col items-center gap-2 mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredData.length)} dari {filteredData.length} tunggakan
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[90px] text-center">
                    Halaman {page} dari {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}