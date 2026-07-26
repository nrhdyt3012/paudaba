"use client";

import DataTable from "@/components/common/data-table";
import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import useDataTable from "@/hooks/use-data-table";
import { createClient } from "@/lib/supabase/client";
import { convertIDR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Menu } from "@/validations/menu-validation";
import { HEADER_TABLE_MENU } from "@/constants/menu-constant";
import DialogCreateMenu from "./dialog-create-menu";
import DialogUpdateMenu from "./dialog-update-menu";
import DialogDeleteMenu from "./dialog-delete-menu";

const JENJANG_FILTER_OPTIONS = [
  { value: "semua", label: "Semua Jenjang" },
  { value: "KB", label: "KB" },
  { value: "TK A", label: "TK A" },
  { value: "TK B", label: "TK B" },
];

const JENIS_FILTER_OPTIONS = [
  { value: "semua", label: "Semua Jenis" },
  { value: "PPDB", label: "PPDB" },
  { value: "Daftar Ulang", label: "Daftar Ulang" },
  { value: "SPP Reguler", label: "SPP Reguler" },
  { value: "SPP Subsidi", label: "SPP Subsidi" },
];

// FIX: 3 opsi pengurutan data
// - "terbaru": data yang paling baru ditambahkan tampil paling atas
// - "nama": urut abjad A-Z berdasarkan namatagihan
// - "jenjang": KB -> TK A -> TK B. Kebetulan urutan alfabet biasa untuk
//   3 nilai ini ("KB" < "TK A" < "TK B") sudah persis sesuai urutan
//   jenjang yang diinginkan (K sebelum T, lalu A sebelum B), jadi cukup
//   ascending biasa tanpa perlu CASE/urutan custom.
const SORT_OPTIONS = [
  { value: "terbaru", label: "Terbaru Ditambahkan" },
  { value: "nama", label: "Nama (A-Z)" },
  { value: "jenjang", label: "Jenjang (KB, TK A, TK B)" },
];

function applyJenisFilter(query: any, filterJenis: string) {
  if (filterJenis === "PPDB") {
    return query.ilike("namatagihan", "%PPDB%");
  }
  if (filterJenis === "Daftar Ulang") {
    return query.ilike("namatagihan", "%Daftar Ulang%");
  }
  if (filterJenis === "SPP Reguler") {
    return query.ilike("namatagihan", "%SPP%").ilike("namatagihan", "%Reguler%");
  }
  if (filterJenis === "SPP Subsidi") {
    return query.ilike("namatagihan", "%SPP%").ilike("namatagihan", "%Subsidi%");
  }
  return query;
}

// FIX: helper terpisah untuk urutan, supaya queryFn tidak numpuk logic
function applySort(query: any, sortBy: string) {
  if (sortBy === "nama") {
    return query.order("namatagihan", { ascending: true });
  }
  if (sortBy === "jenjang") {
    return query
      .order("jenjang", { ascending: true })
      .order("namatagihan", { ascending: true }); // urutan kedua sbg tie-breaker dalam jenjang yang sama
  }
  // default: "terbaru"
  return query.order("created_at", { ascending: false });
}

export default function MenuManagement() {
  const supabase = createClient();
  const { currentPage, currentLimit, currentSearch, handleChangePage, handleChangeLimit, handleChangeSearch } = useDataTable();

  const [filterJenjang, setFilterJenjang] = useState("semua");
  const [filterJenis, setFilterJenis] = useState("semua");
  const [sortBy, setSortBy] = useState("terbaru");

  const { data: menus, isLoading, refetch } = useQuery({
    queryKey: ["master-tagihan", currentPage, currentLimit, currentSearch, filterJenjang, filterJenis, sortBy],
    queryFn: async () => {
      let query = supabase
        .from("master_tagihan")
        .select("*", { count: "exact" })
        .range((currentPage - 1) * currentLimit, currentPage * currentLimit - 1);

      query = applySort(query, sortBy);

      if (currentSearch) {
        query = query.or(`namatagihan.ilike.%${currentSearch}%,jenjang.ilike.%${currentSearch}%`);
      }

      if (filterJenjang !== "semua") query = query.eq("jenjang", filterJenjang);

      if (filterJenis !== "semua") query = applyJenisFilter(query, filterJenis);

      const result = await query;
      if (result.error) toast.error("Gagal memuat data", { description: result.error.message });
      return result;
    },
  });

  const [selectedAction, setSelectedAction] = useState<{ data: Menu; type: "update" | "delete" } | null>(null);
  const handleChangeAction = (open: boolean) => { if (!open) setSelectedAction(null); };

  const filteredData = useMemo(() => {
    return (menus?.data || []).map((item: any, index: number) => [
      currentLimit * (currentPage - 1) + index + 1,
      <p key={`nama-${item.id_mastertagihan}`} className="font-semibold">
        {item.namatagihan}
      </p>,
      <span key={`jenjang-${item.id_mastertagihan}`} className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
        {item.jenjang}
      </span>,
      <span key={`nominal-${item.id_mastertagihan}`} className="font-semibold">
        {convertIDR(parseFloat(item.nominal || 0))}
      </span>,
      <span key={`keterangan-${item.id_mastertagihan}`} className="text-sm text-muted-foreground">
        {item.description || "-"}
      </span>,
      <DropdownAction
        key={`action-${item.id_mastertagihan}`}
        menu={[
          {
            label: <span className="flex items-center gap-2"><Pencil className="w-4 h-4" />Edit</span>,
            action: () => setSelectedAction({
              data: {
                id_masterTagihan: item.id_mastertagihan,
                namaTagihan: item.namatagihan,
                jenjang: item.jenjang,
                jenisTagihan: item.jenistagihan,
                nominal: item.nominal,
                description: item.description,
              },
              type: "update"
            }),
          },
          {
            label: <span className="flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-400" />Hapus</span>,
            variant: "destructive",
            action: () => setSelectedAction({
              data: {
                id_masterTagihan: item.id_mastertagihan,
                namaTagihan: item.namatagihan,
                jenjang: item.jenjang,
                jenisTagihan: item.jenistagihan,
                nominal: item.nominal,
                description: item.description,
              },
              type: "delete"
            }),
          },
        ]}
      />,
    ]);
  }, [menus, currentLimit, currentPage]);

  const totalPages = useMemo(() => {
    return menus?.count ? Math.ceil(menus.count / currentLimit) : 0;
  }, [menus, currentLimit]);

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row mb-4 gap-2 justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold">Master Tagihan</h1>
          <p className="text-sm text-muted-foreground">Kelola jenis tagihan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Cari nama tagihan..."
            className="w-full sm:w-56"
            onChange={(e) => handleChangeSearch(e.target.value)}
          />
          <Select value={filterJenjang} onValueChange={setFilterJenjang}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JENJANG_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterJenis} onValueChange={setFilterJenis}>
            <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JENIS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* FIX: dropdown Sortir baru */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[210px]">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />Tambah
              </Button>
            </DialogTrigger>
            <DialogCreateMenu refetch={refetch} />
          </Dialog>
        </div>
      </div>
      <DataTable
        header={HEADER_TABLE_MENU}
        data={filteredData}
        isLoading={isLoading}
        totalPages={totalPages}
        currentPage={currentPage}
        currentLimit={currentLimit}
        onChangePage={handleChangePage}
        onChangeLimit={handleChangeLimit}
      />
      <DialogUpdateMenu
        open={selectedAction?.type === "update"}
        refetch={refetch}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />
      <DialogDeleteMenu
        open={selectedAction?.type === "delete"}
        refetch={refetch}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />
    </div>
  );
}