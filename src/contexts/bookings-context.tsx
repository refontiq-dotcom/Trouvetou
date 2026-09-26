"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface BookingRecord {
  booking_id?: string;
  listing_id?: string;
  booking_code?: string;
  listing_name: string;
  establishment_name?: string;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  status?: string;
  arrival_tracking?: {
    status: "active" | "stopped" | "completed" | "expired";
    token?: string;
    started_at?: string;
    expires_at?: string;
  };
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  total_amount?: number;
  created_at: string;
}

interface BookingsContextValue {
  bookings: BookingRecord[];
  addBooking: (booking: BookingRecord) => void;
  updateBooking: (bookingId: string, patch: Partial<BookingRecord>) => void;
  count: number;
}

const BookingsContext = createContext<BookingsContextValue | null>(null);
const STORAGE_KEY = "trouvetou_bookings";

// Snapshot stable réutilisé par getServerSnapshot() : renvoyer un nouveau
// tableau à chaque appel fait boucler React (« getServerSnapshot should be
// cached to avoid an infinite loop »). Même pattern que favorites-context.
const EMPTY_SNAPSHOT: BookingRecord[] = [];

let snapshot: BookingRecord[] = readEmptyOrStored();
const listeners = new Set<() => void>();

function readEmptyOrStored(): BookingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BookingRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function emit() {
  snapshot = readEmptyOrStored();
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  // Après l'hydratation, on recharge les réservations persistées sans
  // modifier l'instantané utilisé par le serveur. Même pattern que
  // favorites-context.
  const stored = readEmptyOrStored();
  if (stored.length !== snapshot.length) {
    snapshot = stored;
    callback();
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) emit();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): BookingRecord[] {
  return snapshot;
}

function getServerSnapshot(): BookingRecord[] {
  // La référence doit rester stable pendant le SSR et l'hydratation : un
  // `[]` littéral ici provoquerait une boucle de rendu infinie.
  return EMPTY_SNAPSHOT;
}

function persist(next: BookingRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // stockage indisponible
  }
  emit();
}

export function BookingsProvider({ children }: { children: ReactNode }) {
  const bookings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addBooking = useCallback((booking: BookingRecord) => {
    const next = [...snapshot, booking];
    persist(next);
  }, []);

  const updateBooking = useCallback((bookingId: string, patch: Partial<BookingRecord>) => {
    const next = snapshot.map((booking) =>
      booking.booking_id === bookingId || booking.booking_code === bookingId
        ? { ...booking, ...patch }
        : booking
    );
    persist(next);
  }, []);

  const value = useMemo<BookingsContextValue>(
    () => ({
      bookings,
      addBooking,
      updateBooking,
      count: bookings.length,
    }),
    [bookings, addBooking, updateBooking]
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
    return {
      bookings: [],
      addBooking: () => {},
      updateBooking: () => {},
      count: 0,
    };
  }
  return ctx;
}
