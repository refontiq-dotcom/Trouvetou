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
  booking_code?: string;
  listing_name: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  total_amount?: number;
  created_at: string;
}

interface BookingsContextValue {
  bookings: BookingRecord[];
  addBooking: (booking: BookingRecord) => void;
  count: number;
}

const BookingsContext = createContext<BookingsContextValue | null>(null);
const STORAGE_KEY = "trouvetou_bookings";

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
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): BookingRecord[] {
  return snapshot;
}

function getServerSnapshot(): BookingRecord[] {
  return [];
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

  const value = useMemo<BookingsContextValue>(
    () => ({
      bookings,
      addBooking,
      count: bookings.length,
    }),
    [bookings, addBooking]
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
      count: 0,
    };
  }
  return ctx;
}
