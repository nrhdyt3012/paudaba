"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DarkmodeToggle } from "@/components/common/darkmode-toggle";
import { MessageCircle, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// FIX: forgot password sekarang mengarah ke kontak WhatsApp admin/bendahara
// (via wa.me, BUKAN Fonnte — wa.me cuma buka aplikasi WhatsApp user sendiri
// dengan pesan yang sudah terisi otomatis, tidak butuh API key apa pun).
// Ganti nomor di bawah ini kalau nomor admin/bendahara berubah.
const ADMIN_WA_NUMBER_RAW = "082229308120";

// wa.me butuh format internasional tanpa angka 0 di depan (62xxxxxxxxxx).
function toWaFormat(nomor: string): string {
  const digitsOnly = nomor.replace(/\D/g, "");
  if (digitsOnly.startsWith("0")) return "62" + digitsOnly.slice(1);
  if (digitsOnly.startsWith("62")) return digitsOnly;
  return "62" + digitsOnly;
}

export default function ForgotPassword() {
  const [nis, setNis] = useState("");
  const [namaSiswa, setNamaSiswa] = useState("");
  const [namaWali, setNamaWali] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleHubungiWA = () => {
    if (!nis.trim() || !namaSiswa.trim() || !namaWali.trim()) {
      setError("NIS, nama siswa, dan nama wali wajib diisi.");
      return;
    }
    setError("");

    const nomor = toWaFormat(ADMIN_WA_NUMBER_RAW);

    let pesan =
      `Assalamu'alaikum, saya lupa password akun saya.\n\n` +
      `NIS Siswa: ${nis}\n` +
      `Nama Siswa: ${namaSiswa}\n` +
      `Nama Wali: ${namaWali}\n`;

    if (email.trim()) {
      pesan += `Email/akun: ${email}\n`;
    }

    pesan += `\nMohon bantuannya untuk reset password. Terima kasih.`;

    const url = `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-white via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 p-6">
      <div className="absolute top-4 right-4"><DarkmodeToggle /></div>
      <div className="mb-8">
        <Image src="/logo.jpg" alt="Logo" width={100} height={100} className="rounded-full shadow-lg" priority />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Lupa Password?</CardTitle>
          <CardDescription>
            Hubungi admin/bendahara sekolah via WhatsApp untuk bantuan reset
            password akun Anda.
          </CardDescription>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            Catatan: fitur ini hanya untuk wali siswa yang lupa password akun
            mereka.
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nis">NIS Siswa</Label>
              <Input
                id="nis"
                type="text"
                placeholder="Masukkan NIS siswa"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="namaSiswa">Nama Siswa</Label>
              <Input
                id="namaSiswa"
                type="text"
                placeholder="Masukkan nama siswa"
                value={namaSiswa}
                onChange={(e) => setNamaSiswa(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="namaWali">Nama Wali</Label>
              <Input
                id="namaWali"
                type="text"
                placeholder="Masukkan nama wali"
                value={namaWali}
                onChange={(e) => setNamaWali(e.target.value)}
              />
            </div>

            {/* <div className="space-y-2">
              <Label htmlFor="email">Email Akun (opsional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Isi jika masih ingat, supaya admin lebih cepat menemukan data
                akun Anda.
              </p>
            </div> */}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <Button
              type="button"
              onClick={handleHubungiWA}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Hubungi via WhatsApp
            </Button>

            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
