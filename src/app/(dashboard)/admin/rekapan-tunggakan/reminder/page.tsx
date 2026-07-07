import ReminderTunggakan from "./_components/reminder-tunggakan";

// FIX poin 4: halaman penuh (bukan popup/dialog) untuk reminder WA,
// dengan daftar digabung per siswa (bukan per tagihan).
export default function ReminderTunggakanPage() {
  return (
    <div className="w-full">
      <ReminderTunggakan />
    </div>
  );
}
