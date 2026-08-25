import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { Stethoscope, GraduationCap, UtensilsCrossed, Building2 } from "lucide-react";

const CATEGORIES = [
  {
    slug: "clinic",
    label: "Cliniques",
    href: "/cliniques",
    image:
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&h=500&fit=crop&q=80",
    color: "from-emerald-600/80 to-emerald-900/90",
    icon: Stethoscope,
    emoji: "🏥",
  },
  {
    slug: "school",
    label: "Écoles",
    href: "/ecoles",
    image:
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&h=500&fit=crop&q=80",
    color: "from-[#1565c0]/80 to-[#0d47a1]/90",
    icon: GraduationCap,
    emoji: "🏫",
  },
  {
    slug: "restaurant",
    label: "Restaurants",
    href: "/restaurants",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&h=500&fit=crop&q=80",
    color: "from-orange-600/80 to-red-900/90",
    icon: UtensilsCrossed,
    emoji: "🍽️",
  },
  {
    slug: "residence",
    label: "Résidences & Hôtels",
    href: "/hotels",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&h=500&fit=crop&q=80",
    color: "from-amber-600/80 to-amber-900/90",
    icon: Building2,
    emoji: "🏨",
  },
];

export async function CategoryShowcase() {
  const supabase = getSupabase();
  let counts: Record<string, number> = {};

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
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CATEGORIES.map((cat) => {
          const count = displayCounts[cat.slug] ?? 0;
          const Icon = cat.icon;
          return (
            <Link
              key={cat.slug}
              href={cat.href}
              className="group relative aspect-square overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Image de fond */}
              <img
                src={cat.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* Dégradé sombre */}
              <div className={`absolute inset-0 bg-gradient-to-t ${cat.color}`} />

              {/* Gros emoji en arrière-plan pour les illettrés */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                <span className="text-7xl sm:text-8xl">{cat.emoji}</span>
              </div>

              {/* Contenu */}
              <div className="relative z-10 flex h-full flex-col justify-end p-4 sm:p-5">
                {/* Icône + label */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    {cat.label}
                  </h3>
                </div>

                {/* Compteur ou "Bientôt" */}
                <div className="flex items-center justify-between">
                  {count > 0 ? (
                    <span className="text-xs sm:text-sm font-semibold text-white/90">
                      {count.toLocaleString("fr-FR")}{" "}
                      <span className="font-normal text-white/60">
                        annonce{count > 1 ? "s" : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-white/50">Bientôt</span>
                  )}
                  <span className="text-sm font-semibold text-white transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
