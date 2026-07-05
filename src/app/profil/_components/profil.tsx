// src/app/profil/_components/profil.tsx
"use client";

import Navbar from "@/components/common/navbar";
import Footer from "@/components/common/footer";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import {
  Users,
  GraduationCap,
  BookOpen,
  Target,
  Award,
  Lightbulb,
} from "lucide-react";

export default function ProfilPage() {
  const pengurus = [
    {
      nama: "Ust. Aminah",
      jabatan: "Kepala Sekolah",
      photo: "/logo.jpg",
    },
    {
      nama: "Ustadzah Siti Fatimah",
      jabatan: "Wakil Kepala Sekolah",
      photo: "/logo.jpg",
    },
    {
      nama: "Ustadzah Nur Azizah",
      jabatan: "Koordinator KB",
      photo: "/logo.jpg",
    },
    {
      nama: "Ustadzah Dewi Anggraini",
      jabatan: "Koordinator TK",
      photo: "/logo.jpg",
    },
  ];

  const stats = [
    {
      icon: <Users className="w-8 h-8" />,
      value: "150+",
      label: "Siswa Aktif",
    },
    {
      icon: <GraduationCap className="w-8 h-8" />,
      value: "15+",
      label: "Tenaga Pendidik",
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      value: "10+",
      label: "Tahun Berdiri",
    },
    {
      icon: <Award className="w-8 h-8" />,
      value: "A",
      label: "Akreditasi",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 bg-gradient-to-br from-teal-500 to-blue-600 text-white">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">Profil Sekolah</h1>
          <p className="text-xl max-w-2xl mx-auto">
            Mengenal lebih dekat KB TK 'Aisyiyah Bustanul Athfal 1 Buduran
          </p>
        </div>
      </section>

      {/* Sambutan Kepala Sekolah */}
      <section className="py-20 px-6 bg-white dark:bg-gray-800">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Selayang Pandang dari Kepala Sekolah
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-teal-500 shadow-xl">
                  <Image
                    src="/logo.jpg"
                    alt="Kepala Sekolah"
                    width={256}
                    height={256}
                    className="object-cover"
                  />
                </div>
                <div className="text-center mt-6">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    Ust. Aminah
                  </h3>
                  <p className="text-teal-600 dark:text-teal-400">
                    Kepala Sekolah
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    0815 5336 6321
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              <p className="text-lg">
                <span className="text-2xl text-teal-600 font-serif">"</span>
                Assalamu'alaikum Warahmatullahi Wabarakatuh
              </p>
              <p>
                Puji syukur kehadirat Allah SWT atas segala nikmat dan karunia-Nya. 
                KB TK 'Aisyiyah Bustanul Athfal 1 Buduran hadir sebagai lembaga pendidikan 
                anak usia dini yang berkomitmen memberikan pendidikan berkualitas dengan 
                landasan nilai-nilai Islami.
              </p>
              <p>
                Kami menerapkan metode <span className="font-semibold text-teal-600">Ramah Otak Anak</span>, 
                dimana pembelajaran tidak dilakukan dengan cara duduk diam, melainkan melalui 
                kegiatan bermain yang terstruktur dan bermakna. Kami mengoptimalkan stimulasi 
                7 Indera Ajaib dan 6 Aspek Perkembangan anak secara holistik.
              </p>
              <p>
                Dengan motto <span className="font-semibold">"Sholih, Ceria, Mandiri"</span>, 
                kami berharap setiap anak didik kami dapat tumbuh menjadi pribadi yang sholeh/sholehah, 
                ceria dalam belajar, dan mandiri dalam kehidupan sehari-hari.
              </p>
              <p className="italic">
                Wassalamu'alaikum Warahmatullahi Wabarakatuh
                <span className="text-2xl text-teal-600 font-serif">"</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Visi Misi Tujuan */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Visi, Misi & Tujuan
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Arah dan tujuan kami dalam mendidik generasi masa depan
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Visi */}
            <Card className="hover:shadow-2xl transition-all">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-teal-100 dark:bg-teal-900 rounded-full">
                    <Target className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Visi</h3>
                </div>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  Menjadi lembaga KB/TK unggulan yang menghasilkan generasi sholih, 
                  ceria, dan mandiri dengan metode pembelajaran ramah otak anak
                </p>
              </CardContent>
            </Card>

            {/* Misi */}
            <Card className="hover:shadow-2xl transition-all">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Misi</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    "Menyelenggarakan pendidikan Islami berkualitas",
                    "Mengoptimalkan 7 Indera Ajaib dan 6 Aspek Perkembangan",
                    "Menerapkan metode pembelajaran yang menyenangkan",
                    "Membentuk karakter mandiri dan berakhlak mulia",
                    "Melibatkan orang tua dalam proses pembelajaran",
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-teal-500 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-sm">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Tujuan */}
            <Card className="hover:shadow-2xl transition-all">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                    <Lightbulb className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Tujuan</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    "Menghasilkan lulusan yang sholih/sholehah",
                    "Memiliki kemampuan membaca Al-Quran",
                    "Ceria dan senang dalam belajar",
                    "Mandiri dalam aktivitas sehari-hari",
                    "Siap melanjutkan ke jenjang SD/MI",
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-teal-500 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-sm">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Struktur Organisasi */}
      <section className="py-20 px-6 bg-white dark:bg-gray-800">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Struktur Organisasi
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Tim pengurus dan pengajar yang berdedikasi
            </p>
          </div>

          {/* Pengurus */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {pengurus.map((person, index) => (
              <Card
                key={index}
                className="hover:shadow-xl transition-all hover:scale-105"
              >
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center">
                    <Image
                      src={person.photo}
                      alt={person.nama}
                      width={120}
                      height={120}
                      className="rounded-full border-4 border-teal-500"
                    />
                  </div>
                  <h4 className="font-bold text-lg mb-1">{person.nama}</h4>
                  <p className="text-sm text-teal-600 dark:text-teal-400">
                    {person.jabatan}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Statistik */}
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className="bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-950 dark:to-blue-950 border-2 border-teal-200 dark:border-teal-800"
              >
                <CardContent className="p-6 text-center">
                  <div className="flex justify-center text-teal-600 dark:text-teal-400 mb-3">
                    {stat.icon}
                  </div>
                  <div className="text-3xl font-bold text-teal-600 dark:text-teal-400 mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tentang Metode Ramah Otak Anak */}
      <section className="py-20 px-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Metode Ramah Otak Anak
            </h2>
          </div>

          <Card>
            <CardContent className="p-8">
              <div className="space-y-6 text-gray-700 dark:text-gray-300">
                <p className="text-lg leading-relaxed">
                  Metode <span className="font-bold text-teal-600">Ramah Otak Anak</span> adalah 
                  pendekatan pembelajaran yang disesuaikan dengan cara kerja otak anak usia dini. 
                  Kami tidak menuntut anak untuk duduk diam, melainkan membiarkan mereka belajar 
                  melalui kegiatan bermain yang terstruktur dan bermakna.
                </p>

                <div className="bg-teal-50 dark:bg-teal-950 p-6 rounded-lg">
                  <h3 className="text-xl font-bold text-teal-600 dark:text-teal-400 mb-4">
                    7 Indera Ajaib yang Kami Optimalkan:
                  </h3>
                  <ul className="grid md:grid-cols-2 gap-3">
                    {[
                      "Penglihatan (Visual)",
                      "Pendengaran (Audio)",
                      "Penciuman (Olfactory)",
                      "Pengecapan (Gustatory)",
                      "Perabaan (Tactile)",
                      "Keseimbangan (Vestibular)",
                      "Kesadaran Tubuh (Proprioceptive)",
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
                  <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                    6 Aspek Perkembangan:
                  </h3>
                  <ul className="grid md:grid-cols-2 gap-3">
                    {[
                      "Nilai Agama dan Moral",
                      "Fisik Motorik",
                      "Kognitif",
                      "Bahasa",
                      "Sosial Emosional",
                      "Seni",
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-lg leading-relaxed italic text-center pt-4">
                  "Dengan metode ini, kami percaya setiap anak dapat berkembang optimal 
                  sesuai dengan potensi dan tahap perkembangannya masing-masing"
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}