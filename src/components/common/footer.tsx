// src/components/common/footer.tsx
import Image from "next/image";
import Link from "next/link";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/logo.jpg"
                alt="Logo"
                width={50}
                height={50}
                className="rounded-full"
              />
              <div>
                <h3 className="font-bold text-lg">KB TK Aisyiyah</h3>
                <p className="text-xs text-gray-400">Bustanul Athfal 1 Buduran</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Pendidikan anak usia dini dengan metode Ramah Otak Anak yang
              mengoptimalkan tumbuh kembang anak.
            </p>
            <div className="text-sm">
              <p className="font-semibold text-teal-400 mb-1">Motto:</p>
              <p className="italic">"Sholih, Ceria, Mandiri"</p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Menu Cepat</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/#profil"
                  className="text-gray-400 hover:text-teal-400 transition-colors"
                >
                  Profil
                </Link>
              </li>
              <li>
                <Link
                  href="/#fasilitas"
                  className="text-gray-400 hover:text-teal-400 transition-colors"
                >
                  Fasilitas
                </Link>
              </li>
              <li>
                <Link
                  href="/info-sekolah"
                  className="text-gray-400 hover:text-teal-400 transition-colors"
                >
                  Program & Gallery
                </Link>
              </li>
              <li>
                <Link
                  href="/ppdb"
                  className="text-gray-400 hover:text-teal-400 transition-colors"
                >
                  PPDB 2026/2027
                </Link>
              </li>
              <li>
                <Link
                  href="/#kontak"
                  className="text-gray-400 hover:text-teal-400 transition-colors"
                >
                  Kontak
                </Link>
              </li>
              <li>
                <Link
                  href="/#syarat-ketentuan"
                  className="text-gray-400 hover:text-teal-400 transition-colors"
                >
                  Syarat & Ketentuan
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Kontak</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <span className="text-gray-400">
                  Jl. Kavling Persada Asri C-37
                  <br />
                  Damarsi, Buduran, Sidoarjo
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-teal-400 shrink-0" />
                <div>
                  <p className="text-gray-400">Ust. Aminah</p>
                  <p className="text-gray-400">0815 5336 6321</p>
                </div>
              </li>
              <li className="flex items-center gap-2">
                <Instagram className="w-5 h-5 text-teal-400 shrink-0" />
                <span className="text-gray-400">@abasatubuduran</span>
              </li>
            </ul>
          </div>

          {/* Program Unggulan */}
          <div>
            <h4 className="font-semibold mb-4">Program Unggulan</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-teal-400">•</span>
                <span>Mengaji & Tahfidz Metode UMMI</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400">•</span>
                <span>Do'a dan Hadist</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400">•</span>
                <span>Petualangan Maharaja</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400">•</span>
                <span>Berkemandirian & Karakter Islami</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400">•</span>
                <span>Tuntas Toilet Training</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="grid md:grid-cols-2 gap-4 text-center md:text-left">
            <div>
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} KB TK 'Aisyiyah Bustanul Athfal 1
                Buduran
              </p>
              <p className="text-sm text-gray-400 mt-1">
                All rights reserved.
              </p>
            </div>
            <div className="text-sm text-gray-400 md:text-right">
              <p className="italic">
                "Diuruk karena menarik, disuka karena beda"
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Developed by Dwi Nurhidayat – Universitas Negeri Surabaya
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}