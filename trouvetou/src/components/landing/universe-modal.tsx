"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  GraduationCap,
  Hotel,
  Stethoscope,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Universe {
  title: string;
  description: string;
  icon: typeof Hotel;
  gradient: string;
  href?: string;
  soon?: boolean;
}

const UNIVERSES: Universe[] = [
  {
    title: "Hôtels & Résidences Meublées",
    description:
      "Chambres, studios et appartements à la nuit, à la semaine ou au mois.",
    icon: Hotel,
    gradient: "from-emerald-500 to-teal-600",
    href: "/hotels",
  },
  {
    title: "Écoles & Établissements Privés",
    description: "Campus, écoles et centres de formation de confiance.",
    icon: GraduationCap,
    gradient: "from-violet-500 to-indigo-600",
    soon: true,
  },
  {
    title: "Cliniques & Santé",
    description: "Cliniques, cabinets médicaux et centres de santé vérifiés.",
    icon: Stethoscope,
    gradient: "from-rose-500 to-pink-600",
    soon: true,
  },
];

interface UniverseModalProps {
  open: boolean;
  onClose: () => void;
}

export function UniverseModal({ open, onClose }: UniverseModalProps) {
  const router = useRouter();

  function choose(universe: Universe) {
    if (universe.soon || !universe.href) return;
    onClose();
    router.push(universe.href);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Que recherchez-vous ?"
      description="Choisissez l'univers qui vous intéresse pour commencer votre recherche."
      size="lg"
    >
      <div className="grid gap-4">
        {UNIVERSES.map((universe, i) => {
          const Icon = universe.icon;
          return (
            <motion.button
              key={universe.title}
              onClick={() => choose(universe)}
              disabled={universe.soon}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
              whileHover={
                universe.soon ? undefined : { x: 4, transition: { duration: 0.15 } }
              }
              className={cn(
                "group flex items-center gap-4 rounded-2xl border border-border bg-background p-4 text-left transition-shadow",
                universe.soon
                  ? "cursor-not-allowed opacity-70"
                  : "hover:border-primary hover:shadow-md hover:shadow-emerald-100/60"
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                  universe.gradient
                )}
              >
                <Icon className="h-6 w-6" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {universe.title}
                  </span>
                  {universe.soon && (
                    <Badge variant="warning">Bientôt disponible</Badge>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {universe.description}
                </span>
              </span>

              {!universe.soon && (
                <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              )}
            </motion.button>
          );
        })}
      </div>
    </Modal>
  );
}
