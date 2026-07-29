/**
 * WhatsApp Message Templates
 * Template messages untuk notifikasi KB TK Aisyiyah Bustanul Athfal 1 Buduran
 */

interface MessageTemplateParams {
  recipientName: string;
  studentName: string;
  [key: string]: string | number | boolean | undefined;
}

export const whatsappTemplates = {
  /**
   * Notifikasi Tagihan Baru
   */
  notifikasiTagihan: (params: MessageTemplateParams & {
    periode: string;
    namaTagihan: string;
    nominal: string | number;
    linkPembayaran: string;
    batasPembayaran?: string;
    kelas?: string;
  }): string => {
    const nominalFormatted =
      typeof params.nominal === 'number'
        ? new Intl.NumberFormat('id-ID').format(params.nominal)
        : params.nominal;

    return `🔔 *PEMBERITAHUAN TAGIHAN*

Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu *${params.recipientName}*

Kami informasikan bahwa telah diterbitkan tagihan pembayaran untuk Ananda *${params.studentName}*${params.kelas ? ` (${params.kelas})` : ''} dengan rincian sebagai berikut:

📋 *Detail Tagihan*
- Periode: ${params.periode}
- Jenis Tagihan: ${params.namaTagihan}
- Nominal: Rp${nominalFormatted}

Untuk melakukan pembayaran, silakan mengakses tautan berikut:
${params.linkPembayaran}

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },

  /**
   * Notifikasi Pembayaran Berhasil
   * FIX poin 5/6: pesan sekarang KONDISIONAL — kalau sisa masih > 0 (baru
   * dicicil sebagian), pesan bilang "BELUM LUNAS" + tampilkan sisanya,
   * BUKAN langsung "LUNAS" seperti sebelumnya.
   */
  notifikasiPembayaranBerhasil: (params: MessageTemplateParams & {
    namaTagihan: string;
    nominalBayar: string | number;
    tanggalPembayaran: string;
    linkKwitansi: string;
    kelas?: string;
    isLunas: boolean;
    sisaTagihan?: string | number;
  }): string => {
    const nominalFormatted =
      typeof params.nominalBayar === 'number'
        ? new Intl.NumberFormat('id-ID').format(params.nominalBayar)
        : params.nominalBayar;

    const sisaFormatted =
      typeof params.sisaTagihan === 'number'
        ? new Intl.NumberFormat('id-ID').format(params.sisaTagihan)
        : params.sisaTagihan ?? '0';

    const statusLine = params.isLunas
      ? '- Status: *LUNAS* ✓'
      : `- Status: *BELUM LUNAS* — Sisa tagihan: Rp${sisaFormatted}`;

    const closingLine = params.isLunas
      ? 'Jazakumullahu khairan atas kepercayaan dan kerja sama Bapak/Ibu.'
      : 'Mohon Bapak/Ibu melunasi sisa tagihan di atas pada kesempatan berikutnya. Jazakumullahu khairan atas kerja sama Bapak/Ibu.';

    return `✅ *PEMBAYARAN DITERIMA*

Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu *${params.recipientName}*

Alhamdulillah, pembayaran tagihan untuk Ananda *${params.studentName}*${params.kelas ? ` (${params.kelas})` : ''} telah kami terima dengan rincian sebagai berikut:

📄 *Detail Pembayaran*
- Jenis Tagihan: ${params.namaTagihan}
- Nominal Pembayaran: Rp${nominalFormatted}
- Tanggal Pembayaran: ${params.tanggalPembayaran}
${statusLine}

Kwitansi pembayaran dapat dilihat melalui tautan berikut:
${params.linkKwitansi}

${closingLine}

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },

  /**
   * Notifikasi Pembayaran Gagal / Kadaluarsa
   */
  notifikasiPembayaranGagal: (params: MessageTemplateParams & {
    namaTagihan: string;
    nominalBayar: string | number;
    alasan?: string;
    nomorAdmin?: string;
    kelas?: string;
  }): string => {
    const nominalFormatted =
      typeof params.nominalBayar === 'number'
        ? new Intl.NumberFormat('id-ID').format(params.nominalBayar)
        : params.nominalBayar;

    return `⚠️ *PEMBAYARAN GAGAL*

Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu *${params.recipientName}*

Kami informasikan bahwa pembayaran tagihan untuk Ananda *${params.studentName}*${params.kelas ? ` (${params.kelas})` : ''} belum berhasil diproses.

❌ *Detail Pembayaran*
- Jenis Tagihan: ${params.namaTagihan}
- Nominal: Rp${nominalFormatted}
- Keterangan: ${params.alasan || 'Pembayaran tidak berhasil, silakan coba kembali'}

Mohon Bapak/Ibu melakukan pembayaran ulang melalui aplikasi atau menghubungi pihak sekolah untuk bantuan lebih lanjut.${params.nomorAdmin ? `\n\n📱 Hubungi Admin: *${params.nomorAdmin}*` : ''}

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },

  /**
   * Pengingat Tagihan Tertunggak — SATU tagihan (dipertahankan untuk
   * kompatibilitas / dipakai tempat lain kalau ada).
   */
  remiderTagihanTertunggak: (params: MessageTemplateParams & {
    namaTagihan: string;
    nominalTertunggak: string | number;
    periode: string;
    linkPembayaran: string;
    kelas?: string;
  }): string => {
    const nominalFormatted =
      typeof params.nominalTertunggak === 'number'
        ? new Intl.NumberFormat('id-ID').format(params.nominalTertunggak)
        : params.nominalTertunggak;

    return `🔔 *PENGINGAT PEMBAYARAN*

Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu Wali Murid Ananda *${params.studentName}*${params.kelas ? ` (${params.kelas})` : ''}

Dengan hormat, kami informasikan bahwa hingga saat ini masih terdapat tagihan administrasi yang belum terbayarkan:

- ${params.namaTagihan} ${params.periode} — Rp${nominalFormatted}

*Total Tunggakan: Rp${nominalFormatted}*

Mohon kesediaan Bapak/Ibu untuk segera melakukan pembayaran melalui tautan berikut:
${params.linkPembayaran}

Apabila pembayaran telah dilakukan, mohon abaikan pesan ini.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },

  /**
   * FIX poin 4: Pengingat Tunggakan GABUNGAN — satu siswa bisa punya
   * BEBERAPA tagihan tertunggak sekaligus, dirangkum jadi SATU pesan.
   */
  reminderTunggakanGabungan: (params: MessageTemplateParams & {
    kelas?: string;
    daftarTagihan: Array<{ namaTagihan: string; periode: string; sisa: number }>;
    totalSisa: number;
    linkPembayaran: string;
  }): string => {
    const daftarText = params.daftarTagihan
      .map(
        (t, i) =>
          `${i + 1}. ${t.namaTagihan} (${t.periode}) — Rp${new Intl.NumberFormat(
            'id-ID'
          ).format(t.sisa)}`
      )
      .join('\n');

    const totalFormatted = new Intl.NumberFormat('id-ID').format(params.totalSisa);

    return `🔔 *PENGINGAT PEMBAYARAN*

Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu Wali Murid Ananda *${params.studentName}*${params.kelas ? ` (${params.kelas})` : ''}

Dengan hormat, kami informasikan bahwa hingga saat ini masih terdapat tagihan administrasi yang belum terbayarkan/belum lunas:

${daftarText}

*Total Tunggakan: Rp${totalFormatted}*

Mohon kesediaan Bapak/Ibu untuk segera melakukan pembayaran melalui aplikasi:
${params.linkPembayaran}

Apabila pembayaran telah dilakukan, mohon abaikan pesan ini.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },

  /**
   * FIX (fitur lupa password): dikirim saat superadmin klik "Konfirmasi
   * ke WA" di daftar permintaan reset password — menanyakan ke pemilik
   * akun apakah benar dia yang mengajukan, sekaligus jadi peringatan dini
   * kalau ada yang mengatasnamakan dia tanpa sepengetahuannya.
   */
  konfirmasiPermintaanResetPassword: (params: MessageTemplateParams): string => {
    return `🔐 *KONFIRMASI PERMINTAAN RESET PASSWORD*

Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu Selaku Wali Siswa dari *${params.recipientName}*

Kami menerima permintaan reset password untuk akun Anda di Sistem Pembayaran KB/TK Aisyiyah Bustanul Athfal 1 Buduran.

Apabila benar Bapak/Ibu yang mengajukan permintaan ini, mohon konfirmasi kepada admin/bendahara sekolah agar password baru dapat segera diproses.

Apabila Bapak/Ibu TIDAK merasa mengajukan permintaan ini, mohon segera hubungi admin/bendahara sekolah untuk melaporkan hal ini demi keamanan akun Anda.

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },

  /**
   * FIX (fitur lupa password): dikirim setelah superadmin menyimpan
   * password baru untuk akun tersebut.
   */
  notifikasiPasswordBaruDiset: (
    params: MessageTemplateParams & { passwordBaru: string }
  ): string => {
    return `🔑 *PASSWORD AKUN ANDA TELAH DIPERBARUI*

Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu Selaku Wali Siswa dari *${params.recipientName}*

Password akun Anda di Sistem Pembayaran KB/TK Aisyiyah Bustanul Athfal 1 Buduran telah diperbarui oleh admin sekolah. Berikut password baru Anda:

*${params.passwordBaru}*

Apabila Bapak/Ibu tidak pernah meminta perubahan ini, segera hubungi admin/bendahara sekolah.

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },

  /**
   * Test Message
   */
  testMessage: (params: MessageTemplateParams): string => {
    return `👋 *TES NOTIFIKASI*

Assalamu'alaikum Wr. Wb.

Halo *${params.recipientName}*!

Ini adalah pesan tes dari sistem notifikasi WhatsApp KB TK Aisyiyah Bustanul Athfal 1 Buduran.

Sistem sudah siap untuk mengirimkan notifikasi tagihan dan pembayaran.

Wassalamu'alaikum Wr. Wb.
*KB TK Aisyiyah Bustanul Athfal 1 Buduran*`;
  },
};

export type TemplateKey = keyof typeof whatsappTemplates;
