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
import { useEffect, useState } from "react";
import { searchWaliByEmail } from "../actions";
import { Search, Check, Mail, Phone, ArrowRightLeft } from "lucide-react";

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

  const [waliQuery, setWaliQuery] = useState("");
  const [waliResults, setWaliResults] = useState<any[]>([]);
  const [isSearchingWali, setIsSearchingWali] = useState(false);
  const [selectedWali, setSelectedWali] = useState<any | null>(null);

  const mode = form.watch("mode" as Path<T>) as unknown as "baru" | "existing" | undefined;

  useEffect(() => {
    if (mode !== "existing" || waliQuery.trim().length < 2) {
      setWaliResults([]);
      return;
    }
    setIsSearchingWali(true);
    const timeout = setTimeout(async () => {
      const res = await searchWaliByEmail(waliQuery.trim());
      setWaliResults(res);
      setIsSearchingWali(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [waliQuery, mode]);

const handlePilihWali = (wali: any) => {
    setSelectedWali(wali);
    form.setValue("wali_auth_id" as Path<T>, wali.wali_auth_id as any);
    form.setValue("nama_wali" as Path<T>, wali.namawali as any);
    form.setValue("no_wa" as Path<T>, wali.nowa as any);
    form.setValue("email" as Path<T>, wali.email as any); // ← baru: email ikut auto-isi
    setWaliQuery("");
    setWaliResults([]);
  };

const handleGantiMode = (newMode: "baru" | "existing") => {
    form.setValue("mode" as Path<T>, newMode as any);
    setSelectedWali(null);
    form.setValue("wali_auth_id" as Path<T>, "" as any);
    if (newMode === "baru") {
      form.setValue("email" as Path<T>, "" as any); // reset biar tidak kebawa dari wali sebelumnya
      form.setValue("no_wa" as Path<T>, "" as any); // reset biar tidak kebawa dari wali sebelumnya
      form.setValue("nama_wali" as Path<T>, "" as any); // reset biar tidak kebawa dari wali sebelumnya
    }
  };
  const [showPindahWali, setShowPindahWali] = useState(false);
  const [waliBaruQuery, setWaliBaruQuery] = useState("");
  const [waliBaruResults, setWaliBaruResults] = useState<any[]>([]);
  const [isSearchingWaliBaru, setIsSearchingWaliBaru] = useState(false);
  const [selectedWaliBaru, setSelectedWaliBaru] = useState<any | null>(null);

  useEffect(() => {
    if (!showPindahWali || waliBaruQuery.trim().length < 2) {
      setWaliBaruResults([]);
      return;
    }
    setIsSearchingWaliBaru(true);
    const timeout = setTimeout(async () => {
      const res = await searchWaliByEmail(waliBaruQuery.trim());
      setWaliBaruResults(res);
      setIsSearchingWaliBaru(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [waliBaruQuery, showPindahWali]);

  const handlePilihWaliBaru = (wali: any) => {
    setSelectedWaliBaru(wali);
    form.setValue("wali_auth_id_baru" as Path<T>, wali.wali_auth_id as any);
    form.setValue("nama_wali" as Path<T>, wali.namawali as any);
    form.setValue("no_wa" as Path<T>, wali.nowa as any);
    setWaliBaruQuery("");
    setWaliBaruResults([]);
  };

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
           {type === "Create" && (
              <div className="space-y-3 pb-3 border-b">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleGantiMode("baru")}
                    className={`flex-1 text-sm py-2 rounded-md border transition-colors ${
                      mode !== "existing"
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    Wali Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGantiMode("existing")}
                    className={`flex-1 text-sm py-2 rounded-md border transition-colors ${
                      mode === "existing"
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    Anak dari Wali yang Sudah Ada
                  </button>
                </div>

                {mode === "existing" && (
                  selectedWali ? (
                    <div className="flex items-center justify-between p-2.5 rounded-md border border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-800 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className="w-4 h-4 text-green-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{selectedWali.namawali || "-"}</p>
                          <p className="text-xs text-muted-foreground truncate">{selectedWali.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWali(null);
                          form.setValue("wali_auth_id" as Path<T>, "" as any);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={waliQuery}
                        onChange={(e) => setWaliQuery(e.target.value)}
                        placeholder="Cari wali yang sudah terdaftar..."
                        className="w-full pl-8 pr-2 py-2 text-sm rounded-md border bg-background"
                      />
                        {waliQuery.trim().length >= 2 && (
                        <div className="mt-1 border rounded-md max-h-48 overflow-y-auto divide-y">
                          {isSearchingWali ? (
                            <p className="text-xs text-muted-foreground p-2">Mencari...</p>
                          ) : waliResults.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-2">
                              Wali tidak ditemukan (coba cari pakai nama, email, atau no. WA)
                            </p>
) : (
                            waliResults.map((w) => (
                              <div
                                key={w.wali_auth_id}
                                onClick={() => handlePilihWali(w)}
                                className="p-2.5 text-sm cursor-pointer hover:bg-muted/60"
                              >
                                <p className="font-medium">{w.namawali || "-"}</p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{w.email || "-"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                  <Phone className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{w.nowa || "-"}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}  
                    </div>
                  )
                )}
              </div>
            )}

            {type === "Update" && (
              <div className="space-y-2 pb-3 border-b">
                {!showPindahWali ? (
                  <button
                    type="button"
                    onClick={() => setShowPindahWali(true)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Siswa ini ternyata anak dari wali yang sudah terdaftar? Pindahkan di sini
                  </button>
                ) : selectedWaliBaru ? (
                  <div className="flex items-center justify-between p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Akan dipindah ke wali:</p>
                        <p className="font-medium truncate">{selectedWaliBaru.namawali || "-"}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedWaliBaru.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWaliBaru(null);
                        form.setValue("wali_auth_id_baru" as Path<T>, "" as any);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={waliBaruQuery}
                      onChange={(e) => setWaliBaruQuery(e.target.value)}
                      placeholder="Cari nama wali, email, atau no. WA tujuan..."
                      className="w-full pl-8 pr-2 py-2 text-sm rounded-md border bg-background"
                      autoFocus
                    />
                    {waliBaruQuery.trim().length >= 2 && (
                      <div className="mt-1 border rounded-md max-h-40 overflow-y-auto divide-y">
                        {isSearchingWaliBaru ? (
                          <p className="text-xs text-muted-foreground p-2">Mencari...</p>
                        ) : waliBaruResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-2">Wali tidak ditemukan</p>
                        ) : (
                          waliBaruResults.map((w) => (
                            <div
                              key={w.wali_auth_id}
                              onClick={() => handlePilihWaliBaru(w)}
                              className="p-2.5 text-sm cursor-pointer hover:bg-muted/60"
                            >
                              <p className="font-medium">{w.namawali || "-"}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate">{w.email || "-"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <Phone className="w-3 h-3 shrink-0" />
                                <span className="truncate">{w.nowa || "-"}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowPindahWali(false); setWaliBaruQuery(""); }}
                      className="text-xs text-muted-foreground hover:underline mt-1"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}

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
                  label={mode === "existing" ? "Email Login Wali (otomatis, mengikuti akun yang dipilih)" : "Email (untuk login wali)"}
                  placeholder="email@example.com"
                  type="email"
                  disabled={mode === "existing"}
                />
                {mode !== "existing" && (
                  <FormInput
                    form={form}
                    name={"password" as Path<T>}
                    label="Password"
                    placeholder="Min. 6 karakter"
                    type="password"
                  />
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                form={form}
                name={"NIS" as Path<T>}
                label="NIS"
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

            {/* FIX: field Alamat baru, ditampilkan di halaman Info Siswa
                (kartu Data Wali Siswa) */}
            <FormInput
              form={form}
              name={"alamat" as Path<T>}
              label="Alamat (Opsional)"
              placeholder="Alamat tempat tinggal"
              type="textarea"
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