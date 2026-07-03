"use client";

import { useState, useEffect, startTransition, useActionState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Info, Search, ChevronsUpDown, Check, X } from "lucide-react";
import { convertIDR } from "@/lib/utils";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTagihanBatch } from "../actions";

const INITIAL_STATE = { status: "idle", errors: { _form: [] } };

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function parsePeriodeFromNama(namaTagihan: string): { bulan: number; tahun: number } {
  const now = new Date();
  const defaultBulan = now.getMonth() + 1;
  const defaultTahun = now.getFullYear();
  if (!namaTagihan) return { bulan: defaultBulan, tahun: defaultTahun };
  const tahunMatch = namaTagihan.match(/(\d{4})/);
  const tahun = tahunMatch ? parseInt(tahunMatch[1]) : defaultTahun;
  const bulanMap: Record<string, number> = {
    Januari: 1, Februari: 2, Maret: 3, April: 4,
    Mei: 5, Juni: 6, Juli: 7, Agustus: 8,
    September: 9, Oktober: 10, November: 11, Desember: 12,
  };
  for (const [nama, num] of Object.entries(bulanMap)) {
    if (namaTagihan.includes(nama)) return { bulan: num, tahun };
  }
  if (namaTagihan.includes("Semester Ganjil")) return { bulan: 7, tahun };
  if (namaTagihan.includes("Semester Genap")) return { bulan: 1, tahun };
  return { bulan: defaultBulan, tahun };
}

export default function DialogCreateTagihan({ refetch }: { refetch: () => void }) {
  const supabase = createClient();

  // ─── State ────────────────────────────────────────────────────────────────
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<string>("");
  const [searchSiswa, setSearchSiswa] = useState("");
  const [searchMaster, setSearchMaster] = useState("");
  const [openMasterPicker, setOpenMasterPicker] = useState(false);
  const [selectedBulan, setSelectedBulan] = useState<number>(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState<number>(new Date().getFullYear());
  const searchMasterRef = useRef<HTMLInputElement>(null);

  const [state, action, isPending] = useActionState(createTagihanBatch, INITIAL_STATE);

  // ─── Master tagihan list ───────────────────────────────────────────────────
const {
  data: masterList = [],
  isLoading: loadingMaster,
} = useQuery({
    queryKey: ["master-tagihan-for-create"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_tagihan")
        .select("*")
        .order("jenjang")
        .order("namatagihan");
      if (error) toast.error("Gagal memuat master tagihan");
      return data || [];
    },
  });

  const masterSelected = masterList?.find(
    (m: any) => m.id_mastertagihan?.toString() === selectedMaster
  );

  // ─── Filter master tagihan berdasarkan search ──────────────────────────────
  const filteredMasterList = useMemo(() => {
    if (!searchMaster.trim()) return masterList || [];
    const q = searchMaster.toLowerCase();
    return (masterList || []).filter((m: any) =>
      m.namatagihan?.toLowerCase().includes(q) ||
      m.jenjang?.toLowerCase().includes(q) ||
      m.jenistagihan?.toLowerCase().includes(q)
    );
  }, [masterList, searchMaster]);

  // ─── Auto-focus search input saat popover terbuka ─────────────────────────
  useEffect(() => {
    if (openMasterPicker) {
      setTimeout(() => searchMasterRef.current?.focus(), 50);
    } else {
      setSearchMaster("");
    }
  }, [openMasterPicker]);

  // ─── Auto-fill bulan & tahun saat master dipilih ──────────────────────────
  useEffect(() => {
    if (masterSelected?.namatagihan) {
      const { bulan, tahun } = parsePeriodeFromNama(masterSelected.namatagihan);
      setSelectedBulan(bulan);
      setSelectedTahun(tahun);
      setSelectedSiswa([]);
    }
  }, [selectedMaster]);

  // ─── Siswa yang belum punya tagihan ini ───────────────────────────────────
  const { data: siswaList, isLoading: loadingSiswa } = useQuery({
    queryKey: ["siswa-for-tagihan", selectedMaster, selectedBulan, selectedTahun, searchSiswa],
    enabled: !!selectedMaster,
    queryFn: async () => {
      let siswaQuery = supabase
        .from("siswa")
        .select("id, namasiswa, kelas, nis")
        .eq("status", "aktif")
        .order("kelas")
        .order("namasiswa");
      if (searchSiswa) siswaQuery = siswaQuery.ilike("namasiswa", `%${searchSiswa}%`);
      const { data: semuaSiswa, error } = await siswaQuery;
      if (error) { toast.error("Gagal memuat siswa"); return []; }

      const { data: sudahTagihan } = await supabase
        .from("tagihan_siswa")
        .select("idsiswa")
        .eq("idmastertagihan", parseInt(selectedMaster))
        .eq("bulan", selectedBulan)
        .eq("tahun", selectedTahun);

      const sudahSet = new Set((sudahTagihan || []).map((t: any) => t.idsiswa));
      return (semuaSiswa || []).filter((s: any) => !sudahSet.has(s.id));
    },
  });

  const siswaByKelas = useMemo(() => {
    const groups: Record<string, any[]> = {};
    siswaList?.forEach((s: any) => {
      const k = s.kelas || "Lainnya";
      if (!groups[k]) groups[k] = [];
      groups[k].push(s);
    });
    return groups;
  }, [siswaList]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectMaster = (id: string) => {
    setSelectedMaster(id);
    setSelectedSiswa([]);
    setOpenMasterPicker(false);
  };

  const handleClearMaster = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMaster("");
    setSelectedSiswa([]);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedSiswa(checked ? (siswaList?.map((s: any) => s.id) || []) : []);
  };

  const handleSelectSiswa = (id: string, checked: boolean) => {
    setSelectedSiswa(checked ? [...selectedSiswa, id] : selectedSiswa.filter((s) => s !== id));
  };

  const handleSubmit = () => {
    if (!selectedMaster) { toast.error("Pilih jenis tagihan terlebih dahulu"); return; }
    if (!selectedSiswa.length) { toast.error("Pilih minimal 1 siswa"); return; }
    const formData = new FormData();
    formData.append("siswa_ids", JSON.stringify(selectedSiswa));
    formData.append("master_tagihan_id", selectedMaster);
    formData.append("bulan", selectedBulan.toString());
    formData.append("tahun", selectedTahun.toString());
    startTransition(() => { action(formData); });
  };

  useEffect(() => {
    if (state?.status === "error") {
      toast.error("Gagal membuat tagihan", { description: state.errors?._form?.[0] });
    }
    if (state?.status === "success") {
      toast.success(`Berhasil membuat ${selectedSiswa.length} tagihan`);
      document.querySelector<HTMLButtonElement>('[data-state="open"]')?.click();
      refetch();
      setSelectedSiswa([]);
      setSelectedMaster("");
    }
  }, [state]);

  const tahunOptions = Array.from({ length: 7 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return { value: y, label: y.toString() };
  });

  return (
    <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Buat Tagihan Siswa</DialogTitle>
        <DialogDescription>
          Cari dan pilih Master tagihan, lalu pilih siswa yang akan ditagih
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">

        {/* ─── Step 1: Pilih Master Tagihan via Combobox ──────────────────── */}
        <div>
          <h3 className="text-sm font-semibold mb-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs mr-2">1</span>
            Master Tagihan
          </h3>

          <Popover open={openMasterPicker} onOpenChange={setOpenMasterPicker}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm transition-colors
                  ${selectedMaster
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "border-input hover:border-gray-400 bg-background"
                  }`}
              >
                {selectedMaster && masterSelected ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="font-medium truncate">{masterSelected.namatagihan}</p>
                      <p className="text-xs text-muted-foreground">
                        {masterSelected.jenjang} · {masterSelected.jenistagihan} · {convertIDR(parseFloat(masterSelected.nominal || 0))}
                      </p>
                    </div>
                    {/* Tombol clear */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={handleClearMaster}
                      onKeyDown={(e) => e.key === "Enter" && handleClearMaster(e as any)}
                      className="ml-auto shrink-0 p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Cari atau pilih Master tagihan...
                  </span>
                )}
                {!selectedMaster && (
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
              sideOffset={4}
            >
              {/* Search box di dalam popover */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchMasterRef}
                    placeholder="Cari nama tagihan, jenjang..."
                    value={searchMaster}
                    onChange={(e) => setSearchMaster(e.target.value)}
                    className="pl-8 h-8 text-sm border-0 focus-visible:ring-0 shadow-none"
                  />
                </div>
              </div>

              {/* Hasil pencarian */}
              <div className="max-h-64 overflow-y-auto">
                {loadingMaster ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
                  </div>
                ) : filteredMasterList.length === 0 ? (
                  <div className="py-5 px-4 text-center space-y-1.5">
                    <p className="text-sm font-medium text-muted-foreground">
                      {searchMaster
                        ? `Tagihan "${searchMaster}" tidak ditemukan`
                        : "Belum ada master tagihan"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {searchMaster
                        ? "Coba kata kunci lain, atau buat master tagihan baru di menu "
                        : "Silakan buat master tagihan terlebih dahulu di menu "}
                      <span className="font-semibold text-foreground">Master Tagihan</span>
                      {searchMaster ? "." : " sebelum menerbitkan tagihan siswa."}
                    </p>
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredMasterList.map((master: any) => {
                      const isSelected = selectedMaster === master.id_mastertagihan?.toString();
                      return (
                        <div
                          key={master.id_mastertagihan}
                          onClick={() => handleSelectMaster(master.id_mastertagihan?.toString())}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{master.namatagihan}</p>
                            <p className="text-xs text-muted-foreground">
                              {master.jenjang} · {master.jenistagihan}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                              {convertIDR(parseFloat(master.nominal || 0))}
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-green-600" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer info jumlah */}
              {!loadingMaster && masterList?.length > 0 && (
                <div className="px-3 py-2 border-t text-xs text-muted-foreground">
                  {filteredMasterList.length} dari {masterList.length} jenis tagihan
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* ─── Step 2: Periode (autofill) ─────────────────────────────────── */}
        {selectedMaster && (
          <div>
            <h3 className="text-sm font-semibold mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs mr-2">2</span>
              Periode Tagihan
            </h3>
            <div className="rounded-lg border border-dashed border-muted-foreground/40 p-3 bg-muted/20 space-y-3">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Periode diisi otomatis dari nama tagihan. Ubah jika diperlukan.</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bulan</Label>
                  <Select
                    value={selectedBulan.toString()}
                    onValueChange={(v) => { setSelectedBulan(parseInt(v)); setSelectedSiswa([]); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BULAN_NAMA.slice(1).map((nama, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>{nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tahun</Label>
                  <Select
                    value={selectedTahun.toString()}
                    onValueChange={(v) => { setSelectedTahun(parseInt(v)); setSelectedSiswa([]); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tahunOptions.map((t) => (
                        <SelectItem key={t.value} value={t.value.toString()}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Preview nominal ────────────────────────────────────────────────
        {masterSelected && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardContent className="pt-4 pb-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nominal per siswa:</span>
                <span className="font-bold text-green-700 dark:text-green-400">
                  {convertIDR(parseFloat(masterSelected.nominal || 0))}
                </span>
              </div>
              {selectedSiswa.length > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">
                    Total ({selectedSiswa.length} siswa):
                  </span>
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {convertIDR(parseFloat(masterSelected.nominal || 0) * selectedSiswa.length)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )} */}

        {/* ─── Step 3: Pilih Siswa ──────────────────────────────────────────── */}
        {selectedMaster && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs mr-2">3</span>
                Pilih Siswa
                <span className="text-muted-foreground font-normal ml-1">
                  ({selectedSiswa.length} dipilih)
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari siswa..."
                    className="w-36 h-8 pl-7 text-sm"
                    onChange={(e) => setSearchSiswa(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleSelectAll(selectedSiswa.length === 0)}
                >
                  {selectedSiswa.length === siswaList?.length && siswaList?.length > 0
                    ? "Batal Semua"
                    : "Pilih Semua"}
                </Button>
              </div>
            </div>

            {loadingSiswa ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="max-h-56 overflow-y-auto border rounded-lg p-2 space-y-3">
                {Object.keys(siswaByKelas).length === 0 ? (
                  <div className="text-center py-6 space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Semua siswa sudah memiliki tagihan ini
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tidak ada siswa yang perlu ditagih untuk periode{" "}
                      {BULAN_NAMA[selectedBulan]} {selectedTahun}
                    </p>
                  </div>
                ) : (
                  Object.entries(siswaByKelas).map(([kelas, siswaKelas]) => (
                    <div key={kelas}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-1">
                        {kelas}
                      </p>
                      <div className="space-y-1">
                        {(siswaKelas as any[]).map((s: any) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleSelectSiswa(s.id, !selectedSiswa.includes(s.id))}
                          >
                            <Checkbox
                              checked={selectedSiswa.includes(s.id)}
                              onCheckedChange={(c) => handleSelectSiswa(s.id, c as boolean)}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{s.namasiswa}</p>
                              {s.nis && (
                                <p className="text-xs text-muted-foreground">NIS: {s.nis}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Placeholder sebelum tagihan dipilih */}
        {!selectedMaster && (
          <div className="border border-dashed rounded-lg p-8 text-center space-y-2">
            <Search className="h-8 w-8 text-muted-foreground/50 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Cari dan pilih jenis tagihan di atas untuk melihat daftar siswa
            </p>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 mt-4">
        <DialogClose asChild>
          <Button variant="outline">Batal</Button>
        </DialogClose>
        <Button
          onClick={handleSubmit}
          disabled={isPending || selectedSiswa.length === 0 || !selectedMaster}
          className="bg-green-600 hover:bg-green-700"
        >
          {isPending ? (
            <><Loader2 className="animate-spin mr-2 h-4 w-4" />Membuat...</>
          ) : (
            `Buat Tagihan (${selectedSiswa.length} Siswa)`
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}