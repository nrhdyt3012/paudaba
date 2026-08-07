"use client";

import { useAuthStore } from "@/stores/auth-store";
import { pilihAnakAktif } from "../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function PilihAnakPage() {
  const profile = useAuthStore((state) => state.profile);
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePilih = async (siswaId: string) => {
    setLoadingId(siswaId);
    const res = await pilihAnakAktif(siswaId);
    if (res.status === "success") {
      router.push("/siswa/info");
      router.refresh();
    } else {
      setLoadingId(null);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">Pilih Data Siswa</h1>
        <p className="text-sm text-muted-foreground">
          Akun Anda menaungi lebih dari satu siswa. Pilih salah satu untuk dilihat.
        </p>
      </div>
      <div className="space-y-2">
        {(((profile as any)?.children) || []).map((anak: any) => (
          <button
            key={anak.id}
            onClick={() => handlePilih(anak.id)}
            disabled={!!loadingId}
            className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/60 transition-colors text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
              {anak.namaSiswa?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{anak.namaSiswa}</p>
              <p className="text-xs text-muted-foreground">{anak.kelas} · NIS {anak.NIS}</p>
            </div>
            {loadingId === anak.id && <Loader2 className="w-4 h-4 animate-spin" />}
          </button>
        ))}
      </div>
    </div>
  );
}