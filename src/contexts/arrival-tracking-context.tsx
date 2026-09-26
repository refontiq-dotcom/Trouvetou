"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useBookings, type BookingRecord } from "@/contexts/bookings-context";
import { requestBrowserLocation, haversineDistance, type LatLng } from "@/lib/geo";

type ActiveTracking = { booking_id: string; token: string; started_at?: string; expires_at?: string };
type ArrivalTrackingContextValue = { active: ActiveTracking | null; starting: boolean; error: string | null; startTracking: (booking: BookingRecord) => Promise<boolean>; stopTracking: (bookingId: string) => Promise<void>; isTracking: (bookingId?: string) => boolean };
const STORAGE_KEY = "trouvetou_arrival_tracking";
const ArrivalTrackingContext = createContext<ArrivalTrackingContextValue | null>(null);

export function ArrivalTrackingProvider({ children }: { children: ReactNode }) {
  const { bookings, updateBooking } = useBookings();
  const [active, setActive] = useState<ActiveTracking | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<LatLng | null>(null);
  const lastSentAtRef = useRef(0);

  const persist = useCallback((next: ActiveTracking | null) => {
    setActive(next);
    try { if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); else localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const clearTimer = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; }, []);

  const sendCurrentPosition = useCallback(async (session: ActiveTracking, force = false) => {
    const loc = await requestBrowserLocation();
    if (!loc) {
      setError("Position indisponible. Vérifiez l’autorisation GPS.");
      return;
    }
    const now = Date.now();
    if (!force && lastSentRef.current && now - lastSentAtRef.current < 15000 && haversineDistance(lastSentRef.current, loc) < 100) return;

    try {
      const res = await fetch("/api/catalog/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_tracking",
          booking_id: session.booking_id,
          public_token: session.token,
          latitude: loc.lat,
          longitude: loc.lng,
        }),
        cache: "no-store",
      });

      if (res.ok) {
        lastSentRef.current = loc;
        lastSentAtRef.current = now;
        setError(null);
        return;
      }

      if (res.status === 410 || res.status === 409 || res.status === 404) {
        clearTimer();
        persist(null);
        updateBooking(session.booking_id, {
          arrival_tracking: { status: res.status === 410 ? "expired" : "stopped" },
        });
        setError(
          res.status === 410
            ? "Le suivi a expiré. Vous pouvez le réactiver si votre arrivée est toujours prévue."
            : "Le suivi n’est plus actif pour cette réservation."
        );
        return;
      }

      setError("Connexion au service de suivi momentanément indisponible. Nouvelle tentative automatique.");
    } catch {
      // Une perte de réseau ne termine pas la session : le serveur conserve
      // la session active et le prochain cycle réessaiera automatiquement.
      setError("Connexion perdue. Le suivi reprendra automatiquement dès que le réseau revient.");
    }
  }, [clearTimer, persist, updateBooking]);

  const startPolling = useCallback((session: ActiveTracking) => {
    clearTimer();
    void sendCurrentPosition(session, true);
    timerRef.current = setInterval(() => { void sendCurrentPosition(session); }, 15000);
  }, [clearTimer, sendCurrentPosition]);

  const startTracking = useCallback(async (booking: BookingRecord) => {
    if (!booking.booking_id || starting) return false;
    if (active && active.booking_id === booking.booking_id) return true;
    if (active && active.booking_id !== booking.booking_id) {
      setError("Un autre suivi d’arrivée est déjà actif.");
      return false;
    }
    setStarting(true); setError(null);
    try {
      const initial = await requestBrowserLocation();
      if (!initial) throw new Error("Autorisez la localisation pour partager votre arrivée.");
      const res = await fetch("/api/catalog/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start_tracking", listing_id: booking.listing_id, booking_id: booking.booking_id }), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success !== true || !data?.token) throw new Error(data?.error || "Impossible d’activer le suivi.");
      const session: ActiveTracking = { booking_id: booking.booking_id, token: data.token, started_at: data.started_at, expires_at: data.expires_at };
      persist(session); updateBooking(booking.booking_id, { arrival_tracking: { status: "active", token: data.token, started_at: data.started_at, expires_at: data.expires_at } });
      lastSentRef.current = initial; lastSentAtRef.current = Date.now();
      await fetch("/api/catalog/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_tracking", booking_id: booking.booking_id, public_token: data.token, latitude: initial.lat, longitude: initial.lng }), cache: "no-store" });
      startPolling(session);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’activer le suivi."); return false; }
    finally { setStarting(false); }
  }, [active, startPolling, starting, persist, updateBooking]);

  const stopTracking = useCallback(async (bookingId: string) => {
    const session = active?.booking_id === bookingId ? active : null;
    clearTimer();
    if (session) { try { await fetch("/api/catalog/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop_tracking", booking_id: bookingId, public_token: session.token }), cache: "no-store" }); } catch {} }
    persist(null); updateBooking(bookingId, { arrival_tracking: { status: "stopped" } });
  }, [active, clearTimer, persist, updateBooking]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ActiveTracking;
      if (!saved?.booking_id || !saved?.token) return;
      if (saved.expires_at && new Date(saved.expires_at) <= new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        updateBooking(saved.booking_id, { arrival_tracking: { status: "expired" } });
        return;
      }
      setActive(saved);
      if (bookings.some((b) => b.booking_id === saved.booking_id)) {
        updateBooking(saved.booking_id, {
          arrival_tracking: { status: "active", token: saved.token, started_at: saved.started_at, expires_at: saved.expires_at },
        });
      }
      startPolling(saved);
    } catch {}
    return clearTimer;
  }, [bookings, clearTimer, startPolling, updateBooking]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return <ArrivalTrackingContext.Provider value={{ active, starting, error, startTracking, stopTracking, isTracking: (id) => Boolean(active && (!id || active.booking_id === id)) }}>{children}</ArrivalTrackingContext.Provider>;
}

export function useArrivalTracking() {
  const ctx = useContext(ArrivalTrackingContext);
  if (!ctx) throw new Error("useArrivalTracking doit être utilisé dans ArrivalTrackingProvider.");
  return ctx;
}