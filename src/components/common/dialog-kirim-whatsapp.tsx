// components/dialog/dialog-kirim-whatsapp.tsx
"use client";

import { Dialog } from "@/components/ui/dialog";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Send } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  isLoading: boolean;
  namaSiswa: string;
  kelas?: string;
  namaTagihan?: string;
  jumlahDibayar?: string; // sudah diformat, mis. convertIDR(...)
  sisaText?: string; // mis. "Lunas" atau "Rp 50.000"
  sudahPernahDikirim?: boolean;
  tanggalKirimSebelumnya?: string | null;
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function DialogKirimWhatsApp({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  namaSiswa,
  kelas,
  namaTagihan,
  jumlahDibayar,
  sisaText,
  sudahPernahDikirim,
  tanggalKirimSebelumnya,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !isLoading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[440px]">
        <div className="grid gap-5">
          <DialogHeader className="items-center text-center sm:text-center">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <MessageCircle className="h-7 w-7 text-green-600" />
            </div>
            <DialogTitle>
              {sudahPernahDikirim ? "Kirim Ulang Notifikasi" : "Kirim Notifikasi WhatsApp"}
            </DialogTitle>
            <DialogDescription>
              Notifikasi pembayaran untuk{" "}
              <span className="font-semibold text-foreground">{namaSiswa}</span>{" "}
              akan dikirim ke nomor WhatsApp wali murid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <InfoRow label="Nama Siswa" value={namaSiswa} />
            <InfoRow label="Kelas" value={kelas} />
            <InfoRow label="Tagihan" value={namaTagihan} />
            <InfoRow label="Dibayar" value={jumlahDibayar} />
            <InfoRow label="Sisa" value={sisaText} />
          </div>

          {sudahPernahDikirim && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Notifikasi ini sudah pernah dikirim
              {tanggalKirimSebelumnya ? ` pada ${tanggalKirimSebelumnya}` : ""}.
              Mengirim lagi akan membuat wali menerima pesan yang sama dua kali.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Batal
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {sudahPernahDikirim ? "Kirim Ulang" : "Kirim"}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}