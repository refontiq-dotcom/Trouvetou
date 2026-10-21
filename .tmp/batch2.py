# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import op, op_lines, apply

# --------------------------------------------------- categories.ts (commentaire)
op_lines(
    "src/lib/categories.ts",
    25,
    26,
    "// Lorsqu'un portail couvre plusieurs catégories (hôtels ET résidences), il\n"
    "// ajoute `?type=<slug>` pour que la page se filtre sur la catégorie exacte.",
)

# ---------------------------------------------------- categories.ts (helpers)
op(
    "src/lib/categories.ts",
    r"""    categories: ["restaurant"],
  },
};
""",
    r"""    categories: ["restaurant"],
  },
};

/**
 * Filtres de catégorie d'un portail.
 *
 * Un portail qui ne couvre qu'une catégorie (écoles, cliniques, restaurants)
 * n'affiche pas de filtre : la page EST déjà la page de la catégorie. Un
 * portail multi-catégories (hôtels / résidences) affiche une puce par
 * catégorie, et `?type=` permet d'y arriver directement.
 */
export function portalTypeFilters(portal: UniverseSlug): string[] | undefined {
  const categories = PORTALS[portal].categories;
  return categories.length > 1 ? [...categories] : undefined;
}

/**
 * Libellé de prix d'un portail.
 *
 * Dérivé de ses catégories (et non redéfini) : les annonces d'un même portail
 * sont toujours facturées de la même façon.
 */
export function portalPriceSuffix(portal: UniverseSlug): string {
  const [first] = PORTALS[portal].categories;
  return first ? CATEGORIES[first].priceSuffix : "par nuit";
}
""",
)

apply()
