"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ITEMS_PER_PAGE = 10;

function isLakiLaki(jk: string | null | undefined) {
  const v = (jk || "").toLowerCase();
  return v === "laki-laki" || v === "l";
}
function isPerempuan(jk: string | null | undefined) {
  const v = (jk || "").toLowerCase();
  return v === "perempuan" || v === "p";
}

interface SiswaListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  // Kalau diisi ("laki-laki" | "perempuan"), gender di-fix (dropdown gender
  // tidak ditampilkan). Kalau undefined → tampilkan dropdown pilih gender
  // (dipakai untuk kartu "Total Siswa").
  fixedGender?: "laki-laki" | "perempuan";
}

export default function SiswaListDialog({
  open,
  onOpenChange,
  title,
  description,
  fixedGender,
}: SiswaListDialogProps) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [filterKelas, setFilterKelas] = useState("semua");
  const [filterAngkatan, setFilterAngkatan] = useState("semua");
  const [filterGender, setFilterGender] = useState("semua");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (open) {
      setSearch("");
      setFilterKelas("semua");
      setFilterAngkatan("semua");
      setFilterGender("semua");
      setCurrentPage(1);
    }
  }, [open]);

  // ─── Opsi filter kelas & angkatan (distinct dari tabel siswa) ───────────
  const { data: filterOptions } = useQuery({
    queryKey: ["siswa-filter-options"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("siswa")
        .select("kelas, angkatan")
        .eq("status", "aktif");
      const kelasSet = new Set<string>();
      const angkatanSet = new Set<string>();
      (data || []).forEach((s: any) => {
        if (s.kelas) kelasSet.add(s.kelas);
        if (s.angkatan) angkatanSet.add(s.angkatan);
      });
      return {
        kelasList: Array.from(kelasSet).sort(),
        angkatanList: Array.from(angkatanSet).sort((a, b) => b.localeCompare(a)),
      };
    },
  });

  // ─── Data siswa sesuai filter server-side (kelas/angkatan/status) ──────
  const { data: siswaData, isLoading } = useQuery({
    queryKey: ["dashboard-siswa-list", open, filterKelas, filterAngkatan],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("siswa")
        .select(
          "id, nis, namasiswa, jeniskelamin, tempatlahir, tanggallahir, namawali, nowa, kelas, angkatan, tipe_spp, status"
        )
        .eq("status", "aktif")
        .order("namasiswa");

      if (filterKelas !== "semua") query = query.eq("kelas", filterKelas);
      if (filterAngkatan !== "semua") query = query.eq("angkatan", filterAngkatan);

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  // ─── Filter gender (fixed atau dari dropdown) + search — di client ─────
  const filtered = useMemo(() => {
    const genderToApply = fixedGender || (filterGender !== "semua" ? filterGender : null);

    let result = siswaData || [];
    if (genderToApply === "laki-laki") {
      result = result.filter((s: any) => isLakiLaki(s.jeniskelamin));
    } else if (genderToApply === "perempuan") {
      result = result.filter((s: any) => isPerempuan(s.jeniskelamin));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s: any) =>
          (s.namasiswa || "").toLowerCase().includes(q) ||
          (s.nis || "").toLowerCase().includes(q) ||
          (s.kelas || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [siswaData, fixedGender, filterGender, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-[1500px] sm:max-w-[1500px] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-8 py-5 border-b shrink-0 bg-background">
          <div className="flex flex-col items-center text-center gap-1">
            <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-base">
              {description || `${filtered.length} siswa ditemukan`}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b shrink-0 flex flex-wrap items-center justify-end gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, NIS, atau kelas..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>

          <Select
            value={filterKelas}
            onValueChange={(v) => {
              setFilterKelas(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kelas</SelectItem>
              {(filterOptions?.kelasList || []).map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterAngkatan}
            onValueChange={(v) => {
              setFilterAngkatan(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Angkatan</SelectItem>
              {(filterOptions?.angkatanList || []).map((a) => (
                <SelectItem key={a} value={a}>Angkatan {a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dropdown gender hanya muncul kalau fixedGender tidak diisi
              (dipakai untuk kartu "Total Siswa") */}
          {!fixedGender && (
            <Select
              value={filterGender}
              onValueChange={(v) => {
                setFilterGender(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Jenis Kelamin</SelectItem>
                <SelectItem value="laki-laki">Laki-laki</SelectItem>
                <SelectItem value="perempuan">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabel */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada siswa yang cocok dengan filter ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-background z-20">
                  <tr className="border-b bg-muted">
                    <th className="p-3 text-left">No</th>
                    <th className="p-3 text-left">NIS</th>
                    <th className="p-3 text-left">Nama Siswa</th>
                    <th className="p-3 text-left">Jenis Kelamin</th>
                    <th className="p-3 text-left">Tempat Lahir</th>
                    <th className="p-3 text-left">Tanggal Lahir</th>
                    <th className="p-3 text-left">Nama Wali</th>
                    <th className="p-3 text-left">No. WA Wali</th>
                    <th className="p-3 text-left">Kelas</th>
                    <th className="p-3 text-left">Angkatan</th>
                    <th className="p-3 text-left">Tipe</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s: any, i: number) => (
                    <tr key={s.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-muted-foreground">
                        {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                      </td>
                      <td className="p-3 font-mono">{s.nis || "-"}</td>
                      <td className="p-3 font-medium">{s.namasiswa || "-"}</td>
                      <td className="p-3">{s.jeniskelamin || "-"}</td>
                      <td className="p-3">{s.tempatlahir || "-"}</td>
                      <td className="p-3">
                        {s.tanggallahir
                          ? new Date(s.tanggallahir).toLocaleDateString("id-ID")
                          : "-"}
                      </td>
                      <td className="p-3">{s.namawali || "-"}</td>
                      <td className="p-3">{s.nowa || "-"}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          {s.kelas || "-"}
                        </span>
                      </td>
                      <td className="p-3">{s.angkatan || "-"}</td>
                      <td className="p-3 capitalize">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.tipe_spp === "subsidi"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                              : "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100"
                          }`}
                        >
                          {s.tipe_spp || "reguler"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          {s.status || "aktif"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer pagination */}
        {filtered.length > 0 && (
          <div className="px-8 py-4 border-t shrink-0 grid grid-cols-3 items-center bg-muted/30">
            <span />
            <span className="text-sm text-muted-foreground text-center">
              Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} dari {filtered.length} siswa
            </span>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1 justify-self-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ‹
                </Button>
                <span className="text-xs px-2">{currentPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  ›
                </Button>
              </div>
            ) : (
              <span />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
