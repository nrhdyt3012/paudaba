import { INITIAL_CREATE_USER_FORM, INITIAL_STATE_CREATE_USER } from "@/constants/auth-constant";
import { CreateUserForm, createUserSchema } from "@/validations/auth-validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { createUser } from "../actions";
import { toast } from "sonner";
import FormUser from "./form-user";

export default function DialogCreateUser({ refetch }: { refetch: () => void }) {
  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: INITIAL_CREATE_USER_FORM,
  });

  const [state, action, isPending] = useActionState(createUser, INITIAL_STATE_CREATE_USER);

  const onSubmit = form.handleSubmit((data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      // Lewati avatar_url jika masih ada di schema (untuk kompatibilitas)
      if (key === "avatar_url") return;
      formData.append(key, (value as string) || "");
    });
    startTransition(() => {
      action(formData);
    });
  });

  useEffect(() => {
    if (state?.status === "error") {
      toast.error("Gagal Menambah Siswa", {
        description: state.errors?._form?.[0],
      });
    }
    if (state?.status === "success") {
      // ── BARU: kalau email/password digenerate otomatis (wali baru
      // tanpa isi email/password manual), tampilkan ke bendahara supaya
      // bisa dicatat & diberikan ke wali. Durasi toast dipanjangkan
      // karena isinya penting untuk disalin.
      if (state.akunDigenerate) {
        toast.success("Data siswa berhasil ditambahkan", {
          description: `Akun wali otomatis dibuat — Email: ${state.akunDigenerate.email} / Password: ${state.akunDigenerate.password}`,
          duration: 15000,
        });
      } else {
        toast.success("Data siswa berhasil ditambahkan");
      }

      form.reset();
      document
        .querySelector<HTMLButtonElement>('[data-state="open"]')
        ?.click();
      refetch();
    }
  }, [state]);

  return <FormUser form={form} onSubmit={onSubmit} isLoading={isPending} type="Create" />;
}