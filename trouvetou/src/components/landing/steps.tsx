"use client";

import { motion } from "framer-motion";
import { CircleCheck, HandCoins, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    number: "1",
    icon: Search,
    title: "Recherchez",
    description:
      "Trouvez l'établissement qu'il vous faut — école, clinique ou résidence — grâce à la recherche et aux filtres.",
    color: "bg-primary",
  },
  {
    number: "2",
    icon: MapPin,
    title: "Localisez",
    description:
      "Visualisez l'emplacement exact et obtenez l'itinéraire vers l'établissement en un clic.",
    color: "bg-accent",
  },
  {
    number: "3",
    icon: HandCoins,
    title: "Contactez & Réservez",
    description:
      "Contactez directement l'établissement par téléphone ou WhatsApp et finalisez votre démarche.",
    color: "bg-primary",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
            <CircleCheck className="h-4 w-4" />
            Simple, rapide, sécurisé
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Comment ça marche ?
          </h2>
        </motion.div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.12 }}
                className={cn(
                  "relative rounded-2xl border border-border bg-card p-5 sm:p-8 transition-shadow hover:shadow-lg",
                  i === 2 && "col-span-2 md:col-span-1"
                )}
              >
                {/* Step number */}
                <div
                  className={cn(
                    "absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-md",
                    step.color
                  )}
                >
                  {step.number}
                </div>

                <div
                  className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-xl text-white",
                    step.color
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-lg font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
