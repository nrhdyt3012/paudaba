"use client";

// src/app/(dashboard)/admin/menu/_components/form-menu.tsx

import FormInput from "@/components/common/form-input";
import FormSelect from "@/components/common/form-select";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import {
  BULAN_LIST,
  JENJANG_LIST,
  JENIS_TAGIHAN_LIST,
  SEMESTER_LIST,
  TAHUN_LIST,
  TIPE_SPP_LIST,
  generateNamaTagihan,
} from "@/constants/menu-constant";
import { MenuForm } from "@/validations/menu-validation";
import { Loader2 } from "lucide-react";
import { FormEvent } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";

export default function FormMenu({
  form,
  onSubmit,
  isLoading,
  type,
}: {
  form: UseFormReturn<MenuForm>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  type: "Create" | "Update";
}) {
  // Watch semua field yang mempengaruhi tampilan
  const jenisTagihan = useWatch({ control: form.control, name: "jenisTagihan" });
  const tipeSPP = useWatch({ control: form.control, name: "tipeSPP" });

  const isSPP =
    jenisTagihan === "SPP Reguler" || jenisTagihan === "SPP Subsidi";
  const isDaftarUlang = jenisTagihan === "Daftar Ulang";
  const showField2 = isDaftarUlang || isSPP;

  // Preview nama tagihan yang akan di-generate
  const allValues = useWatch({ control: form.control });
  const { namaTagihan: previewNama } = generateNamaTagihan({
    jenisTagihan: allValues.jenisTagihan || "",
    tipeSPP: allValues.tipeSPP,
    semesterDaftarUlang: allValues.semesterDaftarUlang,
    tahunDaftarUlang: allValues.tahunDaftarUlang,
    bulanSPP: allValues.bulanSPP,
    tahunSPP: allValues.tahunSPP,
    semesterSPP: allValues.semesterSPP,
    jenjang: allValues.jenjang,
  });

  // Reset field turunan saat jenis tagihan berubah
  const handleJenisTagihanChange = () => {
    form.setValue("semesterDaftarUlang", "");
    form.setValue("tahunDaftarUlang", "");
    form.setValue("tipeSPP", "");
    form.setValue("bulanSPP", "");
    form.setValue("tahunSPP", "");
    form.setValue("semesterSPP", "");
  };

  // Reset field bulanan/semesteran saat tipe SPP berubah
  const handleTipeSPPChange = () => {
    form.setValue("bulanSPP", "");
    form.setValue("tahunSPP", "");
    form.setValue("semesterSPP", "");
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <Form {...form}>
        <DialogHeader>
          <DialogTitle>
            {type === "Create" ? "Tambah" : "Edit"} Master Tagihan
          </DialogTitle>
          <DialogDescription>
            {type === "Create"
              ? "Tambah jenis tagihan baru"
              : "Ubah data jenis tagihan"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-4 max-h-[65vh] px-1 overflow-y-auto">

            {/* ─── Field 1: Jenis Tagihan ─── */}
            <div onClick={handleJenisTagihanChange}>
              <FormSelect
                form={form}
                name="jenisTagihan"
                label="Jenis Tagihan"
                selectItem={JENIS_TAGIHAN_LIST}
              />
            </div>

            {/* ─── Field 2 (kondisional) ─── */}

            {/* Daftar Ulang → Semester + Tahun */}
            {isDaftarUlang && (
              <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/40 p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Detail Daftar Ulang
                </p>
                <FormSelect
                  form={form}
                  name="semesterDaftarUlang"
                  label="Semester"
                  selectItem={SEMESTER_LIST}
                />
                <FormSelect
                  form={form}
                  name="tahunDaftarUlang"
                  label="Tahun"
                  selectItem={TAHUN_LIST}
                />
              </div>
            )}

            {/* SPP → Tipe SPP */}
            {isSPP && (
              <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/40 p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Detail SPP
                </p>
                <div onClick={handleTipeSPPChange}>
                  <FormSelect
                    form={form}
                    name="tipeSPP"
                    label="Tipe SPP"
                    selectItem={TIPE_SPP_LIST}
                  />
                </div>

                {/* SPP Bulanan → Bulan + Tahun */}
                {tipeSPP === "Bulanan" && (
                  <div className="space-y-3">
                    <FormSelect
                      form={form}
                      name="bulanSPP"
                      label="Bulan"
                      selectItem={BULAN_LIST}
                    />
                    <FormSelect
                      form={form}
                      name="tahunSPP"
                      label="Tahun"
                      selectItem={TAHUN_LIST}
                    />
                  </div>
                )}

                {/* SPP Semesteran → Semester + Tahun */}
                {tipeSPP === "Semesteran" && (
                  <div className="space-y-3">
                    <FormSelect
                      form={form}
                      name="semesterSPP"
                      label="Semester"
                      selectItem={SEMESTER_LIST}
                    />
                    <FormSelect
                      form={form}
                      name="tahunSPP"
                      label="Tahun"
                      selectItem={TAHUN_LIST}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ─── Field 3: Jenjang ─── */}
            <FormSelect
              form={form}
              name="jenjang"
              label="Jenjang"
              selectItem={JENJANG_LIST}
            />

            {/* ─── Field 4: Nominal ─── */}
            <FormInput
              form={form}
              name="nominal"
              label="Nominal (Rp)"
              placeholder="Contoh: 150.000"
              type="currency"
            />

            {/* ─── Field 5: Keterangan (Opsional) ─── */}
            <FormInput
              form={form}
              name="description"
              label="Keterangan (Opsional)"
              placeholder="Keterangan tambahan"
              type="textarea"
            />

            {/* ─── Preview nama tagihan ─── */}
            {previewNama && (
              <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">
                  Nama tagihan yang akan disimpan:
                </p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {previewNama}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : type === "Create" ? (
                "Simpan"
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}