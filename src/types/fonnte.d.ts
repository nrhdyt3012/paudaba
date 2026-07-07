/**
 * Type definitions untuk Fonnte WhatsApp API
 */

export interface FontteConfig {
  apiKey: string;
  baseUrl: string;
}

export interface FontneSendMessageRequest {
  target: string; // Nomor WhatsApp dengan kode negara (628xxxxxxxxx)
  message: string;
  countryCode?: string;
}

export interface FontneSendMessageResponse {
  status: boolean;
  detail?: string;
  reason?: string;
  id?: (string | number)[];
  process?: string;
  requestid?: number;
  target?: string[];
  quota?: Record<string, any>;
  message?: string; // dipertahankan untuk kompatibilitas lama
  data?: {
    id: string;
    message: string;
    target: string;
    device: string;
    status: 'pending' | 'sent' | 'delivered' | 'read';
  };
}

export interface FontneCheckStatusRequest {
  id: string; // Message ID dari response
}

export interface FontneCheckStatusResponse {
  status: boolean;
  message: string;
  data?: {
    id: string;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
  };
}

export interface FontneWebhookPayload {
  event: 'message' | 'status' | 'device';
  data: {
    id: string;
    target?: string;
    message?: string;
    status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
  };
}

export interface WhatsAppNotificationLog {
  id: number;
  recipient_phone: string;
  message_type: 'TAGIHAN' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'REMINDER_GABUNGAN';
  target_id: number | null;
  message_content: string;
  delivery_status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  fonnte_message_id: string | null;
  fonnte_response: Record<string, any> | null;
  created_at: string;
  delivered_at: string | null;
}

export interface NotificationPayload {
  recipientPhone: string;
  // FIX poin 4: tambah 'REMINDER_GABUNGAN' untuk reminder tunggakan yang
  // merangkum beberapa tagihan sekaligus jadi satu pesan per siswa.
  messageType: 'TAGIHAN' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'REMINDER_GABUNGAN';
  targetId?: number;
  recipientName: string;
  studentName: string;
  data: Record<string, any>;
}
