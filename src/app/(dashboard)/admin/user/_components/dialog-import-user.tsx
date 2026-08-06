"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileUp, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importUsersBulk, ImportResult } from "../actions";

const TEMPLATE_HEADERS = [
  "Nama Siswa", "NIS", "Jenis Kelamin", "Kelas", "Angkatan",
  "Nama Wali", "No WA", "Email", "Password", "Tempat Lahir",
  "Tanggal Lahir", "Alamat", "Tipe SPP",
];

const TEMPLATE_EXAMPLE = {
  "Nama Siswa": "Contoh: Budi Santoso",
  "NIS": "2024001",
  "Jenis Kelamin": "Laki-laki",
  "Kelas": "TK A",
  "Angkatan": "2024",
  "Nama Wali": "Contoh: Siti Aminah",
  "No WA": "08123456789",
  "Email": "wali.budi@example.com",
  "Password": "min6karakter",
  "Tempat Lahir": "Surabaya",
  "Tanggal Lahir": "2020-05-10",
  "Alamat": "Jl. Contoh No. 1",
  "Tipe SPP": "reguler",
};

export default function DialogImportUser({ refetch }: { refetch: () => void }) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE], { header: TEMPLATE_HEADERS });
    worksheet["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Import Siswa");
    XLSX.writeFile(workbook, "Template-Import-Data-Siswa.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

        if (rows.length === 0) {
          toast.error("File Excel kosong atau format tidak sesuai");
          setPreview([]);
          return;
        }
        setPreview(rows);
      } catch {
        toast.error("Gagal membaca file Excel", {
          description: "Pastikan file sesuai format template",
        });
        setPreview([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setIsProcessing(true);
    setResult(null);

    try {
      const rows = preview.map((r) => ({
        nama_siswa: r["Nama Siswa"] || "",
        NIS: String(r["NIS"] || ""),
        jenis_kelamin: r["Jenis Kelamin"] || "",
        kelas: r["Kelas"] || "",
        angkatan: String(r["Angkatan"] || ""),
        nama_wali: r["Nama Wali"] || "",
        no_wa: String(r["No WA"] || ""),
        email: r["Email"] || "",
        password: r["Password"] ? String(r["Password"]) : undefined,
        tempat_lahir: r["Tempat Lahir"] || "",
        tanggal_lahir: r["Tanggal Lahir"] || "",
        alamat: r["Alamat"] || undefined,
        tipe_spp: r["Tipe SPP"] || "reguler",
      }));

      const res = await importUsersBulk(rows);
      setResult(res);

      if (res.berhasil > 0) {
        toast.success(`${res.berhasil} data siswa berhasil diimpor`);
        refetch();
      }
      if (res.gagal > 0) {
        toast.error(`${res.gagal} data gagal diimpor`, { description: "Lihat detail di bawah" });
      }
    } catch (err: any) {
      toast.error("Gagal memproses impor", { description: err?.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPreview([]);
    setFileName("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="w-4 h-4 mr-2" />
          Impor Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Impor Data Siswa dari Excel</DialogTitle>
          <DialogDescription>
            Unggah file Excel (.xlsx) sesuai format template untuk menambahkan banyak siswa sekaligus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 px-1">
          <Button variant="secondary" onClick={handleDownloadTemplate} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Unduh Template Excel
          </Button>

          <Input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} />

          {preview.length > 0 && !result && (
            <div className="border rounded-md p-3 text-sm bg-muted/40">
              <p className="font-medium mb-1">
                {fileName} — {preview.length} baris data siap diimpor
              </p>
              <p className="text-muted-foreground text-xs">
                Pastikan kolom Email unik dan belum pernah digunakan sebelumnya.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> {result.berhasil} berhasil
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" /> {result.gagal} gagal
                </span>
              </div>
              {result.detailGagal.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto text-xs divide-y">
                  {result.detailGagal.map((d, i) => (
                    <div key={i} className="p-2">
                      <span className="font-medium">Baris {d.baris} ({d.nama}):</span>{" "}
                      <span className="text-red-600">{d.pesan}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {result ? "Tutup" : "Batal"}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={preview.length === 0 || isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileUp className="w-4 h-4 mr-2" />
              )}
              Impor {preview.length > 0 ? `(${preview.length} data)` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}