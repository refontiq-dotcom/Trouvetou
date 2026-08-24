// ============================================================================
// TROUVETOU — Détection d'intention de recherche (intent detection)
//
// Quand une requête ne correspond pas à l'univers courant du portail
// (ex. « résidence » tapé sur /ecoles), on le détecte via des mots-clés et on
// propose de basculer vers le bon portail en conservant la requête.
//
// La comparaison est insensible à la casse et aux accents (« école » ===
// « ecole »). On ne suggère un autre univers que si la requête ne contient
// aucun mot-clé de l'univers courant (évite les faux positifs).
// ============================================================================

export type UniverseSlug = "hotels" | "ecoles" | "cliniques";

export interface UniverseSuggestion {
  targetSlug: UniverseSlug;
  targetLabel: string;
  targetHref: string;
  /** Mot-clé correspondant (forme d'origine, ex. « résidence »). */
  matchedKeyword: string;
}

interface Keyword {
  /** Forme lisible (ex. « résidence »). */
  raw: string;
  /** Forme normalisée pour la comparaison (minuscules, sans accents). */
  norm: string;
}

interface UniverseProfile {
  slug: UniverseSlug;
  label: string;
  href: string;
  keywords: Keyword[];
}

function toKeywords(list: string[]): Keyword[] {
  return list.map((raw) => ({ raw, norm: normalize(raw) }));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const UNIVERSES: UniverseProfile[] = [
  {
    slug: "hotels",
    label: "Hôtels & Résidences",
    href: "/hotels",
    keywords: toKeywords([
      "hôtel",
      "hôtels",
      "résidence",
      "résidences",
      "résidance",
      "logement",
      "logements",
      "chambre",
      "chambres",
      "studio",
      "studios",
      "appartement",
      "appartements",
      "apartement",
      "appart",
      "villa",
      "villas",
      "maison",
      "auberge",
      "auberges",
      "gîte",
      "gîtes",
      "meublé",
      "meublés",
      "hébergement",
      "dortoir",
      "nuit",
      "dormir",
      "loger",
      "louer",
      "guesthouse",
      "bnb",
      "location",
      "tourisme",
      "concession",
      "campement",
      "keur",
    ]),
  },
  {
    slug: "ecoles",
    label: "Écoles & Établissements",
    href: "/ecoles",
    keywords: toKeywords([
      "école",
      "écoles",
      "établissement",
      "établissements",
      "collège",
      "collèges",
      "lycée",
      "lycées",
      "université",
      "universités",
      "universitaire",
      "campus",
      "formation",
      "formations",
      "institut",
      "instituts",
      "scolarité",
      "maternelle",
      "primaire",
      "secondaire",
      "apprentissage",
      "licence",
      "master",
      "doctorat",
      "baccalauréat",
      "bts",
      "bac",
      "écolage",
      "tuition",
      "professeur",
      "enseignant",
      "internat",
      "cours",
      "inscription",
      "inscrire",
      "rentrée",
      "apprendre",
      "étudier",
      "étude",
      "études",
      "daara",
      "médersa",
      "franco-arabe",
      "franco arabe",
      "bachi",
      "proff",
    ]),
  },
  {
    slug: "cliniques",
    label: "Cliniques & Santé",
    href: "/cliniques",
    keywords: toKeywords([
      "clinique",
      "cliniques",
      "polyclinique",
      "hôpital",
      "hôpitaux",
      "médecin",
      "médecins",
      "docteur",
      "dentiste",
      "pharmacie",
      "pharmacies",
      "pharma",
      "dispensaire",
      "infirmerie",
      "consultation",
      "consultations",
      "consulter",
      "soins",
      "soigner",
      "pédiatre",
      "gynécologue",
      "gynéco",
      "cardiologue",
      "cardio",
      "dermatologue",
      "dermato",
      "ophtalmologue",
      "ophtalmo",
      "généraliste",
      "urgence",
      "urgences",
      "laboratoire",
      "laboratoires",
      "santé",
      "infirmier",
      "infirmière",
      "radiologie",
      "maternité",
      "traitement",
      "vaccination",
      "imagerie",
      "malade",
      "maladie",
      "hosto",
      "toubib",
      "docta",
      "maison de santé",
      "maison de retraite",
    ]),
  },
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Détecte le portail le plus probable pour une requête tapée depuis la page
 * d'accueil (où aucun univers courant n'existe). Retourne null si aucun
 * mot-clé connu n'est détecté — dans ce cas on utilise le portail par défaut.
 */
export function detectTargetPortal(query: string): UniverseSuggestion | null {
  const needle = normalize(query);
  if (needle.length < 3) return null;

  let best: UniverseProfile | null = null;
  let bestScore = 0;
  let bestKeyword = "";

  for (const universe of UNIVERSES) {
    let score = 0;
    let matched = "";
    for (const keyword of universe.keywords) {
      if (needle.includes(keyword.norm)) {
        score += 1;
        if (matched === "") matched = keyword.raw;
      }
    }
    if (score > bestScore) {
      best = universe;
      bestScore = score;
      bestKeyword = matched;
    }
  }

  if (!best) return null;

  return {
    targetSlug: best.slug,
    targetLabel: best.label,
    targetHref: best.href,
    matchedKeyword: capitalize(bestKeyword),
  };
}

/**
 * Détecte si la requête appartient manifestement à un autre univers.
 *
 * Règle : la requête ne contient aucun mot-clé de l'univers courant, mais
 * contient des mots-clés d'un autre univers → on propose cet univers.
 * En cas d'égalité avec l'univers courant, on ne suggère rien (l'utilisateur
 * peut mixer plusieurs domaines, ex. « résidence universitaire »).
 */
export function detectPortalSuggestion(
  query: string,
  currentSlug: UniverseSlug
): UniverseSuggestion | null {
  const needle = normalize(query);
  if (needle.length < 3) return null;

  let currentScore = 0;
  let best: UniverseProfile | null = null;
  let bestScore = 0;
  let bestKeyword = "";

  for (const universe of UNIVERSES) {
    let score = 0;
    let matched = "";
    for (const keyword of universe.keywords) {
      if (needle.includes(keyword.norm)) {
        score += 1;
        if (matched === "") matched = keyword.raw;
      }
    }
    if (score === 0) continue;

    if (universe.slug === currentSlug) {
      currentScore = score;
      continue;
    }
    if (!best || score > bestScore) {
      best = universe;
      bestScore = score;
      bestKeyword = matched;
    }
  }

  if (!best || bestScore === 0) return null;
  if (currentScore > 0 && currentScore >= bestScore) return null;

  return {
    targetSlug: best.slug,
    targetLabel: best.label,
    targetHref: best.href,
    matchedKeyword: capitalize(bestKeyword),
  };
}
