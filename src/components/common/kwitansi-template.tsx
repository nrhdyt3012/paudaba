"use client";

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
}

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(n)));
}

// Nama bendahara yang menandatangani kwitansi. FIX: gambar tanda tangan asli
// sudah ditempel di public/tanda-tangan-bendahara.png (background sudah
// dibuat transparan), diletakkan tepat di atas nama ini.
const NAMA_BENDAHARA = "Sri Wahyuni";

export default function KwitansiTemplate({ data }: { data: KwitansiData }) {
  return (
    <div className="bg-white text-black" style={{ width: "210mm", minHeight: "148mm", padding: "12mm" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Logo" className="h-14 w-14 object-contain" />
          <div>
            <p className="font-bold text-lg leading-tight">KB TK AISYIYAH BUSTANUL ATHFAL 1</p>
            <p className="text-sm leading-tight">BUDURAN — SIDOARJO</p>
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
            <td className="border border-gray-300 p-2">Total Tagihan</td>
            <td className="border border-gray-300 p-2 text-right">Rp{formatRupiah(data.totalTagihan)}</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-2 font-semibold">Jumlah Dibayar (transaksi ini)</td>
            <td className="border border-gray-300 p-2 text-right font-semibold">
              Rp{formatRupiah(data.jumlahDibayar)}
            </td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-2">Sisa Tagihan Setelah Ini</td>
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

      {/* Footer: QR + Tanda tangan */}
      <div className="flex justify-between items-end mt-8">
        <div className="flex flex-col items-center">
          {data.qrCodeDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.qrCodeDataUrl} alt="QR Kwitansi" className="w-20 h-20" />
          )}
          <p className="text-[10px] text-gray-500 mt-1">Scan untuk verifikasi</p>
        </div>

        <div className="text-center">
          <p className="text-sm mb-1">Buduran, {data.tanggalCetak}</p>
          <p className="text-sm mb-1">Bendahara,</p>
          {/* FIX: tanda tangan asli (background sudah transparan), ditempel
              tepat di atas nama bendahara — gantikan garis kosong lama. */}
          <div className="h-20 w-36 flex items-end justify-center mx-auto -mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tanda-tangan-bendahara.png"
              alt={`Tanda tangan ${NAMA_BENDAHARA}`}
              className="max-h-20 max-w-36 object-contain"
            />
          </div>
          <p className="font-semibold underline underline-offset-2">{NAMA_BENDAHARA}</p>
        </div>
      </div>
    </div>
  );
}
