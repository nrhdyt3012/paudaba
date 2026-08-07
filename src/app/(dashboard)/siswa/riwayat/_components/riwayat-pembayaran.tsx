"use client";

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
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { convertIDR, cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Receipt, Printer, ChevronDown, ChevronUp, FileStack, Search, PrinterIcon } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import KwitansiTemplate, { KwitansiData } from "@/components/common/kwitansi-template";
import LaporanRiwayatTemplate, {
  LaporanRiwayatData,
  TagihanBelumLunasItem,
} from "@/components/common/laporan-riwayat-template";
import { generateQrCodeDataUrl } from "@/lib/kwitansi-helper";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STATUS_FILTER_OPTIONS = [
  { value: "semua", label: "Semua Status" },
  { value: "BELUM BAYAR", label: "Belum Bayar" },
  { value: "BELUM LUNAS", label: "Belum Lunas" },
  { value: "LUNAS", label: "Lunas" },
];

type PembayaranItem = {
  idpembayaran: number;
  jumlahdibayar: string;
  tanggalpembayaran: string;
  metodepembayaran: string;
  statuspembayaran: string;
  sisa_setelah_transaksi_ini: string | number | null;
};

type TagihanItem = {
  idtagihansiswa: number;
  jumlahtagihan: string;
  jumlahterbayar: string;
  statuspembayaran: string;
  bulan: number;
  tahun: number;
  createdat: string;
  updatedat: string;
  // FIX: namatagihan & jenjang sekarang kolom SNAPSHOT langsung di
  // tagihan_siswa (bukan lagi lewat join master_tagihan) — supaya kwitansi
  // & riwayat tetap menunjukkan nama/jenjang SAAT tagihan itu diterbitkan,
  // bukan ikut berubah kalau Master Tagihan-nya diedit belakangan.
  namatagihan: string;
  jenjang: string;
  pembayaran?: PembayaranItem[];
};

type SisaTagihanItem = {
  idtagihansiswa: number;
  jumlahtagihan: string;
  bulan: number;
  tahun: number;
  namatagihan: string;
};

export default function RiwayatPembayaran() {
  const supabase = createClient();
  const activeSiswaId = useAuthStore((state) => state.profile.activeSiswaId);
  const [expandedTagihan, setExpandedTagihan] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("semua");

  const { data: siswaData } = useQuery({
    queryKey: ["siswa-self-riwayat", activeSiswaId],
    enabled: !!activeSiswaId,
    queryFn: async () => {
      const { data } = await supabase.from("siswa").select("*").eq("id", activeSiswaId).single();
      return data;
    },
  });

  const { data: riwayatList, isLoading } = useQuery({
    queryKey: ["riwayat-siswa", activeSiswaId],
    enabled: !!activeSiswaId,
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
          updatedat,
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
        .eq("idsiswa", activeSiswaId)
        .order("tahun", { ascending: false })
        .order("bulan", { ascending: false });

      if (error) {
        toast.error("Gagal memuat riwayat", { description: error.message });
        return [];
      }
      return (data as unknown as TagihanItem[]) || [];
    },
  });

  const { data: sisaTagihanList } = useQuery({
    queryKey: ["sisa-tagihan-belum-bayar", activeSiswaId],
    enabled: !!activeSiswaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tagihan_siswa")
        .select(`
          idtagihansiswa,
          jumlahtagihan,
          bulan,
          tahun,
          namatagihan
        `)
        .eq("idsiswa", activeSiswaId)
        .in("statuspembayaran", ["BELUM BAYAR", "BELUM LUNAS"])
        .order("tahun", { ascending: false })
        .order("bulan", { ascending: false });
      return (data as unknown as SisaTagihanItem[]) || [];
    },
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      "BELUM BAYAR": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      "BELUM LUNAS": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
      "LUNAS": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    };
    const label: Record<string, string> = {
      "BELUM BAYAR": "Belum Bayar",
      "BELUM LUNAS": "Belum Lunas",
      "LUNAS": "Lunas",
    };
    return (
      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", config[status] || config["BELUM BAYAR"])}>
        {label[status] || status}
      </span>
    );
  };

  const toggleExpand = (id: number) => {
    setExpandedTagihan((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getSuccessPembayaran = (item: TagihanItem) =>
    (item.pembayaran ?? []).filter(
      (p) => p.statuspembayaran === "SUCCESS" || p.statuspembayaran === "PARTIAL"
    );

  // FIX: search bar (cari nama tagihan/periode) + filter status, sejajar
  // dengan judul "Daftar Riwayat Tagihan".
  const filteredRiwayatList = useMemo(() => {
    let result = riwayatList || [];

    if (filterStatus !== "semua") {
      result = result.filter((item) => item.statuspembayaran === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const namaTagihan = item.namatagihan?.toLowerCase() || "";
        const periode = `${BULAN_NAMA[item.bulan]} ${item.tahun}`.toLowerCase();
        return namaTagihan.includes(q) || periode.includes(q);
      });
    }

    return result;
  }, [riwayatList, searchQuery, filterStatus]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="animate-spin h-8 w-8 text-green-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Riwayat Pembayaran</h1>
        <p className="text-sm text-muted-foreground">Semua tagihan dan status pembayaran</p>
      </div>

      {!riwayatList?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Belum ada riwayat tagihan</p>
            <p className="text-sm text-muted-foreground">
              Tagihan akan muncul di sini setelah admin membuat tagihan
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <CardTitle className="shrink-0">Daftar Riwayat Tagihan</CardTitle>
            {/* FIX: search bar + filter status + tombol cetak laporan
                menyeluruh, sejajar dengan judul "Daftar Riwayat Tagihan". */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama tagihan atau periode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[150px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PrintButtonLaporanMenyeluruh riwayatList={riwayatList} siswaData={siswaData} />
            </div>
          </CardHeader>
          <CardContent>
            {filteredRiwayatList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Tidak ditemukan tagihan yang cocok dengan pencarian/filter ini
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3">No</th>
                    <th className="text-left p-3">Tagihan</th>
                    <th className="text-left p-3">Periode</th>
                    <th className="text-right p-3">Total</th>
                    <th className="text-right p-3">Terbayar</th>
                    <th className="text-right p-3">Sisa</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRiwayatList.map((item, index) => {
                    const totalTagihan = parseFloat(item.jumlahtagihan);
                    const sudahBayar = parseFloat(item.jumlahterbayar || "0");
                    const sisa = Math.max(0, totalTagihan - sudahBayar);
                    const isExpanded = expandedTagihan.has(item.idtagihansiswa);
                    const successPembayaran = getSuccessPembayaran(item);

                    return (
                      <Fragment key={`tagihan-${item.idtagihansiswa}`}>
                        <tr
                          className={cn(
                            "border-b hover:bg-muted/50 cursor-pointer",
                            isExpanded && "bg-muted/30"
                          )}
                          onClick={() => {
                            if (successPembayaran.length > 0) {
                              toggleExpand(item.idtagihansiswa);
                            }
                          }}
                        >
                          <td className="p-3">{index + 1}</td>
                          <td className="p-3">
                            <p className="font-medium">{item.namatagihan || "-"}</p>
                            <p className="text-xs text-muted-foreground">
                              #{item.idtagihansiswa} · {item.jenjang}
                            </p>
                          </td>
                          <td className="p-3">{BULAN_NAMA[item.bulan]} {item.tahun}</td>
                          <td className="p-3 text-right font-semibold">
                            {convertIDR(totalTagihan)}
                          </td>
                          <td className="p-3 text-right text-green-600 font-semibold">
                            {convertIDR(sudahBayar)}
                          </td>
                          <td className="p-3 text-right">
                            <span className={cn(
                              "font-semibold",
                              sisa > 0 ? "text-red-600" : "text-green-600"
                            )}>
                              {sisa > 0 ? convertIDR(sisa) : "Lunas"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {getStatusBadge(item.statuspembayaran)}
                          </td>
                          <td className="p-3 text-center">
                            {successPembayaran.length > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(item.idtagihansiswa);
                                }}
                                className="text-xs text-muted-foreground flex items-center gap-1 mx-auto hover:text-foreground"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {successPembayaran.length} transaksi
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && successPembayaran.length > 0 && (
                          <tr>
                            <td colSpan={8} className="p-0 bg-muted/20">
                              <div className="px-6 py-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                                  Riwayat Transaksi
                                </p>
                                <div className="space-y-2">
                                  {successPembayaran
                                    .sort((a, b) =>
                                      new Date(a.tanggalpembayaran).getTime() -
                                      new Date(b.tanggalpembayaran).getTime()
                                    )
                                    .map((p, pIdx) => (
                                      <div
                                        key={p.idpembayaran}
                                        className="flex items-center justify-between bg-white dark:bg-card border rounded-lg px-4 py-2"
                                      >
                                        <div className="flex items-center gap-4">
                                          <span className="text-xs text-muted-foreground">
                                            #{pIdx + 1}
                                          </span>
                                          <div>
                                            <p className="text-sm font-semibold text-green-600">
                                              {convertIDR(parseFloat(p.jumlahdibayar || "0"))}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {new Date(p.tanggalpembayaran).toLocaleDateString("id-ID", {
                                                day: "numeric", month: "long", year: "numeric",
                                                hour: "2-digit", minute: "2-digit",
                                              })}
                                              {" · "}
                                              {p.metodepembayaran === "cash" ? "Cash/Manual" : "Transfer/Online"}
                                            </p>
                                          </div>
                                        </div>
                                        <PrintButtonSingle
                                          pembayaran={p}
                                          tagihan={item}
                                          siswaData={siswaData}
                                          indexTransaksi={pIdx + 1}
                                          totalTagihan={totalTagihan}
                                          sisaTagihanBelumBayar={sisaTagihanList || []}
                                        />
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tombol cetak laporan tagihan MENYELURUH (riwayat pembayaran + rincian
// tagihan yang belum lunas) ─────────────────────────────────────────────────
function PrintButtonLaporanMenyeluruh({
  riwayatList,
  siswaData,
}: {
  riwayatList: TagihanItem[];
  siswaData: any;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Laporan-Tagihan-${siswaData?.namasiswa || "Siswa"}`,
  });

  const now = new Date();

  // Tabel 1: rangkum SEMUA transaksi dari SEMUA tagihan jadi satu list, urut
  // kronologis (paling lama duluan) — persis seperti mutasi rekening.
  const allItems = riwayatList
    .flatMap((tagihan) =>
      (tagihan.pembayaran ?? [])
        .filter((p) => p.statuspembayaran === "SUCCESS")
        .map((p) => ({
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

  // BARU — Tabel 2: rincian tagihan yang statusnya belum LUNAS, diambil dari
  // data tagihan_siswa TERKINI (bukan dari histori pembayaran), supaya wali
  // siswa tahu persis sisa tagihan yang masih harus dibayar saat laporan
  // ini dicetak.
  const tagihanBelumLunas: TagihanBelumLunasItem[] = riwayatList
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

  const laporanData: LaporanRiwayatData = {
    namaSiswa: siswaData?.namasiswa || siswaData?.namaSiswa || "-",
    kelas: siswaData?.kelas || "-",
    namaWali: siswaData?.namawali || siswaData?.namaWali || "-",
    tanggalCetak: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    jamCetak: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".") + " WIB",
    items: allItems,
    totalDibayarKeseluruhan,
    tagihanBelumLunas,
    totalSisaBelumLunas,
  };

  return (
    <>
      <Button onClick={handlePrint} variant="outline" className="gap-2">
        <PrinterIcon className="h-4 w-4" />
        Cetak Laporan Tagihan Menyeluruh
      </Button>
      <div className="hidden">
        <div ref={contentRef}>
          <LaporanRiwayatTemplate data={laporanData} />
        </div>
      </div>
    </>
  );
}

// ─── Komponen print per transaksi ─────────────────────────────────────────────
function PrintButtonSingle({
  pembayaran,
  tagihan,
  siswaData,
  indexTransaksi,
  totalTagihan,
  sisaTagihanBelumBayar,
}: {
  pembayaran: PembayaranItem;
  tagihan: TagihanItem;
  siswaData: any;
  indexTransaksi: number;
  totalTagihan: number;
  sisaTagihanBelumBayar: SisaTagihanItem[];
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
 
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Kwitansi-${tagihan.idtagihansiswa}-Transaksi-${pembayaran.idpembayaran}`,
  });
 
  const jumlahBayar = parseFloat(pembayaran.jumlahdibayar || "0");

  const sisaSetelahIni =
    pembayaran.sisa_setelah_transaksi_ini != null
      ? Math.max(0, Number(pembayaran.sisa_setelah_transaksi_ini))
      : Math.max(0, totalTagihan - parseFloat(tagihan.jumlahterbayar || "0"));

  const isLunas = sisaSetelahIni <= 0 && pembayaran.statuspembayaran === "SUCCESS";
 
  const tglBayar = new Date(pembayaran.tanggalpembayaran);
  const noKwitansi = `${tagihan.idtagihansiswa}/${pembayaran.idpembayaran}/${tglBayar.getFullYear()}`;
 
  useEffect(() => {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const linkKwitansi = `${appUrl}/kwitansi/${pembayaran.idpembayaran}`;
    generateQrCodeDataUrl(linkKwitansi).then(setQrCodeDataUrl);
  }, [pembayaran.idpembayaran]);
 
  void indexTransaksi;
 
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
    namaSiswa: siswaData?.namasiswa || siswaData?.namaSiswa || "-",
    kelas: siswaData?.kelas || "-",
    namaWali: siswaData?.namawali || siswaData?.namaWali || "-",
    namaTagihan: tagihan.namatagihan || "-",
    periode: `${BULAN_NAMA[tagihan.bulan]} ${tagihan.tahun}`,
    jumlahDibayar: jumlahBayar,
    totalTagihan,
    sisaTagihan: sisaSetelahIni,
    isLunas,
    qrCodeDataUrl,
    tagihanLain: sisaTagihanBelumBayar.map((s) => ({
      idtagihansiswa: s.idtagihansiswa,
      jumlahtagihan: s.jumlahtagihan,
      bulan: s.bulan,
      tahun: s.tahun,
      namatagihan: s.namatagihan || "-",
    })),
  };
 
  return (
    <>
      <Button onClick={handlePrint} size="sm" variant="outline" className="gap-1 text-xs h-8">
        <Printer className="h-3 w-3" />
        Cetak Kwitansi
      </Button>
 
      <div className="hidden">
        <div ref={contentRef}>
          <KwitansiTemplate data={kwitansiData} />
        </div>
      </div>
    </>
  );
}