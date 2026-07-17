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
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  // FIX: tambah "currency" — tampilan angka otomatis pakai titik ribuan
  // (mis. 700.000), tapi value yang disimpan di form tetap angka murni.
  type?: string;
}) {
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
                  className="pl-9"
                />
              </div>
            ) : (
              <Input
                {...rest}
                value={value ?? ""}
                onChange={onChange}
                type={type}
                placeholder={placeholder}
                autoComplete="off"
              />
            )}
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
