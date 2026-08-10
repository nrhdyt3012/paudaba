"use client";

// components/laporan-riwayat-template.tsx
// Sama seperti kwitansi: profil sekolah sekarang dinamis lewat `data.sekolah`.
// FIX: tabel rincian "Tagihan Belum Lunas" dihapus — cukup diringkas di
// 3 baris ringkasan di bawah tabel riwayat. Kolom "Sisa" pada tabel riwayat
// dipecah jadi 2 kolom terpisah: "Sisa" (nominal) dan "Status" (badge).
// Ringkasan 3 baris: Total Dibayar - Total Tagihan Keseluruhan = Sisa.

import type { SekolahInfo } from "./kwitansi-template"; // re-use tipe yang sama

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
  tagihanBelumLunas: TagihanBelumLunasItem[];
  totalSisaBelumLunas: number;
  // FIX: total nominal SEMUA tagihan siswa (lunas + belum lunas), dipakai
  // untuk baris "Total Tagihan Keseluruhan" — supaya rumus
  // totalTagihanKeseluruhan - totalDibayarKeseluruhan = totalSisaBelumLunas
  totalTagihanKeseluruhan: number;
  sekolah: SekolahInfo;
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(n)));
}

export default function LaporanRiwayatTemplate({ data }: { data: LaporanRiwayatData }) {
  // FIX: guard defensif — sekolah bisa undefined sesaat saat render pertama
  // (mis. hidden print-div dirender sebelum query pengaturan_sekolah selesai)
  const sekolah = data.sekolah ?? {
    namaSekolah: "-",
    alamatSekolah: "-",
    logoUrl: null,
    namaBendahara: "-",
    tandaTanganUrl: null,
  };
  const statusLunas = data.totalSisaBelumLunas <= 0;

  return (
    <div className="bg-white text-black" style={{ width: "210mm", minHeight: "297mm", padding: "15mm" }}>
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
          <p className="font-bold text-xl uppercase tracking-wide">Laporan Riwayat Pembayaran</p>
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

      {/* Tabel: Riwayat pembayaran, dengan kolom Sisa & Status terpisah */}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left w-8">No</th>
            <th className="border border-gray-300 p-2 text-left">Tanggal</th>
            <th className="border border-gray-300 p-2 text-left">Tagihan</th>
            <th className="border border-gray-300 p-2 text-left">Metode</th>
            <th className="border border-gray-300 p-2 text-right">Total Tagihan</th>
            <th className="border border-gray-300 p-2 text-right">Dibayar</th>
            <th className="border border-gray-300 p-2 text-right">Sisa</th>
            <th className="border border-gray-300 p-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => {
            const itemLunas = item.sisaSetelahTransaksi <= 0;
            return (
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
                  {itemLunas ? "Rp0" : `Rp${formatRupiah(item.sisaSetelahTransaksi)}`}
                </td>
                <td className="border border-gray-300 p-1.5 text-center">
                  {itemLunas ? (
                    <span className="text-green-700 font-semibold">Lunas</span>
                  ) : (
                    <span className="text-red-700 font-semibold">Belum Lunas</span>
                  )}
                </td>
              </tr>
            );
          })}
          {data.items.length === 0 && (
            <tr>
              <td colSpan={8} className="border border-gray-300 p-4 text-center text-gray-500">
                Belum ada riwayat transaksi pembayaran
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Ringkasan dipisah dari tabel, dengan jarak, 3 baris:
          Total Dibayar - Total Tagihan Keseluruhan = Sisa */}
      <div className="mt-8 max-w-xs ml-auto text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-700">Total Keseluruhan Dibayar</span>
          <span className="font-bold text-green-700">
            Rp{formatRupiah(data.totalDibayarKeseluruhan)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-700">Total Tagihan Keseluruhan</span>
          <span className="font-semibold">
            Rp{formatRupiah(data.totalTagihanKeseluruhan)}
          </span>
        </div>
        <div className="flex justify-between border-t border-gray-300 pt-1.5">
          <span className="text-gray-700 font-semibold">Sisa</span>
          <span className={`font-bold ${statusLunas ? "text-green-700" : "text-red-700"}`}>
            Rp{formatRupiah(data.totalSisaBelumLunas)} ({statusLunas ? "Lunas" : "Belum Lunas"})
          </span>
        </div>
      </div>

      {/* Tanda tangan */}
      <div className="flex justify-end mt-10">
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