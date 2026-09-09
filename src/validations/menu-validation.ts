// src/validations/menu-validation.ts
import { z } from "zod";

export const menuFormSchema = z
  .object({
    jenisTagihan: z.string().min(1, "Jenis tagihan wajib dipilih"),

    // PPDB
    gelombangPPDB: z.string().optional(),
    tahunPPDB: z.string().optional(),

    // Daftar Ulang
    semesterDaftarUlang: z.string().optional(),
    tahunDaftarUlang: z.string().optional(),

    // SPP
    tipeSPP: z.string().optional(),
    bulanSPP: z.string().optional(),
    tahunSPP: z.string().optional(),
    semesterSPP: z.string().optional(),

    // Lainnya
    namaTagihanManual: z.string().optional(),

    // Common
    jenjang: z.string().min(1, "Jenjang wajib dipilih"),
    nominal: z
      .string()
      .min(1, "Nominal wajib diisi")
      .refine((val) => /^\d+$/.test(val), {
        message: "Nominal harus berupa angka",
      })
      .refine((val) => Number(val) > 1000, {
        message: "Nominal harus lebih dari 1000",
      }),
    description: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // FIX: validasi field Gelombang + Tahun untuk PPDB
    if (data.jenisTagihan === "PPDB") {
      if (!data.gelombangPPDB) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gelombang wajib dipilih",
          path: ["gelombangPPDB"],
        });
      }
      if (!data.tahunPPDB) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tahun wajib dipilih",
          path: ["tahunPPDB"],
        });
      }
    }

    if (data.jenisTagihan === "Daftar Ulang") {
      if (!data.semesterDaftarUlang) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Semester wajib dipilih",
          path: ["semesterDaftarUlang"],
        });
      }
      if (!data.tahunDaftarUlang) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tahun wajib dipilih",
          path: ["tahunDaftarUlang"],
        });
      }
    }

    if (
      data.jenisTagihan === "SPP Reguler" ||
      data.jenisTagihan === "SPP Subsidi"
    ) {
      if (!data.tipeSPP) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tipe SPP wajib dipilih",
          path: ["tipeSPP"],
        });
      }
      if (data.tipeSPP === "Bulanan") {
        if (!data.bulanSPP) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Bulan wajib dipilih",
            path: ["bulanSPP"],
          });
        }
        if (!data.tahunSPP) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Tahun wajib dipilih",
            path: ["tahunSPP"],
          });
        }
      }
      if (data.tipeSPP === "Semesteran") {
        if (!data.semesterSPP) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Semester wajib dipilih",
            path: ["semesterSPP"],
          });
        }
        if (!data.tahunSPP) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Tahun wajib dipilih",
            path: ["tahunSPP"],
          });
        }
      }
    }

    // FIX: validasi nama manual untuk jenis "Lainnya"
    if (data.jenisTagihan === "Lainnya") {
      if (!data.namaTagihanManual || !data.namaTagihanManual.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nama tagihan wajib diisi",
          path: ["namaTagihanManual"],
        });
      }
    }
  });

// Schema untuk DB / server action (namaTagihan sudah di-generate)
export const menuSchema = z.object({
  id_masterTagihan: z.number().optional(),
  namaTagihan: z.string(),
  jenjang: z.string(),
  jenisTagihan: z.string(),
  nominal: z.number(),
  description: z.string().optional(),
});

export type MenuForm = z.infer<typeof menuFormSchema>;
export type Menu = z.infer<typeof menuSchema>;