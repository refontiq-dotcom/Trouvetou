"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const MAX_COMPARE = 2;

interface CompareItem {
  id: string;
  name: string;
  city?: string | null;
  price?: number | null;
  image?: string;
}

interface CompareContextValue {
  /** Annonces sélectionnées pour la comparaison (max 2). */
  items: CompareItem[];
  /** Ajoute ou retire une annonce de la comparaison. */
  toggleCompare: (item: CompareItem) => void;
  /** Vérifie si une annonce est sélectionnée. */
  isSelected: (id: string) => boolean;
  /** Nombre d'annonces sélectionnées. */
  count: number;
  /** Vide la sélection. */
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);

  const toggleCompare = useCallback((item: CompareItem) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) return prev.filter((i) => i.id !== item.id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, item];
    });
  }, []);

  const isSelected = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const clearCompare = useCallback(() => setItems([]), []);

  const value = useMemo<CompareContextValue>(
    () => ({ items, toggleCompare, isSelected, count: items.length, clearCompare }),
    [items, toggleCompare, isSelected, clearCompare]
  );

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    return {
      items: [],
      toggleCompare: () => {},
      isSelected: () => false,
      count: 0,
      clearCompare: () => {},
    };
  }
  return ctx;
}

export type { CompareItem };
