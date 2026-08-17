"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { convertIDR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  MessageSquare,
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
const MonthYearPicker = ({
  selectedMonth,
  selectedYear,
  onChange,
  onClose,
}: {
  selectedMonth: number;
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  onClose: () => void;
}) => {
  const [pickerYear, setPickerYear] = useState(selectedYear);
  const currentYear = new Date().getFullYear();

  return (
    <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 w-72">
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
          const isActive = bulanIdx === selectedMonth && pickerYear === selectedYear;
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
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Data tabel per periode terpilih ──────────────────────────────────────
  const { data: tunggakanData, isLoading } = useQuery({
    queryKey: ["rekapan-tunggakan", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
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
        .eq("bulan", selectedMonth)
        .eq("tahun", selectedYear)
        .order("createdat", { ascending: false });

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

        // FIX poin 3: grafik menghitung berdasarkan SISA (dan tetap
        // menghitung jumlah baris tunggakan untuk breakdown per jenjang),
        // bukan menganggap semua tunggakan senilai nominal penuh.
        const breakdown: Record<string, number> = {};
        (data || []).forEach((item: any) => {
          // FIX: jenjang & jenistagihan sekarang dari kolom snapshot
          // langsung (item.jenjang, item.jenistagihan)
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

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const handleExport = () => {
    if (!tunggakanData?.length) { toast.error("Tidak ada data"); return; }
    const rows = tunggakanData.map((item: any, i: number) => ({
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
    XLSX.writeFile(wb, `Tunggakan_${BULAN_NAMA[selectedMonth]}_${selectedYear}.xlsx`);
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
                      entry.bulan === selectedMonth && entry.tahun === selectedYear
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
        <Button variant="outline" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="relative" ref={pickerRef}>
          <Button
            variant="outline"
            className="gap-2 min-w-[160px] font-semibold"
            onClick={() => setShowPicker((v) => !v)}
          >
            <Calendar className="h-4 w-4 text-red-600" />
            {BULAN_NAMA[selectedMonth]} {selectedYear}
          </Button>
          {showPicker && (
            <MonthYearPicker
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onChange={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
        <Button variant="outline" size="icon" onClick={handleNextMonth}>
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

      {/* ─── Tabel tunggakan — Export Excel masuk ke CardHeader ─────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Daftar Siswa Menunggak
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {BULAN_NAMA[selectedMonth]} {selectedYear}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExport}
              disabled={!tunggakanData?.length}
              variant="outline"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            {/* FIX poin 4: sekarang navigasi ke HALAMAN PENUH (bukan popup),
                yang sudah menggabungkan tagihan per siswa. */}
            {!isKepalaSekolah && (
              <Button
                onClick={() => router.push("/admin/rekapan-tunggakan/reminder")}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Tagih via WhatsApp
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Memuat data...</div>
          ) : !tunggakanData?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada tunggakan untuk periode ini 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3">No</th>
                    <th className="text-left p-3">Nama Siswa</th>
                    <th className="text-left p-3">Kelas</th>
                    <th className="text-left p-3">No. WA Wali</th>
                    <th className="text-left p-3">Tagihan</th>
                    <th className="text-right p-3">Sisa</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tunggakanData.map((item: any, i: number) => (
                    <tr key={item.idtagihansiswa} className="border-b hover:bg-muted/50">
                      <td className="p-3">{i + 1}</td>
                      <td className="p-3 font-medium">{item.siswa?.namasiswa || "-"}</td>
                      <td className="p-3">{item.siswa?.kelas || "-"}</td>
                      <td className="p-3">{item.siswa?.nowa || "-"}</td>
                      <td className="p-3">{item.namatagihan || "-"}</td>
                      {/* FIX poin 3: tampilkan SISA, bukan nominal penuh */}
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
                    <td colSpan={5} className="p-3 text-right">Total Sisa:</td>
                    <td className="p-3 text-right text-red-600">{convertIDR(totalNominal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}