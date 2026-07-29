"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DarkmodeToggle } from "@/components/common/darkmode-toggle";
import { KeyRound, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ajukanResetPassword } from "../actions";

// FIX (fitur lupa password): form ini sekarang dipakai BERSAMA oleh
// bendahara & wali siswa, dan cuma minta satu kolom — EMAIL — karena
// email adalah satu-satunya identitas yang unik per akun (baik role-nya
// admin/bendahara maupun siswa/wali). Submit TIDAK lagi membuka wa.me;
// sebaliknya, permintaan masuk ke sistem dan akan muncul di halaman
// Kelola Akun milik superadmin untuk diproses (lihat actions.ts).
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email wajib diisi.");
      return;
    }

    setIsPending(true);
    const formData = new FormData();
    formData.set("email", email.trim());

    const result = await ajukanResetPassword({}, formData);
    setIsPending(false);

    if (result.status === "error") {
      toast.error(result.message || "Gagal mengirim permintaan.");
      return;
    }

    setIsSubmitted(true);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-white via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 p-6">
      <div className="absolute top-4 right-4"><DarkmodeToggle /></div>
      <div className="mb-8">
        <Image src="/logo.jpg" alt="Logo" width={100} height={100} className="rounded-full shadow-lg" priority />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        {isSubmitted ? (
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Permintaan Terkirim</h2>
                <p className="text-muted-foreground text-sm">
                  Jika email tersebut terdaftar di sistem kami, permintaan
                  reset password Anda telah kami terima dan akan segera
                  diproses oleh admin sekolah. Anda akan dihubungi melalui
                  WhatsApp setelah password baru disiapkan.
                </p>
              </div>
              <Link href="/login" className="w-full">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Kembali ke Login
                </Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center space-y-2">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Lupa Password?</CardTitle>
              <CardDescription>
                Masukkan email akun Anda. Admin sekolah akan memproses
                permintaan reset password Anda.
              </CardDescription>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                Catatan: fitur ini berlaku untuk akun Bendahara maupun Wali
                Siswa.
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Akun</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isPending}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isPending || !email.trim()}
                >
                  {isPending ? (
                    <><Loader2 className="mr-2 w-4 h-4 animate-spin" />Mengirim...</>
                  ) : (
                    <><KeyRound className="w-4 h-4 mr-2" />Ajukan Reset Password</>
                  )}
                </Button>

                <Link href="/login" className="block">
                  <Button variant="ghost" className="w-full" type="button">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Kembali ke Login
                  </Button>
                </Link>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
