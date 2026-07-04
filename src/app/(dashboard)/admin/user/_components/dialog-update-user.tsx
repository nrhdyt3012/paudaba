"use client";

import { INITIAL_STATE_UPDATE_USER } from "@/constants/auth-constant";
import { UpdateUserForm, updateUserSchema } from "@/validations/auth-validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { updateUser } from "../actions";
import { toast } from "sonner";
import FormUser from "./form-user";
import { Dialog } from "@radix-ui/react-dialog";

export default function DialogUpdateUser({
  refetch,
  currentData,
  open,
  handleChangeAction,
}: {
  refetch: () => void;
  currentData?: any;
  open?: boolean;
  handleChangeAction?: (open: boolean) => void;
}) {
  const form = useForm<UpdateUserForm>({
    resolver: zodResolver(updateUserSchema),
  });

  const [state, action, isPending] = useActionState(
    updateUser,
    INITIAL_STATE_UPDATE_USER
  );

  const onSubmit = form.handleSubmit((data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === "avatar_url") return;
      formData.append(key, (value as string) || "");
    });
    formData.append("id", currentData?.id ?? "");
    startTransition(() => { action(formData); });
  });

  useEffect(() => {
    if (state?.status === "error") {
      toast.error("Gagal Mengubah Data", {
        description: state.errors?._form?.[0],
      });
    }
    if (state?.status === "success") {
      toast.success("Data siswa berhasil diubah");
      form.reset();
      handleChangeAction?.(false);
      refetch();
    }
  }, [state]);

  useEffect(() => {
    if (currentData && open) {
      form.setValue("nama_siswa", currentData.namaSiswa || currentData.namasiswa || currentData.name || "");
      form.setValue("NIS", currentData.NIS || currentData.nis || "");

      // Normalisasi jenis kelamin
      const rawJK = currentData.jeniskelamin ?? currentData.jenis_kelamin ?? currentData.jenisKelamin ?? "";
      let normalizedJK: "Laki-laki" | "Perempuan" | undefined;
      const jkLower = String(rawJK).toLowerCase().trim();
      if (jkLower === "laki-laki" || jkLower === "l" || jkLower === "laki") {
        normalizedJK = "Laki-laki";
      } else if (jkLower === "perempuan" || jkLower === "p") {
        normalizedJK = "Perempuan";
      }
      if (normalizedJK) form.setValue("jenis_kelamin", normalizedJK);

      form.setValue("kelas", currentData.kelas || "");
      form.setValue("angkatan", currentData.angkatan || "");
      form.setValue("nama_wali", currentData.namaWali || currentData.namawali || "");
      form.setValue("no_wa", currentData.noWa || currentData.nowa || "");
      form.setValue("tempat_lahir", currentData.tempatLahir || currentData.tempatlahir || "");
      form.setValue("tanggal_lahir", currentData.tanggalLahir || currentData.tanggallahir || "");
      form.setValue("role", "siswa");

      // ← Tipe SPP — pre-fill dari data siswa
      form.setValue(
        "tipe_spp",
        (currentData.tipe_spp as "reguler" | "subsidi") || "reguler"
      );
    }
  }, [currentData, open]);

  return (
    <Dialog open={open} onOpenChange={handleChangeAction}>
      <FormUser
        form={form}
        onSubmit={onSubmit}
        isLoading={isPending}
        type="Update"
      />
    </Dialog>
  );
}