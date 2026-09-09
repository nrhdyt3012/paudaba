"use client";

// src/app/(dashboard)/admin/menu/_components/dialog-update-menu.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { updateMenu } from "../actions";
import { toast } from "sonner";
import FormMenu from "./form-menu";
import { Dialog } from "@radix-ui/react-dialog";
import { Menu, MenuForm, menuFormSchema } from "@/validations/menu-validation";
import { INITIAL_STATE_MENU, generateNamaTagihan } from "@/constants/menu-constant";

/**
 * Parse namatagihan yang sudah tersimpan di DB ke bentuk form values.
 * Ini digunakan saat Edit agar field kondisional terisi dengan benar.
 */
function parseNamaTagihanToFormValues(
  namaTagihan: string,
  jenisTagihanDB: string // "Reguler" | "Subsidi"
): Partial<MenuForm> {
  const nama = namaTagihan || "";

  if (nama.startsWith("PPDB")) {
    // FIX: parse Gelombang + Tahun dari nama tagihan PPDB
    // (untuk data PPDB lama sebelum fitur ini ada, gelombang/tahun akan
    // kosong dan user tinggal isi ulang saat edit)
    const gelombangMatch = nama.match(/Gelombang\s+(\d+)/);
    const tahunMatch = nama.match(/(\d{4})/);
    return {
      jenisTagihan: "PPDB",
      gelombangPPDB: gelombangMatch?.[1] || "",
      tahunPPDB: tahunMatch?.[1] || "",
    };
  }

  if (nama.startsWith("Daftar Ulang")) {
    const semesterMatch = nama.match(/Semester\s+(Ganjil|Genap)/);
    const tahunMatch = nama.match(/(\d{4})/);
    return {
      jenisTagihan: "Daftar Ulang",
      semesterDaftarUlang: semesterMatch?.[1] || "",
      tahunDaftarUlang: tahunMatch?.[1] || "",
    };
  }

  if (nama.startsWith("SPP Semesteran")) {
    const semesterMatch = nama.match(/Semester\s+(Ganjil|Genap)/);
    const tahunMatch = nama.match(/(\d{4})/);
    const jenis = jenisTagihanDB === "Subsidi" ? "SPP Subsidi" : "SPP Reguler";
    return {
      jenisTagihan: jenis,
      tipeSPP: "Semesteran",
      semesterSPP: semesterMatch?.[1] || "",
      tahunSPP: tahunMatch?.[1] || "",
    };
  }

  if (nama.startsWith("SPP Bulanan")) {
    const BULAN_MAP: Record<string, string> = {
      Januari: "1", Februari: "2", Maret: "3", April: "4",
      Mei: "5", Juni: "6", Juli: "7", Agustus: "8",
      September: "9", Oktober: "10", November: "11", Desember: "12",
    };
    let bulanSPP = "";
    for (const [namaBulan, val] of Object.entries(BULAN_MAP)) {
      if (nama.includes(namaBulan)) { bulanSPP = val; break; }
    }
    const tahunMatch = nama.match(/(\d{4})/);
    const jenis = jenisTagihanDB === "Subsidi" ? "SPP Subsidi" : "SPP Reguler";
    return {
      jenisTagihan: jenis,
      tipeSPP: "Bulanan",
      bulanSPP,
      tahunSPP: tahunMatch?.[1] || "",
    };
  }

  // FIX: nama tidak match pola manapun -> perlakukan sebagai "Lainnya"
  // (nama tagihan yang sebelumnya diketik manual atau tidak beraturan)
  return {
    jenisTagihan: "Lainnya",
    namaTagihanManual: nama,
  };
}

export default function DialogUpdateMenu({
  refetch,
  currentData,
  open,
  handleChangeAction,
}: {
  refetch: () => void;
  currentData?: Menu;
  open?: boolean;
  handleChangeAction?: (open: boolean) => void;
}) {
  const form = useForm<MenuForm>({ resolver: zodResolver(menuFormSchema) });
  const [state, action, isPending] = useActionState(updateMenu, INITIAL_STATE_MENU);

  const onSubmit = form.handleSubmit((data) => {
    const { namaTagihan, dbJenisTagihan } = generateNamaTagihan({
      jenisTagihan: data.jenisTagihan,
      gelombangPPDB: data.gelombangPPDB,
      tahunPPDB: data.tahunPPDB,
      tipeSPP: data.tipeSPP,
      semesterDaftarUlang: data.semesterDaftarUlang,
      tahunDaftarUlang: data.tahunDaftarUlang,
      bulanSPP: data.bulanSPP,
      tahunSPP: data.tahunSPP,
      semesterSPP: data.semesterSPP,
      namaTagihanManual: data.namaTagihanManual,
      jenjang: data.jenjang,
    });

    const formData = new FormData();
    formData.append("id", currentData!.id_masterTagihan!.toString());
    formData.append("namaTagihan", namaTagihan);
    formData.append("jenjang", data.jenjang);
    formData.append("jenisTagihan", dbJenisTagihan);
    formData.append("nominal", data.nominal);
    formData.append("description", data.description || "");
    formData.append("jenisTagihanDisplay", data.jenisTagihan);
    startTransition(() => { action(formData); });
  });

  useEffect(() => {
    if (state?.status === "error") {
      toast.error("Gagal Mengubah", { description: state.errors?._form?.[0] });
    }
    if (state?.status === "success") {
      toast.success("Master tagihan berhasil diubah");
      form.reset();
      handleChangeAction?.(false);
      refetch();
    }
  }, [state]);

  useEffect(() => {
    if (currentData) {
      const parsed = parseNamaTagihanToFormValues(
        currentData.namaTagihan || "",
        currentData.jenisTagihan || ""
      );

      form.reset({
        jenisTagihan: parsed.jenisTagihan || "",
        gelombangPPDB: parsed.gelombangPPDB || "",
        tahunPPDB: parsed.tahunPPDB || "",
        semesterDaftarUlang: parsed.semesterDaftarUlang || "",
        tahunDaftarUlang: parsed.tahunDaftarUlang || "",
        tipeSPP: parsed.tipeSPP || "",
        bulanSPP: parsed.bulanSPP || "",
        tahunSPP: parsed.tahunSPP || "",
        semesterSPP: parsed.semesterSPP || "",
        namaTagihanManual: parsed.namaTagihanManual || "",
        jenjang: currentData.jenjang || "",
        nominal: currentData.nominal?.toString() || "",
        description: currentData.description || "",
      });
    }
  }, [currentData]);

  return (
    <Dialog open={open} onOpenChange={handleChangeAction}>
      <FormMenu form={form} onSubmit={onSubmit} isLoading={isPending} type="Update" />
    </Dialog>
  );
}