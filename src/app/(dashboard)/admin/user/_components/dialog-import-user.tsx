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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileUp, Download, Loader2, CheckCircle2, XCircle, RefreshCw, Eye, ArrowLeft, AlertTriangle, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  importUsersBulk,
  previewImportUsersBulk,
  ImportResult,
  ImportRow,
  ImportPlanResult,
} from "../actions";

const TEMPLATE_HEADERS = [
  "Nama Siswa", "NIS", "Jenis Kelamin", "Kelas", "Angkatan",
  "Nama Wali", "No WA", "Email (Opsional)", "Password (Opsional)",
  "Tempat Lahir", "Tanggal Lahir", "Alamat", "Tipe SPP",
];

const TEMPLATE_EXAMPLE = {
  "Nama Siswa": "Contoh: Budi Santoso",
  "NIS": "2024001",
  "Jenis Kelamin": "Laki-laki",
  "Kelas": "TK A",
  "Angkatan": "2024",
  "Nama Wali": "Contoh: Siti Aminah",
  "No WA": "08123456789",
  "Email (Opsional)": "",
  "Password (Opsional)": "",
  "Tempat Lahir": "Surabaya",
  "Tanggal Lahir": "2020-05-10",
  "Alamat": "Jl. Contoh No. 1",
  "Tipe SPP": "reguler",
};

// ── Badge kecil untuk kolom Aksi di tabel preview ────────────────────────────
function BadgeAksi({ aksi }: { aksi: "TAMBAH" | "PERBARUI" | "GAGAL" }) {
  const styleMap = {
    TAMBAH: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    PERBARUI: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    GAGAL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${styleMap[aksi]}`}>
      {aksi}
    </span>
  );
}

// ── BARU: Badge sumber kecocokan wali (No WA = indikator kuat, Nama = perlu
// dikonfirmasi manual karena rawan tabrakan nama umum) ───────────────────────
function BadgeKecocokan({ sumber }: { sumber?: "no_wa" | "nama" }) {
  if (!sumber) return <span className="text-muted-foreground text-[11px]">Wali baru</span>;
  if (sumber === "no_wa") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-green-700 dark:text-green-400">
        <Link2 className="w-3 h-3" /> No WA sama
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
      <AlertTriangle className="w-3 h-3" /> Nama mirip
    </span>
  );
}

export default function DialogImportUser({ refetch }: { refetch: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<ImportPlanResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── BARU: keputusan gabung/pisah per grup keluarga (keyed by familyKey).
  // Diinisialisasi dari rekomendasi default sistem tiap kali preview baru
  // dibuat, lalu bisa diubah manual oleh admin lewat dropdown di tabel.
  const [waliDecisions, setWaliDecisions] = useState<Record<string, "gabung" | "baru">>({});

  useEffect(() => {
    if (plan) {
      const init: Record<string, "gabung" | "baru"> = {};
      plan.rows.forEach((r) => {
        if (r.familyKey && r.keputusanDefault && !(r.familyKey in init)) {
          init[r.familyKey] = r.keputusanDefault;
        }
      });
      setWaliDecisions(init);
    }
  }, [plan]);

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
    setPlan(null);

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

  // ── Ubah baris mentah dari Excel jadi ImportRow yang dipakai server ─────────
  const buildRows = (): ImportRow[] =>
    preview.map((r) => ({
      nama_siswa: r["Nama Siswa"] || "",
      NIS: String(r["NIS"] || ""),
      jenis_kelamin: r["Jenis Kelamin"] || "",
      kelas: r["Kelas"] || "",
      angkatan: String(r["Angkatan"] || ""),
      nama_wali: r["Nama Wali"] || "",
      no_wa: String(r["No WA"] || ""),
      email: r["Email (Opsional)"] ? String(r["Email (Opsional)"]).trim() : undefined,
      password: r["Password (Opsional)"] ? String(r["Password (Opsional)"]).trim() : undefined,
      tempat_lahir: r["Tempat Lahir"] || "",
      tanggal_lahir: r["Tanggal Lahir"] || "",
      alamat: r["Alamat"] || undefined,
      tipe_spp: r["Tipe SPP"] || "reguler",
    }));

  const handlePreview = async () => {
    if (preview.length === 0) return;
    setIsPreviewing(true);
    try {
      const res = await previewImportUsersBulk(buildRows());
      setPlan(res);
    } catch (err: any) {
      toast.error("Gagal membuat preview", { description: err?.message });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setIsProcessing(true);
    setResult(null);

    try {
      // BARU: sisipkan keputusan gabung/pisah (yang sudah dikonfirmasi
      // admin di tabel preview) ke tiap baris sebelum dikirim ke server —
      // supaya importUsersBulk mengeksekusi persis apa yang ditampilkan
      // di preview, bukan menghitung ulang rekomendasi default.
      const rawRows = buildRows();
      const rows: ImportRow[] = rawRows.map((r, i) => {
        const planRow = plan?.rows[i];
        if (planRow?.familyKey && waliDecisions[planRow.familyKey]) {
          return { ...r, keputusanWali: waliDecisions[planRow.familyKey] };
        }
        return r;
      });

      const res = await importUsersBulk(rows);
      setResult(res);

      if (res.berhasil > 0) {
        toast.success(`${res.berhasil} data siswa berhasil diproses (${res.ditambahkan} baru, ${res.diperbarui} diperbarui)`);
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
    setPlan(null);
    setResult(null);
    setWaliDecisions({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) handleReset();
  };

  // Jumlah baris dengan kandidat kecocokan nama-saja yang masih perlu
  // dikonfirmasi admin — ditampilkan sebagai pengingat di atas tabel.
  const jumlahPerluKonfirmasi =
    plan?.rows.filter((r) => r.kecocokanWali === "nama").length || 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="w-4 h-4 mr-2" />
          Impor Excel
        </Button>
      </DialogTrigger>
      {/* Preview berupa tabel lebar, jadi dialog dilebarkan khusus saat plan sudah ada */}
      <DialogContent className={`${plan && !result ? "sm:max-w-[95vw] lg:max-w-[1250px]" : "sm:max-w-[650px]"} max-h-[90vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle>Impor Data Siswa dari Excel</DialogTitle>
          <DialogDescription>
            Unggah file Excel (.xlsx) sesuai format template. NIS yang sudah terdaftar akan diperbarui,
            NIS baru akan didaftarkan sebagai siswa baru. Lihat dulu preview-nya sebelum diterapkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 px-1">
          {!plan && !result && (
            <>
              <Button variant="secondary" onClick={handleDownloadTemplate} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Unduh Template Excel
              </Button>

              <Input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} />

              {preview.length > 0 && (
                <div className="border rounded-md p-3 text-sm bg-muted/40">
                  <p className="font-medium mb-1">
                    {fileName} — {preview.length} baris data siap dipreview
                  </p>
                  <p className="text-muted-foreground text-xs">
                    NIS yang sudah terdaftar akan otomatis di-<strong>update</strong> (data akademik saja,
                    akun wali tidak diubah). NIS baru akan dicek dulu apakah <strong>No WA</strong>-nya cocok
                    dengan wali yang sudah terdaftar (kalau cocok, otomatis digabung ke akun yang sama) —
                    kalau cuma nama yang mirip, sistem tidak akan menggabung otomatis dan akan meminta
                    konfirmasi Anda dulu di tahap Preview.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Tampilan Preview: tabel (belum menulis apa pun ke DB) ──────────── */}
          {plan && !result && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> {plan.akanDitambahkan} akan ditambah
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <RefreshCw className="w-4 h-4" /> {plan.akanDiperbarui} akan diperbarui
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" /> {plan.akanGagal} akan gagal
                </span>
                {jumlahPerluKonfirmasi > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-4 h-4" /> {jumlahPerluKonfirmasi} perlu konfirmasi kecocokan wali
                  </span>
                )}
              </div>

              {jumlahPerluKonfirmasi > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-2">
                  Ada baris dengan <strong>nama wali mirip</strong> dengan wali yang sudah terdaftar, tapi
                  No WA berbeda. Sistem <strong>tidak</strong> menggabung otomatis untuk kasus ini — cek kolom
                  &quot;Kecocokan Wali&quot; di bawah dan pilih sendiri apakah ini orang yang sama (Gabungkan)
                  atau memang orang berbeda (Buat Baru).
                </p>
              )}

              <div className="border rounded-md overflow-auto max-h-[55vh]">
                <table className="text-xs w-full border-collapse">
                  <thead className="bg-muted/70 sticky top-0 z-10">
                    <tr>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Baris</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Aksi</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">NIS</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Nama Siswa</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Jenis Kelamin</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Tempat Lahir</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Tanggal Lahir</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Nama Wali</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">No WA Wali</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Alamat</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Kelas</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Angkatan</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Tipe SPP</th>
                      {/* BARU: kolom kecocokan wali + kontrol keputusan */}
                      <th className="p-2 text-left font-medium whitespace-nowrap">Kecocokan Wali</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Keputusan</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Email</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Password</th>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.rows.map((r, i) => {
                      const decision = r.familyKey ? waliDecisions[r.familyKey] : undefined;
                      const punyaKandidat = !!r.waliKandidat;

                      return (
                        <tr
                          key={i}
                          className={
                            r.aksi === "GAGAL"
                              ? "bg-red-50 dark:bg-red-950/20"
                              : r.kecocokanWali === "nama"
                              ? "bg-amber-50/60 dark:bg-amber-950/10"
                              : undefined
                          }
                        >
                          <td className="p-2 whitespace-nowrap text-muted-foreground">{r.baris}</td>
                          <td className="p-2 whitespace-nowrap"><BadgeAksi aksi={r.aksi} /></td>
                          <td className="p-2 whitespace-nowrap font-mono">{r.nis}</td>
                          <td className="p-2 whitespace-nowrap">{r.nama_siswa}</td>
                          <td className="p-2 whitespace-nowrap">{r.jenis_kelamin}</td>
                          <td className="p-2 whitespace-nowrap">{r.tempat_lahir}</td>
                          <td className="p-2 whitespace-nowrap">{r.tanggal_lahir}</td>
                          <td className="p-2 whitespace-nowrap">{r.nama_wali}</td>
                          <td className="p-2 whitespace-nowrap">{r.no_wa}</td>
                          <td className="p-2 max-w-[150px] truncate" title={r.alamat}>{r.alamat}</td>
                          <td className="p-2 whitespace-nowrap">{r.kelas}</td>
                          <td className="p-2 whitespace-nowrap">{r.angkatan}</td>
                          <td className="p-2 whitespace-nowrap capitalize">{r.tipe_spp}</td>

                          {/* Kecocokan Wali */}
                          <td className="p-2 whitespace-nowrap">
                            {r.aksi === "TAMBAH" ? (
                              <div>
                                <BadgeKecocokan sumber={r.kecocokanWali} />
                                {r.waliKandidat && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    ↳ {r.waliKandidat.namawali} ({r.waliKandidat.email})
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>

                          {/* Keputusan gabung/baru — cuma bisa dipilih kalau ada kandidat */}
                          <td className="p-2 whitespace-nowrap">
                            {r.aksi === "TAMBAH" && punyaKandidat && r.familyKey ? (
                              <Select
                                value={decision || r.keputusanDefault || "baru"}
                                onValueChange={(v) =>
                                  setWaliDecisions((prev) => ({
                                    ...prev,
                                    [r.familyKey!]: v as "gabung" | "baru",
                                  }))
                                }
                              >
                                <SelectTrigger className="h-7 text-[11px] w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gabung">Gabungkan</SelectItem>
                                  <SelectItem value="baru">Buat Baru</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>

                          <td className="p-2 whitespace-nowrap">{r.email || "-"}</td>
                          <td className="p-2 whitespace-nowrap">{r.password || "(pakai akun lama)"}</td>
                          <td className="p-2 min-w-[220px]">
                            {r.pesan ? (
                              <span className="text-red-600">{r.pesan}</span>
                            ) : (
                              <span className="text-muted-foreground">{r.keterangan}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {plan.akanGagal > 0 && (
                <p className="text-xs text-amber-600">
                  Baris berstatus GAGAL akan tetap dilewati saat diterapkan — perbaiki dulu di file
                  Excel kalau ingin baris tersebut ikut masuk.
                </p>
              )}
            </div>
          )}

          {/* ── Tampilan hasil setelah benar-benar diterapkan ──────────────────── */}
          {result && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> {result.ditambahkan} siswa baru
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <RefreshCw className="w-4 h-4" /> {result.diperbarui} diperbarui
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" /> {result.gagal} gagal
                </span>
              </div>

              {result.akunDigenerate.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto text-xs divide-y">
                  <p className="p-2 font-medium bg-muted/50 sticky top-0">
                    Akun baru yang digenerate (catat untuk diberikan ke wali):
                  </p>
                  {result.akunDigenerate.map((d, i) => (
                    <div key={i} className="p-2">
                      <span className="font-medium">{d.nama}:</span> {d.email} / {d.password}
                    </div>
                  ))}
                </div>
              )}

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

          {/* Tahap 1: belum ada file dipreview */}
          {!plan && !result && (
            <Button onClick={handlePreview} disabled={preview.length === 0 || isPreviewing}>
              {isPreviewing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Preview {preview.length > 0 ? `(${preview.length} data)` : ""}
            </Button>
          )}

          {/* Tahap 2: sudah ada preview, tunggu konfirmasi Terapkan */}
          {plan && !result && (
            <>
              <Button variant="secondary" onClick={() => setPlan(null)} disabled={isProcessing}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
              <Button
                onClick={handleImport}
                disabled={isProcessing || plan.akanGagal === plan.total}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileUp className="w-4 h-4 mr-2" />
                )}
                Terapkan Import ({plan.akanDitambahkan + plan.akanDiperbarui})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}