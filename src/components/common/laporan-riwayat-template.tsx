"use client";

export interface LaporanRiwayatItem {
  idpembayaran: number;
  tanggalpembayaran: string;
  namatagihan: string;
  periode: string;
  totalTagihan: number;
  jumlahDibayar: number;
  sisaSetelahTransaksi: number;
  metodepembayaran: string;
}

// BARU: item untuk tabel rincian tagihan yang belum lunas (diambil dari data
// tagihan terkini, bukan dari histori pembayaran).
export interface TagihanBelumLunasItem {
  idtagihansiswa: number;
  namatagihan: string;
  periode: string;
  totalTagihan: number;
  sudahDibayar: number;
  sisaTagihan: number;
}

export interface LaporanRiwayatData {
  namaSiswa: string;
  kelas: string;
  namaWali: string;
  tanggalCetak: string;
  jamCetak: string;
  items: LaporanRiwayatItem[];
  totalDibayarKeseluruhan: number;
  // BARU
  tagihanBelumLunas: TagihanBelumLunasItem[];
  totalSisaBelumLunas: number;
}

const NAMA_BENDAHARA = "Sri Wahyuni";

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(n)));
}

// FIX (dosen pembimbing): laporan sekarang berisi DUA tabel — (1) mutasi
// riwayat pembayaran seperti sebelumnya, dan (2) rincian tagihan yang masih
// belum lunas (data terkini), supaya wali siswa tahu persis sisa tagihan
// yang belum dibayarkan. Judul laporan diganti jadi "Laporan Tagihan
// Menyeluruh" karena isinya bukan cuma riwayat lagi.
export default function LaporanRiwayatTemplate({ data }: { data: LaporanRiwayatData }) {
  return (
    <div className="bg-white text-black" style={{ width: "210mm", minHeight: "297mm", padding: "15mm" }}>
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
          <p className="font-bold text-xl uppercase tracking-wide">Laporan Tagihan Menyeluruh</p>
          <p className="text-xs text-gray-600">Dicetak: {data.tanggalCetak}, {data.jamCetak}</p>
        </div>
      </div>

      {/* Info siswa */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Nama Siswa</span>
          <span className="font-semibold">{data.namaSiswa}</span>
        </div>
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
          <span className="text-gray-600">Kelas</span>
          <span className="font-semibold">{data.kelas}</span>
        </div>
        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1 col-span-2">
          <span className="text-gray-600">Nama Wali</span>
          <span className="font-semibold">{data.namaWali}</span>
        </div>
      </div>

      {/* Tabel 1: Mutasi riwayat pembayaran */}
      <p className="font-bold text-sm mb-2">Riwayat Pembayaran</p>
      <table className="w-full text-xs border-collapse mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left w-8">No</th>
            <th className="border border-gray-300 p-2 text-left">Tanggal</th>
            <th className="border border-gray-300 p-2 text-left">Tagihan</th>
            <th className="border border-gray-300 p-2 text-left">Metode</th>
            <th className="border border-gray-300 p-2 text-right">Total Tagihan</th>
            <th className="border border-gray-300 p-2 text-right">Dibayar</th>
            <th className="border border-gray-300 p-2 text-right">Sisa</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={item.idpembayaran}>
              <td className="border border-gray-300 p-1.5 text-center">{i + 1}</td>
              <td className="border border-gray-300 p-1.5">
                {new Date(item.tanggalpembayaran).toLocaleDateString("id-ID", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                })}
              </td>
              <td className="border border-gray-300 p-1.5">
                {item.namatagihan}
                <span className="block text-[10px] text-gray-500">{item.periode}</span>
              </td>
              <td className="border border-gray-300 p-1.5 capitalize">{item.metodepembayaran}</td>
              <td className="border border-gray-300 p-1.5 text-right">Rp{formatRupiah(item.totalTagihan)}</td>
              <td className="border border-gray-300 p-1.5 text-right font-semibold">
                Rp{formatRupiah(item.jumlahDibayar)}
              </td>
              <td className="border border-gray-300 p-1.5 text-right">
                {item.sisaSetelahTransaksi <= 0 ? (
                  <span className="text-green-700 font-semibold">Lunas</span>
                ) : (
                  `Rp${formatRupiah(item.sisaSetelahTransaksi)}`
                )}
              </td>
            </tr>
          ))}
          {data.items.length === 0 && (
            <tr>
              <td colSpan={7} className="border border-gray-300 p-4 text-center text-gray-500">
                Belum ada riwayat transaksi pembayaran
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold">
            <td colSpan={5} className="border border-gray-300 p-2 text-right">
              Total Keseluruhan Dibayar
            </td>
            <td className="border border-gray-300 p-2 text-right" colSpan={2}>
              Rp{formatRupiah(data.totalDibayarKeseluruhan)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Tabel 2: BARU — Rincian tagihan yang belum lunas (data terkini) */}
      <p className="font-bold text-sm mb-2">Rincian Tagihan yang Belum Lunas</p>
      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left w-8">No</th>
            <th className="border border-gray-300 p-2 text-left">Tagihan</th>
            <th className="border border-gray-300 p-2 text-right">Total Tagihan</th>
            <th className="border border-gray-300 p-2 text-right">Sudah Dibayar</th>
            <th className="border border-gray-300 p-2 text-right">Sisa Belum Dibayar</th>
          </tr>
        </thead>
        <tbody>
          {data.tagihanBelumLunas.map((t, i) => (
            <tr key={t.idtagihansiswa}>
              <td className="border border-gray-300 p-1.5 text-center">{i + 1}</td>
              <td className="border border-gray-300 p-1.5">
                {t.namatagihan}
                <span className="block text-[10px] text-gray-500">{t.periode}</span>
              </td>
              <td className="border border-gray-300 p-1.5 text-right">Rp{formatRupiah(t.totalTagihan)}</td>
              <td className="border border-gray-300 p-1.5 text-right">Rp{formatRupiah(t.sudahDibayar)}</td>
              <td className="border border-gray-300 p-1.5 text-right font-semibold text-red-700">
                Rp{formatRupiah(t.sisaTagihan)}
              </td>
            </tr>
          ))}
          {data.tagihanBelumLunas.length === 0 && (
            <tr>
              <td colSpan={5} className="border border-gray-300 p-4 text-center text-green-700 font-semibold">
                Semua tagihan sudah lunas
              </td>
            </tr>
          )}
        </tbody>
        {data.tagihanBelumLunas.length > 0 && (
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={4} className="border border-gray-300 p-2 text-right">
                Total Sisa Tagihan Belum Dibayar
              </td>
              <td className="border border-gray-300 p-2 text-right text-red-700">
                Rp{formatRupiah(data.totalSisaBelumLunas)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Tanda tangan */}
      <div className="flex justify-end mt-10">
        <div className="text-center">
          <p className="text-sm mb-1">Buduran, {data.tanggalCetak}</p>
          <p className="text-sm mb-1">Bendahara,</p>
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