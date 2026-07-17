"use client";

import Image from "next/image";
import Link from "next/link";
import FormInput from "@/components/common/form-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import {
  INITIAL_LOGIN_FORM,
  INITIAL_STATE_LOGIN_FORM,
} from "@/constants/auth-constant";
import { LoginForm, loginSchemaForm } from "@/validations/auth-validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { login } from "../actions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchemaForm),
    defaultValues: INITIAL_LOGIN_FORM,
  });

  const [loginState, loginAction, isPendingLogin] = useActionState(
    login,
    INITIAL_STATE_LOGIN_FORM
  );

  // ── Tampilkan toast jika diredirect karena session expired ──────────────
  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      toast.warning("Sesi Anda telah berakhir", {
        description: "Silakan login kembali untuk melanjutkan.",
        duration: 5000,
      });
      // Hapus query param dari URL agar tidak muncul lagi jika refresh
      router.replace("/login");
    }
  }, []);

  const onSubmit = form.handleSubmit(async (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });
    startTransition(() => { loginAction(formData); });
  });

  useEffect(() => {
    if (loginState?.status === "error") {
      toast.error("Login Gagal", {
        description:
          loginState.errors?._form?.[0] || "Terjadi kesalahan saat login",
      });
    }
    if (loginState?.status === "success") {
      toast.success("Login Berhasil", {
        description: "Anda akan dialihkan...",
      });
      setTimeout(() => {
        window.location.href = loginState.data?.redirectUrl || "/";
      }, 500);
    }
  }, [loginState, router]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-white via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 p-6">
      <div className="mb-8">
        <Image
          src="/logo.jpg"
          alt="Logo KB/TK Aisyiyah Bustanul Athfal 1 Buduran"
          width={120}
          height={120}
          className="rounded-full shadow-lg"
          priority
        />
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Selamat Datang
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-md">
          KB TK Aisyiyah Bustanul Athfal 1 Buduran
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Portal untuk Wali Siswa dan Administrator
        </p>
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Masukkan kredensial Anda untuk mengakses sistem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormInput
                form={form}
                name="email"
                label="Email"
                placeholder="Masukkan email Anda"
                type="email"
              />
              <FormInput
                form={form}
                name="password"
                label="Password"
                placeholder="••••••••"
                type="password"
              />
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Lupa password?
                </Link>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isPendingLogin}
              >
                {isPendingLogin ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" />
                    Sedang login...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} KB TK Aisyiyah Bustanul Athfal 1 Buduran</p>
        <p className="mt-1">Semua hak cipta dilindungi</p>
      </div>
    </div>
  );
}