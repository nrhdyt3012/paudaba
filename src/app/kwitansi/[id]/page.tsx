// src/app/kwitansi/[id]/page.tsx
// Halaman publik untuk menampilkan kwitansi — ini URL yang dikirim via
// WhatsApp (linkKwitansi) dan yang dijadikan isi QR code di kwitansi itu
// sendiri, supaya orang yang scan QR bisa memverifikasi keasliannya.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { generateQrCodeDataUrl } from "@/lib/kwitansi-helper";
import KwitansiTemplate, {
  KwitansiData,
  SekolahInfo,
} from "@/components/common/kwitansi-template";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: `KB/TK ABA 1 Buduran | Kwitansi #${id}`,
    icons: { icon: "/favicon.ico" },
  };
}

export default async function KwitansiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idPembayaran = parseInt(id);

  if (!idPembayaran || isNaN(idPembayaran)) {
    notFound();
  }

  const supabase = getAdminClient();

  const { data: pembayaran, error } = await supabase
    .from("pembayaran")
    .select(
      `
      idpembayaran,
      jumlahdibayar,
      tanggalpembayaran,
      metodepembayaran,
      statuspembayaran,
      tagihan_siswa:tagihan_siswa!idtagihansiswa(
        idtagihansiswa,
        jumlahtagihan,
        jumlahterbayar,
        statuspembayaran,
        bulan,
        tahun,
        idsiswa,
        siswa:siswa!idsiswa(id, namasiswa, kelas, namawali),
        master_tagihan:master_tagihan!idmastertagihan(namatagihan, jenjang, jenistagihan)
      )
    `
    )
    .eq("idpembayaran", idPembayaran)
    .single();

  if (error || !pembayaran) {
    notFound();
  }

  const tagihan: any = pembayaran.tagihan_siswa;
  const siswa: any = tagihan?.siswa;
  const masterTagihan: any = tagihan?.master_tagihan;

  if (!tagihan || !siswa) {
    notFound();
  }

  // Ambil tagihan lain milik siswa yang sama yang masih BELUM BAYAR
  // (info ini ditampilkan di kwitansi sebagai pengingat)
  const { data: tagihanLainRaw } = await supabase
    .from("tagihan_siswa")
    .select(
      `
      idtagihansiswa,
      jumlahtagihan,
      bulan,
      tahun,
      master_tagihan:master_tagihan!idmastertagihan(namatagihan)
    `
    )
    .eq("idsiswa", siswa.id)
    .eq("statuspembayaran", "BELUM BAYAR")
    .neq("idtagihansiswa", tagihan.idtagihansiswa)
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false });

  const tagihanLain = (tagihanLainRaw || []).map((t: any) => ({
    idtagihansiswa: t.idtagihansiswa,
    jumlahtagihan: t.jumlahtagihan,
    bulan: t.bulan,
    tahun: t.tahun,
    namatagihan: t.master_tagihan?.namatagihan || "-",
  }));

  // Ambil profil sekolah (dipakai untuk header, footer/ttd bendahara di
  // kwitansi) — di-fetch di server pakai admin client supaya tetap dinamis
  // meskipun halaman ini publik/tanpa login.
  const { data: sekolahRow } = await supabase
    .from("pengaturan_sekolah")
    .select(
      "nama_sekolah, alamat_sekolah, logo_url, nama_bendahara, tanda_tangan_bendahara_url"
    )
    .eq("id", 1)
    .maybeSingle();

  const sekolah: SekolahInfo = {
    namaSekolah: sekolahRow?.nama_sekolah || "-",
    alamatSekolah: sekolahRow?.alamat_sekolah || "-",
    logoUrl: sekolahRow?.logo_url || null,
    namaBendahara: sekolahRow?.nama_bendahara || "-",
    tandaTanganUrl: sekolahRow?.tanda_tangan_bendahara_url || null,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const linkKwitansi = `${appUrl}/kwitansi/${idPembayaran}`;
  const qrCodeDataUrl = await generateQrCodeDataUrl(linkKwitansi);

  const totalTagihan = parseFloat(tagihan.jumlahtagihan || "0");
  const jumlahDibayar = parseFloat(pembayaran.jumlahdibayar || "0");
  const sisaTagihan = Math.max(
    0,
    totalTagihan - parseFloat(tagihan.jumlahterbayar || "0")
  );
  const isLunas =
    tagihan.statuspembayaran === "LUNAS" &&
    pembayaran.statuspembayaran === "SUCCESS";

  const tglBayar = new Date(pembayaran.tanggalpembayaran);
  const noKwitansi = `${tagihan.idtagihansiswa}/${pembayaran.idpembayaran}/${tglBayar.getFullYear()}`;

  const kwitansiData: KwitansiData = {
    noKwitansi,
    tanggalCetak: tglBayar.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    jamCetak:
      tglBayar
        .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        .replace(":", ".") + " WIB",
    namaSiswa: siswa.namasiswa || "-",
    kelas: siswa.kelas || "-",
    namaWali: siswa.namawali || "-",
    namaTagihan: masterTagihan?.namatagihan || "-",
    periode: `${BULAN_NAMA[tagihan.bulan]} ${tagihan.tahun}`,
    jumlahDibayar,
    totalTagihan,
    sisaTagihan,
    isLunas,
    qrCodeDataUrl,
    tagihanLain,
    sekolah,
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <KwitansiTemplate data={kwitansiData} />
    </div>
  );
}