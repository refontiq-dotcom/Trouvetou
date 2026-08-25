import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { Stethoscope, GraduationCap, UtensilsCrossed, Building2 } from "lucide-react";

const CATEGORIES = [
  {
    slug: "clinic",
    label: "Cliniques",
    href: "/cliniques",
    iconBg: "bg-sky-100",
    iconText: "text-sky-600",
    icon: Stethoscope,
  },
  {
    slug: "school",
    label: "Écoles",
    href: "/ecoles",
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    icon: GraduationCap,
  },
  {
    slug: "restaurant",
    label: "Restaurants",
    href: "/restaurants",
    iconBg: "bg-orange-100",
    iconText: "text-orange-600",
    icon: UtensilsCrossed,
  },
  {
    slug: "residence",
    label: "Résidences & Hôtels",
    href: "/hotels",
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    icon: Building2,
  },
];

export async function CategoryShowcase() {
  const supabase = getSupabase();
  const counts: Record<string, number> = {};

  if (supabase) {
    try {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, slug");

      if (cats) {
        const results = await Promise.all(
          cats.map(async (cat) => {
            const { count } = await supabase
              .from("listings")
              .select("id", { count: "exact", head: true })
              .eq("category_id", cat.id)
              .eq("is_available", true);
            return { slug: cat.slug, count: count ?? 0 };
          })
        );
        results.forEach((r) => {
          counts[r.slug] = r.count;
        });
      }
    } catch {
      // Silencieux
    }
  }

  const residenceCount = (counts.hotel ?? 0) + (counts.residence ?? 0);
  const displayCounts: Record<string, number> = {
    clinic: counts.clinic ?? 0,
    school: counts.school ?? 0,
    residence: residenceCount,
    restaurant: counts.restaurant ?? 0,
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {CATEGORIES.map((cat) => {
          const count = displayCounts[cat.slug] ?? 0;
          const Icon = cat.icon;
          return (
            <Link
              key={cat.slug}
              href={cat.href}
              className="group inline-flex items-center gap-2 rounded-full border bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md active:scale-[0.98]"
            >
              {/* Petite pastille icône colorée */}
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cat.iconBg}`}
              >
                <Icon className={`h-3.5 w-3.5 ${cat.iconText}`} />
              </span>

              {/* Label */}
              <span className="whitespace-nowrap text-sm font-semibold text-neutral-800">
                {cat.label}
              </span>

              {/* Compteur ou "Bientôt" */}
              {count > 0 ? (
                <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 tabular-nums">
                  {count.toLocaleString("fr-FR")}
                </span>
              ) : (
                <span className="text-[10px] text-neutral-400">Bientôt</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
