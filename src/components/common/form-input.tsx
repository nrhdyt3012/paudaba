import { useState } from "react";
import { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Eye, EyeOff } from "lucide-react";

// FIX: helper format ribuan gaya Indonesia — "700000" -> "700.000".
// Hanya untuk TAMPILAN; nilai yang benar-benar disimpan di form tetap
// angka murni tanpa titik (biar tidak perlu ubah parseFloat/parseInt yang
// sudah ada di action & komponen lain).
function formatRibuan(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  const digitsOnly = String(value).replace(/\D/g, "");
  if (!digitsOnly) return "";
  return new Intl.NumberFormat("id-ID").format(parseInt(digitsOnly, 10));
}

export default function FormInput<T extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  type = "text",
  disabled = false,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  // FIX: tambah "currency" — tampilan angka otomatis pakai titik ribuan
  // (mis. 700.000), tapi value yang disimpan di form tetap angka murni.
  type?: string;
  // FIX: dukung field yang perlu dikunci (mis. email wali otomatis-isi
  // saat mode "existing" dipilih di form-user.tsx), diteruskan ke semua
  // varian Input/Textarea di bawah.
  disabled?: boolean;
}) {
  // FIX: state show/hide khusus untuk field bertipe "password" — dipakai
  // untuk toggle ikon mata (Eye/EyeOff). Karena tiap FormInput adalah
  // instance komponen tersendiri per field, state ini otomatis independen
  // antar field password yang berbeda (mis. "Password" vs "Password Baru"
  // di form yang sama tidak akan saling mempengaruhi).
  const [showPassword, setShowPassword] = useState(false);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field: { onChange, value, ...rest } }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {type === "textarea" ? (
              <Textarea
                {...rest}
                value={value ?? ""}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete="off"
                disabled={disabled}
                className="resize-none"
              />
            ) : type === "currency" ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  Rp
                </span>
                <Input
                  {...rest}
                  type="text"
                  inputMode="numeric"
                  value={formatRibuan(value)}
                  onChange={(e) => {
                    // Simpan hanya digit murni (tanpa titik) ke form state
                    const digitsOnly = e.target.value.replace(/\D/g, "");
                    onChange(digitsOnly);
                  }}
                  placeholder={placeholder}
                  autoComplete="off"
                  disabled={disabled}
                  className="pl-9"
                />
              </div>
            ) : type === "password" ? (
              // FIX: tambah ikon mata untuk show/hide password. Input
              // tetap ter-mask (titik-titik) secara default — ikon mata
              // cuma toggle attribute `type` antara "password" <-> "text"
              // saat diklik, sesuai standar UX form password pada umumnya.
              <div className="relative">
                <Input
                  {...rest}
                  value={value ?? ""}
                  onChange={onChange}
                  type={showPassword ? "text" : "password"}
                  placeholder={placeholder}
                  autoComplete="off"
                  disabled={disabled}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={disabled}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            ) : (
              <Input
                {...rest}
                value={value ?? ""}
                onChange={onChange}
                type={type}
                placeholder={placeholder}
                autoComplete="off"
                disabled={disabled}
              />
            )}
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}