"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { User, Calendar, MapPin, Phone, BookOpen, Loader2 } from "lucide-react";

// Helper: ambil inisial dari nama lengkap (maks 2 huruf)
function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Warna background avatar berdasarkan inisial (konsisten per nama)
function getAvatarColor(name?: string | null): string {
  const colors = [
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-amber-500",
  ];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function InfoSiswa() {
  const activeSiswaId = useAuthStore((state) => state.profile.activeSiswaId);
  const supabase = createClient();

  const { data: siswaData, isLoading } = useQuery({
    queryKey: ["siswa-detail-self", activeSiswaId],
    enabled: !!activeSiswaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("siswa")
        .select("*")
        .eq("id", activeSiswaId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="animate-spin h-8 w-8 text-green-600" />
      </div>
    );
  }

  const namaLengkap = siswaData?.namasiswa || activeSiswaId || "";
  const initials = getInitials(namaLengkap);
  const avatarColor = getAvatarColor(namaLengkap);

  const InfoItem = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value?: string | null;
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50">
      <Icon className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Info Siswa</h1>
        <p className="text-muted-foreground text-sm">
          KB/TK Aisyiyah Bustanul Athfal 1 Buduran
        </p>
      </div>

      {/* Header profil — avatar inisial, tanpa foto */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar inisial */}
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-md ${avatarColor}`}
            >
              <span className="text-white text-4xl font-bold select-none">
                {initials}
              </span>
            </div>

            <div className="flex-1 text-center md:text-left space-y-2">
              <h2 className="text-3xl font-bold">{namaLengkap}</h2>
              {siswaData?.nis && (
                <p className="text-muted-foreground text-sm">
                  NIS: {siswaData.nis}
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-3">
                {siswaData?.kelas && (
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-full text-sm font-medium">
                    {siswaData.kelas}
                  </span>
                )}
                {siswaData?.angkatan && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full text-sm">
                    Angkatan {siswaData.angkatan}
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    siswaData?.status === "aktif"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {siswaData?.status || "Aktif"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Data Siswa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-green-600" />
              Data Siswa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoItem icon={User} label="Nama Lengkap" value={siswaData?.namasiswa} />
            <InfoItem icon={BookOpen} label="NIS" value={siswaData?.nis} />
            <InfoItem icon={BookOpen} label="Kelas" value={siswaData?.kelas} />
            <InfoItem icon={BookOpen} label="Angkatan" value={siswaData?.angkatan} />
            <InfoItem icon={MapPin} label="Tempat Lahir" value={siswaData?.tempatlahir} />
            <InfoItem
              icon={Calendar}
              label="Tanggal Lahir"
              value={
                siswaData?.tanggallahir
                  ? new Date(siswaData.tanggallahir).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : null
              }
            />
          </CardContent>
        </Card>

        {/* Data Wali */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-5 h-5 text-green-600" />
              Data Wali Siswa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoItem icon={User} label="Nama Wali" value={siswaData?.namawali} />
            <InfoItem icon={Phone} label="No. WhatsApp" value={siswaData?.nowa} />
            {/* FIX: tambah Alamat, diambil dari kolom `alamat` di tabel
                siswa. Kalau kolom ini belum ada di database, tambahkan
                dulu lewat migration (lihat README). */}
            <InfoItem icon={MapPin} label="Alamat" value={siswaData?.alamat} />
          </CardContent>
        </Card>

        {/* Catatan */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Informasi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Jika ada data yang kurang tepat atau perlu diperbarui, silakan
              hubungi admin/bendahara KB/TK Aisyiyah Bustanul Athfal 1 Buduran
              untuk melakukan perubahan.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}