"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * TROUVETOU — Réservations.
 *
 * Un compte est requis : chaque réservation est enregistrée dans la table
 * `bookings` (RLS `auth.uid() = user_id`). L'ancienne version ne gardait
 * l'historique que dans le navigateur, donc le client le perdait en changeant
 * d'appareil — alors que la réservation, elle, existe côté établissement.
 */

export interface BookingRecord {
  id?: string;
  listing_id?: string | null;
  booking_code?: string | null;
  listing_name: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  total_amount?: number | null;
  created_at: string;
}

interface BookingsContextValue {
  bookings: BookingRecord[];
  /** N'enregistre que pour un utilisateur connecté (no-op sinon). */
  addBooking: (booking: BookingRecord) => void;
  count: number;
  loading: boolean;
}

const BookingsContext = createContext<BookingsContextValue | null>(null);

export function BookingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Les réservations sont indexées par utilisateur : au changement de compte
  // (ou à la déconnexion) la valeur retombe à vide sans setState synchrone
  // dans l'effet. `loading` se déduit de l'absence de chargement pour cet id.
  const [entry, setEntry] = useState<{
    userId: string | null;
    bookings: BookingRecord[];
  }>({ userId: null, bookings: [] });

  const bookings = useMemo(
    () => (entry.userId === userId ? entry.bookings : []),
    [entry, userId]
  );
  const loading = userId !== null && entry.userId !== userId;

  useEffect(() => {
    if (!userId) return;

    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let active = true;

    void supabase
      .from("bookings")
      .select(
        "id, listing_id, booking_code, listing_name, check_in_date, check_out_date, number_of_guests, total_amount, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setEntry({ userId, bookings: (data ?? []) as BookingRecord[] });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const addBooking = useCallback(
    (booking: BookingRecord) => {
      if (!userId) return;

      // Affichage immédiat, puis confirmation par la base.
      const optimistic: BookingRecord = { ...booking };
      const current = entry.userId === userId ? entry.bookings : [];
      setEntry({ userId, bookings: [optimistic, ...current] });

      const supabase = getBrowserSupabase();
      if (!supabase) return;

      void (async () => {
        const { data, error } = await supabase
          .from("bookings")
          .insert({
            user_id: userId,
            listing_id: booking.listing_id ?? null,
            booking_code: booking.booking_code ?? null,
            listing_name: booking.listing_name,
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            number_of_guests: booking.number_of_guests,
            total_amount: booking.total_amount ?? null,
          })
          .select("id")
          .single();

        if (error) {
          // La réservation existe côté établissement : on retire seulement la
          // ligne locale qui n'a pas pu être archivée.
          setEntry((previous) => ({
            ...previous,
            bookings: previous.bookings.filter((item) => item !== optimistic),
          }));
          return;
        }

        setEntry((previous) => ({
          ...previous,
          bookings: previous.bookings.map((item) =>
            item === optimistic ? { ...item, id: data.id } : item
          ),
        }));
      })();
    },
    [userId, entry]
  );

  const value = useMemo<BookingsContextValue>(
    () => ({ bookings, addBooking, count: bookings.length, loading }),
    [bookings, addBooking, loading]
  );

  return (
    <BookingsContext.Provider value={value}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings(): BookingsContextValue {
  const ctx = useContext(BookingsContext);
  if (!ctx) {
    return { bookings: [], addBooking: () => {}, count: 0, loading: false };
  }
  return ctx;
}
