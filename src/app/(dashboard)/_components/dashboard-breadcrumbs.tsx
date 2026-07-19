"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

// Map path segment ke label yang lebih bersih
const PATH_LABELS: Record<string, string> = {
  admin: "Bendahara",
  siswa: "Siswa",
  tagihan: "Tagihan",
  riwayat: "Riwayat Pembayaran",
  info: "Info Siswa",
  menu: "Master Tagihan",
  user: "Data Siswa",
  "rekapan-pembayaran": "Rekapan Pembayaran",
  "rekapan-tunggakan": "Rekapan Tunggakan",
  payment: "Pembayaran",
  success: "Berhasil",
  failed: "Gagal",
  bendahara:"Kelola Akun"
};

export default function DashboardBreadcrumb() {
  const pathname = usePathname();
  const paths = pathname.split("/").filter(Boolean);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {paths.map((path, index) => {
          const label = PATH_LABELS[path] || path.charAt(0).toUpperCase() + path.slice(1);
          return (
            <Fragment key={`path-${path}-${index}`}>
              <BreadcrumbItem className="capitalize">
                {index < paths.length - 1 ? (
                  <BreadcrumbLink href={`/${paths.slice(0, index + 1).join("/")}`}>
                    {label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {index < paths.length - 1 && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}