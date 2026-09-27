"use client";
import { useMemo } from "react";
import { MapPin, Navigation, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingRecord } from "@/contexts/bookings-context";
import { useArrivalTracking } from "@/contexts/arrival-tracking-context";

function dayDiff(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function ArrivalTrackingAction({ booking }: { booking: BookingRecord }) {
  const { active, starting, error, startTracking, stopTracking, isTracking } = useArrivalTracking();
  const available = useMemo(() => {
    const arrivalWindow = booking.check_in_date && dayDiff(booking.check_in_date) >= 0 && dayDiff(booking.check_in_date) <= 1;
    const statusAllowsTracking = !booking.status || booking.status === "confirmed";
    return Boolean(arrivalWindow && statusAllowsTracking);
  }, [booking.check_in_date, booking.status]);
  const activeForBooking = isTracking(booking.booking_id);
  if (!booking.booking_id || !available) return null;

  if (activeForBooking) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Vous êtes en route</p>
            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">Position partagée avec la résidence</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-[11px]" onClick={() => void stopTracking(booking.booking_id!)}>
          <Square className="h-3 w-3" /> Arrêter
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Button type="button" variant="outline" size="sm" className="w-full justify-center" loading={starting} onClick={() => void startTracking(booking)}>
        <Navigation className="h-4 w-4" /> Je suis en route
      </Button>
      <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" /> Partage temporaire de votre position</p>
      {error && <p className="mt-1 text-center text-[10px] text-destructive">{error}</p>}
    </div>
  );
}