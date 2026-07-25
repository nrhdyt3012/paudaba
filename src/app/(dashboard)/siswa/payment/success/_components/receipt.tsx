"use client";

import { convertIDR } from "@/lib/utils";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const BULAN_NAMA = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function Receipt({
  tagihan,
  nominalBayar,
  sisaBaru,
  nominalTotal,
}: {
  tagihan: any;
  nominalBayar: number;
  sisaBaru: number;
  nominalTotal: number;
}) {
  const isFullPayment = sisaBaru < 0.01;
  const tanggalBayar = new Date();

  return (
    <div className="w-full bg-white p-8 text-black">
      <div className="max-w-2xl mx-auto border border-gray-300 p-8">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
          <h1 className="text-3xl font-bold">KWITANSI</h1>
          <p className="text-sm text-gray-600 mt-2">
            No. Kwitansi: #{ tagihan?.idtagihansiswa}-{format(tanggalBayar, "yyyyMMdd")}
          </p>
        </div>

        {/* Data Sekolah */}
        <div className="mb-8">
          <p className="font-bold text-lg">KB/TK ABA 1 Buduran</p>
          <p className="text-sm text-gray-600">Jl. Buduran, Surabaya</p>
          <p className="text-sm text-gray-600">Tanggal Cetak: {format(tanggalBayar, "dd MMMM yyyy", { locale: id })}</p>
        </div>

        {/* Data Siswa */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div>
            <p className="font-semibold text-gray-700 mb-3">DATA SISWA</p>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="text-gray-600 w-24">Nama</td>
                  <td className="font-semibold">: {tagihan?.siswa?.namasiswa}</td>
                </tr>
                <tr>
                  <td className="text-gray-600">Kelas</td>
                  <td className="font-semibold">: {tagihan?.siswa?.kelas || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <p className="font-semibold text-gray-700 mb-3">DETAIL TAGIHAN</p>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="text-gray-600 w-24">ID Tagihan</td>
                  <td className="font-semibold">: #{tagihan?.idtagihansiswa}</td>
                </tr>
                <tr>
                  <td className="text-gray-600">Periode</td>
                  <td className="font-semibold">: {BULAN_NAMA[tagihan?.bulan || 0]} {tagihan?.tahun}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Pembayaran */}
        <div className="mb-8 text-sm">
          <p className="font-semibold text-gray-700 mb-3">DETAIL PEMBAYARAN</p>
          <table className="w-full">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="text-gray-600 py-2 w-40">Jenis Tagihan</td>
                <td className="font-semibold py-2">: {tagihan?.namatagihan}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="text-gray-600 py-2">Total Tagihan</td>
                <td className="font-semibold py-2 text-right pr-4">{convertIDR(nominalTotal)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="text-gray-600 py-2">Nominal Dibayar</td>
                <td className="font-semibold py-2 text-right pr-4 text-green-700">{convertIDR(nominalBayar)}</td>
              </tr>
              {!isFullPayment && (
                <tr className="border-b border-gray-300">
                  <td className="text-gray-600 py-2">Sisa Tagihan</td>
                  <td className="font-semibold py-2 text-right pr-4 text-red-700">{convertIDR(Math.max(0, sisaBaru))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Status */}
        <div className="bg-gray-100 p-4 rounded mb-8 text-sm">
          <p className="text-center font-bold">
            STATUS: {isFullPayment ? "✓ LUNAS" : "✗ BELUM LUNAS"}
          </p>
          {!isFullPayment && (
            <p className="text-center text-gray-600 text-xs mt-1">
              Masih ada sisa tagihan sebesar {convertIDR(Math.max(0, sisaBaru))}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-800 pt-6 mt-8">
          <div className="flex justify-between items-end">
            <div className="text-center text-xs">
              <p className="mb-8">Penerima,</p>
              <p className="border-t border-gray-400 pt-2">(______________)</p>
            </div>
            <div className="text-center text-xs">
              <p className="mb-8">Kepala Sekolah,</p>
              <p className="border-t border-gray-400 pt-2">(______________)</p>
            </div>
          </div>
        </div>

        {/* Print Info */}
        <div className="mt-6 text-center text-xs text-gray-500 border-t border-gray-300 pt-4">
          <p>Dokumen ini dicetak otomatis oleh sistem</p>
          <p>Tanggal Cetak: {format(tanggalBayar, "dd/MM/yyyy HH:mm")}</p>
        </div>
      </div>
    </div>
  );
}
