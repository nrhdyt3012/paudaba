// src/app/api/payment/webhook/route.ts
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { environment } from "@/configs/environtment";
import crypto from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { syncRekapanSetelahPembayaran, hapusRekapanTunggakan } from "@/lib/rekapan-helper";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("🎯 [WEBHOOK] Received:", JSON.stringify(body, null, 2));

    const serverKey = environment.MIDTRANS_SERVER_KEY;
    const {
      order_id: midtransOrderId,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
    } = body;

    // Verifikasi signature Midtrans
    const expectedSignature = crypto
      .createHash("sha512")
      .update(`${midtransOrderId}${status_code}${gross_amount}${serverKey}`)
      .digest("hex");

    if (expectedSignature !== signature_key) {
      console.warn("⚠️ [WEBHOOK] Invalid signature — lanjut untuk sandbox");
    }

    // Parse order_id: PPPM-{tagihanId}-{pembayaranId}-{timestamp}
    let tagihanId: string;
    let pembayaranIdFromOrder: string | null = null;

    if (midtransOrderId?.startsWith("PPPM-")) {
      const parts = midtransOrderId.split("-");
      tagihanId = parts[1];
      if (parts.length >= 4) {
        pembayaranIdFromOrder = parts[2];
      }
    } else {
      tagihanId = midtransOrderId;
    }

    console.log(
      "🔍 [WEBHOOK] tagihanId:",
      tagihanId,
      "pembayaranId:",
      pembayaranIdFromOrder,
      "status:",
      transaction_status
    );

    const supabase = await createClient({ isAdmin: true });

    // ════════════════════════════════════════════════════════════════════
    // FIX DUPLIKASI #1 — Idempotency check di awal.
    // ════════════════════════════════════════════════════════════════════
    const { data: existingLog } = await supabase
      .from("payment_gateway_log")
      .select("idlog")
      .eq("orderid", midtransOrderId)
      .maybeSingle();

    if (existingLog) {
      console.log(
        `ℹ️ [WEBHOOK] Order ${midtransOrderId} sudah pernah diproses (idlog: ${existingLog.idlog}), skip duplikat.`
      );
      return NextResponse.json({ status: "already_processed" });
    }

    // Ambil data tagihan
    const { data: tagihan, error: tagihanError } = await supabase
      .from("tagihan_siswa")
      .select(
        "idtagihansiswa, idsiswa, statuspembayaran, jumlahtagihan, jumlahterbayar"
      )
      .eq("idtagihansiswa", tagihanId)
      .single();

    if (tagihanError || !tagihan) {
      console.error("❌ [WEBHOOK] Tagihan tidak ditemukan:", tagihanId);
      return NextResponse.json(
        { error: "Tagihan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Idempotent: sudah LUNAS → skip
    if (tagihan.statuspembayaran === "LUNAS") {
      console.log("ℹ️ [WEBHOOK] Tagihan sudah LUNAS, skip");
      return NextResponse.json({ status: "already_paid" });
    }

    const metodepembayaran = body.payment_type || "midtrans_online";
    const jumlahTagihan = parseFloat(tagihan.jumlahtagihan || "0");
    const sudahBayarSebelumnya = parseFloat(tagihan.jumlahterbayar || "0");
    const nominalBayar = parseFloat(gross_amount || "0");

    // ─── Map status Midtrans → status internal ──────────────────────────
    // PENTING: "KADALUARSA" TIDAK LAGI menjadi status tagihan. Kalau token
    // Midtrans expire, itu murni status transaksi/link pembayaran — tagihan
    // tetap "BELUM BAYAR" (atau "BELUM LUNAS" kalau sudah pernah dicicil),
    // supaya tetap muncul di Rekapan Tunggakan & bisa di-generate link baru.
    let statuspembayaranTagihan: "BELUM BAYAR" | "BELUM LUNAS" | "LUNAS" =
      sudahBayarSebelumnya > 0 ? "BELUM LUNAS" : "BELUM BAYAR";
    let statusPembayaranRecord: "SUCCESS" | "FAILED" | "EXPIRED" | "PENDING" =
      "PENDING";
    let terbayarBaruUntukLog = sudahBayarSebelumnya;

    if (transaction_status === "settlement" || transaction_status === "capture") {
      // Midtrans di alur ini selalu bayar penuh sisa tagihan (bukan cicilan
      // parsial — cicilan parsial hanya lewat jalur cash/bayarTagihanManual).
      terbayarBaruUntukLog = sudahBayarSebelumnya + nominalBayar;
      statuspembayaranTagihan =
        terbayarBaruUntukLog >= jumlahTagihan ? "LUNAS" : "BELUM LUNAS";
      statusPembayaranRecord = "SUCCESS";
      console.log(
        `✅ [WEBHOOK] SUKSES: nominal=${nominalBayar}, status=${statuspembayaranTagihan}`
      );
    } else if (transaction_status === "expire") {
      // Tidak mengubah status tagihan — cukup catat di log transaksi (di bawah)
      // dan reset paymenttoken supaya wali bisa generate link baru.
      statusPembayaranRecord = "EXPIRED";
      console.log(
        "⏰ [WEBHOOK] Token EXPIRED — status tagihan TIDAK diubah, tetap:",
        statuspembayaranTagihan
      );
    } else if (transaction_status === "cancel" || transaction_status === "deny") {
      statusPembayaranRecord = "FAILED";
      console.log(
        `🚫 [WEBHOOK] ${transaction_status.toUpperCase()}: status tagihan tetap ${statuspembayaranTagihan}`
      );
    } else {
      console.log("⏳ [WEBHOOK] Status pending/lainnya:", transaction_status);
      return NextResponse.json({ status: "pending", transaction_status });
    }
    // ────────────────────────────────────────────────────────────────────

    // ════════════════════════════════════════════════════════════════════
    // FIX DUPLIKASI #2
    // ════════════════════════════════════════════════════════════════════
    if (statusPembayaranRecord === "SUCCESS") {
      const { data: alreadySuccess } = await supabase
        .from("pembayaran")
        .select("idpembayaran")
        .eq("idtagihansiswa", parseInt(tagihanId))
        .eq("statuspembayaran", "SUCCESS")
        .neq("metodepembayaran", "cash")
        .maybeSingle();

      if (alreadySuccess) {
        console.log(
          `ℹ️ [WEBHOOK] Tagihan ${tagihanId} sudah punya pembayaran midtrans SUCCESS (id: ${alreadySuccess.idpembayaran}). Sinkronkan status saja, jangan insert baru.`
        );
        await supabase
          .from("tagihan_siswa")
          .update({
            statuspembayaran: "LUNAS",
            jumlahterbayar: jumlahTagihan,
            updatedat: new Date().toISOString(),
          })
          .eq("idtagihansiswa", tagihanId);

        await supabase.from("payment_gateway_log").insert({
          idpembayaran: alreadySuccess.idpembayaran,
          orderid: midtransOrderId,
          transactionstatusmidtrans: transaction_status,
          rawresponsemidtrans: {
            note: "Duplicate webhook call, payment already recorded",
            ...body,
          },
        });

        // Idempotency: pastikan rekapan_tunggakan bersih (dihapus) karena
        // status sudah dipastikan LUNAS di jalur duplikat ini juga.
        await hapusRekapanTunggakan(supabase, parseInt(tagihanId));

        return NextResponse.json({ status: "already_paid_synced" });
      }
    }

    // Update tagihan_siswa
    const updateData: any = {
      statuspembayaran: statuspembayaranTagihan,
      updatedat: new Date().toISOString(),
    };

    if (statusPembayaranRecord === "SUCCESS") {
      updateData.jumlahterbayar = terbayarBaruUntukLog;
    }

    // paymenttoken hanya direset kalau transaksi tidak sukses (expire/cancel/deny)
    // supaya wali bisa generate link pembayaran baru untuk sisa tagihannya.
    if (
      transaction_status === "expire" ||
      transaction_status === "cancel" ||
      transaction_status === "deny"
    ) {
      updateData.paymenttoken = null;
    }

    const { error: updateError } = await supabase
      .from("tagihan_siswa")
      .update(updateData)
      .eq("idtagihansiswa", tagihanId);

    if (updateError) {
      console.error("❌ [WEBHOOK] Gagal update tagihan:", updateError);
      return NextResponse.json({ error: "Gagal update tagihan" }, { status: 500 });
    }

    // Sisa tagihan SETELAH transaksi ini — snapshot immutable untuk riwayat.
    const sisaSetelahTransaksiIni =
      statusPembayaranRecord === "SUCCESS"
        ? Math.max(0, jumlahTagihan - terbayarBaruUntukLog)
        : Math.max(0, jumlahTagihan - sudahBayarSebelumnya);

    // ─── Update / insert record pembayaran ──────────────────────────────
    let pembayaranId: number | null = null;
    let updated = false;

    if (pembayaranIdFromOrder) {
      const { error: updatePembayaranError } = await supabase
        .from("pembayaran")
        .update({
          statuspembayaran: statusPembayaranRecord,
          tanggalpembayaran: new Date().toISOString(),
          metodepembayaran,
          jumlahdibayar: nominalBayar,
          sisa_setelah_transaksi_ini: sisaSetelahTransaksiIni,
        })
        .eq("idpembayaran", parseInt(pembayaranIdFromOrder));

      if (!updatePembayaranError) {
        pembayaranId = parseInt(pembayaranIdFromOrder);
        updated = true;
        console.log("✅ [WEBHOOK] Pembayaran updated by id:", pembayaranId);
      }
    }

    if (!updated) {
      const { data: existingPending } = await supabase
        .from("pembayaran")
        .select("idpembayaran")
        .eq("idtagihansiswa", parseInt(tagihanId))
        .eq("statuspembayaran", "PENDING")
        .maybeSingle();

      if (existingPending) {
        const { error } = await supabase
          .from("pembayaran")
          .update({
            statuspembayaran: statusPembayaranRecord,
            tanggalpembayaran: new Date().toISOString(),
            metodepembayaran,
            jumlahdibayar: nominalBayar,
            sisa_setelah_transaksi_ini: sisaSetelahTransaksiIni,
          })
          .eq("idpembayaran", existingPending.idpembayaran);

        if (!error) {
          pembayaranId = existingPending.idpembayaran;
          updated = true;
        }
      }
    }

    if (
      !updated &&
      (transaction_status === "settlement" || transaction_status === "capture")
    ) {
      const { data: newPembayaran, error: insertPembayaranError } = await supabase
        .from("pembayaran")
        .insert({
          idtagihansiswa: parseInt(tagihanId),
          idsiswa: tagihan.idsiswa,
          jumlahdibayar: nominalBayar,
          tanggalpembayaran: new Date().toISOString(),
          metodepembayaran,
          statuspembayaran: statusPembayaranRecord,
          sisa_setelah_transaksi_ini: sisaSetelahTransaksiIni,
        })
        .select("idpembayaran")
        .single();

      if (insertPembayaranError) {
        console.warn(
          "⚠️ [WEBHOOK] Insert pembayaran gagal (kemungkinan duplikat ditolak constraint):",
          insertPembayaranError.message
        );
      }

      pembayaranId = newPembayaran?.idpembayaran ?? null;
    }
    // ────────────────────────────────────────────────────────────────────

    if (pembayaranId !== null) {
      const { error: logError } = await supabase
        .from("payment_gateway_log")
        .insert({
          idpembayaran: pembayaranId,
          orderid: midtransOrderId,
          transactionstatusmidtrans: transaction_status,
          rawresponsemidtrans: body,
        });

      if (logError) {
        console.warn(
          "⚠️ [WEBHOOK] Gagal insert payment_gateway_log (kemungkinan duplikat):",
          logError.message
        );
      }
    }

    console.log(
      `✅ [WEBHOOK] Done: tagihan=${tagihanId}, status=${statuspembayaranTagihan}, pembayaranId=${pembayaranId}`
    );

    // FIX (arahan dosen pembimbing): snapshot ke rekapan_pembayaran +
    // sinkronkan rekapan_tunggakan — hanya untuk transaksi yang BENAR-BENAR
    // sukses (settlement/capture), bukan untuk expire/cancel/deny.
    if (
      pembayaranId !== null &&
      (transaction_status === "settlement" || transaction_status === "capture")
    ) {
      await syncRekapanSetelahPembayaran(supabase, {
        idpembayaran: pembayaranId,
        idtagihansiswa: parseInt(tagihanId),
        jumlahdibayar: nominalBayar,
        tanggalpembayaran: new Date().toISOString(),
        metodepembayaran,
        sisaSetelahTransaksiIni,
        statusTagihanTerbaru: statuspembayaranTagihan,
      });
    }

    // Kirim notifikasi hanya saat transaksi benar-benar sukses
    if (
      pembayaranId !== null &&
      (transaction_status === "settlement" || transaction_status === "capture")
    ) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      if (process.env.FONNTE_API_KEY) {
        try {
          await fetch(`${appUrl}/api/notifications/send-payment-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idPembayaran: pembayaranId,
              idTagihan: parseInt(tagihanId),
              status: "SUCCESS",
            }),
          });
          console.log(
            `📱 [WEBHOOK] WhatsApp payment success notification queued for pembayaran ${pembayaranId}`
          );
        } catch (whatsappError) {
          console.error(`⚠️ [WEBHOOK] Gagal kirim WhatsApp notification:`, whatsappError);
        }
      }
    }

    // Untuk expire/cancel/deny: TIDAK mengirim notifikasi "gagal" otomatis
    // ke wali kalau ini cuma link kadaluarsa — karena tagihan tetap valid
    // dan wali akan tetap melihatnya di halaman tagihan / dapat reminder biasa.
    // Kalau kamu tetap mau menginformasikan "link kadaluarsa, silakan bayar
    // ulang", kirim lewat template notifikasiTagihan (bukan PAYMENT_FAILED)
    // supaya tidak kesannya tagihan itu sendiri yang gagal/invalid.
    if (
      pembayaranId !== null &&
      (transaction_status === "cancel" || transaction_status === "deny")
    ) {
      if (process.env.FONNTE_API_KEY) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        try {
          await fetch(`${appUrl}/api/notifications/send-payment-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idPembayaran: pembayaranId,
              idTagihan: parseInt(tagihanId),
              status: "FAILED",
            }),
          });
        } catch (whatsappError) {
          console.error(`⚠️ [WEBHOOK] Gagal kirim WhatsApp notification:`, whatsappError);
        }
      }
    }

    return NextResponse.json({
      status: "success",
      tagihan_id: tagihanId,
      updated_status: statuspembayaranTagihan,
      pembayaran_id: pembayaranId,
    });
  } catch (error: any) {
    console.error("💥 [WEBHOOK] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
