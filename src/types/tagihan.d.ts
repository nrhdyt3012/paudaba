// src/types/tagihan.d.ts
export type TagihanFormState = {
  status?: string;
  errors?: {
    siswa_ids?: string[];
    master_tagihan_id?: string[];
    bulan?: string[];
    tahun?: string[];
    _form?: string[];
  };
};

// "KADALUARSA" sengaja dihapus dari status tagihan — itu status transaksi
// (level `pembayaran`/Midtrans), bukan status tagihan. Kalau link Midtrans
// hangus, tagihan tetap "BELUM BAYAR" / "BELUM LUNAS", bukan "KADALUARSA".
export type StatusPembayaranTagihan = "BELUM BAYAR" | "BELUM LUNAS" | "LUNAS";

export type TagihanSiswa = {
  idTagihanSiswa: number;
  idSiswa: string;
  idMasterTagihan: number;
  bulan: number;
  tahun: number;
  jumlahTagihan: number;
  jumlahTerbayar: number;
  sisa: number;
  statuspembayaran: StatusPembayaranTagihan;
  paymentToken: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TagihanWithDetails = TagihanSiswa & {
  siswa: {
    id: string;
    namaSiswa: string;
    avatarUrl: string;
    kelas: string;
  };
  master_tagihan: {
    id_masterTagihan: number;
    namaTagihan: string;
    jenjang: string;
    nominal: number;
    jenisTagihan: string;
  };
};
