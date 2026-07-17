"use client";

import DataTable from "@/components/common/data-table";
import DropdownAction from "@/components/common/dropdown-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useDataTable from "@/hooks/use-data-table";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HEADER_TABLE_USER } from "@/constants/user-constant";
import DialogCreateUser from "./dialog-create-user";
import DialogUpdateUser from "./dialog-update-user";
import DialogDeleteUser from "./dialog-delete-user";
import { Profile } from "@/types/auth";

export default function UserManagement() {
  const supabase = createClient();
  const {
    currentPage,
    currentLimit,
    currentSearch,
    handleChangePage,
    handleChangeLimit,
    handleChangeSearch,
  } = useDataTable();

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["siswa-list", currentPage, currentLimit, currentSearch],
    queryFn: async () => {
      let query = supabase
        .from("siswa")
        .select("*", { count: "exact" })
        .range((currentPage - 1) * currentLimit, currentPage * currentLimit - 1)
        .order("createdat", { ascending: false });

      if (currentSearch) {
        query = query.or(
          `namasiswa.ilike.%${currentSearch}%,nis.ilike.%${currentSearch}%,kelas.ilike.%${currentSearch}%`
        );
      }

      const result = await query;
      if (result.error) {
        toast.error("Gagal memuat data siswa", { description: result.error.message });
      }
      return result;
    },
  });

  const [selectedAction, setSelectedAction] = useState<{
    data: Profile;
    type: "update" | "delete";
  } | null>(null);

  const handleChangeAction = (open: boolean) => {
    if (!open) setSelectedAction(null);
  };

  const filteredData = useMemo(() => {
    return (users?.data || []).map((item: any, index: number) => [
      currentLimit * (currentPage - 1) + index + 1,

      // NIS
      <span key={`nis-${item.id}`} className="font-mono text-sm">
        {item.nis || "-"}
      </span>,

      // Nama Siswa
      <div key={`nama-${item.id}`}>
        <p className="font-medium">{item.namasiswa || "-"}</p>
      </div>,

      // Jenis Kelamin
      item.jeniskelamin || "-",

      // Tempat Lahir
      item.tempatlahir || "-",

      // Tanggal Lahir
      item.tanggallahir
        ? new Date(item.tanggallahir).toLocaleDateString("id-ID")
        : "-",

      // Nama Wali
      item.namawali || "-",

      // No WA
      item.nowa || "-",

      // FIX: kolom Alamat baru — supaya konsisten, sekarang juga tampil
      // di tabel Data Siswa (sebelumnya cuma bisa diisi lewat form, tidak
      // kelihatan di listnya).
      <span key={`alamat-${item.id}`} className="text-sm max-w-[200px] truncate block" title={item.alamat || "-"}>
        {item.alamat || "-"}
      </span>,

      // Kelas
      <span
        key={`kelas-${item.id}`}
        className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
      >
        {item.kelas || "-"}
      </span>,

      // Angkatan
      item.angkatan || "-",

      // Tipe SPP ← kolom baru
      <span
        key={`tipe-${item.id}`}
        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
          item.tipe_spp === "subsidi"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
            : "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100"
        }`}
      >
        {item.tipe_spp || "reguler"}
      </span>,

      // Status
      <span
        key={`status-${item.id}`}
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          item.status === "aktif"
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        }`}
      >
        {item.status || "aktif"}
      </span>,

      // Aksi
      <DropdownAction
        key={`act-${item.id}`}
        menu={[
          {
            label: (
              <span className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Edit
              </span>
            ),
            action: () =>
              setSelectedAction({
                data: {
                  id: item.id,
                  name: item.namasiswa,
                  namaSiswa: item.namasiswa,
                  NIS: item.nis,
                  kelas: item.kelas,
                  angkatan: item.angkatan,
                  namaWali: item.namawali,
                  noWa: item.nowa,
                  tempatLahir: item.tempatlahir,
                  tanggalLahir: item.tanggallahir,
                  jeniskelamin: item.jeniskelamin,
                  tipe_spp: item.tipe_spp || "reguler",
                  status: item.status,
                  role: "siswa",
                } as Profile & { jeniskelamin?: string; tipe_spp?: string },
                type: "update",
              }),
          },
          {
            label: (
              <span className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                Hapus
              </span>
            ),
            variant: "destructive" as const,
            action: () =>
              setSelectedAction({
                data: {
                  id: item.id,
                  name: item.namasiswa,
                  namaSiswa: item.namasiswa,
                  avatar_url: item.avatarurl,
                  role: "siswa",
                } as Profile,
                type: "delete",
              }),
          },
        ]}
      />,
    ]);
  }, [users, currentLimit, currentPage]);

  const totalPages = useMemo(
    () => (users?.count ? Math.ceil(users.count / currentLimit) : 0),
    [users, currentLimit]
  );

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row mb-4 gap-2 justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold">Data Siswa</h1>
          <p className="text-sm text-muted-foreground">Kelola data siswa KB, TK A, dan TK B</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Cari nama, NIS, atau kelas..."
            onChange={(e) => handleChangeSearch(e.target.value)}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Tambah
              </Button>
            </DialogTrigger>
            <DialogCreateUser refetch={refetch} />
          </Dialog>
        </div>
      </div>

      <DataTable
        header={HEADER_TABLE_USER}
        data={filteredData}
        isLoading={isLoading}
        totalPages={totalPages}
        currentPage={currentPage}
        currentLimit={currentLimit}
        onChangePage={handleChangePage}
        onChangeLimit={handleChangeLimit}
      />

      <DialogUpdateUser
        open={selectedAction?.type === "update"}
        refetch={refetch}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />

      <DialogDeleteUser
        open={selectedAction?.type === "delete"}
        refetch={refetch}
        currentData={selectedAction?.data}
        handleChangeAction={handleChangeAction}
      />
    </div>
  );
}