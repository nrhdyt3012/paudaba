

Proyek ini adalah sistem manajemen pembayaran dan tagihan pendidikan berbasis web yang dibangun dengan **Next.js 15** dan **TypeScript**. Aplikasi ini dirancang untuk PAUD BA 1 Buduran, menyediakan modul lengkap untuk siswa, wali murid, dan admin dalam mengelola tagihan, pembayaran, serta informasi pendidikan.

[Live Demo](https://paudaba1buduran.my.id/)

---

## Daftar Isi
- [Ringkasan](#ringkasan)
- [Fitur Utama](#fitur-utama)
- [Arsitektur & Teknologi](#arsitektur--teknologi)
- [Struktur Aplikasi](#struktur-aplikasi)
- [Persiapan & Prasyarat](#persiapan--prasyarat)
- [Cara Setup & Jalankan](#cara-setup--jalankan)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Pengujian](#pengujian)
- [Kontribusi](#kontribusi)
- [Catatan Pengembangan](#catatan-pengembangan)
- [Lisensi](#lisensi)

---

## Ringkasan
PPPM-BM adalah aplikasi SaaS modern untuk manajemen pembayaran sekolah. Dibangun dengan teknologi terkini, aplikasi ini menyediakan:

- **Dashboard Admin** untuk pengelolaan siswa, tagihan, dan pembayaran
- **Portal Siswa & Wali** untuk melihat tagihan dan melakukan pembayaran online
- **Sistem Pembayaran Terintegrasi** dengan Midtrans untuk payment gateway
- **Sistem Database Relasional** menggunakan Supabase (PostgreSQL)
- **Email Notification** untuk konfirmasi pembayaran dan kwitansi

Bahasa pemrograman: **TypeScript** (98.8%) dengan support minimal untuk konfigurasi native.

---

## Fitur Utama
- **🔐 Autentikasi & Authorization** - Login dengan email/password, role-based access control (Admin, Siswa, Wali)
- **💳 Sistem Pembayaran** - Integrasi Midtrans untuk pembayaran online (kartu kredit, transfer bank, e-wallet)
- **📋 Manajemen Tagihan** - CRUD tagihan siswa, pembayaran manual (cash), tracking status pembayaran
- **📊 Dashboard Analytics** - Laporan pembayaran, statistik tagihan tertunggak, grafik pembayaran
- **📨 Email Notification** - Pengiriman kwitansi dan notifikasi pembayaran via email
- **👥 Manajemen Data Siswa** - Import/export data siswa, profil siswa, data akademik
- **📱 Responsive Design** - UI yang bekerja sempurna di desktop, tablet, dan mobile
- **🌙 Dark Mode Support** - Theme switcher untuk kenyamanan visual user
- **📁 File Management** - Upload dokumen, cetak kwitansi, export Excel
- **🔔 Real-time Updates** - Sync pembayaran real-time dengan webhook Midtrans

---

## Arsitektur & Teknologi

### Frontend & Framework
- **Next.js 15.3.1** - React framework dengan App Router, server components, server actions
- **TypeScript 5** - Type-safe JavaScript development
- **React 19** - UI library
- **Tailwind CSS 4** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives

### UI Components & Libraries
- **Radix UI Components** - Dialog, Dropdown, Tabs, Select, Checkbox, Avatar, Tooltip, Hover Card
- **Lucide React** - Icon library modern
- **Motion** - Animation library
- **React Hook Form** - Efficient form management
- **Zod** - TypeScript-first schema validation
- **Class Variance Authority** - Utility untuk CSS class variants
- **Sonner** - Toast notifications

### Backend & Database
- **Supabase** - PostgreSQL database + authentication service
  - `@supabase/supabase-js` - Client library
  - `@supabase/ssr` - Server-side rendering support
- **Prisma** (optional) - ORM untuk database management

### Networking & API
- **TanStack React Query 5** - Server state management dan caching
- **Axios/Fetch** - HTTP client
- **Resend** - Email service untuk pengiriman kwitansi

### Payment Gateway
- **Midtrans** - Payment aggregator untuk transaksi online
- `midtrans-client` - Official Midtrans JavaScript library

### Development Tools
- **Turbopack** - Next.js bundler tercepat (used in dev: `next dev --turbopack`)
- **ESLint 9** - Code quality linting
- **Next Sitemap** - Automatic sitemap generation untuk SEO

### State Management
- **Zustand 5** - Lightweight state management library
- **TanStack React Query 5** - Server state management

### Utilities
- **date-fns 4** - Date manipulation library
- **XLSX 0.18** - Excel file parsing dan generation
- **React to Print 3** - Print functionality untuk kwitansi
- **Recharts 3** - Chart library untuk analytics
- **Clsx** - Conditional className utility
- **Tailwind Merge** - Utility untuk merge Tailwind classes

---

## Struktur Aplikasi

```
pppm-bm/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Authentication pages
│   │   │   ├── login/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── (dashboard)/               # Protected routes
│   │   │   ├── admin/                 # Admin dashboard
│   │   │   │   ├── siswa/             # Manage students
│   │   │   │   ├── tagihan/           # Manage bills
│   │   │   │   ├── pembayaran/        # Payment records
│   │   │   │   └── laporan/           # Reports & analytics
│   │   │   ├── siswa/                 # Student portal
│   │   │   │   ├── tagihan/           # View bills
│   │   │   │   ├── payment/           # Make payment
│   │   │   │   ├── riwayat/           # Payment history
│   │   │   │   └── profile/           # Student profile
│   │   │   └── layout.tsx             # Dashboard layout
│   │   ├── api/                       # API routes
│   │   │   ├── payment/               # Payment endpoints
│   │   │   │   ├── create/            # Create payment transaction
│   │   │   │   └── webhook/           # Midtrans webhook handler
│   │   │   └── send-receipt/          # Email receipt sender
│   │   ├── (public)/                  # Public pages
│   │   │   ├── beranda/
│   │   │   ├── profil/
│   │   │   ├── fasilitas/
│   │   │   └── ...
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Home page
│   │   └── sitemap.ts                 # Dynamic sitemap
│   ├── components/
│   │   ├── ui/                        # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   └── ...
│   │   └── custom/                    # Custom components
│   │       ├── navbar.tsx
│   │       ├── sidebar.tsx
│   │       └── ...
│   ├── lib/
│   │   ├── supabase/                  # Supabase clients & utilities
│   │   │   ├── server.ts              # Server-side client
│   │   │   ├── client.ts              # Client-side client
│   │   │   └── middleware.ts
│   │   ├── utils.ts                   # Helper functions
│   │   ├── validators.ts              # Data validation schemas
│   │   └── constants.ts               # App constants
│   ├── configs/
│   │   ├── environtment.ts            # Environment variables
│   │   └── metadata.ts                # SEO metadata
│   ├── stores/                        # Zustand stores
│   │   ├── auth-store.ts              # Authentication state
│   │   ├── ui-store.ts                # UI state
│   │   └── ...
│   ├── types/                         # TypeScript type definitions
│   │   ├── database.ts
│   │   ├── models.ts
│   │   └── ...
│   ├── middleware.ts                  # Next.js middleware
│   └── styles/                        # Global styles
│       └── globals.css
├── public/
│   ├── images/
│   ├── icons/
│   └── ...
├── .env.local                         # Local environment variables (git ignored)
├── .env.example                       # Template environment variables
├── next.config.ts                     # Next.js configuration
├── tailwind.config.ts                 # Tailwind CSS configuration
├── tsconfig.json                      # TypeScript configuration
├── package.json                       # Dependencies
└── README.md                          # This file
```

---

## Persiapan & Prasyarat

### Sistem Requirements
- **Node.js** v18+ (disarankan v20 LTS atau lebih baru)
- **npm** v9+ atau **pnpm** v8+ atau **yarn** v3+
- **Git** untuk version control

### Required Services (Production)
- **Supabase** account dengan PostgreSQL database
- **Midtrans** merchant account untuk payment gateway
- **Resend** API key untuk email service (optional, untuk production)

### Verifikasi Instalasi
```bash
node --version          # v18.0.0 atau lebih
npm --version           # v9.0.0 atau lebih
git --version           # versi terbaru
```

---

## Cara Setup & Jalankan

### 1. Clone Repository
```bash
git clone https://github.com/nrhdyt3012/pppm-bm.git
cd pppm-bm
```

### 2. Install Dependencies
```bash
npm install
# atau
pnpm install
# atau
yarn install
```

### 3. Setup Environment Variables
```bash
# Copy file template
cp .env.example .env.local

# Edit .env.local dengan konfigurasi Anda
nano .env.local  # atau gunakan editor favorit
```

Lihat bagian [Konfigurasi Environment](#konfigurasi-environment) untuk detail lengkap.

### 4. Setup Database Supabase
1. Login ke [Supabase](https://supabase.com)
2. Buat project baru atau gunakan yang sudah ada
3. Jalankan SQL migrations (copy dari database schema)
4. Konfigurasi RLS (Row Level Security) policies jika diperlukan

### 5. Run Development Server
```bash
npm run dev
# Server akan berjalan di http://localhost:3000
```

Buka browser dan akses aplikasi di `http://localhost:3000`

### 6. Build untuk Production
```bash
npm run build
npm start
```

---

## Konfigurasi Environment

Buat file `.env.local` dengan variabel berikut:

```env
# ==========================================
# NEXT.JS PUBLIC CONFIGURATION
# ==========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ==========================================
# SUPABASE CONFIGURATION
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Service role key (server-side only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ==========================================
# MIDTRANS PAYMENT GATEWAY
# ==========================================
# Sandbox mode untuk development
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your-client-key-sandbox
MIDTRANS_SERVER_KEY=your-server-key-sandbox

# Production (uncomment ketika deploy)
# NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your-client-key-production
# MIDTRANS_SERVER_KEY=your-server-key-production

# ==========================================
# EMAIL SERVICE (RESEND)
# ==========================================
RESEND_API_KEY=your-resend-api-key
FROM_EMAIL=noreply@yourschool.sch.id

# ==========================================
# NODE ENVIRONMENT
# ==========================================
NODE_ENV=development
```

### Cara Mendapatkan Credentials

#### Supabase
1. Buat project di [supabase.com](https://supabase.com)
2. Buka Project Settings → API
3. Copy `URL`, `Anon Key`, dan `Service Role Key`

#### Midtrans
1. Register di [midtrans.com](https://www.midtrans.com)
2. Buat merchant dan dapatkan client key + server key
3. Gunakan sandbox credentials untuk development

#### Resend
1. Create account di [resend.com](https://resend.com)
2. Generate API key di dashboard
3. Verify domain email untuk production

---

## Pengujian

### Development Testing
```bash
# Format code
npm run format

# Lint code
npm run lint

# Build untuk check errors
npm run build
```

### Manual Testing Checklist
- [ ] Login dengan email/password
- [ ] Tambah/edit/hapus data siswa
- [ ] Buat dan lihat tagihan
- [ ] Proses pembayaran (Midtrans sandbox)
- [ ] Verifikasi webhook pembayaran
- [ ] Kirim kwitansi via email
- [ ] Export data ke Excel
- [ ] Test responsive design di mobile

### Testing Pembayaran (Sandbox Midtrans)
```
Nomor Kartu Test: 4811111111111114
Exp: 12/25
CVC: 123
```

---

## Kontribusi

Kami sangat menghargai kontribusi dari komunitas! Berikut langkah-langkah berkontribusi:

### 1. Fork Repository
Kunjungi GitHub dan klik tombol "Fork"

### 2. Clone Fork Anda
```bash
git clone https://github.com/your-username/pppm-bm.git
cd pppm-bm
```

### 3. Buat Branch Fitur
```bash
git checkout -b feat/nama-fitur
# atau
git checkout -b fix/nama-bug
```

### 4. Commit dengan Pesan Deskriptif
```bash
git commit -m "feat: Menambahkan fitur dashboard analytics"
# atau
git commit -m "fix: Memperbaiki bug pada proses pembayaran"
```

**Format Commit:**
- `feat:` untuk fitur baru
- `fix:` untuk bug fix
- `docs:` untuk dokumentasi
- `style:` untuk code style
- `refactor:` untuk refactoring
- `test:` untuk testing

### 5. Push ke Fork
```bash
git push origin feat/nama-fitur
```

### 6. Buat Pull Request
1. Buka GitHub dan navigasi ke repository
2. Klik "Create Pull Request"
3. Isi template PR dengan:
   - Deskripsi lengkap perubahan
   - Related issues (jika ada)
   - Testing steps
   - Screenshots untuk UI changes

### 7. Code Review
Maintainer akan review PR Anda dan memberikan feedback jika diperlukan.

---

## Catatan Pengembangan

### Best Practices
- Selalu gunakan TypeScript, hindari `any` type
- Follow Prettier formatting dan ESLint rules
- Write meaningful commit messages
- Update dokumentasi untuk fitur baru
- Test sebelum push

### Debugging Tips
- Gunakan `console.log()` dengan prefix `[LOCATION]` untuk tracking
- Periksa Network tab di browser DevTools untuk API calls
- Lihat Supabase logs untuk database issues
- Test Midtrans webhook di dashboard Midtrans

### Performance Optimization
- Gunakan React Query untuk data fetching dan caching
- Implement pagination untuk list data besar
- Optimize images dengan Next.js Image component
- Lazy load components dengan `dynamic()`

### Security Best Practices
- Jangan commit `.env.local` (sudah di `.gitignore`)
- Validate input di server-side, jangan hanya client-side
- Use Row Level Security (RLS) di Supabase
- Keep dependencies updated: `npm audit fix`

### Struktur Database (Key Tables)
```sql
-- Users & Auth (managed by Supabase Auth)

-- Siswa (Students)
CREATE TABLE siswa (
  id UUID PRIMARY KEY,
  nama VARCHAR NOT NULL,
  nisn VARCHAR UNIQUE,
  email VARCHAR UNIQUE,
  ...
);

-- Tagihan Siswa (Student Bills)
CREATE TABLE tagihan_siswa (
  idtagihansiswa SERIAL PRIMARY KEY,
  idsiswa UUID REFERENCES siswa(id),
  jumlahtagihan DECIMAL,
  jumlahterbayar DECIMAL,
  statuspembayaran VARCHAR,
  bulan INT,
  tahun INT,
  ...
);

-- Pembayaran (Payment Records)
CREATE TABLE pembayaran (
  idpembayaran SERIAL PRIMARY KEY,
  idtagihansiswa INT REFERENCES tagihan_siswa,
  jumlahdibayar DECIMAL,
  metodepembayaran VARCHAR,
  statuspembayaran VARCHAR,
  ...
);
```

### Troubleshooting

#### Error: "SUPABASE_URL not found"
→ Pastikan `.env.local` sudah dikonfigurasi dengan benar

#### Error: "Midtrans payment failed"
→ Cek Midtrans server key di `.env.local` dan verifikasi merchant status

#### Database connection timeout
→ Periksa koneksi internet dan status Supabase server

#### Build error saat deploy
→ Jalankan `npm run build` lokal untuk detect error lebih awal

---

## Lisensi
Repository ini dilisensikan di bawah lisensi MIT. Lihat file [LICENSE](LICENSE) untuk detail lebih lanjut.

---

## Support & Kontak
Untuk pertanyaan, bug report, atau saran, silakan:
- Buat [GitHub Issue](https://github.com/nrhdyt3012/pppm-bm/issues)
- Hubungi maintainer: [@nrhdyt3012](https://github.com/nrhdyt3012)
- Email: (jika tersedia di profil GitHub)

---

## Deployment

### Deploy ke Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Login ke Vercel
vercel login

# Deploy
vercel
```

Vercel akan automatically detect Next.js dan setup deployment.

### Deploy ke Platform Lain
Aplikasi ini dapat di-deploy ke:
- **Netlify** - Dengan serverless functions
- **Railway** - PaaS yang mudah
- **Render** - Cloud platform
- **Self-hosted** - Docker container

Lihat dokumentasi platform untuk instruksi detail.

---

**Last Updated**: 2026-05-15


