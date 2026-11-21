# PAUDABA — Sistem Administrasi Pembayaran KB/TK Aisyiyah Bustanul Athfal 1 Buduran

Sistem informasi berbasis web untuk mengelola tagihan, pembayaran, dan rekapan keuangan siswa di **KB/TK Aisyiyah Bustanul Athfal 1 Buduran** (Sidoarjo, Jawa Timur). Dibangun dengan **Next.js 15** dan **TypeScript** sebagai bagian dari penelitian skripsi Program Studi Sistem Informasi, Universitas Negeri Surabaya (UNESA).

🔗 **Live:** [paudaba1buduran.my.id](https://paudaba1buduran.my.id/)

---

## Latar Belakang

Sebelum sistem ini, administrasi pembayaran sekolah berjalan lewat chatbot WhatsApp pihak ketiga dan verifikasi manual oleh bendahara. Hasil observasi dan wawancara dengan Kepala Sekolah dan Bendahara menemukan beberapa masalah:

- Chatbot WhatsApp sering *logout* sehingga penagihan terhenti.
- Bukti transfer dicocokkan manual dengan mutasi rekening.
- Tidak ada rekapan tunggakan yang terintegrasi.
- Kwitansi tidak memuat rincian komponen tagihan.
- Ada potensi *double billing* karena salah memilih kategori tagihan.

PAUDABA dirancang untuk menjawab masalah-masalah tersebut melalui digitalisasi tagihan, verifikasi pembayaran otomatis lewat payment gateway, dan kwitansi digital yang rinci.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Peran Pengguna](#peran-pengguna)
- [Alur Pembayaran](#alur-pembayaran)
- [Jenis Tagihan](#jenis-tagihan)
- [Teknologi](#teknologi)
- [Struktur Proyek](#struktur-proyek)
- [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Deployment](#deployment)
- [Metodologi & Pengujian](#metodologi--pengujian)
- [Catatan Pengembangan](#catatan-pengembangan)
- [Lisensi](#lisensi)

---

## Fitur Utama

**Autentikasi & akses**
- Login email/password dengan *role-based access control* (4 peran).
- Lupa password: permintaan reset masuk ke halaman Kelola Akun milik Superadmin.
- Satu akun Wali Siswa dapat menaungi lebih dari satu siswa, lengkap dengan halaman Pilih Siswa dan opsi Ganti Siswa.
- Akun dapat dinonaktifkan/diaktifkan tanpa dihapus.

**Pengelolaan data (Superadmin & Bendahara)**
- CRUD data siswa, plus **impor/ekspor Excel** dengan template, validasi per baris, dan preview sebelum konfirmasi.
- Master tagihan dengan form dinamis sesuai jenis tagihan.
- Penugasan tagihan ke siswa, dengan pengecekan agar siswa tidak ditagih dua kali untuk periode yang sama.
- Pencatatan pembayaran **tunai** dan **transfer manual** (mendukung cicilan), dengan unggah bukti pembayaran opsional.
- Data siswa yang sudah punya tagihan/transaksi dilindungi dari penghapusan.

**Pembayaran & notifikasi**
- Pembayaran online lewat **Midtrans** dengan verifikasi otomatis via webhook.
- Notifikasi WhatsApp via **Fonnte**: tagihan baru, konfirmasi pembayaran (lunas / masih ada sisa), dan pengingat tunggakan.
- Kwitansi PDF yang memuat nominal sebelum bayar, nominal yang dibayar, dan sisa tagihan.

**Monitoring & pelaporan**
- Dashboard ringkasan: jumlah siswa, tagihan, status lunas/belum, pemasukan, dan tunggakan.
- Rekapan pembayaran dan rekapan tunggakan (grafik + tabel), dapat diekspor ke Excel.
- Cetak kwitansi dan riwayat pembayaran, pengingat tunggakan via WhatsApp.
- **Changelog** yang mencatat aktor, menu, jenis aksi, waktu, dan deskripsi setiap perubahan data.
- Pengaturan profil sekolah (nama, alamat, logo, nama dan tanda tangan bendahara) oleh Superadmin.

---

## Peran Pengguna

| Peran | Hak akses utama |
|---|---|
| **Superadmin** | Semua fitur Bendahara, ditambah Kelola Akun (Bendahara, Kepala Sekolah, Wali Siswa) dan edit profil sekolah |
| **Bendahara** | Kelola data siswa, master tagihan, penugasan tagihan, pencatatan pembayaran offline, rekapan, pengingat WhatsApp, changelog |
| **Kepala Sekolah** | Hanya-lihat: dashboard, rekapan pembayaran, rekapan tunggakan, changelog. Hanya boleh ada satu akun |
| **Wali Siswa** | Info siswa, daftar tagihan dan rincian, bayar via Midtrans, riwayat pembayaran, cetak kwitansi |

---

## Alur Pembayaran

Wali Siswa menerima notifikasi tagihan lewat WhatsApp, lalu memilih salah satu metode:

| Metode | Cara kerja | Cicilan |
|---|---|---|
| **Tunai** | Uang diserahkan ke Bendahara, yang mencatatnya di sistem | Ya |
| **Transfer bank manual** | Transfer ke rekening sekolah, bukti dikirim ke Bendahara, divalidasi lalu dicatat | Ya |
| **Midtrans** | Bayar dari halaman tagihan, status diperbarui otomatis lewat webhook | Tidak, harus lunas dalam satu transaksi |

Setelah pembayaran tercatat, sistem membandingkan nominal dengan sisa tagihan. Jika sama, status menjadi **Lunas**. Jika kurang, sisa tagihan diperbarui dan status tetap **Belum Lunas**. Notifikasi WhatsApp dikirim sesuai status akhir.

---

## Jenis Tagihan

Master tagihan mendukung empat jenis, masing-masing dengan field berbeda:

- **PPDB:** nominal, jenjang, keterangan
- **Daftar Ulang:** nominal, jenjang, semester (Ganjil/Genap), tahun
- **SPP Reguler** dan **SPP Subsidi:** pilih tipe *Bulanan* (bulan + tahun) atau *Semesteran* (semester + tahun)

---

## Teknologi

| Kategori | Teknologi |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions), React 19, TypeScript |
| Styling & UI | Tailwind CSS 4, Radix UI / shadcn-ui, Lucide, Sonner |
| Form & validasi | React Hook Form, Zod |
| Data fetching | TanStack React Query |
| Database & Auth | Supabase (PostgreSQL, Auth, RLS) |
| Payment gateway | Midtrans |
| Notifikasi | Fonnte (WhatsApp API) |
| Grafik & dokumen | Recharts, SheetJS (xlsx), React to Print |
| Hosting | Vercel |

---

## Struktur Proyek

> Sesuaikan bagian ini dengan struktur folder terbaru di repo.

```
paudaba/
├── src/
│   ├── app/
│   │   ├── (auth)/              # login, lupa password
│   │   ├── (dashboard)/         # area terproteksi per peran
│   │   │   ├── admin/           # dashboard, siswa, master tagihan, tagihan,
│   │   │   │                    # rekapan pembayaran/tunggakan, kelola akun, changelog
│   │   │   └── ...              # halaman Wali Siswa (info, tagihan, riwayat)
│   │   ├── api/                 # webhook Midtrans, notifikasi WhatsApp
│   │   └── beranda/             # halaman publik sekolah
│   ├── components/              # komponen UI dan komponen khusus
│   ├── lib/                     # klien Supabase, helper, validator
│   └── middleware.ts
├── public/
├── .env.example
└── package.json
```

## Lisensi

Dirilis di bawah lisensi MIT. Lihat berkas [LICENSE](LICENSE).

## Kontak

Dikembangkan oleh **Dwi Nurhidayat** ([@nrhdyt3012](https://github.com/nrhdyt3012)), Sistem Informasi, Universitas Negeri Surabaya.
Pertanyaan atau laporan bug: buka [GitHub Issue](https://github.com/nrhdyt3012/paudaba/issues).
