"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { convertIDR } from "@/lib/utils";
import { deleteTagihanSiswaBatch } from "../actions";

const CONFIRM_WORD = "HAPUS";
const MAX_LIST = 5;

export default function DialogForceDeleteTagihan({
  open,
  items,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  items: any[];
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Kosongkan isian setiap kali dialog dibuka ulang
  useEffect(() => {
    if (open) setConfirmText("");
  }, [open]);

  const summary = useMemo(() => {
    let totalTerbayar = 0;
    let jumlahTransaksi = 0;
    let adaMidtrans = false;

    items.forEach((item) => {
      totalTerbayar += parseFloat(item.jumlahterbayar) || 0;
      (item.pembayaran ?? []).forEach((p: any) => {
        if (p.statuspembayaran !== "SUCCESS") return;
        jumlahTransaksi++;
        if (p.metodepembayaran !== "cash" && p.metodepembayaran !== "transfer") {
          adaMidtrans = true;
        }
      });
    });

    return { totalTerbayar, jumlahTransaksi, adaMidtrans };
  }, [items]);

  const canSubmit =
    confirmText.trim().toUpperCase() === CONFIRM_WORD && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      const res = await deleteTagihanSiswaBatch(
        items.map((i) => i.idtagihansiswa),
        true
      );

      if (res.deleted > 0) {
        toast.success(`${res.deleted} tagihan berhasil dihapus permanen`);
      }
      if (res.failed.length > 0) {
        toast.error(`${res.failed.length} tagihan gagal dihapus`, {
          description: res.failed[0].message,
        });
      }
      if (res.deleted > 0) {
        onOpenChange(false);
        onDeleted();
      }
    } catch (e: any) {
      toast.error("Gagal menghapus", { description: e?.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Hapus Permanen Tagihan dengan Riwayat Pembayaran
          </DialogTitle>
          <DialogDescription>
            Tagihan di bawah ini sudah memiliki pembayaran. Penghapusan bersifat
            permanen dan tidak bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            <p className="font-semibold">
              {items.length} tagihan · {summary.jumlahTransaksi} transaksi
              berhasil · total terbayar {convertIDR(summary.totalTerbayar)}
            </p>
          </div>

          <ul className="space-y-1">
            {items.slice(0, MAX_LIST).map((item) => (
              <li
                key={item.idtagihansiswa}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    #{item.idtagihansiswa} — {item.siswa?.namasiswa || "-"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.namatagihan} ({item.bulan}/{item.tahun}) ·{" "}
                    {item.statuspembayaran}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold">
                  {convertIDR(parseFloat(item.jumlahterbayar) || 0)}
                </span>
              </li>
            ))}
            {items.length > MAX_LIST && (
              <li className="px-1 text-xs text-muted-foreground">
                + {items.length - MAX_LIST} tagihan lainnya
              </li>
            )}
          </ul>

          <div>
            <p className="mb-1 font-medium">Data yang ikut terhapus permanen:</p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>Tagihan siswa</li>
              <li>Semua catatan pembayaran (termasuk yang berhasil)</li>
              <li>Rekapan pembayaran &amp; rekapan tunggakan</li>
              <li>Log payment gateway &amp; log notifikasi WhatsApp</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Laporan keuangan yang bersumber dari rekapan pembayaran akan
              berubah karena transaksi ini hilang dari catatan.
            </p>
          </div>

          {summary.adaMidtrans && (
            <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-100">
              Ada pembayaran via <b>Midtrans</b>. Dana tetap tercatat di
              dashboard Midtrans meskipun datanya dihapus dari sistem ini.
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm">
              Ketik <span className="font-mono font-bold">{CONFIRM_WORD}</span>{" "}
              untuk melanjutkan
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Hapus Permanen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}