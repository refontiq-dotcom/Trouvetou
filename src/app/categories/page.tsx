import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, GraduationCap, Grid2X2Plus, Hospital, House, Hotel } from "lucide-react";

export const metadata: Metadata = {
  title: "Toutes les catégories",
  description: "Explorez toutes les catégories disponibles sur TrouveTout.",
};

const CATEGORIES = [
  { label: "Hôtels", href: "/hotels?type=hotel", icon: Hotel },
  { label: "Résidences", href: "/hotels?type=residence", icon: House },
  { label: "Cliniques", href: "/cliniques", icon: Hospital },
  { label: "Écoles", href: "/ecoles", icon: GraduationCap },
  { label: "Autres", href: "/autres", icon: Grid2X2Plus },
];

export default function CategoriesPage() {
  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-white px-4 py-6 md:mx-auto md:max-w-3xl">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
        <ChevronLeft className="h-4 w-4" /> Accueil
      </Link>
      <h1 className="mt-6 text-2xl font-extrabold text-slate-900">Toutes les catégories</h1>
      <p className="mt-1 text-sm text-slate-500">Choisissez le type d'établissement ou de service que vous recherchez.</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {CATEGORIES.map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href} className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center shadow-sm transition hover:border-[#079b97]/30 hover:bg-[#f0fbfa]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#079b97] shadow-sm">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-sm font-bold text-slate-800">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
