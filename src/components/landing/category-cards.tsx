"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GraduationCap, Hotel, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  title: string;
  subtitle: string;
  icon: typeof Hotel;
  gradient: string;
  iconBg: string;
  href: string;
}

const CATEGORIES: Category[] = [
  {
    title: "Hôtels & Résidences Meublées",
    subtitle:
      "Chambres, studios et appartements meublés disponibles à la nuit, à la semaine ou au mois.",
    icon: Hotel,
    gradient: "from-[#1565c0] to-[#1976d2]",
    iconBg: "bg-[#1565c0]",
    href: "/hotels",
  },
  {
    title: "Écoles & Établissements Privés",
    subtitle:
      "Campus, écoles primaires, secondaires et centres de formation de confiance.",
    icon: GraduationCap,
    gradient: "from-[#1565c0] to-[#2e7d32]",
    iconBg: "bg-[#2e7d32]",
    href: "/ecoles",
  },
  {
    title: "Cliniques & Santé",
    subtitle:
      "Cliniques, cabinets médicaux et centres de santé partenaires vérifiés.",
    icon: Stethoscope,
    gradient: "from-[#1565c0] to-[#00838f]",
    iconBg: "bg-[#00838f]",
    href: "/cliniques",
  },
];

function CategoryCard({ category, index }: { category: Category; index: number }) {
  const Icon = category.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/10"
    >
      {/* Background gradient orb */}
      <div
        className={cn(
          "absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.07] transition-transform duration-300 group-hover:scale-125",
          category.gradient
        )}
      />

      <div className="relative flex h-full flex-col">
        {/* Icon circle */}
        <div
          className={cn(
            "inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-110",
            category.iconBg
          )}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>

        <h3 className="mt-4 text-base sm:text-lg font-bold text-foreground leading-snug">
          {category.title}
        </h3>
        <p className="mt-2 flex-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {category.subtitle}
        </p>

        {/* CTA */}
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:text-primary-hover">
          Comparer les prix
          <span className="inline-block transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
      </div>
    </motion.div>
  );
}

export function CategoryCards() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3">
        {CATEGORIES.map((category, i) => (
          <Link
            key={category.href}
            href={category.href}
            className={cn(
              "block h-full",
              i === 2 && "col-span-2 md:col-span-1"
            )}
          >
            <CategoryCard category={category} index={i} />
          </Link>
        ))}
      </div>
    </section>
  );
}
