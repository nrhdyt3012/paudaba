"use server";

// src/app/(dashboard)/admin/menu/actions.ts

import { createClient } from "@/lib/supabase/server";
import { writeChangelog } from "@/lib/changelog";
import { MenuFormState } from "@/types/menu";
import { menuSchema } from "@/validations/menu-validation";
import { revalidatePath } from "next/cache";

export async function createMenu(prevState: MenuFormState, formData: FormData) {
  const validatedFields = menuSchema.safeParse({
    namaTagihan: formData.get("namaTagihan"),
    jenjang: formData.get("jenjang"),
    jenisTagihan: formData.get("jenisTagihan"),
    nominal: parseFloat(formData.get("nominal") as string) || 0,
    description: formData.get("description") || "",
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      errors: { ...validatedFields.error.flatten().fieldErrors, _form: [] },
    };
  }

  const supabase = await createClient({ isAdmin: true });

  const { error } = await supabase.from("master_tagihan").insert({
    namatagihan: validatedFields.data.namaTagihan,
    jenjang: validatedFields.data.jenjang,
    jenistagihan: validatedFields.data.jenisTagihan, // "Reguler" | "Subsidi"
    nominal: validatedFields.data.nominal,
    description: validatedFields.data.description,
  });

  if (error) {
    return { status: "error", errors: { ...prevState.errors, _form: [error.message] } };
  }

  // Gunakan jenisTagihanDisplay (e.g. "SPP Reguler") untuk deskripsi changelog yang lebih jelas
  const jenisTagihanDisplay = (formData.get("jenisTagihanDisplay") as string) || validatedFields.data.jenisTagihan;

  await writeChangelog({
    supabase,
    namamenu: "Master Tagihan",
    jenisaksi: "TAMBAH",
    deskripsi: `Menambahkan master tagihan "${validatedFields.data.namaTagihan}" (${validatedFields.data.jenjang} - ${jenisTagihanDisplay})`,
  });

  revalidatePath("/admin/menu");
  return { status: "success" };
}

export async function updateMenu(prevState: MenuFormState, formData: FormData) {
  const validatedFields = menuSchema.safeParse({
    id_masterTagihan: parseInt(formData.get("id") as string),
    namaTagihan: formData.get("namaTagihan"),
    jenjang: formData.get("jenjang"),
    jenisTagihan: formData.get("jenisTagihan"),
    nominal: parseFloat(formData.get("nominal") as string) || 0,
    description: formData.get("description") || "",
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      errors: { ...validatedFields.error.flatten().fieldErrors, _form: [] },
    };
  }

  const supabase = await createClient({ isAdmin: true });

  const { error } = await supabase
    .from("master_tagihan")
    .update({
      namatagihan: validatedFields.data.namaTagihan,
      jenjang: validatedFields.data.jenjang,
      jenistagihan: validatedFields.data.jenisTagihan,
      nominal: validatedFields.data.nominal,
      description: validatedFields.data.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id_mastertagihan", validatedFields.data.id_masterTagihan);

  if (error) {
    return { status: "error", errors: { ...prevState.errors, _form: [error.message] } };
  }

  const jenisTagihanDisplay = (formData.get("jenisTagihanDisplay") as string) || validatedFields.data.jenisTagihan;

  await writeChangelog({
    supabase,
    namamenu: "Master Tagihan",
    jenisaksi: "UBAH",
    deskripsi: `Mengubah master tagihan "${validatedFields.data.namaTagihan}" (${validatedFields.data.jenjang} - ${jenisTagihanDisplay})`,
  });

  revalidatePath("/admin/menu");
  return { status: "success" };
}

// FIX: dipisah jadi helper supaya logic cascade delete (hapus semua data
// turunan dari satu idtagihansiswa) bisa dipakai bareng-bareng oleh
// deleteMenu (single) maupun deleteManyMenu (bulk), tanpa duplikasi.
async function cascadeDeleteTagihanSiswa(supabase: any, idTagihanSiswa: number) {
  // Hapus rekapan_tunggakan
  await supabase
    .from("rekapan_tunggakan")
    .delete()
    .eq("idtagihansiswa", idTagihanSiswa);

  // Hapus pembayaran yang gagal/pending beserta log gateway-nya
  const { data: pembayaranList } = await supabase
    .from("pembayaran")
    .select("idpembayaran")
    .eq("idtagihansiswa", idTagihanSiswa);

  if (pembayaranList && pembayaranList.length > 0) {
    const idPembayaranList = pembayaranList.map((p: any) => p.idpembayaran);
    await supabase
      .from("payment_gateway_log")
      .delete()
      .in("idpembayaran", idPembayaranList);

    await supabase
      .from("pembayaran")
      .delete()
      .in("idpembayaran", idPembayaranList);
  }

  // Hapus log notifikasi WhatsApp
  await supabase
    .from("whatsapp_notification_logs")
    .delete()
    .eq("target_id", idTagihanSiswa);

  // Hapus tagihan_siswa itu sendiri
  await supabase
    .from("tagihan_siswa")
    .delete()
    .eq("idtagihansiswa", idTagihanSiswa);
}

export async function deleteMenu(prevState: MenuFormState, formData: FormData) {
  const supabase = await createClient({ isAdmin: true });
  const id = parseInt(formData.get("id") as string);

  const { data: existing } = await supabase
    .from("master_tagihan")
    .select("namatagihan")
    .eq("id_mastertagihan", id)
    .maybeSingle();

  // FIX: Cek apakah ada tagihan_siswa yang masih mereferensi master ini
  const { data: tagihanList } = await supabase
    .from("tagihan_siswa")
    .select("idtagihansiswa")
    .eq("idmastertagihan", id);

  if (tagihanList && tagihanList.length > 0) {
    for (const tagihan of tagihanList) {
      await cascadeDeleteTagihanSiswa(supabase, tagihan.idtagihansiswa);
    }
  }

  const { error } = await supabase
    .from("master_tagihan")
    .delete()
    .eq("id_mastertagihan", id);

  if (error) {
    return { status: "error", errors: { ...prevState.errors, _form: [error.message] } };
  }

  await writeChangelog({
    supabase,
    namamenu: "Master Tagihan",
    jenisaksi: "HAPUS",
    deskripsi: `Menghapus master tagihan "${existing?.namatagihan || `#${id}`}" dan ${tagihanList?.length || 0} tagihan yang terkait`,
  });

  revalidatePath("/admin/menu");
  return { status: "success" };
}

// FIX: hapus banyak master tagihan sekaligus (untuk fitur pilih banyak /
// bulk delete di halaman Master Tagihan). Dipanggil langsung dari client
// component (bukan lewat <form action>), karena jumlah id-nya dinamis.
export async function deleteManyMenu(ids: number[]) {
  if (!ids || ids.length === 0) {
    return { status: "error", message: "Tidak ada data yang dipilih" };
  }

  const supabase = await createClient({ isAdmin: true });

  const { data: existingList } = await supabase
    .from("master_tagihan")
    .select("id_mastertagihan, namatagihan")
    .in("id_mastertagihan", ids);

  let totalTagihanTerkait = 0;

  for (const id of ids) {
    const { data: tagihanList } = await supabase
      .from("tagihan_siswa")
      .select("idtagihansiswa")
      .eq("idmastertagihan", id);

    if (tagihanList && tagihanList.length > 0) {
      totalTagihanTerkait += tagihanList.length;
      for (const tagihan of tagihanList) {
        await cascadeDeleteTagihanSiswa(supabase, tagihan.idtagihansiswa);
      }
    }
  }

  const { error } = await supabase
    .from("master_tagihan")
    .delete()
    .in("id_mastertagihan", ids);

  if (error) {
    return { status: "error", message: error.message };
  }

  const namaList = (existingList || []).map((m: any) => m.namatagihan).join(", ");

  await writeChangelog({
    supabase,
    namamenu: "Master Tagihan",
    jenisaksi: "HAPUS",
    deskripsi: `Menghapus ${ids.length} master tagihan sekaligus (${namaList}) beserta ${totalTagihanTerkait} tagihan yang terkait`,
  });

  revalidatePath("/admin/menu");
  return { status: "success" };
}