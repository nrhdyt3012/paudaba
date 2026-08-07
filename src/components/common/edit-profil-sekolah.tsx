"use client";

// components/edit-profil-sekolah-dialog.tsx
//
// Form untuk mengubah profil sekolah yang dipakai di kwitansi & laporan:
// nama sekolah, alamat, logo, nama bendahara, dan foto tanda tangan bendahara.
// Semua perubahan disimpan ke tabel `pengaturan_sekolah` di Supabase.

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Settings } from "lucide-react";
import {
  fetchPengaturanSekolah,
  updatePengaturanSekolah,
  uploadSekolahAsset,
} from "@/lib/pengaturan-sekolah";
import { toast } from "sonner"; // ganti sesuai library toast yang sudah dipakai di proyek

interface EditProfilSekolahDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditProfilSekolahDialog({
  open,
  onOpenChange,
}: EditProfilSekolahDialogProps) {
  const queryClient = useQueryClient();

  const { data: pengaturan, isLoading } = useQuery({
    queryKey: ["pengaturan-sekolah"],
    queryFn: fetchPengaturanSekolah,
    enabled: open,
  });

  const [namaSekolah, setNamaSekolah] = useState("");
  const [alamatSekolah, setAlamatSekolah] = useState("");
  const [namaBendahara, setNamaBendahara] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [ttdFile, setTtdFile] = useState<File | null>(null);
  const [ttdPreview, setTtdPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const ttdInputRef = useRef<HTMLInputElement>(null);

  // Isi form begitu data lama selesai dimuat
  useEffect(() => {
    if (pengaturan) {
      setNamaSekolah(pengaturan.nama_sekolah);
      setAlamatSekolah(pengaturan.alamat_sekolah);
      setNamaBendahara(pengaturan.nama_bendahara);
      setLogoPreview(pengaturan.logo_url);
      setTtdPreview(pengaturan.tanda_tangan_bendahara_url);
    }
  }, [pengaturan]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "ttd"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === "logo") {
      setLogoFile(file);
      setLogoPreview(previewUrl);
    } else {
      setTtdFile(file);
      setTtdPreview(previewUrl);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let logoUrl = pengaturan?.logo_url ?? null;
      let ttdUrl = pengaturan?.tanda_tangan_bendahara_url ?? null;

      if (logoFile) {
        logoUrl = await uploadSekolahAsset(logoFile, "logo");
      }
      if (ttdFile) {
        ttdUrl = await uploadSekolahAsset(ttdFile, "tanda-tangan");
      }

      await updatePengaturanSekolah({
        nama_sekolah: namaSekolah,
        alamat_sekolah: alamatSekolah,
        nama_bendahara: namaBendahara,
        logo_url: logoUrl,
        tanda_tangan_bendahara_url: ttdUrl,
      });

      // Supaya kwitansi & dashboard langsung pakai data terbaru
      await queryClient.invalidateQueries({ queryKey: ["pengaturan-sekolah"] });

      toast.success("Profil sekolah berhasil diperbarui");
      onOpenChange(false);
    } catch (err) {
      console.error("[EditProfilSekolah] gagal menyimpan:", err);
      toast.error("Gagal menyimpan profil sekolah, coba lagi");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Edit Profil Sekolah
          </DialogTitle>
          <DialogDescription>
            Perubahan di sini akan otomatis muncul di kwitansi dan laporan yang dicetak.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nama-sekolah">Nama Sekolah</Label>
              <Input
                id="nama-sekolah"
                value={namaSekolah}
                onChange={(e) => setNamaSekolah(e.target.value)}
                placeholder="KB TK AISYIYAH BUSTANUL ATHFAL 1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alamat-sekolah">Alamat Sekolah</Label>
              <Input
                id="alamat-sekolah"
                value={alamatSekolah}
                onChange={(e) => setAlamatSekolah(e.target.value)}
                placeholder="BUDURAN — SIDOARJO"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nama-bendahara">Nama Bendahara</Label>
              <Input
                id="nama-bendahara"
                value={namaBendahara}
                onChange={(e) => setNamaBendahara(e.target.value)}
                placeholder="Sri Wahyuni"
              />
            </div>

            {/* Logo sekolah */}
            <div className="space-y-1.5">
              <Label>Logo Sekolah</Label>
              <div className="flex items-center gap-3">
                {logoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Preview logo"
                    className="h-14 w-14 rounded border object-contain bg-white"
                  />
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, "logo")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Ganti Logo
                </Button>
              </div>
            </div>

            {/* Tanda tangan bendahara */}
            <div className="space-y-1.5">
              <Label>Foto Tanda Tangan Bendahara</Label>
              <p className="text-xs text-muted-foreground">
                Gunakan gambar dengan latar transparan (PNG) agar hasil di kwitansi rapi.
              </p>
              <div className="flex items-center gap-3">
                {ttdPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ttdPreview}
                    alt="Preview tanda tangan"
                    className="h-14 w-28 rounded border object-contain bg-white"
                  />
                )}
                <input
                  ref={ttdInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, "ttd")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => ttdInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Ganti Tanda Tangan
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Perubahan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}