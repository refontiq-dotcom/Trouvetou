import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";

const CATEGORIES = [
  {
    slug: "clinic",
    label: "Cliniques",
    subtitle: "Santé & bien-être",
    href: "/cliniques",
    image:
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&h=400&fit=crop&q=80",
    color: "from-emerald-600/80 to-emerald-900/90",
    accent: "text-emerald-300",
  },
  {
    slug: "school",
    label: "Écoles",
    subtitle: "Éducation & formation",
    href: "/ecoles",
    image:
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&h=400&fit=crop&q=80",
    color: "from-[#1565c0]/80 to-[#0d47a1]/90",
    accent: "text-blue-200",
  },
  {
    slug: "residence",
    label: "Résidences",
    subtitle: "Hébergement & logement",
    href: "/hotels",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&q=80",
    color: "from-amber-600/80 to-amber-900/90",
    accent: "text-amber-200",
  },
];

export async function CategoryShowcase() {
  const supabase = getSupabase();

  // Comptage par catégorie : on requête la table categories pour obtenir
  // les IDs, puis on compte les listings actifs par catégorie.
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
      // Silencieux : si Supabase n'est pas configuré, on affiche des 0
    }
  }

  // On additionne hotel + residence pour la catégorie "Résidences"
  const residenceCount = (counts.hotel ?? 0) + (counts.residence ?? 0);

  const displayCounts: Record<string, number> = {
    clinic: counts.clinic ?? 0,
    school: counts.school ?? 0,
    residence: residenceCount,
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const count = displayCounts[cat.slug] ?? 0;
          return (
            <Link
              key={cat.slug}
              href={cat.href}
              className="group relative flex h-[180px] sm:h-[200px] overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Image de fond */}
              <img
                src={cat.image}
                alt={cat.label}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* Dégradé sombre */}
              <div
                className={`absolute inset-0 bg-gradient-to-t ${cat.color}`}
              />

              {/* Contenu */}
              <div className="relative z-10 flex flex-col justify-end p-5 sm:p-6">
                <p className={`text-[11px] font-medium uppercase tracking-wider ${cat.accent}`}>
                  {cat.subtitle}
                </p>
                <h3 className="mt-1 text-xl sm:text-2xl font-bold text-white">
                  {cat.label}
                </h3>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/90">
                    {count > 0 ? (
                      <>
                        {count.toLocaleString("fr-FR")}{" "}
                        <span className="font-normal text-white/60">
                          annonce{count > 1 ? "s" : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/50">Bientôt disponible</span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-white transition-transform group-hover:translate-x-1">
                    Voir tout →
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
