// ============================================================================
// TROUVETOU — Configuration du portail « Écoles partenaires » (Schooly)
//
// Affiche les établissements scolaires publiés sur Schooly et leurs
// disponibilités par niveau. La réservation se fait via le formulaire
// `/ecoles/partenaires/[id]/reserver`.
// ============================================================================

export interface EcolesPartenairesConfig {
  title: string;
  breadcrumbLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  description: string;
}

export const ECOLES_PARTENAIRES_CONFIG: EcolesPartenairesConfig = {
  title: "Écoles partenaires",
  breadcrumbLabel: "Écoles partenaires",
  searchPlaceholder: "Rechercher une école, une ville, un programme…",
  description:
    "Réservez en ligne une place dans les écoles et établissements privés partenaires. Les disponibilités sont synchronisées en temps réel avec la plateforme Schooly.",
  emptyMessage:
    "Aucune école partenaire n'est publiée pour le moment. Revenez bientôt !",
};
