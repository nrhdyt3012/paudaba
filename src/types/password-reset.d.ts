// src/types/password-reset.d.ts

export type PasswordResetStatus = "pending" | "resolved";

export type PasswordResetAccountRole = "admin" | "siswa" | "kepala_sekolah";

export interface PasswordResetRequest {
  id: string;
  email: string;
  account_id: string | null;
  account_role: PasswordResetAccountRole | null;
  account_name: string | null;
  account_phone: string | null;
  status: PasswordResetStatus;
  requested_at: string;
  confirmed_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}