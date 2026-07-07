"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { convertIDR, cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Receipt, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import KwitansiTemplate, { KwitansiData } from "@/components/common/kwitansi-template";
import { generateQrCodeDataUrl } from "@/lib/kwitansi-helper";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type PembayaranItem = {
  idpembayaran: number;
  jumlahdibayar: string;
  tanggalpembayaran: string;
  metodepembayaran: string;
  statuspembayaran: string;
  // FIX poin 8: snapshot immutable, diisi SEKALI saat transaksi terjadi.
  // Bisa null untuk data lama sebelum migration dijalankan.
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
  master_tagihan: {
    namatagihan: string;
    jenjang: string;
    jenistagihan: string;
    nominal: number;
  };
  pembayaran?: PembayaranItem[];
};

type SisaTagihanItem = {
  idtagihansiswa: number;
  jumlahtagihan: string;
  bulan: number;
  tahun: number;
  master_tagihan: {
    namatagihan: string;
  } | null;
};

export default function RiwayatPembayaran() {
  const supabase = createClient();
  const profile = useAuthStore((state) => state.profile);
  const [expandedTagihan, setExpandedTagihan] = useState<Set<number>>(new Set());

  const { data: siswaData } = useQuery({
    queryKey: ["siswa-self-riwayat", profile.id],
    enabled: !!profile.id,
    queryFn: async () => {
      const { data } = await supabase.from("siswa").select("*").eq("id", profile.id).single();
      return data;
    },
  });

  const { data: riwayatList, isLoading } = useQuery({
    queryKey: ["riwayat-siswa", profile.id],
    enabled: !!profile.id,
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
          master_tagihan:master_tagihan!idmastertagihan(
            namatagihan, jenjang, jenistagihan, nominal
          ),
          pembayaran(
            idpembayaran,
            jumlahdibayar,
            tanggalpembayaran,
            metodepembayaran,
            statuspembayaran,
            sisa_setelah_transaksi_ini
          )
        `)
        .eq("idsiswa", profile.id)
        .order("tahun", { ascending: false })
        .order("bulan", { ascending: false });

      if (error) {
        toast.error("Gagal memuat riwayat", { description: error.message });
        return [];
      }
      return (data as unknown as TagihanItem[]) || [];
    },
  });

  // Query semua tagihan yang MASIH TUNGGAKAN (belum bayar ATAU belum lunas)
  // milik siswa ini untuk ditampilkan di kwitansi sebagai "tagihan lain".
  // FIX: sebelumnya cuma "BELUM BAYAR", sekarang mencakup "BELUM LUNAS" juga
  // supaya tagihan yang sudah dicicil sebagian tetap muncul di sini.
  const { data: sisaTagihanList } = useQuery({
    queryKey: ["sisa-tagihan-belum-bayar", profile.id],
    enabled: !!profile.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tagihan_siswa")
        .select(`
          idtagihansiswa,
          jumlahtagihan,
          bulan,
          tahun,
          master_tagihan:master_tagihan!idmastertagihan(namatagihan)
        `)
        .eq("idsiswa", profile.id)
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
          <CardHeader>
            <CardTitle>Daftar Riwayat Tagihan</CardTitle>
          </CardHeader>
          <CardContent>
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
                  {riwayatList.map((item, index) => {
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
                            <p className="font-medium">{item.master_tagihan?.namatagihan || "-"}</p>
                            <p className="text-xs text-muted-foreground">
                              #{item.idtagihansiswa} · {item.master_tagihan?.jenjang}
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
          </CardContent>
        </Card>
      )}
    </div>
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

  // FIX poin 8 — INTI PERBAIKAN:
  // Sebelumnya sisa dihitung LIVE dari `tagihan.jumlahterbayar` (kondisi
  // SEKARANG), sehingga kwitansi transaksi cicilan pertama akan salah
  // menampilkan "sisa Rp 0" kalau tagihan itu SUDAH lunas di kemudian hari.
  // Sekarang pakai snapshot `sisa_setelah_transaksi_ini` yang immutable,
  // diisi sekali saat transaksi itu terjadi (lihat actions.ts & webhook).
  // Fallback ke hitungan live HANYA untuk data lama sebelum migration
  // dijalankan (kolom snapshot masih null).
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
    namaTagihan: tagihan.master_tagihan?.namatagihan || "-",
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
      namatagihan: s.master_tagihan?.namatagihan || "-",
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
