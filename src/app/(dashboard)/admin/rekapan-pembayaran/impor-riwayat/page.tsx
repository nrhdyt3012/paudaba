// PATH SARAN: app/admin/rekapan-pembayaran/impor-riwayat/page.tsx
// Ini menggantikan dialog kecil sebelumnya — sekarang jadi halaman penuh
// dengan 4 tahap yang sama: Master Tagihan -> Periode & Tanggal -> Pilih
// Siswa -> Nominal, Tanggal & Metode per siswa. File import-riwayat-dialog.tsx
// yang lama bisa dihapus kalau tombolnya di halaman Rekapan Pembayaran sudah
// diarahkan ke route ini (lihat revisi rekapan-pembayaran-page.tsx).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  Check,
  ChevronsUpDown,
  History,
  Users,
  CalendarDays,
  ArrowLeft,
  Wallet,
} from "lucide-react";
import { convertIDR } from "@/lib/utils";
// Sesuaikan path ini dengan lokasi file actions.ts (lihat rekapan-pembayaran-actions.ts)
import { importRiwayatPembayaran } from "@/app/(dashboard)/admin/rekapan-pembayaran/actions";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const TAHUN_OPTIONS = Array.from({ length: 8 }, (_, i) => {
  const y = new Date().getFullYear() - 6 + i;
  return { value: y, label: y.toString() };
});

const KELAS_OPTIONS = [
  { value: "semua", label: "Semua Kelas" },
  { value: "KB", label: "KB" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

// BARU: metode pembayaran untuk data impor — cuma 2 opsi, sama seperti
// metode pembayaran normal di sistem (cash / transfer).
const METODE_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Transfer" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

// BARU: pengganti <input type="date"> bawaan browser. Native date picker
// menampilkan teks sesuai locale browser/OS pengguna (bisa MM/DD/YYYY di
// sebagian browser) dan itu TIDAK bisa dipaksa lewat atribut HTML apa pun
// (termasuk `lang`) — jadi biar kalender tetap ada (bisa klik tanggal,
// tombol "Hari Ini", dst.) tapi teks yang tampil di kotaknya dijamin selalu
// dd/MM/yyyy, kalender ini dibuat sendiri pakai Popover + Calendar dari
// shadcn/ui, lalu label tombolnya diformat manual dengan date-fns.
// Value & onChange tetap pakai string ISO (yyyy-mm-dd) supaya kompatibel
// dengan sisa kode yang sudah ada.
function TanggalInputID({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? new Date(`${value}T00:00:00`) : undefined;

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    onChange(`${y}-${m}-${day}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`w-full justify-start font-normal ${compact ? "h-8 text-sm px-2" : "h-9"}`}
        >
          <CalendarDays className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {/* BARU: diformat manual dd/MM/yyyy — tidak pernah ikut locale
              browser, jadi klik "Hari Ini" pun tetap tampil 10/09/2026,
              bukan 09/10/2026. */}
          {dateValue ? format(dateValue, "dd/MM/yyyy") : "Pilih tanggal"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          locale={localeID}
        />
        <div className="flex justify-end gap-2 p-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(new Date())}
          >
            Hari Ini
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type MetodePembayaran = "cash" | "transfer";

type RowInput = {
  siswaId: string;
  namaSiswa: string;
  kelas: string;
  nominal: string;
  tanggal: string;
  // BARU: metode pembayaran per siswa/baris
  metode: MetodePembayaran;
};

export default function ImporRiwayatPembayaranPage() {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isPending, setIsPending] = useState(false);

  // Step 1 — Master Tagihan
  const [selectedMaster, setSelectedMaster] = useState("");
  const [searchMaster, setSearchMaster] = useState("");
  const [showDropdownMaster, setShowDropdownMaster] = useState(false);
  const dropdownMasterRef = useRef<HTMLDivElement>(null);

  // Step 2 — Periode & tanggal default
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [globalTanggal, setGlobalTanggal] = useState(todayIso());
  // BARU: metode default (dipakai saat baris baru pertama kali dibuat &
  // untuk tombol "Terapkan ke semua baris")
  const [globalMetode, setGlobalMetode] = useState<MetodePembayaran>("cash");

  // Step 3 — Pilih siswa
  const [filterKelas, setFilterKelas] = useState("semua");
  const [searchSiswa, setSearchSiswa] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([]);

  // Step 4 — baris nominal, tanggal & metode per siswa terpilih
  const [rows, setRows] = useState<RowInput[]>([]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownMasterRef.current &&
        !dropdownMasterRef.current.contains(e.target as Node)
      ) {
        setShowDropdownMaster(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Data: master tagihan (searchable) ─────────────────────────────────
  const { data: masterList, isLoading: loadingMaster } = useQuery({
    queryKey: ["master-tagihan-impor-riwayat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("master_tagihan")
        .select("*")
        .order("namatagihan");
      return data || [];
    },
  });

  const masterSelected = masterList?.find(
    (m: any) => m.id_mastertagihan?.toString() === selectedMaster
  );

  const searchResultsMaster = useMemo(() => {
    const list = masterList || [];
    if (!searchMaster.trim()) return list;
    const q = searchMaster.toLowerCase();
    return list.filter(
      (m: any) =>
        m.namatagihan?.toLowerCase().includes(q) ||
        m.jenjang?.toLowerCase().includes(q)
    );
  }, [masterList, searchMaster]);

  // ─── Data: siswa aktif (TIDAK difilter "sudah punya tagihan atau belum") ─
  const { data: siswaList, isLoading: loadingSiswa } = useQuery({
    queryKey: ["siswa-impor-riwayat", filterKelas, searchSiswa],
    enabled: !!selectedMaster,
    queryFn: async () => {
      let q = supabase
        .from("siswa")
        .select("id, namasiswa, kelas, nis")
        .eq("is_active", true)
        .eq("status", "aktif")
        .order("kelas")
        .order("namasiswa");
      if (filterKelas !== "semua") q = q.eq("kelas", filterKelas);
      if (searchSiswa) q = q.ilike("namasiswa", `%${searchSiswa}%`);
      const { data } = await q;
      return data || [];
    },
  });

  // ─── Data: status tagihan yang sudah ada, untuk badge, default nominal,
  // dan untuk menentukan siswa mana yang sudah LUNAS (di-disable) ─────────
  const { data: existingTagihanMap } = useQuery({
    queryKey: ["tagihan-existing-impor-riwayat", selectedMaster, selectedBulan, selectedTahun],
    enabled: !!selectedMaster,
    queryFn: async () => {
      const { data } = await supabase
        .from("tagihan_siswa")
        .select("idsiswa, jumlahterbayar, jumlahtagihan, statuspembayaran")
        .eq("idmastertagihan", parseInt(selectedMaster))
        .eq("bulan", selectedBulan)
        .eq("tahun", selectedTahun);
      const map: Record<string, any> = {};
      (data || []).forEach((t: any) => {
        map[t.idsiswa] = t;
      });
      return map;
    },
  });

  const siswaByKelas = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (siswaList || []).forEach((s: any) => {
      const k = s.kelas || "Lainnya";
      if (!groups[k]) groups[k] = [];
      groups[k].push(s);
    });
    return groups;
  }, [siswaList]);

  // BARU: helper — siswa dianggar tidak bisa dipilih kalau tagihan untuk
  // kombinasi master/bulan/tahun yang sedang aktif sudah berstatus LUNAS.
  const isSiswaLunas = (idsiswa: string) =>
    existingTagihanMap?.[idsiswa]?.statuspembayaran === "LUNAS";

  // ─── Sinkronkan rows setiap kali daftar siswa terpilih berubah ────────
  useEffect(() => {
    setRows((prev) => {
      const prevMap = new Map(prev.map((r) => [r.siswaId, r]));
      return selectedSiswa.map((id) => {
        if (prevMap.has(id)) return prevMap.get(id)!;
        const siswa = (siswaList || []).find((s: any) => s.id === id);
        const existing = existingTagihanMap?.[id];
        const totalTagihan = parseFloat(masterSelected?.nominal || "0");
        const sudahDibayar = existing ? parseFloat(existing.jumlahterbayar || "0") : 0;
        const sisaDefault = Math.max(0, totalTagihan - sudahDibayar);
        return {
          siswaId: id,
          namaSiswa: siswa?.namasiswa || "-",
          kelas: siswa?.kelas || "-",
          nominal: (sisaDefault > 0 ? sisaDefault : totalTagihan).toString(),
          tanggal: globalTanggal,
          metode: globalMetode,
        };
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [selectedSiswa, masterSelected, existingTagihanMap, siswaList]);

  // BARU: kalau existingTagihanMap berubah (ganti master/bulan/tahun) dan
  // ternyata ada siswa yang SUDAH terpilih tapi statusnya sekarang LUNAS,
  // keluarkan otomatis dari seleksi — supaya tidak nyangkut sampai Step 4.
  useEffect(() => {
    if (!existingTagihanMap) return;
    setSelectedSiswa((prev) => prev.filter((id) => !isSiswaLunas(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTagihanMap]);

  const handlePilihMaster = (master: any) => {
    setSelectedMaster(master.id_mastertagihan?.toString());
    setSearchMaster("");
    setShowDropdownMaster(false);
    setSelectedSiswa([]);

    // BARU: otomatis sesuaikan filter kelas di Step 3 dengan jenjang pada
    // master tagihan yang dipilih (KB / TK A / TK B). Kalau jenjang master
    // tidak cocok salah satu kelas yang ada, filter dikembalikan ke
    // "Semua Kelas" supaya tidak salah menyembunyikan siswa.
    const jenjangMaster = (master.jenjang || "").trim().toUpperCase();
    const kelasCocok = KELAS_OPTIONS.find(
      (opt) => opt.value !== "semua" && opt.value.toUpperCase() === jenjangMaster
    );
    setFilterKelas(kelasCocok ? kelasCocok.value : "semua");
  };

  const handleClearMaster = () => {
    setSelectedMaster("");
    setFilterKelas("semua");
    setSelectedSiswa([]);
    setRows([]);
  };

  // BARU: siswa berstatus LUNAS tidak bisa ditoggle sama sekali.
  const handleToggleSiswa = (id: string) => {
    if (isSiswaLunas(id)) return;
    setSelectedSiswa((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // BARU: "pilih semua per kelas" hanya menghitung & menyeleksi siswa yang
  // belum LUNAS — siswa LUNAS dilewati sepenuhnya.
  const handleSelectKelas = (kelas: string) => {
    const idsSelectable = (siswaByKelas[kelas] || [])
      .map((s: any) => s.id)
      .filter((id: string) => !isSiswaLunas(id));
    if (idsSelectable.length === 0) return;
    const allSelected = idsSelectable.every((id) => selectedSiswa.includes(id));
    setSelectedSiswa((prev) =>
      allSelected
        ? prev.filter((id) => !idsSelectable.includes(id))
        : [...new Set([...prev, ...idsSelectable])]
    );
  };

  const updateRow = (siswaId: string, patch: Partial<RowInput>) => {
    setRows((prev) =>
      prev.map((r) => (r.siswaId === siswaId ? { ...r, ...patch } : r))
    );
  };

  const applyTanggalKeSemua = () => {
    setRows((prev) => prev.map((r) => ({ ...r, tanggal: globalTanggal })));
  };

  const applyNominalPenuhKeSemua = () => {
    const totalTagihan = parseFloat(masterSelected?.nominal || "0");
    setRows((prev) => prev.map((r) => ({ ...r, nominal: totalTagihan.toString() })));
  };

  // BARU: terapkan metode default (dari Step 2) ke semua baris di Step 4
  const applyMetodeKeSemua = () => {
    setRows((prev) => prev.map((r) => ({ ...r, metode: globalMetode })));
  };

  const totalNominalDiisi = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.nominal) || 0), 0),
    [rows]
  );

  const handleSubmit = async () => {
    if (!selectedMaster) {
      toast.error("Pilih master tagihan terlebih dahulu");
      return;
    }
    if (!rows.length) {
      toast.error("Pilih minimal 1 siswa");
      return;
    }
    const rowTidakValid = rows.find(
      (r) => !r.nominal || parseFloat(r.nominal) <= 0 || !r.tanggal || !r.metode
    );
    if (rowTidakValid) {
      toast.error(`Nominal, tanggal, atau metode untuk ${rowTidakValid.namaSiswa} belum valid`);
      return;
    }

    setIsPending(true);
    const result = await importRiwayatPembayaran({
      idmastertagihan: parseInt(selectedMaster),
      bulan: selectedBulan,
      tahun: selectedTahun,
      rows: rows.map((r) => ({
        idsiswa: r.siswaId,
        jumlahdibayar: parseFloat(r.nominal),
        tanggalpembayaran: new Date(r.tanggal).toISOString(),
        // BARU: metode pembayaran per siswa dikirim ke server, menggantikan
        // metode statis "import data lama" — datanya sekarang konsisten
        // dengan pembayaran normal yang cuma punya 2 opsi: cash / transfer.
        metodepembayaran: r.metode,
      })),
    });
    setIsPending(false);

    if (result.status === "error") {
      toast.error("Gagal mengimpor data", {
        description: result.errors?._form?.[0],
      });
      return;
    }

    toast.success(`Berhasil mengimpor ${result.data?.berhasil ?? rows.length} pembayaran`, {
      description:
        result.data?.gagal && result.data.gagal > 0
          ? `${result.data.gagal} data gagal, cek kembali`
          : undefined,
    });

    queryClient.invalidateQueries({ queryKey: ["rekapan-pembayaran"] });
    queryClient.invalidateQueries({ queryKey: ["chart-pembayaran"] });
    queryClient.invalidateQueries({ queryKey: ["rekapan-tunggakan"] });
    queryClient.invalidateQueries({ queryKey: ["chart-tunggakan"] });

    router.push("/admin/rekapan-pembayaran");
  };

  return (
    <div className="w-full space-y-6 pb-10">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/rekapan-pembayaran")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Impor Riwayat Pembayaran</h1>
          <p className="text-sm text-muted-foreground">
            Untuk mencatat pembayaran yang sudah terjadi sebelum sistem ini dipakai
          </p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
        Data akan langsung berstatus <strong>SUCCESS</strong> dan{" "}
        <strong>tidak mengirim notifikasi WhatsApp</strong> ke wali murid.
      </div>

      {/* Step 1 — Master Tagihan */}
      <Card className="gap-3">
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">1</span>
            Master Tagihan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedMaster ? (
            <div className="relative w-full" ref={dropdownMasterRef}>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Klik untuk lihat semua, atau ketik untuk mencari..."
                  value={searchMaster}
                  onChange={(e) => {
                    setSearchMaster(e.target.value);
                    setShowDropdownMaster(true);
                  }}
                  onFocus={() => setShowDropdownMaster(true)}
                  className="pl-9 pr-9 w-full"
                  autoFocus
                />
                <ChevronsUpDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {showDropdownMaster && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
                  {loadingMaster ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
                    </div>
                  ) : searchResultsMaster.length === 0 ? (
                    <div className="py-6 px-4 text-center text-sm text-muted-foreground">
                      Tidak ada master tagihan yang cocok
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0">
                      {searchResultsMaster.map((master: any, idx: number) => (
                        <div
                          key={master.id_mastertagihan}
                          onClick={() => handlePilihMaster(master)}
                          className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors border-b sm:border-r ${
                            idx % 2 === 1 ? "sm:border-r-0" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{master.namatagihan}</p>
                            <p className="text-xs text-muted-foreground">
                              {master.jenjang} · {master.jenistagihan}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-green-700 dark:text-green-400 shrink-0 ml-4">
                            {convertIDR(parseFloat(master.nominal || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-800 w-full">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-green-800 dark:text-green-200 truncate">
                  {masterSelected?.namatagihan}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  {masterSelected?.jenjang} · {convertIDR(parseFloat(masterSelected?.nominal || 0))}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearMaster} className="shrink-0 h-8">
                Ganti
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — Periode, tanggal & metode default */}
      {selectedMaster && (
        <Card className="gap-3">
          <CardHeader className="pb-1">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">2</span>
              Periode Tagihan, Tanggal & Metode Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
              <div className="space-y-1.5">
                <Label className="text-xs">Bulan</Label>
                <Select value={selectedBulan.toString()} onValueChange={(v) => setSelectedBulan(parseInt(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BULAN_NAMA.slice(1).map((nama, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tahun</Label>
                <Select value={selectedTahun.toString()} onValueChange={(v) => setSelectedTahun(parseInt(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAHUN_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value.toString()}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Tanggal Pembayaran (default)
                </Label>
                <TanggalInputID value={globalTanggal} onChange={setGlobalTanggal} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Metode Pembayaran (default)
                </Label>
                <Select value={globalMetode} onValueChange={(v) => setGlobalMetode(v as MetodePembayaran)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {rows.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button type="button" variant="outline" size="sm" onClick={applyTanggalKeSemua}>
                  Terapkan tanggal ke semua baris
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={applyMetodeKeSemua}>
                  Terapkan metode ke semua baris
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Pilih siswa */}
      {selectedMaster && (
        <Card className="gap-3">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">3</span>
                Pilih Siswa
                {selectedSiswa.length > 0 && (
                  <Badge className="bg-green-600 text-white text-xs">{selectedSiswa.length} dipilih</Badge>
                )}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterKelas} onValueChange={setFilterKelas}>
                  <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KELAS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama siswa..."
                    className="pl-7 h-9 text-sm"
                    value={searchSiswa}
                    onChange={(e) => setSearchSiswa(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {/* BARU: penjelasan singkat kenapa sebagian siswa tampak pudar */}
            <p className="text-[11px] text-muted-foreground mt-1">
              Siswa yang sudah <span className="font-medium">Lunas</span> untuk periode & tagihan ini otomatis dipudarkan dan tidak bisa dipilih.
            </p>
          </CardHeader>
          <CardContent>
            {loadingSiswa ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
              </div>
            ) : Object.keys(siswaByKelas).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Tidak ada siswa yang cocok
              </p>
            ) : (
              <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                {Object.entries(siswaByKelas).map(([kelas, siswaKelas]) => {
                  const idsAll = (siswaKelas as any[]).map((s) => s.id);
                  const idsSelectable = idsAll.filter((id) => !isSiswaLunas(id));
                  const allChecked =
                    idsSelectable.length > 0 && idsSelectable.every((id) => selectedSiswa.includes(id));
                  return (
                    <div key={kelas}>
                      <div
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50 mb-1.5 ${
                          idsSelectable.length > 0 ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed"
                        }`}
                        onClick={() => handleSelectKelas(kelas)}
                      >
                        <Checkbox checked={allChecked} disabled={idsSelectable.length === 0} />
                        <p className="text-xs font-bold uppercase tracking-wider flex-1">{kelas}</p>
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 pl-1">
                        {(siswaKelas as any[]).map((s: any) => {
                          const isChecked = selectedSiswa.includes(s.id);
                          const existing = existingTagihanMap?.[s.id];
                          const isLunas = existing?.statuspembayaran === "LUNAS";
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleToggleSiswa(s.id)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all ${
                                isLunas
                                  ? "opacity-40 cursor-not-allowed border-transparent grayscale"
                                  : isChecked
                                  ? "border-green-400 bg-green-50 dark:bg-green-950/40 dark:border-green-700 cursor-pointer"
                                  : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50 cursor-pointer"
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                disabled={isLunas}
                                onCheckedChange={() => handleToggleSiswa(s.id)}
                              />
                              <p className="text-sm truncate flex-1">{s.namasiswa}</p>
                              {isLunas && (
                                <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 shrink-0">
                                  Sudah Lunas
                                </Badge>
                              )}
                              {existing && !isLunas && (
                                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                                  Ada Tunggakan
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Nominal, Tanggal & Metode per siswa */}
      {rows.length > 0 && (
        <Card className="gap-3">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">4</span>
                Nominal, Tanggal & Metode per Siswa
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={applyNominalPenuhKeSemua}>
                Isi nominal penuh untuk semua
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {rows.map((r) => {
                const totalTagihan = parseFloat(masterSelected?.nominal || "0");
                const existing = existingTagihanMap?.[r.siswaId];
                const sudahDibayarSebelumnya = existing ? parseFloat(existing.jumlahterbayar || "0") : 0;
                const nominalNum = parseFloat(r.nominal) || 0;
                const sisaSetelah = Math.max(0, totalTagihan - sudahDibayarSebelumnya - nominalNum);
                const lunas = sisaSetelah <= 0;
                return (
                  <div
                    key={r.siswaId}
                    className="p-3 rounded-lg border grid grid-cols-2 sm:grid-cols-[1fr_110px_200px_110px_90px] gap-2 items-end"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-[11px] text-muted-foreground">Siswa</Label>
                      <p className="text-sm font-medium truncate">{r.namaSiswa}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nominal</Label>
                      <Input
                        type="number"
                        min={1}
                        value={r.nominal}
                        onChange={(e) => updateRow(r.siswaId, { nominal: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Tanggal</Label>
                      <TanggalInputID
                        value={r.tanggal}
                        onChange={(v) => updateRow(r.siswaId, { tanggal: v })}
                        compact
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Metode</Label>
                      <Select
                        value={r.metode}
                        onValueChange={(v) => updateRow(r.siswaId, { metode: v as MetodePembayaran })}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {METODE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge className={lunas ? "bg-green-600 text-white text-[10px] justify-center" : "bg-orange-500 text-white text-[10px] justify-center"}>
                      {lunas ? "Lunas" : `Sisa ${convertIDR(sisaSetelah)}`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Footer aksi ─────────────────────────────────────────────────── */}
      <div className="border-t bg-background/95 backdrop-blur-sm px-4 py-3 rounded-lg">
        <div className="flex items-center justify-end gap-4 flex-wrap">
          {rows.length > 0 && (
            <div className="text-sm mr-auto text-right">
              <span className="text-muted-foreground">{rows.length} siswa · </span>
              <span className="font-bold text-green-700 dark:text-green-400">
                {convertIDR(totalNominalDiisi)}
              </span>
            </div>
          )}
          <Button variant="outline" onClick={() => router.push("/admin/rekapan-pembayaran")} disabled={isPending}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !rows.length}
            className="bg-green-600 hover:bg-green-700 min-w-[180px]"
          >
            {isPending ? (
              <><Loader2 className="animate-spin mr-2 h-4 w-4" />Menyimpan...</>
            ) : (
              <><Check className="mr-2 h-4 w-4" />Simpan Riwayat ({rows.length})</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}