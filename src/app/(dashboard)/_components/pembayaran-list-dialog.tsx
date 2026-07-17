"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { convertIDR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ITEMS_PER_PAGE = 10;
const first = (v: any) => (Array.isArray(v) ? v[0] : v);

interface PembayaranListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // idsiswa yang boleh ditampilkan (hasil filter angkatan global di dashboard).
  // undefined/null = tanpa filter (semua siswa).
  idSiswaFilter?: string[] | null;
}

export default function PembayaranListDialog({
  open,
  onOpenChange,
  idSiswaFilter,
}: PembayaranListDialogProps) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (open) {
      setSearch("");
      setCurrentPage(1);
    }
  }, [open]);

  // FIX konsisten dengan Rekapan Pembayaran: query dari tabel `pembayaran`
  // (log transaksi asli), bukan tagihan_siswa yang difilter LUNAS — supaya
  // transaksi cicilan cash juga ikut tampil apa adanya.
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["dashboard-sudah-bayar", open, idSiswaFilter],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("pembayaran")
        .select(`
          idpembayaran,
          idtagihansiswa,
          idsiswa,
          jumlahdibayar,
          tanggalpembayaran,
          metodepembayaran,
          statuspembayaran,
          tagihan_siswa:tagihan_siswa!idtagihansiswa(
            bulan, tahun,
            siswa:siswa!idsiswa(id, namasiswa, kelas),
            master_tagihan:master_tagihan!idmastertagihan(namatagihan, jenjang)
          )
        `)
        .eq("statuspembayaran", "SUCCESS")
        .order("tanggalpembayaran", { ascending: false });

      if (idSiswaFilter && idSiswaFilter.length > 0) {
        query = query.in("idsiswa", idSiswaFilter);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rawData || [];
    const q = search.toLowerCase();
    return (rawData || []).filter((item: any) => {
      const tagihan = first(item.tagihan_siswa);
      const siswa = first(tagihan?.siswa);
      const master = first(tagihan?.master_tagihan);
      const nama = siswa?.namasiswa?.toLowerCase() || "";
      const kelas = siswa?.kelas?.toLowerCase() || "";
      const namaTagihan = master?.namatagihan?.toLowerCase() || "";
      return nama.includes(q) || kelas.includes(q) || namaTagihan.includes(q);
    });
  }, [rawData, search]);

  const totalNominal = filtered.reduce(
    (s: number, i: any) => s + parseFloat(i.jumlahdibayar || 0),
    0
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1300px] sm:max-w-[1300px] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-8 py-5 border-b shrink-0 bg-background">
          <div className="flex flex-col items-center text-center gap-1">
            <DialogTitle className="text-2xl font-bold">Daftar Siswa Sudah Bayar</DialogTitle>
            <DialogDescription className="mt-1 text-base">
              {filtered.length} transaksi dari semua periode
            </DialogDescription>
          </div>
        </DialogHeader>

        {!isLoading && (rawData?.length || 0) > 0 && (
          <div className="px-6 py-3 border-b shrink-0 flex justify-end">
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Cari nama siswa, kelas, atau tagihan..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 h-11 text-base"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-8 py-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Belum ada transaksi pembayaran
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background z-20">
                <tr className="border-b bg-muted">
                  <th className="p-3 text-left">No</th>
                  <th className="p-3 text-left">Nama Siswa</th>
                  <th className="p-3 text-left">Kelas</th>
                  <th className="p-3 text-left">Tagihan</th>
                  <th className="p-3 text-left">Metode</th>
                  <th className="p-3 text-right">Dibayar</th>
                  <th className="p-3 text-left">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item: any, i: number) => {
                  const tagihan = first(item.tagihan_siswa);
                  const siswa = first(tagihan?.siswa);
                  const master = first(tagihan?.master_tagihan);
                  return (
                    <tr key={item.idpembayaran} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-muted-foreground">
                        {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                      </td>
                      <td className="p-3 font-medium">{siswa?.namasiswa || "-"}</td>
                      <td className="p-3">{siswa?.kelas || "-"}</td>
                      <td className="p-3">{master?.namatagihan || "-"}</td>
                      <td className="p-3 capitalize">{item.metodepembayaran || "-"}</td>
                      <td className="p-3 text-right font-semibold text-green-600">
                        {convertIDR(parseFloat(item.jumlahdibayar || 0))}
                      </td>
                      <td className="p-3">
                        {new Date(item.tanggalpembayaran).toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold bg-muted/30">
                  <td colSpan={5} className="p-3 text-right">Total:</td>
                  <td className="p-3 text-right text-green-600">{convertIDR(totalNominal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-8 py-4 border-t shrink-0 flex flex-col items-center gap-2 bg-muted/30">
            <span className="text-sm text-muted-foreground text-center">
              Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} dari {filtered.length} transaksi
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ‹
                </Button>
                <span className="text-xs px-2">{currentPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  ›
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
