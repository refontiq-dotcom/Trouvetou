import { Skeleton } from "@/components/ui/skeleton";

/** Squelette d'une carte verticale du catalogue — aligné sur `ListingCard`. */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-tt-card bg-tt-card shadow-tt-card ring-1 ring-tt-line">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="mt-1 h-4 w-2/5" />
      </div>
    </div>
  );
}

/**
 * Grille de chargement du catalogue.
 * 2 colonnes sur mobile (maquette), 3 puis 4 sur desktop.
 */
export function ListingCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}
