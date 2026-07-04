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
  KELAS_LIST,
  JENIS_KELAMIN_LIST,
  TIPE_SPP_SISWA_LIST,
} from "@/constants/auth-constant";
import { Loader2 } from "lucide-react";
import { FormEvent } from "react";
import { FieldValues, Path, UseFormReturn } from "react-hook-form";

export default function FormUser<T extends FieldValues>({
  form,
  onSubmit,
  isLoading,
  type,
}: {
  form: UseFormReturn<T>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  type: "Create" | "Update";
}) {
  return (
    <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
      <Form {...form}>
        <DialogHeader>
          <DialogTitle>{type === "Create" ? "Tambah" : "Edit"} Data Siswa</DialogTitle>
          <DialogDescription>
            {type === "Create" ? "Tambah data siswa baru" : "Ubah data siswa"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-4 max-h-[60vh] px-1 overflow-y-auto">
            <FormInput
              form={form}
              name={"nama_siswa" as Path<T>}
              label="Nama Lengkap Siswa"
              placeholder="Nama lengkap siswa"
            />

            {type === "Create" && (
              <>
                <FormInput
                  form={form}
                  name={"email" as Path<T>}
                  label="Email (untuk login wali)"
                  placeholder="email@example.com"
                  type="email"
                />
                <FormInput
                  form={form}
                  name={"password" as Path<T>}
                  label="Password"
                  placeholder="Min. 6 karakter"
                  type="password"
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                form={form}
                name={"NIS" as Path<T>}
                label="NIS (Opsional)"
                placeholder="Nomor Induk Siswa"
              />
              <FormSelect
                form={form}
                name={"jenis_kelamin" as Path<T>}
                label="Jenis Kelamin"
                selectItem={JENIS_KELAMIN_LIST}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                form={form}
                name={"kelas" as Path<T>}
                label="Kelas"
                selectItem={KELAS_LIST}
              />
              <FormInput
                form={form}
                name={"angkatan" as Path<T>}
                label="Angkatan (Tahun Masuk)"
                placeholder="Contoh: 2024"
              />
            </div>

              <FormSelect
                form={form}
                name={"tipe_spp" as Path<T>}
                label="Tipe SPP"
                selectItem={TIPE_SPP_SISWA_LIST}
              />

            <FormInput
              form={form}
              name={"nama_wali" as Path<T>}
              label="Nama Wali Siswa"
              placeholder="Nama lengkap orang tua/wali"
            />

            <FormInput
              form={form}
              name={"no_wa" as Path<T>}
              label="Nomor WhatsApp Wali"
              placeholder="Contoh: 08123456789"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                form={form}
                name={"tempat_lahir" as Path<T>}
                label="Tempat Lahir"
                placeholder="Kota/Kabupaten"
              />
              <FormInput
                form={form}
                name={"tanggal_lahir" as Path<T>}
                label="Tanggal Lahir"
                placeholder="YYYY-MM-DD"
                type="date"
              />
            </div>
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