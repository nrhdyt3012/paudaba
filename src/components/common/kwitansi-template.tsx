"use client";

// components/kwitansi-template.tsx
// Perubahan dari versi lama: nama sekolah, alamat, logo, nama bendahara, dan
// foto tanda tangan SEKARANG datang dari `data.sekolah` (diisi dari tabel
// pengaturan_sekolah), bukan lagi hardcode di komponen ini.

export interface SekolahInfo {
  namaSekolah: string;
  alamatSekolah: string;
  logoUrl: string | null;
  namaBendahara: string;
  tandaTanganUrl: string | null;
}

export interface KwitansiData {
  noKwitansi: string;
  tanggalCetak: string;
  jamCetak: string;
  namaSiswa: string;
  kelas: string;
  namaWali: string;
  namaTagihan: string;
  periode: string;
  jumlahDibayar: number;
  totalTagihan: number;
  sisaTagihan: number;
  isLunas: boolean;
  qrCodeDataUrl?: string;
  tagihanLain?: Array<{
    idtagihansiswa: number;
    jumlahtagihan: string;
    bulan: number;
    tahun: number;
    namatagihan: string;
  }>;
  // BARU: profil sekolah dinamis
  sekolah: SekolahInfo;
}

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(n)));
}

export default function KwitansiTemplate({ data }: { data: KwitansiData }) {
  // FIX: guard defensif — sama seperti laporan-riwayat-template
  const sekolah = data.sekolah ?? {
    namaSekolah: "-",
    alamatSekolah: "-",
    logoUrl: null,
    namaBendahara: "-",
    tandaTanganUrl: null,
  };

  return (
    <div className="bg-white text-black" style={{ width: "210mm", minHeight: "148mm", padding: "12mm" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
        <div className="flex items-center gap-3">
          {sekolah.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sekolah.logoUrl} alt="Logo" className="h-14 w-14 object-contain" />
          )}
          <div>
            <p className="font-bold text-lg leading-tight">{sekolah.namaSekolah}</p>
            <p className="text-sm leading-tight">{sekolah.alamatSekolah}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-xl uppercase tracking-wide">Kwitansi</p>
          <p className="text-sm font-mono">No. {data.noKwitansi}</p>
        </div>
      </div>

      {/* Info transaksi */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-4">
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Nama Siswa</span>
          <span className="font-semibold">{data.namaSiswa}</span>
        </div>
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Kelas</span>
          <span className="font-semibold">{data.kelas}</span>
        </div>
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Nama Wali</span>
          <span className="font-semibold">{data.namaWali}</span>
        </div>
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Tanggal Bayar</span>
          <span className="font-semibold">{data.tanggalCetak}, {data.jamCetak}</span>
        </div>
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Jenis Tagihan</span>
          <span className="font-semibold">{data.namaTagihan}</span>
        </div>
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Periode</span>
          <span className="font-semibold">{data.periode}</span>
        </div>
      </div>

      {/* Rincian pembayaran */}
      <table className="w-full text-sm border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">Keterangan</th>
            <th className="border border-gray-300 p-2 text-right">Nominal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-300 p-2">Total Tagihan Keseluruhan</td>
            <td className="border border-gray-300 p-2 text-right">Rp{formatRupiah(data.totalTagihan)}</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-2">Jumlah Sudah Dibayar (sebelum transaksi ini)</td>
            <td className="border border-gray-300 p-2 text-right">
              Rp{formatRupiah(data.totalTagihan - data.sisaTagihan - data.jumlahDibayar)}
            </td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-2 font-semibold">Dibayar pada Transaksi Ini</td>
            <td className="border border-gray-300 p-2 text-right font-semibold">
              Rp{formatRupiah(data.jumlahDibayar)}
            </td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-2">Sisa Tagihan</td>
            <td className="border border-gray-300 p-2 text-right">
              {data.isLunas ? (
                <span className="text-green-700 font-bold">LUNAS</span>
              ) : (
                `Rp${formatRupiah(data.sisaTagihan)}`
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {data.tagihanLain && data.tagihanLain.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 mb-1">
            Catatan: Ananda masih memiliki tagihan lain yang belum lunas:
          </p>
          <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
            {data.tagihanLain.slice(0, 5).map((t) => (
              <li key={t.idtagihansiswa}>
                {t.namatagihan} ({BULAN_NAMA[t.bulan]} {t.tahun}) — Rp{formatRupiah(parseFloat(t.jumlahtagihan))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer: tanda tangan */}
      <div className="flex justify-end items-end mt-8">
        <div className="text-center">
          <p className="text-sm mb-1">Buduran, {data.tanggalCetak}</p>
          <p className="text-sm mb-1">Bendahara,</p>
          <div className="h-20 w-36 flex items-end justify-center mx-auto -mb-1">
            {sekolah.tandaTanganUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sekolah.tandaTanganUrl}
                alt={`Tanda tangan ${sekolah.namaBendahara}`}
                className="max-h-20 max-w-36 object-contain"
              />
            )}
          </div>
          <p className="font-semibold underline underline-offset-2">{sekolah.namaBendahara}</p>
        </div>
      </div>
    </div>
  );
}