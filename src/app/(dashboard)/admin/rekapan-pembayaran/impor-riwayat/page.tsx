// PATH SARAN: app/admin/rekapan-pembayaran/impor-riwayat/page.tsx
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
  Users,
  CalendarDays,
  ArrowLeft,
  Wallet,
} from "lucide-react";
import { convertIDR } from "@/lib/utils";
import { importRiwayatPembayaran } from "@/app/(dashboard)/admin/rekapan-pembayaran/actions";
import { parsePeriodeDariNama, getCakupanBulan, isTagihanSPP } from "@/lib/periode-tagihan";

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

const METODE_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Transfer" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

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
  nominalEdited: boolean; // BARU
  tanggal: string;
  metode: MetodePembayaran;
};

export default function ImporRiwayatPembayaranPage() {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isPending, setIsPending] = useState(false);

  // Step 1
  const [selectedMaster, setSelectedMaster] = useState("");
  const [searchMaster, setSearchMaster] = useState("");
  const [showDropdownMaster, setShowDropdownMaster] = useState(false);
  const dropdownMasterRef = useRef<HTMLDivElement>(null);

  // Step 2
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [periodeTerdeteksi, setPeriodeTerdeteksi] = useState(true);
  const [globalTanggal, setGlobalTanggal] = useState(todayIso());
  const [globalMetode, setGlobalMetode] = useState<MetodePembayaran>("cash");

  // Step 3
  const [filterKelas, setFilterKelas] = useState("semua");
  const [searchSiswa, setSearchSiswa] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([]);

  // Step 4
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

  // ─── Data: master tagihan ──────────────────────────────────────────────
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

  // ─── Data: siswa aktif ─────────────────────────────────────────────────
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

  // ─── Data: tagihan existing (REVISI: selalu segar) ─────────────────────
  const { data: existingTagihanMap, isFetching: fetchingExisting } = useQuery({
    queryKey: ["tagihan-existing-impor-riwayat", selectedMaster, selectedBulan, selectedTahun],
    enabled: !!selectedMaster,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
queryFn: async () => {
  const { data, error } = await supabase
    .from("tagihan_siswa")
    .select("idsiswa, jumlahterbayar, jumlahtagihan, statuspembayaran")
    .eq("idmastertagihan", parseInt(selectedMaster))
    .eq("bulan", selectedBulan)
    .eq("tahun", selectedTahun);
  if (error) {
    console.error("Gagal ambil tagihan existing:", error);
    throw error;
  }
      const map: Record<string, any> = {};
      (data || []).forEach((t: any) => {
        map[t.idsiswa] = t;
      });
      return map;
    },
  });

  const { data: tercakupIds } = useQuery({
  queryKey: ["tagihan-tercakup-impor-riwayat", selectedMaster, selectedBulan, selectedTahun],
  enabled: !!selectedMaster && isTagihanSPP(masterSelected?.namatagihan),
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: "always",
  queryFn: async () => {
    const cakupanBaru = getCakupanBulan(masterSelected?.namatagihan, selectedBulan);
    const { data, error } = await supabase
      .from("tagihan_siswa")
      .select("idsiswa, bulan, namatagihan, idmastertagihan")
      .ilike("namatagihan", "SPP%")
      .eq("tahun", selectedTahun)
      .or(`bulan.in.(${cakupanBaru.join(",")}),namatagihan.ilike.*Semester*`);
    if (error) {
      console.error("Gagal cek cakupan SPP:", error);
      throw error;
    }
    return (data || [])
      .filter((t: any) => {
        const tagihanSama =
          t.idmastertagihan === parseInt(selectedMaster) && t.bulan === selectedBulan;
        if (tagihanSama) return false; // yang sama ditangani existingTagihanMap
        return getCakupanBulan(t.namatagihan, t.bulan).some((b) => cakupanBaru.includes(b));
      })
      .map((t: any) => t.idsiswa as string);
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

  // after
const isSiswaLunas = (idsiswa: string) => {
  const t = existingTagihanMap?.[idsiswa];
  if (!t) return false;
  const status = (t.statuspembayaran || "").trim().toUpperCase();
  const total = parseFloat(t.jumlahtagihan || "0");
  const terbayar = parseFloat(t.jumlahterbayar || "0");
  return status === "LUNAS" || (total > 0 && terbayar >= total);
};

const isSiswaTercakup = (idsiswa: string) => (tercakupIds ?? []).includes(idsiswa);
const isSiswaTerkunci = (idsiswa: string) => isSiswaLunas(idsiswa) || isSiswaTercakup(idsiswa);

  // BARU: total & sisa tagihan per siswa
  const getTotalTagihan = (idsiswa: string) => {
    const existing = existingTagihanMap?.[idsiswa];
    return parseFloat(existing?.jumlahtagihan ?? masterSelected?.nominal ?? "0");
  };

  const getSisaTagihan = (idsiswa: string) => {
    const existing = existingTagihanMap?.[idsiswa];
    const terbayar = parseFloat(existing?.jumlahterbayar || "0");
    return Math.max(0, getTotalTagihan(idsiswa) - terbayar);
  };

  // ─── Sinkronkan rows (REVISI: tunggu data siap, ikuti sisa terbaru) ────
  useEffect(() => {
    if (!selectedMaster || fetchingExisting || !existingTagihanMap) return;

    setRows((prev) => {
      const prevMap = new Map(prev.map((r) => [r.siswaId, r]));
      return selectedSiswa.map((id) => {
        const sisa = getSisaTagihan(id).toString();
        const old = prevMap.get(id);
        if (old) {
          return old.nominalEdited ? old : { ...old, nominal: sisa };
        }
        const siswa = (siswaList || []).find((s: any) => s.id === id);
        return {
          siswaId: id,
          namaSiswa: siswa?.namasiswa || "-",
          kelas: siswa?.kelas || "-",
          nominal: sisa,
          nominalEdited: false,
          tanggal: globalTanggal,
          metode: globalMetode,
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiswa, masterSelected, existingTagihanMap, fetchingExisting, siswaList]);

// after
useEffect(() => {
  if (!existingTagihanMap) return;
  setSelectedSiswa((prev) => prev.filter((id) => !isSiswaTerkunci(id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [existingTagihanMap, tercakupIds]);

  const handlePilihMaster = (master: any) => {
    setSelectedMaster(master.id_mastertagihan?.toString());
    setSearchMaster("");
    setShowDropdownMaster(false);
    setSelectedSiswa([]);
    setRows([]);

    const periode = parsePeriodeDariNama(master.namatagihan);
setSelectedBulan(periode.bulan);
setSelectedTahun(periode.tahun);
setPeriodeTerdeteksi(periode.terdeteksi);
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

  const handleToggleSiswa = (id: string) => {
if (isSiswaTerkunci(id)) return;
    setSelectedSiswa((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSelectKelas = (kelas: string) => {
    const idsSelectable = (siswaByKelas[kelas] || [])
      .map((s: any) => s.id)
.filter((id: string) => !isSiswaTerkunci(id));
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

  // REVISI: isi dengan sisa tagihan per siswa
  const applyNominalPenuhKeSemua = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        nominal: getSisaTagihan(r.siswaId).toString(),
        nominalEdited: false,
      }))
    );
  };

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
    // BARU: tolak nominal melebihi sisa tagihan
    const rowMelebihiSisa = rows.find(
      (r) => parseFloat(r.nominal) > getSisaTagihan(r.siswaId)
    );
    if (rowMelebihiSisa) {
      toast.error(
        `Nominal ${rowMelebihiSisa.namaSiswa} melebihi sisa tagihan (${convertIDR(
          getSisaTagihan(rowMelebihiSisa.siswaId)
        )})`
      );
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
    queryClient.invalidateQueries({ queryKey: ["tagihan-existing-impor-riwayat"] }); // BARU

    router.push("/admin/rekapan-pembayaran");
  };

  return (
    <div className="w-full space-y-6 pb-10">
      {/* Header */}
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

      {/* Step 2 */}
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
<Select
  value={selectedBulan.toString()}
  onValueChange={(v) => {
    setSelectedBulan(parseInt(v));
    setPeriodeTerdeteksi(true);
    setSelectedSiswa([]);
    setRows([]);
  }}
>                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BULAN_NAMA.slice(1).map((nama, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tahun</Label>
<Select
  value={selectedTahun.toString()}
  onValueChange={(v) => {
    setSelectedTahun(parseInt(v));
    setPeriodeTerdeteksi(true);
    setSelectedSiswa([]);
    setRows([]);
  }}
>                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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

      {/* Step 3 */}
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
const idsSelectable = idsAll.filter((id) => !isSiswaTerkunci(id));                  const allChecked =
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
 // after
const existing = existingTagihanMap?.[s.id];
const isLunas = isSiswaLunas(s.id);
const isTercakup = !isLunas && isSiswaTercakup(s.id);
const isTerkunci = isLunas || isTercakup;
return (
  <div
    key={s.id}
    onClick={() => handleToggleSiswa(s.id)}
    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all ${
      isTerkunci
        ? "opacity-40 cursor-not-allowed border-transparent grayscale"
                                  : isChecked
                                  ? "border-green-400 bg-green-50 dark:bg-green-950/40 dark:border-green-700 cursor-pointer"
                                  : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50 cursor-pointer"
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                disabled={isTerkunci}
                                onCheckedChange={() => handleToggleSiswa(s.id)}
                              />
                              <p className="text-sm truncate flex-1">{s.namasiswa}</p>
                              {isLunas && (
                                <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 shrink-0">
                                  Sudah Lunas
                                </Badge>
                              )}
                              {isTercakup && (
  <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700 shrink-0">
    Tercakup SPP Lain
  </Badge>
)}
{existing && !isLunas && !isTercakup && (
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

      {/* Step 4 */}
      {rows.length > 0 && (
        <Card className="gap-3">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">4</span>
                Nominal, Tanggal & Metode per Siswa
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={applyNominalPenuhKeSemua}>
                Isi sisa tagihan untuk semua
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {rows.map((r) => {
                const sisaAwal = getSisaTagihan(r.siswaId);
                const nominalNum = parseFloat(r.nominal) || 0;
                const sisaSetelah = Math.max(0, sisaAwal - nominalNum);
                const lunas = sisaSetelah <= 0;
                return (
                  <div
                    key={r.siswaId}
                    className="p-3 rounded-lg border grid grid-cols-2 sm:grid-cols-[1fr_110px_200px_110px_90px] gap-2 items-end"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-[11px] text-muted-foreground">Siswa</Label>
                      <p className="text-sm font-medium truncate">{r.namaSiswa}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Sisa sebelum bayar: {convertIDR(sisaAwal)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nominal</Label>
                      <Input
                        type="number"
                        min={1}
                        value={r.nominal}
                        onChange={(e) =>
                          updateRow(r.siswaId, { nominal: e.target.value, nominalEdited: true })
                        }
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

      {/* Footer aksi */}
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