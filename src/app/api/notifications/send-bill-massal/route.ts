/**
 * API Endpoint: POST /api/notifications/send-bill-massal
 * FIX poin 4: mengirim SATU pesan WhatsApp per SISWA yang merangkum SEMUA
 * tagihan tertunggak/belum lunas miliknya, bukan satu pesan per tagihan.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWhatsAppNotificationService } from "@/lib/fonnte/whatsapp-sender";

interface SendBillMassalRequest {
  idSiswa: string;
  // ID tagihan_siswa yang mau digabung jadi satu pesan untuk siswa ini
  idTagihanList: number[];
}

const BULAN_NAMA = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export async function POST(request: NextRequest) {
  try {
    const body: SendBillMassalRequest = await request.json();
    const { idSiswa, idTagihanList } = body;

    if (!idSiswa || !Array.isArray(idTagihanList) || idTagihanList.length === 0) {
      return NextResponse.json(
        { error: "idSiswa dan idTagihanList harus disediakan" },
        { status: 400 }
      );
    }

    const supabase = await createClient({ isAdmin: true });

    const { data: tagihanList, error: tagihanError } = await supabase
      .from("tagihan_siswa")
      .select(
        `
        idtagihansiswa,
        jumlahtagihan,
        jumlahterbayar,
        bulan,
        tahun,
        statuspembayaran,
        master_tagihan(namatagihan),
        siswa(namasiswa, nowa, namawali, kelas)
      `
      )
      .in("idtagihansiswa", idTagihanList)
      .eq("idsiswa", idSiswa)
      .in("statuspembayaran", ["BELUM BAYAR", "BELUM LUNAS"]);

    if (tagihanError || !tagihanList || tagihanList.length === 0) {
      return NextResponse.json(
        { error: "Tagihan tidak ditemukan atau sudah lunas semua" },
        { status: 404 }
      );
    }

    const first = (v: any) => (Array.isArray(v) ? v[0] : v);
    const siswa = first(tagihanList[0].siswa);

    if (!siswa || !siswa.nowa) {
      return NextResponse.json(
        { error: "Nomor WhatsApp wali tidak ditemukan" },
        { status: 400 }
      );
    }

    const daftarTagihan = tagihanList.map((t: any) => {
      const master = first(t.master_tagihan);
      const sisa = Math.max(
        0,
        parseFloat(t.jumlahtagihan || "0") - parseFloat(t.jumlahterbayar || "0")
      );
      return {
        namaTagihan: master?.namatagihan || "Tagihan",
        periode: `${BULAN_NAMA[t.bulan] || t.bulan} ${t.tahun}`,
        sisa,
      };
    });

    const totalSisa = daftarTagihan.reduce((s, t) => s + t.sisa, 0);

    if (totalSisa <= 0) {
      return NextResponse.json(
        { error: "Semua tagihan yang dipilih sudah lunas" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    // Link umum ke halaman tagihan siswa (bukan link 1 tagihan spesifik,
    // karena pesan ini merangkum BEBERAPA tagihan sekaligus).
    const linkPembayaran = `${appUrl}/siswa/tagihan`;

    const whatsAppService = getWhatsAppNotificationService();

    const result = await whatsAppService.sendNotification({
      recipientPhone: siswa.nowa,
      messageType: "REMINDER_GABUNGAN",
      targetId: tagihanList[0].idtagihansiswa,
      recipientName: siswa.namawali || "Wali Murid",
      studentName: siswa.namasiswa,
      data: {
        kelas: siswa.kelas || "",
        daftarTagihan,
        totalSisa,
        linkPembayaran,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Gagal mengirim notifikasi" },
        { status: 500 }
      );
    }

    // Tandai semua tagihan yang dirangkum sebagai sudah diingatkan
    await supabase
      .from("tagihan_siswa")
      .update({ whatsapp_notified_at: new Date().toISOString() })
      .in(
        "idtagihansiswa",
        tagihanList.map((t: any) => t.idtagihansiswa)
      );

    console.log(
      `✅ [NOTIFICATION-BILL-MASSAL] Reminder gabungan terkirim untuk siswa ${idSiswa} (${tagihanList.length} tagihan), message_id: ${result.messageId}`
    );

    return NextResponse.json({
      success: true,
      message: "Reminder gabungan berhasil dikirim",
      messageId: result.messageId,
      siswa: siswa.namasiswa,
      totalTagihan: tagihanList.length,
      totalSisa,
    });
  } catch (error: any) {
    console.error("[NOTIFICATION-BILL-MASSAL] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
