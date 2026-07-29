"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, MessageCircleQuestionMark, Loader2, Eye, EyeOff, Dices, KeySquare } from "lucide-react";
import { kirimKonfirmasiWA, simpanPasswordBaru } from "../password-reset-actions";
import type { PasswordResetRequest } from "@/types/password-reset";

// FIX (fitur lupa password — revisi desain): sebelumnya panel ini berupa
// <Card> yang selalu tampil di atas tabel Kelola Akun (bikin tabel utama
// jadi menyempit). Sekarang jadi TOMBOL dengan badge jumlah pending, yang
// kalau diklik baru memunculkan popup (Dialog) berisi daftar permintaan —
// isinya sama persis seperti versi Card sebelumnya, cuma dipindah ke
// dalam Dialog. Tombol ini dirender inline di header <BendaharaManagement />
// (lihat bendahara.tsx), bukan lagi sebagai block terpisah di page.tsx.
function generateRandomPassword(): string {
  // 8 karakter alfanumerik, cukup kuat untuk password sementara.
  return Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4);
}

export default function PasswordResetPanel() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [isListOpen, setIsListOpen] = useState(false);
  const [selected, setSelected] = useState<PasswordResetRequest | null>(null);
  const [passwordBaru, setPasswordBaru] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPendingWA, setIsPendingWA] = useState<string | null>(null);
  const [isPendingSave, setIsPendingSave] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["password-reset-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_reset_requests")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: true });

      if (error) throw error;
      return (data || []) as PasswordResetRequest[];
    },
    refetchInterval: 15000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["password-reset-requests"] });

  const handleKonfirmasiWA = async (request: PasswordResetRequest) => {
    setIsPendingWA(request.id);
    const formData = new FormData();
    formData.set("id", request.id);
    const state = await kirimKonfirmasiWA({}, formData);
    setIsPendingWA(null);

    if (state.status === "error") {
      toast.error("Gagal mengirim konfirmasi WA", { description: state.message });
      return;
    }

    toast.success(`Pesan konfirmasi terkirim ke ${request.account_name || request.email}`);
    invalidate();
  };

  const openDialogUbahPassword = (request: PasswordResetRequest) => {
    setSelected(request);
    setPasswordBaru("");
    setShowPassword(false);
  };

  const handleSimpanPassword = async () => {
    if (!selected) return;
    if (passwordBaru.length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }

    setIsPendingSave(true);
    const formData = new FormData();
    formData.set("id", selected.id);
    formData.set("password_baru", passwordBaru);
    const state = await simpanPasswordBaru({}, formData);
    setIsPendingSave(false);

    if (state.status === "error") {
      toast.error("Gagal menyimpan password baru", { description: state.message });
      return;
    }

    if (state.message) {
      // Sukses tapi ada catatan (mis. WA gagal terkirim)
      toast.warning(state.message);
    } else {
      toast.success(`Password ${selected.account_name || selected.email} berhasil diubah`);
    }

    setSelected(null);
    invalidate();
  };

  const pendingCount = requests?.length || 0;

  return (
    <>
      {/* Tombol trigger + badge — ditaruh di header Kelola Akun */}
      <div className="relative inline-block">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsListOpen(true)}
          className="relative"
        >
          <KeyRound className="w-4 h-4 mr-2" />
          Permintaan Reset Password
        </Button>
        {pendingCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full"
          >
            {pendingCount}
          </Badge>
        )}
      </div>

      {/* Popup daftar permintaan reset password */}
      <Dialog open={isListOpen} onOpenChange={setIsListOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg">Permintaan Reset Password</DialogTitle>
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount}</Badge>
              )}
            </div>
            <DialogDescription>
              Daftar permintaan lupa password dari Bendahara &amp; Wali Siswa
              yang menunggu diproses.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat data...</p>
          ) : pendingCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada permintaan reset password yang menunggu.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Akun</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>No. WhatsApp</TableHead>
                    <TableHead>Diajukan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests!.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <p className="font-medium">{req.account_name || "-"}</p>
                        <p className="text-xs text-muted-foreground">{req.email}</p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            req.account_role === "admin"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                          }`}
                        >
                          {req.account_role === "admin" ? "Bendahara" : "Wali Siswa"}
                        </span>
                      </TableCell>
                      <TableCell>{req.account_phone || "-"}</TableCell>
                      <TableCell>
                        {new Date(req.requested_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {req.confirmed_at && (
                          <p className="text-xs text-green-600">Sudah dikonfirmasi WA</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPendingWA === req.id || !req.account_phone}
                          onClick={() => handleKonfirmasiWA(req)}
                        >
                          {isPendingWA === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MessageCircleQuestionMark className="w-4 h-4 mr-1" />
                          )}
                          Konfirmasi WA
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openDialogUbahPassword(req)}
                        >
                          <KeyRound className="w-4 h-4 mr-1" />
                          Ubah Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Popup Ubah Password (muncul di atas popup daftar) */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeySquare className="w-5 h-5 text-green-600" />
              Ubah Password
            </DialogTitle>
            <DialogDescription>
              Tentukan password baru untuk akun{" "}
              <strong>{selected?.account_name || selected?.email}</strong>.
              Password ini akan dikirim ke akun tersebut via WhatsApp, dan
              disarankan untuk diganti sendiri setelah login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Password Baru</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  disabled={isPendingSave}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              {/* <Button
                type="button"
                variant="outline"
                disabled={isPendingSave}
                onClick={() => {
                  setPasswordBaru(generateRandomPassword());
                  setShowPassword(true);
                }}
                title="Buat password acak"
              >
                <Dices className="w-4 h-4" />
              </Button> */}
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={isPendingSave}
            >
              Batal
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSimpanPassword}
              disabled={isPendingSave || passwordBaru.length < 6}
            >
              {isPendingSave ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                "Simpan & Kirim WA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}