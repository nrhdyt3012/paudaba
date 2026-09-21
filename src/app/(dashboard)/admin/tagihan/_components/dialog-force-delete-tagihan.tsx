"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

type Group = {
  key: string;
  nama: string;
  kelas: string;
  tagihan: string[];
  totalTerbayar: number;
};

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
  const [isLoading, setIsLoading] = useState(false);

  // Kelompokkan per siswa: 1 siswa bisa punya beberapa tagihan terpilih
  const { groups, totalTerbayar } = useMemo(() => {
    const map = new Map<string, Group>();
    let total = 0;

    items.forEach((item) => {
      const key = item.siswa?.id ?? `tagihan-${item.idtagihansiswa}`;
      const terbayar = parseFloat(item.jumlahterbayar) || 0;
      total += terbayar;

      if (!map.has(key)) {
        map.set(key, {
          key,
          nama: item.siswa?.namasiswa || "-",
          kelas: item.siswa?.kelas || "",
          tagihan: [],
          totalTerbayar: 0,
        });
      }
      const g = map.get(key)!;
      g.tagihan.push(`${item.namatagihan || "-"} (${item.bulan}/${item.tahun})`);
      g.totalTerbayar += terbayar;
    });

    return {
      groups: Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama)),
      totalTerbayar: total,
    };
  }, [items]);

  const handleSubmit = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await deleteTagihanSiswaBatch(
        items.map((i) => i.idtagihansiswa),
        true
      );

      if (res.deleted > 0) {
        toast.success(`${res.deleted} tagihan berhasil dihapus`);
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
            Hapus Tagihan yang Sudah Ada Pembayaran
          </DialogTitle>
          <DialogDescription>
            Tagihan berikut beserta data pembayarannya akan dihapus permanen.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-sm">
          {groups.map((g) => (
            <li
              key={g.key}
              className="flex items-start justify-between gap-3 rounded border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {g.nama}
                  {g.kelas && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {g.kelas}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{g.tagihan.join(" · ")}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {convertIDR(g.totalTerbayar)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          <span>
            {groups.length} siswa · {items.length} tagihan
          </span>
          <span>Total terbayar {convertIDR(totalTerbayar)}</span>
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
            disabled={isLoading}
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