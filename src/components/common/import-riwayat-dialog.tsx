// PATH SARAN: components/common/import-riwayat-dialog.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  X,
  ChevronsUpDown,
  History,
  Users,
  CalendarDays,
} from "lucide-react";
import { convertIDR } from "@/lib/utils";
// Sesuaikan path ini dengan lokasi file actions.ts yang berisi
// importRiwayatPembayaran (lihat rekapan-pembayaran-actions.ts)
import { importRiwayatPembayaran } from "@/app/(dashboard)/admin/rekapan-pembayaran/actions";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Rentang tahun untuk impor data historis — mundur lebih jauh dari form
// "Buat Tagihan" biasa karena tujuannya justru mencatat data lama.
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

const todayIso = () => new Date().toISOString().slice(0, 10);

type RowInput = {
  siswaId: string;
  namaSiswa: string;
  kelas: string;
  nominal: string;
  tanggal: string;
};

export default function ImportRiwayatDialog() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
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

  // Step 3 — Pilih siswa
  const [filterKelas, setFilterKelas] = useState("semua");
  const [searchSiswa, setSearchSiswa] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([]);

  // Step 4 — baris nominal & tanggal per siswa terpilih
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

  const resetAll = () => {
    setSelectedMaster("");
    setSearchMaster("");
    setSelectedBulan(new Date().getMonth() + 1);
    setSelectedTahun(new Date().getFullYear());
    setGlobalTanggal(todayIso());
    setFilterKelas("semua");
    setSearchSiswa("");
    setSelectedSiswa([]);
    setRows([]);
  };

  const closeDialog = (o: boolean) => {
    setOpen(o);
    if (!o) resetAll();
  };

  // ─── Data: master tagihan (searchable) ─────────────────────────────────
  const { data: masterList, isLoading: loadingMaster } = useQuery({
    queryKey: ["master-tagihan-impor-riwayat"],
    enabled: open,
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

  // ─── Data: siswa aktif (TIDAK difilter "sudah punya tagihan atau belum",
  // karena tujuan dialog ini justru mencatat siswa yang sudah bayar) ─────
  const { data: siswaList, isLoading: loadingSiswa } = useQuery({
    queryKey: ["siswa-impor-riwayat", filterKelas, searchSiswa],
    enabled: open && !!selectedMaster,
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

  // ─── Data: status tagihan yang sudah ada untuk kombinasi master+periode
  // ini, dipakai untuk kasih badge "Sudah Lunas" / "Ada Tunggakan" di grid
  // siswa, dan sebagai default nominal (sisa tagihan, bukan selalu penuh).
  const { data: existingTagihanMap } = useQuery({
    queryKey: ["tagihan-existing-impor-riwayat", selectedMaster, selectedBulan, selectedTahun],
    enabled: open && !!selectedMaster,
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
        };
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [selectedSiswa, masterSelected, existingTagihanMap, siswaList]);

  const handlePilihMaster = (master: any) => {
    setSelectedMaster(master.id_mastertagihan?.toString());
    setSearchMaster("");
    setShowDropdownMaster(false);
    setSelectedSiswa([]);
  };

  const handleClearMaster = () => {
    setSelectedMaster("");
    setSelectedSiswa([]);
    setRows([]);
  };

  const handleToggleSiswa = (id: string) => {
    setSelectedSiswa((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSelectKelas = (kelas: string) => {
    const ids = (siswaByKelas[kelas] || []).map((s: any) => s.id);
    const allSelected = ids.every((id) => selectedSiswa.includes(id));
    setSelectedSiswa((prev) =>
      allSelected
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
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
      (r) => !r.nominal || parseFloat(r.nominal) <= 0 || !r.tanggal
    );
    if (rowTidakValid) {
      toast.error(`Nominal atau tanggal untuk ${rowTidakValid.namaSiswa} belum valid`);
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
    closeDialog(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <History className="mr-2 h-4 w-4" />
        Impor Riwayat Pembayaran
      </Button>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-green-600" />
              Impor Riwayat Pembayaran
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Untuk mencatat pembayaran yang sudah terjadi sebelum sistem ini
            dipakai. Data akan langsung berstatus <strong>SUCCESS</strong> dan{" "}
            <strong>tidak mengirim notifikasi WhatsApp</strong> ke wali murid.
          </p>

          {/* Step 1 — Master Tagihan */}
          <Card className="gap-3">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[11px] shrink-0">1</span>
                Master Tagihan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedMaster ? (
                <div className="relative" ref={dropdownMasterRef}>
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
                      className="pl-9 pr-9"
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
                        <div className="max-h-56 overflow-y-auto divide-y">
                          {searchResultsMaster.map((master: any) => (
                            <div
                              key={master.id_mastertagihan}
                              onClick={() => handlePilihMaster(master)}
                              className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors"
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
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-800">
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

          {/* Step 2 — Periode & tanggal default */}
          {selectedMaster && (
            <Card className="gap-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[11px] shrink-0">2</span>
                  Periode Tagihan & Tanggal Pembayaran
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bulan</Label>
                    <Select value={selectedBulan.toString()} onValueChange={(v) => setSelectedBulan(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TAHUN_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value.toString()}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Tanggal Pembayaran (default untuk semua siswa)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={globalTanggal}
                      onChange={(e) => setGlobalTanggal(e.target.value)}
                      className="max-w-[200px]"
                    />
                    {rows.length > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={applyTanggalKeSemua}>
                        Terapkan ke semua baris
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3 — Pilih siswa */}
          {selectedMaster && (
            <Card className="gap-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[11px] shrink-0">3</span>
                  Pilih Siswa
                  {selectedSiswa.length > 0 && (
                    <Badge className="bg-green-600 text-white text-xs">{selectedSiswa.length} dipilih</Badge>
                  )}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Select value={filterKelas} onValueChange={setFilterKelas}>
                    <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KELAS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama siswa..."
                      className="pl-7 h-9 text-sm"
                      value={searchSiswa}
                      onChange={(e) => setSearchSiswa(e.target.value)}
                    />
                  </div>
                </div>
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
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                    {Object.entries(siswaByKelas).map(([kelas, siswaKelas]) => {
                      const ids = (siswaKelas as any[]).map((s) => s.id);
                      const allChecked = ids.every((id) => selectedSiswa.includes(id));
                      return (
                        <div key={kelas}>
                          <div
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer mb-1.5"
                            onClick={() => handleSelectKelas(kelas)}
                          >
                            <Checkbox checked={allChecked} />
                            <p className="text-xs font-bold uppercase tracking-wider flex-1">{kelas}</p>
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                            {(siswaKelas as any[]).map((s: any) => {
                              const isChecked = selectedSiswa.includes(s.id);
                              const existing = existingTagihanMap?.[s.id];
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => handleToggleSiswa(s.id)}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                                    isChecked
                                      ? "border-green-400 bg-green-50 dark:bg-green-950/40 dark:border-green-700"
                                      : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50"
                                  }`}
                                >
                                  <Checkbox checked={isChecked} onCheckedChange={() => handleToggleSiswa(s.id)} />
                                  <p className="text-sm truncate flex-1">{s.namasiswa}</p>
                                  {existing?.statuspembayaran === "LUNAS" && (
                                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 shrink-0">Sudah Lunas</Badge>
                                  )}
                                  {existing && existing.statuspembayaran !== "LUNAS" && (
                                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">Ada Tunggakan</Badge>
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

          {/* Step 4 — Nominal & tanggal per siswa */}
          {rows.length > 0 && (
            <Card className="gap-3">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[11px] shrink-0">4</span>
                    Nominal & Tanggal per Siswa
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={applyNominalPenuhKeSemua}>
                    Isi nominal penuh untuk semua
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {rows.map((r) => {
                    const totalTagihan = parseFloat(masterSelected?.nominal || "0");
                    const existing = existingTagihanMap?.[r.siswaId];
                    const sudahDibayarSebelumnya = existing ? parseFloat(existing.jumlahterbayar || "0") : 0;
                    const nominalNum = parseFloat(r.nominal) || 0;
                    const sisaSetelah = Math.max(0, totalTagihan - sudahDibayarSebelumnya - nominalNum);
                    const lunas = sisaSetelah <= 0;
                    return (
                      <div key={r.siswaId} className="p-2.5 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{r.namaSiswa}</p>
                          <Badge className={lunas ? "bg-green-600 text-white text-[10px]" : "bg-orange-500 text-white text-[10px]"}>
                            {lunas ? "Lunas" : `Sisa ${convertIDR(sisaSetelah)}`}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Nominal Dibayar</Label>
                            <Input
                              type="number"
                              min={1}
                              value={r.nominal}
                              onChange={(e) => updateRow(r.siswaId, { nominal: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Tanggal Bayar</Label>
                            <Input
                              type="date"
                              value={r.tanggal}
                              onChange={(e) => updateRow(r.siswaId, { tanggal: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <DialogFooter className="flex items-center justify-between gap-3 sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {rows.length > 0 && (
                <>
                  {rows.length} siswa ·{" "}
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {convertIDR(totalNominalDiisi)}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => closeDialog(false)} disabled={isPending}>
                <X className="h-4 w-4 mr-1.5" />
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !rows.length}
                className="bg-green-600 hover:bg-green-700"
              >
                {isPending ? (
                  <><Loader2 className="animate-spin mr-2 h-4 w-4" />Menyimpan...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Simpan Riwayat</>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}