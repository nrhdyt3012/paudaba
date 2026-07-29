/**
 * WhatsApp Notification Service
 * Business logic untuk mengirim dan track notifikasi WhatsApp
 */

import FontteClient from './client';
import { whatsappTemplates } from './templates';
import { createClient } from '@/lib/supabase/server';
import {
  NotificationPayload,
  FontneSendMessageResponse,
  WhatsAppNotificationLog,
} from '@/types/fonnte';

interface SendNotificationOptions {
  retries?: number;
  retryDelay?: number;
}

class WhatsAppNotificationService {
  private fontteClient: FontteClient;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(apiKey: string) {
    this.fontteClient = new FontteClient({ apiKey });
  }

  async sendNotification(
    payload: NotificationPayload,
    options?: SendNotificationOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const maxRetries = options?.retries ?? this.maxRetries;
    const retryDelay = options?.retryDelay ?? this.retryDelay;

    if (!FontteClient.isValidPhoneNumber(payload.recipientPhone)) {
      const error = `Invalid phone number: ${payload.recipientPhone}`;
      console.error('[WhatsAppService]', error);
      await this.logNotification(payload, 'FAILED', null, { error });
      return { success: false, error };
    }

    let message: string;
    try {
      switch (payload.messageType) {
        case 'TAGIHAN':
          message = whatsappTemplates.notifikasiTagihan({
            recipientName: payload.recipientName,
            studentName: payload.studentName,
            periode: payload.data.periode || '-',
            namaTagihan: payload.data.namaTagihan || '-',
            nominal: payload.data.nominal || 0,
            linkPembayaran: payload.data.linkPembayaran || '#',
            kelas: payload.data.kelas || '',
          });
          break;

        case 'PAYMENT_SUCCESS':
          // FIX poin 5/6: isLunas & sisaTagihan sekarang WAJIB dikirim oleh
          // caller (send-payment-status route) supaya pesan tidak selalu
          // bilang "LUNAS" untuk pembayaran cicilan/parsial.
          message = whatsappTemplates.notifikasiPembayaranBerhasil({
            recipientName: payload.recipientName,
            studentName: payload.studentName,
            namaTagihan: payload.data.namaTagihan || '-',
            nominalBayar: payload.data.nominalBayar || 0,
            tanggalPembayaran: payload.data.tanggalPembayaran || '-',
            linkKwitansi: payload.data.linkKwitansi || '#',
            kelas: payload.data.kelas || '',
            isLunas: payload.data.isLunas ?? true,
            sisaTagihan: payload.data.sisaTagihan ?? 0,
          });
          break;

        case 'PAYMENT_FAILED':
          message = whatsappTemplates.notifikasiPembayaranGagal({
            recipientName: payload.recipientName,
            studentName: payload.studentName,
            namaTagihan: payload.data.namaTagihan || '-',
            nominalBayar: payload.data.nominalBayar || 0,
            alasan: payload.data.alasan,
            nomorAdmin: payload.data.nomorAdmin,
            kelas: payload.data.kelas || '',
          });
          break;

        case 'REMINDER_GABUNGAN':
          // FIX poin 4: satu pesan merangkum SEMUA tagihan tertunggak
          // milik satu siswa, dipakai oleh halaman reminder WA yang baru.
          message = whatsappTemplates.reminderTunggakanGabungan({
            recipientName: payload.recipientName,
            studentName: payload.studentName,
            kelas: payload.data.kelas || '',
            daftarTagihan: payload.data.daftarTagihan || [],
            totalSisa: payload.data.totalSisa || 0,
            linkPembayaran: payload.data.linkPembayaran || '#',
          });
          break;

        case 'PASSWORD_RESET_CONFIRM':
          message = whatsappTemplates.konfirmasiPermintaanResetPassword({
            recipientName: payload.recipientName,
            studentName: payload.studentName,
          });
          break;

        case 'PASSWORD_RESET_DONE':
          message = whatsappTemplates.notifikasiPasswordBaruDiset({
            recipientName: payload.recipientName,
            studentName: payload.studentName,
            passwordBaru: payload.data.passwordBaru || '-',
          });
          break;

        default:
          const _exhaustive: never = payload.messageType;
          throw new Error(`Unknown message type: ${_exhaustive}`);
      }
    } catch (error) {
      console.error('[WhatsAppService] Template generation error:', error);
      await this.logNotification(payload, 'FAILED', null, { error: String(error) });
      return { success: false, error: 'Failed to generate message' };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const formattedPhone = FontteClient.formatPhoneNumber(payload.recipientPhone);

        const response = await this.fontteClient.sendMessage({
          target: formattedPhone,
          message,
        });

        console.log(
          `[WhatsAppService] Fonnte response (attempt ${attempt}):`,
          JSON.stringify(response)
        );

        if (response.status) {
          const messageId = Array.isArray(response.id)
            ? String(response.id[0])
            : response.data?.id || String(response.requestid || '');

          console.log(
            `[WhatsAppService] Message sent successfully (attempt ${attempt}):`,
            messageId
          );

          await this.logNotification(payload, 'SENT', messageId, response);

          return { success: true, messageId };
        }

        const fonnteReason =
          response.reason ||
          response.message ||
          JSON.stringify(response) ||
          'Unknown error';
        throw new Error(fonnteReason);
      } catch (error) {
        console.error(
          `[WhatsAppService] Attempt ${attempt}/${maxRetries} failed:`,
          error
        );

        if (attempt === maxRetries) {
          await this.logNotification(payload, 'FAILED', null, {
            error: String(error),
            lastAttempt: attempt,
          });
          return { success: false, error: String(error) };
        }

        await this.delay(retryDelay);
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  async checkDeliveryStatus(messageId: string): Promise<{
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    timestamp?: string;
  }> {
    try {
      const response = await this.fontteClient.checkStatus({ id: messageId });

      if (response.status && response.data) {
        return { status: response.data.status, timestamp: response.data.timestamp };
      }

      throw new Error(response.message || 'Failed to check status');
    } catch (error) {
      console.error('[WhatsAppService] Check status error:', error);
      return { status: 'failed' };
    }
  }

  private async logNotification(
    payload: NotificationPayload,
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED',
    messageId: string | null,
    response: any
  ): Promise<void> {
    try {
      const supabase = await createClient({ isAdmin: true });

      const logEntry: Omit<WhatsAppNotificationLog, 'id' | 'created_at'> = {
        recipient_phone: payload.recipientPhone,
        message_type: payload.messageType,
        target_id: payload.targetId || null,
        message_content: '',
        delivery_status: status,
        fonnte_message_id: messageId,
        fonnte_response: response,
        delivered_at: status === 'DELIVERED' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('whatsapp_notification_logs')
        .insert([logEntry]);

      if (error) {
        console.error('[WhatsAppService] Failed to log notification:', error);
      }
    } catch (error) {
      console.error('[WhatsAppService] Logging error:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let instance: WhatsAppNotificationService | null = null;

export function getWhatsAppNotificationService(): WhatsAppNotificationService {
  const apiKey = process.env.FONNTE_API_KEY;

  if (!apiKey) {
    throw new Error('FONNTE_API_KEY environment variable is not set');
  }

  if (!instance) {
    instance = new WhatsAppNotificationService(apiKey);
  }

  return instance;
}

export default WhatsAppNotificationService;
