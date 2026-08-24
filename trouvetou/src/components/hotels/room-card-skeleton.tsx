import { Skeleton } from "@/components/ui/skeleton";

export function RoomCardSkeleton() {
  return (
    <div className="flex flex-row overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="h-[130px] w-[130px] flex-shrink-0 rounded-none sm:h-[150px] sm:w-[200px] lg:w-[240px]" />
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
        <div className="mt-3 hidden flex-wrap gap-1 sm:flex">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
          <Skeleton className="h-6 w-28" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoomCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <RoomCardSkeleton key={i} />
      ))}
    </div>
  );
}
