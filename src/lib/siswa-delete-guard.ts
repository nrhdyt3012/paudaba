// src/lib/siswa-delete-guard.ts
//
// FIX: kebijakan hapus siswa disamakan & dipusatkan di sini, dipakai dari
// 2 tempat (Kelola Data Siswa & Kelola Akun) supaya tidak ada celah salah
// satu jalur lupa dicek.
//
// KEBIJAKAN (sesuai kesepakatan): siswa dicek dari tabel `pembayaran`,
// BUKAN `tagihan_siswa`:
// - Kalau siswa itu punya tagihan tapi BELUM PERNAH ada pembayaran SUKSES
//   sama sekali → aman dihapus. Tagihan yang masih "BELUM BAYAR" itu cuma
//   invoice kosong, belum ada uang yang benar-benar berpindah, jadi boleh
//   ikut terhapus bersama siswanya.
// - Kalau sudah ADA minimal 1 pembayaran berstatus SUCCESS (mau itu lunas
//   penuh atau baru cicilan sebagian) → itu representasi uang yang sudah
//   benar-benar masuk. WAJIB dipertahankan untuk pembukuan/audit sekolah,
//   jadi siswa tersebut TIDAK BOLEH dihapus permanen. Solusinya pakai
//   "Nonaktifkan" (is_active = false) — datanya tetap aman, cuma akunnya
//   tidak bisa dipakai login lagi.

import { SupabaseClient } from "@supabase/supabase-js";

export async function cekSiswaBisaDihapus(
  supabase: SupabaseClient,
  idsiswa: string
): Promise<{ bisaDihapus: boolean; jumlahTransaksi: number }> {
  const { count, error } = await supabase
    .from("pembayaran")
    .select("*", { count: "exact", head: true })
    .eq("idsiswa", idsiswa)
    .eq("statuspembayaran", "SUCCESS");

  if (error) {
    console.error("[siswa-delete-guard] Gagal cek riwayat pembayaran:", error.message);
    // Kalau pengecekan sendiri gagal, demi keamanan data JANGAN izinkan
    // hapus — lebih baik gagal aman (fail-safe) daripada berisiko
    // menghapus riwayat pembayaran yang belum sempat kecek.
    return { bisaDihapus: false, jumlahTransaksi: -1 };
  }

  const jumlahTransaksi = count || 0;
  return { bisaDihapus: jumlahTransaksi === 0, jumlahTransaksi };
}

export function pesanTidakBisaDihapus(jumlahTransaksi: number): string {
  return `Siswa ini sudah memiliki ${jumlahTransaksi} riwayat pembayaran yang berhasil, sehingga tidak bisa dihapus permanen — akan menghilangkan bukti pembayaran itu dari sistem. Kalau siswa ini sudah lulus/pindah/keluar, gunakan tombol "Nonaktifkan" di menu Kelola Akun (superadmin) supaya datanya tetap aman.`;
}

/**
 * Dipanggil SETELAH `cekSiswaBisaDihapus` memastikan aman (belum pernah ada
 * pembayaran SUCCESS). Membersihkan semua data turunan yang masih nyantol
 * (tagihan yang belum dibayar, log Midtrans, notifikasi WA, snapshot
 * rekapan tunggakan) SEBELUM akun siswanya sendiri dihapus — supaya tidak
 * ada baris yatim (orphan) tersisa di tabel lain.
 */
export async function bersihkanDataTagihanSiswa(
  supabase: SupabaseClient,
  idsiswa: string
) {
  const { data: tagihanList } = await supabase
    .from("tagihan_siswa")
    .select("idtagihansiswa")
    .eq("idsiswa", idsiswa);

  const idTagihanList = (tagihanList || []).map((t: any) => t.idtagihansiswa);
  if (idTagihanList.length === 0) return;

  // Pembayaran non-sukses (PENDING/FAILED/EXPIRED) yang nyantol di tagihan
  // ini — aman dihapus karena bukan transaksi yang benar-benar jadi.
  const { data: pembayaranList } = await supabase
    .from("pembayaran")
    .select("idpembayaran")
    .in("idtagihansiswa", idTagihanList);
  const idPembayaranList = (pembayaranList || []).map((p: any) => p.idpembayaran);

  if (idPembayaranList.length > 0) {
    await supabase.from("payment_gateway_log").delete().in("idpembayaran", idPembayaranList);
    await supabase.from("pembayaran").delete().in("idpembayaran", idPembayaranList);
  }

  // Snapshot rekapan_tunggakan yang nyantol (lihat rekapan-helper.ts)
  await supabase.from("rekapan_tunggakan").delete().in("idtagihansiswa", idTagihanList);

  // Log notifikasi WhatsApp yang nyantol ke tagihan-tagihan ini
  await supabase
    .from("whatsapp_notification_logs")
    .delete()
    .in("target_id", idTagihanList);

  // Terakhir, baru hapus baris tagihan_siswa itu sendiri
  await supabase.from("tagihan_siswa").delete().in("idtagihansiswa", idTagihanList);
}
