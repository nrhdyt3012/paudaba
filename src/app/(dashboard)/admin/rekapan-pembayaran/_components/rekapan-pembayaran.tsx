"use client";

import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  FileStack,
  Search,
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
// BARU: template laporan riwayat menyeluruh — sama persis dengan yang
// dipakai di halaman Riwayat Pembayaran milik wali siswa, di-reuse di sini
// supaya bendahara/superadmin bisa mencetak riwayat lengkap per siswa juga.
import LaporanRiwayatTemplate, {
  LaporanRiwayatData,
  TagihanBelumLunasItem,
} from "@/components/common/laporan-riwayat-template";
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

// ─── BARU: Dialog pencarian siswa + tombol cetak riwayat menyeluruh ───────────
// Dipakai oleh bendahara/superadmin di menu Rekapan Pembayaran, supaya bisa
// mencetak "Laporan Riwayat Pembayaran" per siswa (semua tagihan & transaksi,
// bukan cuma bulan yang lagi dipilih) — persis seperti fitur yang sudah ada
// di halaman Riwayat Pembayaran milik wali siswa.
function CetakRiwayatSiswaDialog({
  sekolah,
}: {
  sekolah: SekolahInfo | null | undefined;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [printTarget, setPrintTarget] = useState<{ siswaId: number; nama: string } | null>(null);

  // Debounce input pencarian supaya tidak query ke Supabase setiap ketukan
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: hasilSiswa, isFetching } = useQuery({
    queryKey: ["cari-siswa-cetak-riwayat", debouncedSearch],
    enabled: open && debouncedSearch.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("siswa")
        .select("id, namasiswa, kelas, namawali")
        .or(`namasiswa.ilike.%${debouncedSearch}%,kelas.ilike.%${debouncedSearch}%`)
        .order("namasiswa", { ascending: true })
        .limit(15);

      if (error) {
        toast.error("Gagal mencari siswa", { description: error.message });
        return [];
      }
      return data || [];
    },
  });

  const closeDialog = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setSearch("");
      setDebouncedSearch("");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileStack className="mr-2 h-4 w-4" />
        Cetak Riwayat per Siswa
      </Button>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cetak Riwayat Pembayaran per Siswa</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Cari nama siswa atau kelas... (mis. Muhammad Firdaus)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1.5 -mx-1 px-1 mt-1">
            {debouncedSearch.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Ketik minimal 2 huruf untuk mencari siswa
              </p>
            ) : isFetching ? (
              <p className="text-sm text-muted-foreground text-center py-8">Mencari...</p>
            ) : !hasilSiswa?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Tidak ada siswa yang cocok dengan pencarian
              </p>
            ) : (
              hasilSiswa.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.namasiswa}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.kelas || "-"}
                      {s.namawali ? ` · Wali: ${s.namawali}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    disabled={printTarget !== null}
                    onClick={() => setPrintTarget({ siswaId: s.id, nama: s.namasiswa })}
                  >
                    <Printer className="h-3 w-3" />
                    Cetak
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Runner terpisah: fetch data lengkap siswa terpilih lalu langsung
          trigger dialog print begitu data & konten siap. */}
      {printTarget && (
        <CetakRiwayatSiswaRunner
          key={printTarget.siswaId}
          siswaId={printTarget.siswaId}
          namaSiswa={printTarget.nama}
          sekolah={sekolah}
          onDone={() => setPrintTarget(null)}
        />
      )}
    </>
  );
}

// ─── BARU: fetch riwayat lengkap 1 siswa (semua tagihan + transaksi SUCCESS)
// lalu langsung memicu dialog print begitu data siap. Query & susunan data
// persis sama dengan halaman Riwayat Pembayaran milik wali siswa, supaya
// hasil cetaknya identik — bedanya di sini idsiswa datang dari hasil
// pencarian, bukan dari activeSiswaId di auth store.
function CetakRiwayatSiswaRunner({
  siswaId,
  namaSiswa,
  sekolah,
  onDone,
}: {
  siswaId: number;
  namaSiswa: string;
  sekolah: SekolahInfo | null | undefined;
  onDone: () => void;
}) {
  const supabase = createClient();
  const contentRef = useRef<HTMLDivElement>(null);
  const hasPrinted = useRef(false);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Laporan-Riwayat-${namaSiswa}`,
    onAfterPrint: onDone,
  });

  const { data: siswaData } = useQuery({
    queryKey: ["siswa-detail-cetak-riwayat", siswaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("siswa").select("*").eq("id", siswaId).single();
      if (error) {
        toast.error("Gagal memuat data siswa", { description: error.message });
        return null;
      }
      return data;
    },
  });

  const { data: riwayatList, isSuccess: riwayatSelesai } = useQuery({
    queryKey: ["riwayat-siswa-cetak-riwayat", siswaId],
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
          namatagihan,
          jenjang,
          pembayaran(
            idpembayaran,
            jumlahdibayar,
            tanggalpembayaran,
            metodepembayaran,
            statuspembayaran,
            sisa_setelah_transaksi_ini
          )
        `)
        .eq("idsiswa", siswaId)
        .order("tahun", { ascending: false })
        .order("bulan", { ascending: false });

      if (error) {
        toast.error("Gagal memuat riwayat siswa", { description: error.message });
        return [];
      }
      return data || [];
    },
  });

  // Begitu data siswa & riwayat sudah siap dan konten hidden sudah sempat
  // ter-render dengan data final, langsung buka dialog print browser.
  useEffect(() => {
    if (riwayatSelesai && siswaData && riwayatList && !hasPrinted.current) {
      hasPrinted.current = true;
      const t = setTimeout(() => handlePrint(), 150);
      return () => clearTimeout(t);
    }
  }, [riwayatSelesai, siswaData, riwayatList, handlePrint]);

  if (!riwayatSelesai || !siswaData || !riwayatList) {
    return null;
  }

  const now = new Date();

  // Tabel: rangkum SEMUA transaksi dari SEMUA tagihan jadi satu list, urut
  // kronologis (paling lama duluan) — persis seperti mutasi rekening.
  const allItems = (riwayatList as any[])
    .flatMap((tagihan) =>
      (tagihan.pembayaran ?? [])
        .filter((p: any) => p.statuspembayaran === "SUCCESS")
        .map((p: any) => ({
          idpembayaran: p.idpembayaran,
          tanggalpembayaran: p.tanggalpembayaran,
          namatagihan: tagihan.namatagihan || "-",
          periode: `${BULAN_NAMA[tagihan.bulan]} ${tagihan.tahun}`,
          totalTagihan: parseFloat(tagihan.jumlahtagihan),
          jumlahDibayar: parseFloat(p.jumlahdibayar || "0"),
          sisaSetelahTransaksi:
            p.sisa_setelah_transaksi_ini != null
              ? Number(p.sisa_setelah_transaksi_ini)
              : Math.max(0, parseFloat(tagihan.jumlahtagihan) - parseFloat(tagihan.jumlahterbayar || "0")),
          metodepembayaran: p.metodepembayaran,
        }))
    )
    .sort(
      (a, b) => new Date(a.tanggalpembayaran).getTime() - new Date(b.tanggalpembayaran).getTime()
    );

  const totalDibayarKeseluruhan = allItems.reduce((s, it) => s + it.jumlahDibayar, 0);

  const tagihanBelumLunas: TagihanBelumLunasItem[] = (riwayatList as any[])
    .filter((t) => t.statuspembayaran !== "LUNAS")
    .sort((a, b) => (a.tahun * 12 + a.bulan) - (b.tahun * 12 + b.bulan))
    .map((t) => {
      const total = parseFloat(t.jumlahtagihan);
      const sudahDibayar = parseFloat(t.jumlahterbayar || "0");
      return {
        idtagihansiswa: t.idtagihansiswa,
        namatagihan: t.namatagihan || "-",
        periode: `${BULAN_NAMA[t.bulan]} ${t.tahun}`,
        totalTagihan: total,
        sudahDibayar,
        sisaTagihan: Math.max(0, total - sudahDibayar),
      };
    });

  const totalSisaBelumLunas = tagihanBelumLunas.reduce((s, t) => s + t.sisaTagihan, 0);

  const totalTagihanKeseluruhan = (riwayatList as any[]).reduce(
    (s, t) => s + parseFloat(t.jumlahtagihan),
    0
  );

  const sekolahData: SekolahInfo = {
    namaSekolah: sekolah?.namaSekolah || "-",
    alamatSekolah: sekolah?.alamatSekolah || "-",
    logoUrl: sekolah?.logoUrl || null,
    namaBendahara: sekolah?.namaBendahara || "-",
    tandaTanganUrl: sekolah?.tandaTanganUrl || null,
  };

  const laporanData: LaporanRiwayatData = {
    namaSiswa: (siswaData as any).namasiswa || (siswaData as any).namaSiswa || "-",
    kelas: (siswaData as any).kelas || "-",
    namaWali: (siswaData as any).namawali || (siswaData as any).namaWali || "-",
    tanggalCetak: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    jamCetak: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".") + " WIB",
    items: allItems,
    totalDibayarKeseluruhan,
    tagihanBelumLunas,
    totalSisaBelumLunas,
    totalTagihanKeseluruhan,
    sekolah: sekolahData,
  };

  return (
    <div className="hidden">
      <div ref={contentRef}>
        <LaporanRiwayatTemplate data={laporanData} />
      </div>
    </div>
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

  // FIX: sebelumnya `usePengaturanSekolah` cuma di-import tapi tidak pernah
  // dipanggil di komponen ini, padahal `sekolahInfo` dipakai di bawah untuk
  // ActionMenuRekap (kwitansi) — bug ini menyebabkan sekolahInfo selalu
  // undefined. Sekarang dipanggil di sini, satu sumber data untuk kwitansi
  // per transaksi maupun fitur cetak riwayat per siswa yang baru.
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

      <div className="flex flex-wrap items-center gap-2">
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

        {/* BARU: tombol cetak riwayat menyeluruh per siswa, dipisah dari
            navigasi bulan supaya jelas scope-nya beda (per siswa, bukan
            per bulan yang lagi ditampilkan). */}
        <div className="ml-auto">
          <CetakRiwayatSiswaDialog sekolah={sekolahInfo} />
        </div>
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