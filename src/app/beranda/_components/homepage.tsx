// src/app/beranda/_components/homepage.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Heart,
  Star,
  Sparkles,
  Baby,
  Target,
  Lightbulb,
  Home,
  Building2,
  Utensils,
  Activity,
  Shield,
  Palette,
  TreePine,
  Music,
  Calendar,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  Gift,
  Users,
  MapPin,
  Phone,
  Instagram,
  Send,
  MessageCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/common/footer";
import { useState } from "react";
import { toast } from "sonner";

export default function Homepage() {
  /* ================= DATA: PROGRAM UNGGULAN (dipersingkat, 5 kartu) ================= */
  const programUnggulan = [
    {
      icon: <BookOpen className="w-12 h-12 text-teal-500" />,
      title: "Mengaji & Tahfidz Metode UMMI",
      description:
        "Metode menghafal Al-Quran yang efektif dan menyenangkan untuk anak usia dini",
    },
    {
      icon: <Heart className="w-12 h-12 text-teal-500" />,
      title: "Do'a dan Hadist",
      description:
        "Menghafal do'a harian dan hadist pilihan untuk pembiasaan akhlak mulia",
    },
    {
      icon: <Star className="w-12 h-12 text-teal-500" />,
      title: "Petualangan Maharaja",
      description:
        "Pintar baca tanpa belajar membaca - metode inovatif pembelajaran literasi",
    },
    {
      icon: <Sparkles className="w-12 h-12 text-teal-500" />,
      title: "Berkemandirian & Berkarakter Islami",
      description:
        "Membentuk karakter mandiri dan berakhlak mulia sejak dini",
    },
    {
      icon: <Baby className="w-12 h-12 text-teal-500" />,
      title: "Tuntas Toilet Training",
      description:
        "Program khusus melatih kemandirian anak dalam kehidupan sehari-hari",
    },
  ];

  /* ================= DATA: FASILITAS ================= */
  const facilities = [
    {
      id: "ruang-kelas",
      icon: <Home className="w-12 h-12 text-teal-500" />,
      title: "Ruang Kelas",
      description:
        "Ruang kelas yang nyaman, bersih, dan dilengkapi dengan berbagai alat peraga edukatif",
      features: [
        "AC dan ventilasi baik",
        "Pencahayaan optimal",
        "Alat peraga edukatif lengkap",
        "Area bermain dalam kelas",
        "Meja kursi ergonomis untuk anak",
      ],
      image: "/logo.jpg",
    },
    {
      id: "area-bermain",
      icon: <Activity className="w-12 h-12 text-teal-500" />,
      title: "Area Bermain Outdoor",
      description:
        "Area bermain outdoor yang aman dengan berbagai permainan edukatif",
      features: [
        "Playground aman untuk anak",
        "Ayunan dan perosotan",
        "Area lari dan olahraga",
        "Permainan edukatif outdoor",
        "Pengawasan ketat dari guru",
      ],
      image: "/logo.jpg",
    },
    {
      id: "perpustakaan",
      icon: <BookOpen className="w-12 h-12 text-teal-500" />,
      title: "Perpustakaan Mini",
      description:
        "Perpustakaan dengan koleksi buku cerita dan buku edukatif untuk anak",
      features: [
        "Koleksi buku cerita bergambar",
        "Buku edukatif islami",
        "Area reading corner",
        "Buku dongeng dan ensiklopedia anak",
        "Peminjaman buku untuk dibawa pulang",
      ],
      image: "/logo.jpg",
    },
    {
      id: "masjid",
      icon: <Building2 className="w-12 h-12 text-teal-500" />,
      title: "Musholla",
      description:
        "Musholla bersih untuk praktek ibadah dan pembelajaran agama",
      features: [
        "Area sholat berjamaah",
        "Tempat wudhu khusus anak",
        "Pembelajaran praktek ibadah",
        "Hafalan do'a dan surat pendek",
        "Bersih dan nyaman",
      ],
      image: "/logo.jpg",
    },
    {
      id: "kantin",
      icon: <Utensils className="w-12 h-12 text-teal-500" />,
      title: "Kantin Sehat",
      description: "Kantin dengan menu makanan sehat dan bergizi untuk anak",
      features: [
        "Menu makanan sehat",
        "Gizi seimbang",
        "Halal dan higienis",
        "Snack sehat",
        "Area makan bersih",
      ],
      image: "/logo.jpg",
    },
    {
      id: "toilet",
      icon: <Baby className="w-12 h-12 text-teal-500" />,
      title: "Toilet Training Area",
      description:
        "Toilet khusus anak dengan fasilitas lengkap untuk toilet training",
      features: [
        "Toilet duduk ramah anak",
        "Wastafel sesuai tinggi anak",
        "Bersih dan terawat",
        "Pendampingan guru",
        "Program toilet training",
      ],
      image: "/logo.jpg",
    },
    {
      id: "sentra-seni",
      icon: <Palette className="w-12 h-12 text-teal-500" />,
      title: "Sentra Seni & Kreativitas",
      description: "Ruang khusus untuk kegiatan seni dan kreativitas anak",
      features: [
        "Alat lukis dan mewarnai",
        "Bahan craft lengkap",
        "Area prakarya",
        "Display karya anak",
        "Bimbingan guru seni",
      ],
      image: "/logo.jpg",
    },
    {
      id: "taman",
      icon: <TreePine className="w-12 h-12 text-teal-500" />,
      title: "Taman Edukasi",
      description: "Taman dengan berbagai tanaman untuk pembelajaran alam",
      features: [
        "Kebun sayur edukatif",
        "Tanaman hias",
        "Area berkebun untuk anak",
        "Pembelajaran tentang alam",
        "Teduh dan asri",
      ],
      image: "/logo.jpg",
    },
    {
      id: "ruang-musik",
      icon: <Music className="w-12 h-12 text-teal-500" />,
      title: "Ruang Musik & Gerak",
      description: "Ruang untuk kegiatan musik, menyanyi, dan gerak motorik",
      features: [
        "Alat musik sederhana",
        "Sound system",
        "Area untuk gerak dan tari",
        "Pembelajaran lagu islami",
        "Pengembangan motorik kasar",
      ],
      image: "/logo.jpg",
    },
    {
      id: "keamanan",
      icon: <Shield className="w-12 h-12 text-teal-500" />,
      title: "Keamanan",
      description: "Sistem keamanan terjaga untuk kenyamanan dan keselamatan",
      features: [
        "CCTV di area strategis",
        "Pagar pengaman",
        "Satpam dan penjaga",
        "Pintu otomatis",
        "UKS dengan obat-obatan dasar",
      ],
      image: "/logo.jpg",
    },
  ];

  /* ================= DATA: KONTAK ================= */
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Pesan Terkirim!", {
      description: "Kami akan menghubungi Anda segera. Terima kasih!",
    });
    setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const contactInfo = [
    {
      icon: <MapPin className="w-8 h-8 text-teal-500" />,
      title: "Alamat",
      content: [
        "Jl. Kavling Persada Asri C-37",
        "Damarsi, Buduran, Sidoarjo",
        "Jawa Timur, Indonesia",
      ],
    },
    {
      icon: <Phone className="w-8 h-8 text-teal-500" />,
      title: "Telepon / WhatsApp",
      content: ["Ust. Aminah", "0815 5336 6321"],
    },
    {
      icon: <Instagram className="w-8 h-8 text-teal-500" />,
      title: "Media Sosial",
      content: ["@abasatubuduran", "Instagram KB TK Aisyiyah"],
    },
    {
      icon: <Clock className="w-8 h-8 text-teal-500" />,
      title: "Jam Operasional",
      content: [
        "Senin - Kamis: 07.00 - 12.00 WIB",
        "Jum'at: 07.00 - 11.00 WIB",
        "Sabtu & Minggu: Tutup",
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ======================================================= */}
      {/* HERO SECTION (dari Beranda)                              */}
      {/* ======================================================= */}
      <section
        id="beranda"
        className="relative flex items-center justify-center overflow-hidden py-20"
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 via-blue-500/20 to-purple-500/20"></div>
        </div>

        <div className="container mx-auto px-6 z-10">
          <div className="text-center space-y-8 animate-fade-in">
            <div className="flex justify-center mb-8">
              <Image
                src="/logo.jpg"
                alt="Logo KB TK Aisyiyah Bustanul Athfal 1 Buduran"
                width={150}
                height={150}
                className="rounded-full shadow-2xl"
              />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 dark:text-gray-100">
              KB TK 'Aisyiyah
              <br />
              <span className="text-teal-500">Bustanul Athfal 1 Buduran</span>
            </h1>

            <div className="flex flex-col gap-2 max-w-2xl mx-auto">
              <p className="text-2xl md:text-3xl font-semibold text-teal-600 dark:text-teal-400">
                Sholih, Ceria, Mandiri
              </p>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 italic">
                "Diuruk karena menarik, disuka karena beda"
              </p>
            </div>

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Sekolah dengan metode{" "}
              <span className="font-bold text-teal-600">
                Ramah Otak Anak
              </span>
              , mengoptimalkan stimulasi 7 Indera Ajaib dan 6 Aspek
              Perkembangan melalui kegiatan bermain yang menyenangkan
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-6 text-lg"
                >
                  <Baby className="mr-2" />
                  Login
                </Button>
              </Link>
              <a href="#profil">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-lg"
                >
                  Pelajari Lebih Lanjut
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* SELAYANG PANDANG (Sambutan Kepala Sekolah, dari Profil)  */}
      {/* ======================================================= */}
      <section
        id="profil"
        className="py-20 px-6 bg-white dark:bg-gray-800 scroll-mt-8"
      >
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
                Puji syukur kehadirat Allah SWT atas segala nikmat dan
                karunia-Nya. KB TK 'Aisyiyah Bustanul Athfal 1 Buduran hadir
                sebagai lembaga pendidikan anak usia dini yang berkomitmen
                memberikan pendidikan berkualitas dengan landasan nilai-nilai
                Islami.
              </p>
              <p>
                Kami menerapkan metode{" "}
                <span className="font-semibold text-teal-600">
                  Ramah Otak Anak
                </span>
                , dimana pembelajaran tidak dilakukan dengan cara duduk diam,
                melainkan melalui kegiatan bermain yang terstruktur dan
                bermakna. Kami mengoptimalkan stimulasi 7 Indera Ajaib dan 6
                Aspek Perkembangan anak secara holistik.
              </p>
              <p>
                Dengan motto{" "}
                <span className="font-semibold">
                  "Sholih, Ceria, Mandiri"
                </span>
                , kami berharap setiap anak didik kami dapat tumbuh menjadi
                pribadi yang sholeh/sholehah, ceria dalam belajar, dan mandiri
                dalam kehidupan sehari-hari.
              </p>
              <p className="italic">
                Wassalamu'alaikum Warahmatullahi Wabarakatuh
                <span className="text-2xl text-teal-600 font-serif">"</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* VISI MISI TUJUAN (dari Profil)                           */}
      {/* ======================================================= */}
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
                  Menjadi lembaga KB/TK unggulan yang menghasilkan generasi
                  sholih, ceria, dan mandiri dengan metode pembelajaran ramah
                  otak anak
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

      {/* ======================================================= */}
      {/* PROGRAM UNGGULAN (5 kartu ringkas)                       */}
      {/* ======================================================= */}
      <section
        id="program"
        className="py-20 px-6 bg-white dark:bg-gray-800 scroll-mt-8"
      >
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Program Unggulan
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Program-program terbaik yang dirancang khusus untuk
              mengoptimalkan tumbuh kembang anak usia dini
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {programUnggulan.map((program, index) => (
              <Card
                key={index}
                className="hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer border-2 hover:border-teal-500"
              >
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    {program.icon}
                  </div>
                  <CardTitle className="text-center text-lg">
                    {program.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
                    {program.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* FASILITAS (halaman penuh)                                */}
      {/* ======================================================= */}
      <section
        id="fasilitas"
        className="py-16 px-6 bg-gradient-to-br from-blue-500 to-teal-600 text-white scroll-mt-8"
      >
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold mb-4">Fasilitas Sekolah</h2>
          <p className="text-xl max-w-2xl mx-auto">
            Sarana dan prasarana lengkap untuk mendukung tumbuh kembang
            optimal anak
          </p>
        </div>
      </section>

      <section className="py-20 px-6 bg-white dark:bg-gray-800">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            {facilities.map((facility, index) => (
              <div key={index} id={facility.id} className="scroll-mt-8">
                <Card className="hover:shadow-2xl transition-all overflow-hidden h-full">
                  <div className="relative h-64 bg-gradient-to-br from-teal-100 to-blue-100 dark:from-teal-900 dark:to-blue-900">
                    <Image
                      src={facility.image}
                      alt={facility.title}
                      fill
                      className="object-contain p-8"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      {facility.icon}
                      <CardTitle className="text-2xl">
                        {facility.title}
                      </CardTitle>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                      {facility.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <h4 className="font-semibold mb-3 text-teal-600 dark:text-teal-400">
                      Fasilitas Utama:
                    </h4>
                    <ul className="space-y-2">
                      {facility.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                          <span className="text-gray-700 dark:text-gray-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* KONTAK (info, form, lokasi, WhatsApp saja)               */}
      {/* ======================================================= */}
      <section
        id="kontak"
        className="py-16 px-6 bg-gradient-to-br from-indigo-500 to-teal-600 text-white scroll-mt-8"
      >
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold mb-4">Hubungi Kami</h2>
          <p className="text-xl max-w-2xl mx-auto">
            Kami siap membantu menjawab pertanyaan Anda tentang KB TK
            'Aisyiyah Bustanul Athfal 1 Buduran
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-20 px-6 bg-white dark:bg-gray-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info, index) => (
              <Card key={index} className="hover:shadow-xl transition-all">
                <CardHeader>
                  <div className="flex justify-center mb-4">{info.icon}</div>
                  <CardTitle className="text-center text-xl">
                    {info.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-2">
                    {info.content.map((line, idx) => (
                      <p
                        key={idx}
                        className="text-sm text-gray-600 dark:text-gray-400"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Map & WhatsApp */}
<section className="py-20 px-6 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
  <div className="container mx-auto max-w-6xl">

    {/* Map & WhatsApp */}
    <div className="grid md:grid-cols-2 gap-8">

      {/* Maps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Lokasi Kami</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3957.2!2d112.7!3d-7.4!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zN8KwMjQnMDAuMCJTIDExMsKwNDInMDAuMCJF!5e0!3m2!1sen!2sid!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Lokasi KB TK Aisyiyah Bustanul Athfal 1 Buduran"
            />
          </div>

          <div className="mt-4 space-y-2">
            <h4 className="font-semibold">Alamat Lengkap:</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Jl. Kavling Persada Asri C-37, Damarsi, Buduran,
              Sidoarjo, Jawa Timur
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Quick Contact */}
      <Card className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <MessageCircle className="w-16 h-16 mx-auto text-green-600" />

            <h3 className="text-xl font-bold">
              Hubungi Via WhatsApp
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Butuh informasi cepat? Chat langsung dengan kami melalui
              WhatsApp
            </p>

            <a
              href="https://wa.me/6281553366321"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-full bg-green-600 hover:bg-green-700">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat WhatsApp
              </Button>
            </a>

            <p className="text-xs text-gray-500">
              Ust. Aminah - 0815 5336 6321
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  </div>
</section>

      <Footer />
    </div>
  );
}