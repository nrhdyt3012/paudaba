"use client";

import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { convertIDR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  ImageIcon,
  Printer,
} from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { toast } from "sonner";
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
import { useReactToPrint } from "react-to-print";
// FIX: sesuaikan path berikut dengan lokasi asli komponen & util di project kamu
import KwitansiTemplate, {
  KwitansiData,
  SekolahInfo,
} from "@/components/common/kwitansi-template";
// FIX: pakai hook bersama untuk queryKey ["pengaturan-sekolah"] — supaya
// bentuk datanya (camelCase) sama persis dengan yang dipakai app-sidebar.tsx,
// tidak ada lagi dua queryFn berbeda yang berebut satu queryKey (penyebab
// kwitansi kadang nampilin "-" walau data di Supabase sudah benar).
import { usePengaturanSekolah } from "@/hooks/use-pengaturan-sekolah";

const BULAN_NAMA = [
  "",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const BULAN_SINGKAT = [
  "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agt", "Sep", "Okt", "Nov", "Des",
];

const COLOR_ACTIVE = "#16a34a";
const COLOR_INACTIVE = "#86efac";

const first = (v: any) => (Array.isArray(v) ? v[0] : v);

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
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                {count} transaksi
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Total</span>
            <span className="text-xs font-bold text-green-700 dark:text-green-400">
              {data.total} transaksi
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">Tidak ada data</p>
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
                  ? "bg-green-600 text-white shadow-sm"
                  : "hover:bg-green-50 dark:hover:bg-green-950 text-gray-700 dark:text-gray-300"
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

// ─── Menu Aksi per transaksi (Cetak Kwitansi + Lihat Bukti Pembayaran) ─────────
function ActionMenuRekap({
  item,
  sekolah,
  onPreviewBukti,
}: {
  item: any;
  sekolah: SekolahInfo | null | undefined;
  onPreviewBukti: (url: string) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const tagihan = first(item.tagihan_siswa);
  const siswa = first(tagihan?.siswa);
  const hasBukti = !!item.bukti_pembayaran_url;

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Kwitansi-${item.idtagihansiswa}-Transaksi-${item.idpembayaran}`,
  });

  const jumlahBayar = parseFloat(item.jumlahdibayar || "0");
  const totalTagihan = parseFloat(tagihan?.jumlahtagihan || "0");
  const sisaSetelahIni =
    item.sisa_setelah_transaksi_ini != null
      ? Math.max(0, Number(item.sisa_setelah_transaksi_ini))
      : 0;
  const isLunas = sisaSetelahIni <= 0;

  const tglBayar = new Date(item.tanggalpembayaran);
  const noKwitansi = `${item.idtagihansiswa}/${item.idpembayaran}/${tglBayar.getFullYear()}`;

  useEffect(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const linkKwitansi = `${appUrl}/kwitansi/${item.idpembayaran}`;
    // generateQrCodeDataUrl(linkKwitansi).then(setQrCodeDataUrl);
  }, [item.idpembayaran]);

  // FIX: fallback aman kalau data pengaturan sekolah belum termuat/kosong,
  // biar komponen kwitansi tidak crash saat namaSekolah dsb. undefined
  const sekolahData: SekolahInfo = {
    namaSekolah: sekolah?.namaSekolah || "-",
    alamatSekolah: sekolah?.alamatSekolah || "-",
    logoUrl: sekolah?.logoUrl || null,
    namaBendahara: sekolah?.namaBendahara || "-",
    tandaTanganUrl: sekolah?.tandaTanganUrl || null,
  };

  const kwitansiData: KwitansiData = {
    noKwitansi,
    tanggalCetak: tglBayar.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    jamCetak:
      tglBayar
        .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        .replace(":", ".") + " WIB",
    namaSiswa: siswa?.namasiswa || "-",
    kelas: siswa?.kelas || "-",
    namaWali: siswa?.namawali || "-",
    namaTagihan: tagihan?.namatagihan || "-",
    periode: tagihan ? `${BULAN_NAMA[tagihan.bulan]} ${tagihan.tahun}` : "-",
    jumlahDibayar: jumlahBayar,
    totalTagihan,
    sisaTagihan: sisaSetelahIni,
    isLunas,
    qrCodeDataUrl,
    sekolah: sekolahData,
    // Catatan: daftar "tagihan lain yang belum lunas" tidak disertakan di sini
    // karena butuh query tambahan per siswa. Bisa ditambahkan kalau perlu.
  };

  // Kalau tidak ada bukti pembayaran, opsi tetap tampil (memudar) tapi
  // tetap bisa diklik dan akan menampilkan toast pemberitahuan.
  const handleLihatBukti = () => {
    if (!hasBukti) {
      toast.error("Tidak ada bukti pembayaran untuk transaksi ini");
      return;
    }
    onPreviewBukti(item.bukti_pembayaran_url);
  };

  return (
    <>
      {/* FIX: pakai DropdownAction (titik 3) yang sama dengan halaman lain,
          bukan bikin dropdown sendiri, biar konsisten sama menu-management dkk */}
      <DropdownAction
        menu={[
          {
            label: (
              <span className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Cetak Kwitansi
              </span>
            ),
            action: handlePrint,
          },
          {
            label: (
              // Kalau tidak ada bukti, opsi ini memudar tapi tetap bisa
              // diklik -> munculkan toast lewat handleLihatBukti di bawah
              <span className={`flex items-center gap-2 ${!hasBukti ? "opacity-40" : ""}`}>
                <ImageIcon className="w-4 h-4" />
                Lihat Bukti Pembayaran
              </span>
            ),
            action: handleLihatBukti,
          },
        ]}
      />

      {/* Konten cetak kwitansi, disembunyikan, dipicu lewat handlePrint */}
      <div className="hidden">
        <div ref={contentRef}>
          <KwitansiTemplate data={kwitansiData} />
        </div>
      </div>
    </>
  );
}

// ─── Komponen Utama ────────────────────────────────────────────────────────────
export default function RekapanPembayaran() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showPicker, setShowPicker] = useState(false);
  const [buktiPreviewUrl, setBuktiPreviewUrl] = useState<string | null>(null);
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

  // FIX: ambil data profil sekolah lewat hook bersama `usePengaturanSekolah`
  // (queryKey ["pengaturan-sekolah"], bentuk camelCase) — jangan bikin
  // useQuery terpisah di sini lagi, supaya tidak collide dengan cache yang
  // dipakai app-sidebar.tsx dan komponen kwitansi lain.
  const { data: sekolahInfo } = usePengaturanSekolah();

  const { data: pembayaranData, isLoading } = useQuery({
    queryKey: ["rekapan-pembayaran", selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const endDate = new Date(selectedYear, selectedMonth, 1).toISOString();

      const { data, error } = await supabase
        .from("pembayaran")
        .select(`
          idpembayaran,
          idtagihansiswa,
          jumlahdibayar,
          tanggalpembayaran,
          metodepembayaran,
          statuspembayaran,
          sisa_setelah_transaksi_ini,
          bukti_pembayaran_url,
          tagihan_siswa:tagihan_siswa!idtagihansiswa(
            bulan,
            tahun,
            jumlahtagihan,
            namatagihan,
            jenjang,
            jenistagihan,
            siswa:siswa!idsiswa(id, namasiswa, kelas, namawali)
          )
        `)
        .eq("statuspembayaran", "SUCCESS")
        .gte("tanggalpembayaran", startDate)
        .lt("tanggalpembayaran", endDate)
        .order("tanggalpembayaran", { ascending: false });

      if (error) {
        toast.error("Gagal memuat data", { description: error.message });
        return [];
      }
      return data || [];
    },
  });

  const { data: chartData } = useQuery({
    queryKey: ["chart-pembayaran"],
    queryFn: async () => {
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const startDate = new Date(y, m - 1, 1).toISOString();
        const endDate = new Date(y, m, 1).toISOString();

        const { data } = await supabase
          .from("pembayaran")
          .select(`
            idpembayaran,
            jumlahdibayar,
            tagihan_siswa:tagihan_siswa!idtagihansiswa(
              jenjang,
              jenistagihan
            )
          `)
          .eq("statuspembayaran", "SUCCESS")
          .gte("tanggalpembayaran", startDate)
          .lt("tanggalpembayaran", endDate);

        const breakdown: Record<string, number> = {};
        (data || []).forEach((item: any) => {
          const tagihan = first(item.tagihan_siswa);
          // FIX: jenjang & jenistagihan sekarang dari kolom snapshot
          // langsung (tagihan?.jenjang, tagihan?.jenistagihan)
          const jenjang = tagihan?.jenjang || "Lainnya";
          const jenis = tagihan?.jenistagihan || "";
          const key = jenis ? `${jenjang} ${jenis}` : jenjang;
          breakdown[key] = (breakdown[key] || 0) + 1;
        });

        results.push({
          name: `${BULAN_SINGKAT[m]} ${y.toString().slice(2)}`,
          bulan: m,
          tahun: y,
          total: (data || []).length,
          breakdown,
        });
      }
      return results;
    },
  });

  const totalNominal = useMemo(
    () =>
      pembayaranData?.reduce(
        (s: number, i: any) => s + parseFloat(i.jumlahdibayar || 0),
        0
      ) || 0,
    [pembayaranData]
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
    if (!pembayaranData?.length) { toast.error("Tidak ada data"); return; }
    const rows = pembayaranData.map((item: any, i: number) => {
      const tagihan = first(item.tagihan_siswa);
      const siswa = first(tagihan?.siswa);
      const sisa = item.sisa_setelah_transaksi_ini != null
        ? Number(item.sisa_setelah_transaksi_ini)
        : null;
      return {
        No: i + 1,
        "ID Pembayaran": item.idpembayaran,
        "Nama Siswa": siswa?.namasiswa || "-",
        Kelas: siswa?.kelas || "-",
        "Nama Tagihan": tagihan?.namatagihan || "-",
        Jenjang: tagihan?.jenjang || "-",
        Jenis: tagihan?.jenistagihan || "-",
        "Periode Tagihan": tagihan ? `${BULAN_NAMA[tagihan.bulan]} ${tagihan.tahun}` : "-",
        "Metode Bayar": item.metodepembayaran || "-",
        "Nominal Dibayar (transaksi ini)": parseFloat(item.jumlahdibayar || 0),
        "Sisa Setelah Transaksi Ini": sisa,
        "Status Lunas?": sisa !== null ? (sisa <= 0 ? "Lunas" : "Belum Lunas") : "-",
        "Tanggal Bayar": new Date(item.tanggalpembayaran).toLocaleString("id-ID"),
        "Ada Bukti?": item.bukti_pembayaran_url ? "Ya" : "Tidak",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pembayaran");
    XLSX.writeFile(wb, `Pembayaran_${BULAN_NAMA[selectedMonth]}_${selectedYear}.xlsx`);
    toast.success("Data berhasil diekspor");
  };

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-bold">Rekapan Pembayaran</h1>

      <Card>
        <CardHeader>
          <CardTitle>Grafik Pembayaran (6 Bulan Terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend formatter={() => "Jumlah Transaksi"} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Jumlah Transaksi" radius={[6, 6, 0, 0]}>
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
            <Calendar className="h-4 w-4 text-green-600" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Jumlah Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {pembayaranData?.length || 0} Transaksi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Uang Masuk</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{convertIDR(totalNominal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Daftar Transaksi Pembayaran
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {BULAN_NAMA[selectedMonth]} {selectedYear}
            </span>
          </CardTitle>
          <Button
            onClick={handleExport}
            disabled={!pembayaranData?.length}
            variant="outline"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Memuat data...</div>
          ) : !pembayaranData?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada transaksi pembayaran untuk periode ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3">No</th>
                    <th className="text-left p-3">Nama Siswa</th>
                    <th className="text-left p-3">Kelas</th>
                    <th className="text-left p-3">Tagihan</th>
                    <th className="text-left p-3">Metode</th>
                    <th className="text-right p-3">Dibayar (transaksi ini)</th>
                    <th className="text-right p-3">Sisa Setelahnya</th>
                    <th className="text-left p-3">Tanggal</th>
                    <th className="text-center p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pembayaranData.map((item: any, i: number) => {
                    const tagihan = first(item.tagihan_siswa);
                    const siswa = first(tagihan?.siswa);
                    const sisa = item.sisa_setelah_transaksi_ini;
                    return (
                      <tr key={item.idpembayaran} className="border-b hover:bg-muted/50">
                        <td className="p-3">{i + 1}</td>
                        <td className="p-3 font-medium">{siswa?.namasiswa || "-"}</td>
                        <td className="p-3">{siswa?.kelas || "-"}</td>
                        <td className="p-3">{tagihan?.namatagihan || "-"}</td>
                        <td className="p-3 capitalize">{item.metodepembayaran || "-"}</td>
                        <td className="p-3 text-right font-semibold">
                          {convertIDR(parseFloat(item.jumlahdibayar || 0))}
                        </td>
                        <td className="p-3 text-right">
                          {sisa != null ? (
                            Number(sisa) <= 0 ? (
                              <span className="text-green-600 font-semibold">Lunas</span>
                            ) : (
                              <span className="text-orange-600">{convertIDR(Number(sisa))}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {new Date(item.tanggalpembayaran).toLocaleDateString("id-ID")}
                        </td>
                        {/* Aksi: satu tombol dropdown berisi Cetak Kwitansi & Lihat Bukti Pembayaran */}
                        <td className="p-3 text-center">
                          <ActionMenuRekap
                            item={item}
                            sekolah={sekolahInfo}
                            onPreviewBukti={setBuktiPreviewUrl}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold bg-muted/30">
                    <td colSpan={5} className="p-3 text-right">Total:</td>
                    <td className="p-3 text-right text-green-600">{convertIDR(totalNominal)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Lightbox bukti pembayaran ────────────────────────────────────── */}
      <Dialog open={!!buktiPreviewUrl} onOpenChange={(o) => !o && setBuktiPreviewUrl(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          {buktiPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={buktiPreviewUrl}
              alt="Bukti pembayaran"
              className="w-full rounded-lg border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}