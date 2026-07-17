/**
 * Component: SendWhatsAppNotificationButton
 * Button untuk admin mengirim notifikasi WhatsApp ke wali siswa
 * Digunakan di halaman Tagihan
 */

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SendWhatsAppNotificationButtonProps {
  idTagihan: number;
  studentName: string;
  guardianName: string;
  guardianPhone?: string;
  nominal: number;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function SendWhatsAppNotificationButton(
  props: SendWhatsAppNotificationButtonProps
) {
  const {
    idTagihan,
    studentName,
    guardianName,
    guardianPhone,
    nominal,
    disabled = false,
    onSuccess,
  } = props;

  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
  } | null>(null);

  const handleSendNotification = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/notifications/send-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idTagihan,
          manualSend: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          message: data.error || "Gagal mengirim notifikasi",
        });
        toast.error(data.error || "Gagal mengirim notifikasi WhatsApp");
        return;
      }

      setResult({
        success: true,
        message: "Notifikasi WhatsApp berhasil dikirim!",
        messageId: data.messageId,
      });

      toast.success("✅ Notifikasi WhatsApp berhasil dikirim ke " + guardianName);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setShowDialog(false);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setResult({
        success: false,
        message: errorMessage,
      });
      toast.error("❌ Error: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isPhoneValid = guardianPhone && guardianPhone.length >= 10;

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        disabled={disabled || !isPhoneValid || isLoading}
        variant="outline"
        size="sm"
        className="gap-2"
        title={
          !isPhoneValid
            ? "Nomor WhatsApp wali tidak tersedia atau tidak valid"
            : undefined
        }
      >
        <MessageSquare className="h-4 w-4" />
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengirim...
          </>
        ) : (
          "Kirim WhatsApp"
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Kirim Notifikasi WhatsApp</DialogTitle>
            <DialogDescription>
              Kirim notifikasi tagihan ke wali siswa via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preview Info */}
            <div className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm">
              <div className="font-semibold">📋 Detail Pengiriman:</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-600">Siswa:</div>
                <div className="font-medium">{studentName}</div>

                <div className="text-slate-600">Wali Murid:</div>
                <div className="font-medium">{guardianName}</div>

                <div className="text-slate-600">Nomor WA:</div>
                <div className="font-mono text-xs">{guardianPhone}</div>

                <div className="text-slate-600">Nominal:</div>
                <div className="font-medium">
                  Rp {nominal.toLocaleString("id-ID")}
                </div>
              </div>
            </div>

            {/* Message Preview */}
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="text-xs font-semibold text-green-900 mb-2">
                💬 Preview Pesan:
              </div>
              <div className="text-xs text-green-800 whitespace-pre-wrap leading-relaxed">
                🔔 *PEMBERITAHUAN TAGIHAN*
                {"\n\n"}
                Halo {guardianName}, anak Anda {studentName} memiliki tagihan
                pembayaran. Silakan lakukan pembayaran melalui aplikasi PPPM-BM.
              </div>
            </div>

            {/* Result */}
            {result && (
              <div
                className={`flex gap-2 p-3 rounded-lg ${
                  result.success
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      result.success ? "text-green-900" : "text-red-900"
                    }`}
                  >
                    {result.message}
                  </div>
                  {result.messageId && (
                    <div className="text-xs text-slate-600 mt-1">
                      Message ID: {result.messageId}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <div className="text-xs font-semibold text-yellow-900 mb-1">
                ⚠️ Perhatian:
              </div>
              <div className="text-xs text-yellow-800">
                Pastikan nomor WhatsApp wali murid sudah benar dan tersimpan di
                database siswa.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSendNotification}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                "Kirim Notifikasi"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SendWhatsAppNotificationButton;
