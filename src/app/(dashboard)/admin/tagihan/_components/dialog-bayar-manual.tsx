"use client";

import { Dialog } from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { bayarTagihanManual } from "../actions";
import { uploadFile } from "@/actions/storage-action";
import { toast } from "sonner";
import FormInput from "@/components/common/form-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Loader2, Banknote, AlertTriangle, Upload, X, ImageIcon } from "lucide-react";
import { z } from "zod";
import { convertIDR } from "@/lib/utils";

const schema = z.object({
  jumlahbayar: z.string().min(1, "Jumlah bayar wajib diisi"),
});

type FormType = z.infer<typeof schema>;

// Bucket Supabase Storage untuk bukti pembayaran. Bucket ini harus dibuat
// dulu secara manual di Supabase Dashboard (Storage → New bucket → set
// public), lihat catatan di README patch.
const BUCKET_BUKTI_PEMBAYARAN = "bukti-pembayaran";

export default function DialogBayarManual({
  refetch,
  currentData,
  open,
  handleChangeAction,
}: {
  refetch: () => void;
  currentData?: any;
  open?: boolean;
  handleChangeAction?: (open: boolean) => void;
}) {
  const form = useForm<FormType>({ resolver: zodResolver(schema) });
  const [isPending, setIsPending] = useState(false);
  const [tipePembayaran, setTipePembayaran] = useState<"cash" | "transfer">("cash");
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bukti pembayaran harus berupa gambar (jpg/png)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 5MB");
      return;
    }
    setBuktiFile(file);
    setBuktiPreview(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setBuktiFile(null);
    setBuktiPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = form.handleSubmit(async (data) => {
    const jumlahBayar = parseFloat(data.jumlahbayar);
    const sisaTagihan = parseFloat(currentData?.sisa || currentData?.jumlahtagihan || "0");

    if (jumlahBayar > sisaTagihan) {
      toast.error("Jumlah bayar melebihi sisa tagihan");
      return;
    }

    try {
      setIsPending(true);

      // FIX: kalau ada bukti pembayaran, upload dulu ke Supabase Storage
      // sebelum submit form — hasil URL-nya disertakan ke action.
      let buktiUrl: string | null = null;
      if (buktiFile) {
        const uploadResult = await uploadFile(
          BUCKET_BUKTI_PEMBAYARAN,
          `tagihan-${currentData?.idtagihansiswa}`,
          buktiFile
        );
        if (uploadResult.status === "error") {
          toast.error("Gagal mengunggah bukti pembayaran", {
            description: uploadResult.errors?._form?.[0],
          });
          setIsPending(false);
          return;
        }
        buktiUrl = uploadResult.data?.url || null;
      }

      const formData = new FormData();
      formData.append("idtagihansiswa", currentData?.idtagihansiswa?.toString() ?? "");
      formData.append("jumlahbayar", data.jumlahbayar);
      formData.append("tipepembayaran", tipePembayaran);
      if (buktiUrl) formData.append("buktipembayaranurl", buktiUrl);

      const state = await bayarTagihanManual({}, formData);

      if (state?.status === "error") {
        toast.error("Gagal Menyimpan Pembayaran", { description: state.errors?._form?.[0] });
      } else if (state?.status === "success") {
        const statusBaru = state.data?.statusbaru;
        const sisaBaru = state.data?.sisatagihan ?? 0;

        if (statusBaru === "LUNAS") {
          toast.success("Pembayaran berhasil! Tagihan sudah LUNAS.");
        } else {
          toast.success(`Pembayaran berhasil! Sisa tagihan: ${convertIDR(sisaBaru)}`);
        }

        form.reset();
        setTipePembayaran("cash");
        handleRemoveFile();
        handleChangeAction?.(false);
        refetch();
      }
    } catch (error) {
      toast.error("Terjadi kesalahan", { description: String(error) });
    } finally {
      setIsPending(false);
    }
  });

  useEffect(() => {
    if (currentData && open) {
      form.reset({ jumlahbayar: "" });
      setTipePembayaran("cash");
      handleRemoveFile();
    }
  }, [currentData, open]);

  const sisaTagihan = parseFloat(currentData?.sisa || currentData?.jumlahtagihan || "0");
  const jumlahBayarVal = form.watch("jumlahbayar");
  const jumlahBayarNum = parseFloat(jumlahBayarVal || "0");
  const sisaSetelahBayar = sisaTagihan - jumlahBayarNum;

  return (
    <Dialog open={open} onOpenChange={handleChangeAction}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-600" />
              Bayar Tagihan (Manual)
            </DialogTitle>
            <DialogDescription>
              Input pembayaran yang diterima secara cash atau transfer manual
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Info tagihan */}
            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID Tagihan:</span>
                <span className="font-mono">#{currentData?.idtagihansiswa}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama Siswa:</span>
                <span className="font-medium">{currentData?.siswa?.namasiswa || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tagihan:</span>
                <span>{currentData?.namatagihan || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Periode:</span>
                <span>{currentData?.bulan}/{currentData?.tahun}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total Tagihan:</span>
                <span className="text-blue-700 dark:text-blue-400">
                  {convertIDR(parseFloat(currentData?.jumlahtagihan) || 0)}
                </span>
              </div>
              {currentData?.jumlahterbayar > 0 && (
                <div className="flex justify-between text-green-700 dark:text-green-400">
                  <span>Sudah Dibayar:</span>
                  <span className="font-semibold">
                    {convertIDR(parseFloat(currentData?.jumlahterbayar) || 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-bold text-red-700 dark:text-red-400">
                <span>Sisa Tagihan:</span>
                <span className="text-lg">
                  {convertIDR(sisaTagihan)}
                </span>
              </div>
            </div>

            {/* FIX: Tipe Pembayaran — cash / transfer */}
            <div className="space-y-1.5">
              <Label className="text-sm">Tipe Pembayaran</Label>
              <Select
                value={tipePembayaran}
                onValueChange={(v) => setTipePembayaran(v as "cash" | "transfer")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FormInput
              form={form}
              name="jumlahbayar"
              label="Jumlah Dibayarkan (Rp)"
              placeholder="Contoh: 50.000"
              type="currency"
            />

            {/* FIX: Upload Bukti Pembayaran */}
            <div className="space-y-1.5">
              <Label className="text-sm">Bukti Pembayaran (opsional)</Label>
              {!buktiPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-1.5 text-muted-foreground hover:border-green-400 hover:text-green-600 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Klik untuk unggah foto bukti transfer/cash</span>
                  <span className="text-[10px]">JPG/PNG, maks 5MB</span>
                </button>
              ) : (
                <div className="relative w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={buktiPreview}
                    alt="Preview bukti pembayaran"
                    className="h-32 rounded-lg border object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Preview sisa setelah bayar */}
            {jumlahBayarNum > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Sisa Setelah Bayar:</span>
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {sisaSetelahBayar <= 0 ? "LUNAS ✓" : convertIDR(sisaSetelahBayar)}
                  </span>
                </div>
              </div>
            )}

            {jumlahBayarNum > sisaTagihan && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Jumlah pembayaran <strong>melebihi sisa tagihan</strong>. Maksimal yang bisa dibayar: {convertIDR(sisaTagihan)}
                </p>
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isPending}>Batal</Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={isPending || jumlahBayarNum <= 0 || jumlahBayarNum > sisaTagihan}
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2 w-4 h-4" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Banknote className="w-4 h-4 mr-2" />
                    Simpan Pembayaran
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
