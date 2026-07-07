"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { convertIDR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const first = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : v ?? undefined;

type SendStatus = "idle" | "pending" | "sending" | "success" | "failed";

// Jeda acak antar-pesan (per SISWA, bukan per tagihan) — tetap ikuti pola
// anti-banned Fonnte: 30-60 detik antar pesan.
const MIN_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60_000;
const randomDelay = () =>
  Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface SiswaGroup {
  idsiswa: string;
  namasiswa: string;
  kelas: string;
  nowa: string | null;
  tagihanIds: number[];
  daftarTagihan: string[]; // "SPP Juli 2026", dst
  nominalAsli: number;
  sisa: number;
}

export default function ReminderTunggakan() {
  const supabase = createClient();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, SendStatus>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const cancelRef = useRef(false);

  // ─── Ambil SEMUA tagihan yang statusnya masih tunggakan (semua periode,
  // bukan cuma bulan yang lagi dipilih di rekapan-tunggakan) ──────────────
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["reminder-tunggakan-raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tagihan_siswa")
        .select(`
          idtagihansiswa,
          jumlahtagihan,
          jumlahterbayar,
          statuspembayaran,
          bulan,
          tahun,
          siswa:siswa!idsiswa(id, namasiswa, kelas, nowa),
          master_tagihan:master_tagihan!idmastertagihan(namatagihan)
        `)
        .in("statuspembayaran", ["BELUM BAYAR", "BELUM LUNAS"])
        .order("tahun", { ascending: true })
        .order("bulan", { ascending: true });

      if (error) {
        toast.error("Gagal memuat data tunggakan", { description: error.message });
        return [];
      }
      return data || [];
    },
  });

  const BULAN_SINGKAT = [
    "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agt", "Sep", "Okt", "Nov", "Des",
  ];

  // ─── FIX poin 4: group by siswa di client, mirip pola siswaByKelas
  // yang sudah dipakai di halaman Buat Tagihan ──────────────────────────
  const groups: SiswaGroup[] = useMemo(() => {
    const map = new Map<string, SiswaGroup>();

    (rawData || []).forEach((item: any) => {
      const siswa = first(item.siswa);
      const master = first(item.master_tagihan);
      if (!siswa?.id) return;

      const sisa = Math.max(
        0,
        parseFloat(item.jumlahtagihan || "0") - parseFloat(item.jumlahterbayar || "0")
      );
      if (sisa <= 0) return;

      const label = `${master?.namatagihan || "Tagihan"} ${BULAN_SINGKAT[item.bulan] || item.bulan} ${item.tahun}`;

      if (!map.has(siswa.id)) {
        map.set(siswa.id, {
          idsiswa: siswa.id,
          namasiswa: siswa.namasiswa || "-",
          kelas: siswa.kelas || "-",
          nowa: siswa.nowa || null,
          tagihanIds: [],
          daftarTagihan: [],
          nominalAsli: 0,
          sisa: 0,
        });
      }

      const g = map.get(siswa.id)!;
      g.tagihanIds.push(item.idtagihansiswa);
      g.daftarTagihan.push(label);
      g.nominalAsli += parseFloat(item.jumlahtagihan || "0");
      g.sisa += sisa;
    });

    return Array.from(map.values()).sort((a, b) => b.sisa - a.sisa);
  }, [rawData]);

  const validGroups = groups.filter((g) => g.nowa && g.nowa.length >= 10);

  useEffect(() => {
    if (!isSending) {
      setSelectedIds(new Set(validGroups.map((g) => g.idsiswa)));
      setStatusMap({});
      setProgress({ done: 0, total: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === validGroups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validGroups.map((g) => g.idsiswa)));
    }
  };

  const totalSisaTerpilih = useMemo(
    () =>
      groups
        .filter((g) => selectedIds.has(g.idsiswa))
        .reduce((s, g) => s + g.sisa, 0),
    [groups, selectedIds]
  );

  const handleKirim = async () => {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal 1 siswa untuk ditagih");
      return;
    }

    setIsSending(true);
    cancelRef.current = false;
    const idsToSend = groups.filter((g) => selectedIds.has(g.idsiswa));

    const initial: Record<string, SendStatus> = {};
    idsToSend.forEach((g) => (initial[g.idsiswa] = "pending"));
    setStatusMap(initial);
    setProgress({ done: 0, total: idsToSend.length });

    let success = 0;
    let failed = 0;
    const final: Record<string, SendStatus> = { ...initial };

    for (let i = 0; i < idsToSend.length; i++) {
      if (cancelRef.current) {
        idsToSend.slice(i).forEach((g) => (final[g.idsiswa] = "idle"));
        setStatusMap({ ...final });
        break;
      }

      const g = idsToSend[i];
      final[g.idsiswa] = "sending";
      setStatusMap({ ...final });

      try {
        const res = await fetch("/api/notifications/send-bill-massal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idSiswa: g.idsiswa,
            idTagihanList: g.tagihanIds,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mengirim");
        final[g.idsiswa] = "success";
        success++;
      } catch {
        final[g.idsiswa] = "failed";
        failed++;
      }

      setStatusMap({ ...final });
      setProgress({ done: success + failed, total: idsToSend.length });

      if (i < idsToSend.length - 1 && !cancelRef.current) {
        await delay(randomDelay());
      }
    }

    setIsSending(false);

    if (cancelRef.current) {
      toast.info(`Dihentikan. Terkirim ${success}, sisanya dibatalkan.`);
    } else if (failed === 0) {
      toast.success(`Berhasil mengirim reminder ke ${success} wali siswa`);
    } else {
      toast.warning(`Terkirim ${success}, gagal ${failed}. Cek detail di daftar.`);
    }
  };

  const handleStop = () => {
    cancelRef.current = true;
  };

  const invalidCount = groups.length - validGroups.length;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Reminder Tunggakan via WhatsApp</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Daftar Siswa Menunggak
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (digabung per siswa, semua periode tertunggak)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invalidCount > 0 && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
              ⚠️ {invalidCount} siswa tidak memiliki nomor WhatsApp valid dan tidak
              akan otomatis tercentang.
            </div>
          )}

          {isSending && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
              <div className="flex justify-between text-xs text-blue-900">
                <span className="font-medium">Mengirim bertahap (jeda 30–60 detik/pesan)</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all duration-300"
                  style={{
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-blue-700">
                Estimasi sisa: ~{Math.ceil(((progress.total - progress.done) * 45) / 60)} menit.
                Proses tetap lanjut selama tab tidak ditutup.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
              >
                Hentikan Pengiriman
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between border-b pb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === validGroups.length}
                onCheckedChange={toggleSelectAll}
                disabled={isSending}
              />
              Pilih Semua ({validGroups.length} siswa bisa ditagih)
            </label>
            <span className="text-sm font-semibold">{selectedIds.size} dipilih</span>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Memuat data...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada tunggakan saat ini 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 w-10"></th>
                    <th className="text-left p-3">No</th>
                    <th className="text-left p-3">Nama Siswa</th>
                    <th className="text-left p-3">Tagihan</th>
                    <th className="text-right p-3">Nominal Asli</th>
                    <th className="text-right p-3">Sisa</th>
                    <th className="text-center p-3">Status Kirim</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => {
                    const isValid = g.nowa && g.nowa.length >= 10;
                    const status = statusMap[g.idsiswa];
                    return (
                      <tr
                        key={g.idsiswa}
                        className={`border-b hover:bg-muted/50 ${!isValid ? "opacity-50 bg-muted/30" : ""}`}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedIds.has(g.idsiswa)}
                            onCheckedChange={() => toggleSelect(g.idsiswa)}
                            disabled={!isValid || isSending}
                          />
                        </td>
                        <td className="p-3">{i + 1}</td>
                        <td className="p-3 font-medium">
                          {g.namasiswa}
                          <p className="text-xs text-muted-foreground">
                            {g.kelas} · {isValid ? g.nowa : "No. WA tidak tersedia"}
                          </p>
                        </td>
                        <td className="p-3 text-xs max-w-[240px]">
                          {g.daftarTagihan.join(", ")}
                        </td>
                        <td className="p-3 text-right">{convertIDR(g.nominalAsli)}</td>
                        <td className="p-3 text-right font-semibold text-red-600">
                          {convertIDR(g.sisa)}
                        </td>
                        <td className="p-3 text-center">
                          {status === "pending" && (
                            <span className="text-xs text-muted-foreground">menunggu</span>
                          )}
                          {status === "sending" && (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600 mx-auto" />
                          )}
                          {status === "success" && (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          )}
                          {status === "failed" && (
                            <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold bg-muted/30">
                    <td colSpan={5} className="p-3 text-right">Total Sisa Terpilih:</td>
                    <td className="p-3 text-right text-red-600">{convertIDR(totalSisaTerpilih)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {!isSending ? (
              <Button
                onClick={handleKirim}
                disabled={selectedIds.size === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Kirim ke {selectedIds.size} Wali
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
