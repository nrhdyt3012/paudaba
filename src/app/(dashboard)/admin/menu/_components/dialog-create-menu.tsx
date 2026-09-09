"use client";

// src/app/(dashboard)/admin/menu/_components/dialog-create-menu.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { createMenu } from "../actions";
import { toast } from "sonner";
import { MenuForm, menuFormSchema } from "@/validations/menu-validation";
import { INITIAL_MENU, INITIAL_STATE_MENU, generateNamaTagihan } from "@/constants/menu-constant";
import FormMenu from "./form-menu";

export default function DialogCreateMenu({ refetch }: { refetch: () => void }) {
  const form = useForm<MenuForm>({
    resolver: zodResolver(menuFormSchema),
    defaultValues: INITIAL_MENU,
  });

  const [state, action, isPending] = useActionState(createMenu, INITIAL_STATE_MENU);

  const onSubmit = form.handleSubmit((data) => {
    // Generate namaTagihan otomatis dari pilihan user
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
    formData.append("namaTagihan", namaTagihan);
    formData.append("jenjang", data.jenjang);
    formData.append("jenisTagihan", dbJenisTagihan); // "Reguler" | "Subsidi"
    formData.append("nominal", data.nominal);
    formData.append("description", data.description || "");
    // Kirim juga jenisTagihanDisplay agar changelog lebih deskriptif
    formData.append("jenisTagihanDisplay", data.jenisTagihan);
    startTransition(() => { action(formData); });
  });

  useEffect(() => {
    if (state?.status === "error") {
      toast.error("Gagal Menyimpan", { description: state.errors?._form?.[0] });
    }
    if (state?.status === "success") {
      toast.success("Master tagihan berhasil ditambahkan");
      form.reset();
      document.querySelector<HTMLButtonElement>('[data-state="open"]')?.click();
      refetch();
    }
  }, [state]);

  return <FormMenu form={form} onSubmit={onSubmit} isLoading={isPending} type="Create" />;
}