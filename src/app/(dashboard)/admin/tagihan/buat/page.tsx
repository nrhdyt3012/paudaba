"use client";

import {
  useState, useEffect, startTransition,
  useActionState, useMemo, useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Search, Check, X, Info,
  ArrowLeft, Users, FileText, ChevronRight, Pencil,
} from "lucide-react";
import { convertIDR } from "@/lib/utils";
import { createTagihanBatch } from "../actions";
import { useRouter } from "next/navigation";

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const TAHUN_OPTIONS = Array.from({ length: 7 }, (_, i) => {
  const y = new Date().getFullYear() - 2 + i;
  return { value: y, label: y.toString() };
});

const KELAS_OPTIONS = [
  { value: "semua", label: "Semua Kelas" },
  { value: "KB", label: "KB" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

const TIPE_SPP_OPTIONS = [
  { value: "semua", label: "Semua Tipe" },
  { value: "reguler", label: "Reguler" },
  { value: "subsidi", label: "Subsidi" },
];

function parsePeriodeFromNama(namaTagihan: string): { bulan: number; tahun: number } {
  const now = new Date();
  if (!namaTagihan) return { bulan: now.getMonth() + 1, tahun: now.getFullYear() };
  const tahunMatch = namaTagihan.match(/(\d{4})/);
  const tahun = tahunMatch ? parseInt(tahunMatch[1]) : now.getFullYear();
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
  return { bulan: now.getMonth() + 1, tahun };
}

function getAutoTipeSPP(namaTagihan: string): "reguler" | "subsidi" | null {
  if (!namaTagihan?.startsWith("SPP")) return null;
  return namaTagihan.includes("Subsidi") ? "subsidi" : "reguler";
}

export default function BuatTagihanPage() {
  const supabase = createClient();
  const router = useRouter();

  // ─── State ────────────────────────────────────────────────────────────────
  const [selectedMaster, setSelectedMaster] = useState<string>("");
  const [searchMaster, setSearchMaster] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [filterKelas, setFilterKelas] = useState("semua");
  const [filterTipeSPP, setFilterTipeSPP] = useState("semua");
  const [searchSiswa, setSearchSiswa] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [state, action, isPending] = useActionState(createTagihanBatch, {
    status: "idle", errors: { _form: [] },
  });

  // ─── Tutup dropdown saat klik di luar ────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Master tagihan ────────────────────────────────────────────────────────
  const { data: masterList, isLoading: loadingMaster } = useQuery({
    queryKey: ["master-tagihan-buat"],
    queryFn: async () => {
      const { data } = await supabase.from("master_tagihan").select("*").order("namatagihan");
      return data || [];
    },
  });

  const masterSelected = masterList?.find(
    (m: any) => m.id_mastertagihan?.toString() === selectedMaster
  );

  // Hasil pencarian — hanya tampil jika ada teks pencarian
  const searchResults = useMemo(() => {
    if (!searchMaster.trim()) return [];
    const q = searchMaster.toLowerCase();
    return (masterList || []).filter((m: any) =>
      m.namatagihan?.toLowerCase().includes(q) || m.jenjang?.toLowerCase().includes(q)
    );
  }, [masterList, searchMaster]);

  const autoTipeSPP = masterSelected ? getAutoTipeSPP(masterSelected.namatagihan) : null;

  // ─── Auto-fill periode saat master dipilih ────────────────────────────────
  useEffect(() => {
    if (masterSelected?.namatagihan) {
      const { bulan, tahun } = parsePeriodeFromNama(masterSelected.namatagihan);
      setSelectedBulan(bulan);
      setSelectedTahun(tahun);
      setSelectedSiswa([]);
      setFilterTipeSPP(autoTipeSPP ?? "semua");
    }
  }, [selectedMaster]);

  useEffect(() => { setSelectedSiswa([]); }, [filterKelas, filterTipeSPP, selectedBulan, selectedTahun]);

  // ─── Siswa belum punya tagihan ini ────────────────────────────────────────
  const { data: siswaList, isLoading: loadingSiswa } = useQuery({
    queryKey: ["siswa-buat-tagihan", selectedMaster, selectedBulan, selectedTahun, filterKelas, filterTipeSPP, searchSiswa],
    enabled: !!selectedMaster,
    queryFn: async () => {
      let q = supabase
        .from("siswa")
        .select("id, namasiswa, kelas, nis, tipe_spp")
        .eq("status", "aktif")
        .order("kelas").order("namasiswa");
      if (filterKelas !== "semua") q = q.eq("kelas", filterKelas);
      if (filterTipeSPP !== "semua") q = q.eq("tipe_spp", filterTipeSPP);
      if (searchSiswa) q = q.ilike("namasiswa", `%${searchSiswa}%`);
      const { data: semuaSiswa } = await q;
      const { data: sudahTagihan } = await supabase
        .from("tagihan_siswa").select("idsiswa")
        .eq("idmastertagihan", parseInt(selectedMaster))
        .eq("bulan", selectedBulan).eq("tahun", selectedTahun);
      const sudahSet = new Set((sudahTagihan || []).map((t: any) => t.idsiswa));
      return (semuaSiswa || []).filter((s: any) => !sudahSet.has(s.id));
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

  const handlePilihMaster = (master: any) => {
    setSelectedMaster(master.id_mastertagihan?.toString());
    setSelectedSiswa([]);
    setSearchMaster("");
    setShowDropdown(false);
  };

  const handleClearMaster = () => {
    setSelectedMaster("");
    setSelectedSiswa([]);
    setSearchMaster("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleSelectAll = () => {
    if (selectedSiswa.length === siswaList?.length && siswaList?.length > 0) {
      setSelectedSiswa([]);
    } else {
      setSelectedSiswa((siswaList || []).map((s: any) => s.id));
    }
  };

  const handleSelectKelas = (kelas: string) => {
    const ids = (siswaByKelas[kelas] || []).map((s: any) => s.id);
    const allSelected = ids.every((id) => selectedSiswa.includes(id));
    if (allSelected) {
      setSelectedSiswa(selectedSiswa.filter((id) => !ids.includes(id)));
    } else {
      setSelectedSiswa([...new Set([...selectedSiswa, ...ids])]);
    }
  };

  const handleToggleSiswa = (id: string) => {
    setSelectedSiswa((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
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
      router.push("/admin/tagihan");
    }
  }, [state]);

  return (
    <div className="w-full space-y-6">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/tagihan")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Buat Tagihan Siswa</h1>
          <p className="text-sm text-muted-foreground">
            Pilih jenis tagihan → konfirmasi periode → pilih siswa
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          STEP 1 — Master Tagihan (combobox search)
      ════════════════════════════════════════════════════════════════════ */}
      <Card className="gap-3">
        <CardHeader className="pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">1</span>
            Master Tagihan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Jika BELUM dipilih: tampilkan search box */}
          {!selectedMaster ? (
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Ketik untuk mencari tagihan..."
                  value={searchMaster}
                  onChange={(e) => {
                    setSearchMaster(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => { if (searchMaster) setShowDropdown(true); }}
                  className="pl-9"
                  autoFocus
                />
                {searchMaster && (
                  <button
                    onClick={() => { setSearchMaster(""); setShowDropdown(false); }}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown hasil pencarian */}
              {showDropdown && searchMaster && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
                  {loadingMaster ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-1.5">
                      <p className="text-sm font-medium text-muted-foreground">
                        Tagihan &quot;{searchMaster}&quot; tidak ditemukan
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Coba kata kunci lain, atau buat di menu{" "}
                        <span className="font-semibold text-foreground">Master Tagihan</span>.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y">
                      {searchResults.map((master: any) => (
                        <div
                          key={master.id_mastertagihan}
                          onClick={() => handlePilihMaster(master)}
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/60 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{master.namatagihan}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {master.jenjang} · {master.jenistagihan}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                              {convertIDR(parseFloat(master.nominal || 0))}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-4 py-2 border-t text-xs text-muted-foreground bg-muted/30">
                    {searchResults.length} hasil ditemukan
                  </div>
                </div>
              )}

              {/* Hint awal sebelum mengetik */}
              {!searchMaster && (
                <p className="text-xs text-muted-foreground mt-2">
                  Ketik nama tagihan atau jenjang untuk mencari dari {masterList?.length || 0} master tagihan yang tersedia.
                </p>
              )}
            </div>
          ) : (
            /* Jika SUDAH dipilih: tampilkan hanya tagihan terpilih + tombol ganti */
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-green-800 dark:text-green-200 truncate">
                    {masterSelected?.namatagihan}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    {masterSelected?.jenjang} · {masterSelected?.jenistagihan} ·{" "}
                    {convertIDR(parseFloat(masterSelected?.nominal || 0))}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearMaster}
                className="shrink-0 text-muted-foreground hover:text-foreground h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Ganti
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
          STEP 2 — Periode (muncul setelah master dipilih)
      ════════════════════════════════════════════════════════════════════ */}
      {selectedMaster && (
        <Card className="3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">2</span>
              Periode Tagihan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 max-w-sm">
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
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 3 — Pilih Siswa (muncul setelah master dipilih)
          Filter kelas, tipe SPP, pencarian nama, dan tombol pilih semua
          kini berada sejajar dalam satu baris.
      ════════════════════════════════════════════════════════════════════ */}
      {selectedMaster && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs shrink-0">3</span>
              Pilih Siswa
              {selectedSiswa.length > 0 && (
                <Badge className="bg-green-600 text-white text-xs">{selectedSiswa.length} dipilih</Badge>
              )}
            </CardTitle>

            {/* Filter row: kelas, tipe SPP, pencarian nama, tombol pilih semua — sejajar */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KELAS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterTipeSPP} onValueChange={setFilterTipeSPP}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPE_SPP_OPTIONS.map((opt) => (
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

              <Button
                variant="outline" size="sm" className="h-9 text-xs shrink-0"
                onClick={handleSelectAll} disabled={!siswaList?.length}
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {selectedSiswa.length === siswaList?.length && siswaList?.length > 0
                  ? "Batal Semua" : "Pilih Semua"}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {loadingSiswa ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
              </div>
            ) : Object.keys(siswaByKelas).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2 text-center">
                <Check className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium">Semua siswa sudah memiliki tagihan ini</p>
                <p className="text-xs text-muted-foreground">
                  Tidak ada siswa yang perlu ditagih untuk {BULAN_NAMA[selectedBulan]} {selectedTahun}
                  {filterTipeSPP !== "semua" && ` (${filterTipeSPP})`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(siswaByKelas).map(([kelas, siswaKelas]) => {
                  const ids = (siswaKelas as any[]).map((s) => s.id);
                  const allChecked = ids.every((id) => selectedSiswa.includes(id));
                  const someChecked = ids.some((id) => selectedSiswa.includes(id));
                  return (
                    <div key={kelas}>
                      {/* Header kelas */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer mb-2 transition-colors"
                        onClick={() => handleSelectKelas(kelas)}
                      >
                        <Checkbox
                          checked={allChecked}
                          className={someChecked && !allChecked ? "opacity-60" : ""}
                        />
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider flex-1">{kelas}</p>
                        <span className="text-xs text-muted-foreground font-medium">
                          {ids.filter((id) => selectedSiswa.includes(id)).length}/{ids.length} dipilih
                        </span>
                      </div>

                      {/* Grid siswa */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-1">
                        {(siswaKelas as any[]).map((s: any) => {
                          const isChecked = selectedSiswa.includes(s.id);
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleToggleSiswa(s.id)}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                                isChecked
                                  ? "border-green-400 bg-green-50 dark:bg-green-950/40 dark:border-green-700"
                                  : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => handleToggleSiswa(s.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{s.namasiswa}</p>
                                {s.nis && <p className="text-xs text-muted-foreground">NIS: {s.nis}</p>}
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-xs capitalize shrink-0 ${
                                  s.tipe_spp === "subsidi"
                                    ? "border-amber-300 text-amber-700 dark:text-amber-400"
                                    : "border-sky-300 text-sky-700 dark:text-sky-400"
                                }`}
                              >
                                {s.tipe_spp || "reguler"}
                              </Badge>
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

      {/* Placeholder sebelum master dipilih */}
      {!selectedMaster && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center border-2 border-dashed rounded-xl">
          <FileText className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Belum ada tagihan dipilih</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ketik nama tagihan di atas untuk mencari dan memilih master tagihan
            </p>
          </div>
        </div>
      )}

      {/* ─── Footer aksi ─────────────────────────────────────────────────────
          Tidak lagi "fixed" di viewport (sehingga tidak menyisakan area
          kosong di bawah kartu Pilih Siswa) dan tombol Batal kini
          ditempatkan tepat di sebelah kiri tombol Buat Tagihan.
      ────────────────────────────────────────────────────────────────────── */}
      <div className="border-t bg-background/95 backdrop-blur-sm px-4 py-3 rounded-lg">
        <div className="flex items-center justify-end gap-4 flex-wrap">
          {selectedSiswa.length > 0 && masterSelected && (
            <div className="text-sm mr-auto text-right">
              <span className="text-muted-foreground">{selectedSiswa.length} siswa · </span>
              <span className="font-bold text-green-700 dark:text-green-400">
                {convertIDR(parseFloat(masterSelected.nominal || 0) * selectedSiswa.length)}
              </span>
            </div>
          )}
          <Button variant="outline" onClick={() => router.push("/admin/tagihan")}>
            <X className="h-4 w-4 mr-2" />
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || selectedSiswa.length === 0 || !selectedMaster}
            className="bg-green-600 hover:bg-green-700 min-w-[200px]"
          >
            {isPending
              ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Membuat Tagihan...</>
              : selectedSiswa.length > 0
                ? `Buat Tagihan (${selectedSiswa.length} Siswa)`
                : "Pilih Siswa Terlebih Dahulu"
            }
          </Button>
        </div>
      </div>
    </div>
  );
}