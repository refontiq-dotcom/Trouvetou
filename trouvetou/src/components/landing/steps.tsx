"use client";

import { motion } from "framer-motion";
import { Search, MapPin, MessageCircle } from "lucide-react";

const STEPS = [
  {
    number: 1,
    icon: Search,
    title: "Recherchez",
    description:
      "Tapez ce que vous cherchez — école, clinique, restaurant — ou utilisez la recherche vocale.",
    color: "from-primary to-primary/80",
    iconBg: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  {
    number: 2,
    icon: MapPin,
    title: "Localisez",
    description:
      "Activez la géolocalisation ou choisissez une ville. Les résultats se trient par distance.",
    color: "from-accent to-accent/80",
    iconBg: "bg-accent/10 text-accent",
    dot: "bg-accent",
  },
  {
    number: 3,
    icon: MessageCircle,
    title: "Contactez",
    description:
      "Partagez sur WhatsApp, appelez directement ou réservez en un clic.",
    color: "from-[#25D366] to-[#25D366]/80",
    iconBg: "bg-[#25D366]/10 text-[#25D366]",
    dot: "bg-[#25D366]",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-gradient-to-b from-white to-slate-50/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Simple, rapide, intelligent
          </span>
          <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Comment ça marche ?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Trouvez ce qu&apos;il vous faut en 3 étapes, depuis votre téléphone.
          </p>
        </motion.div>

        {/* Timeline — horizontal sur desktop, vertical sur mobile */}
        <div className="relative">
          {/* Ligne de connexion — visible sur desktop */}
          <div className="hidden md:block absolute top-[52px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-[2px]">
            <div className="h-full bg-gradient-to-r from-primary via-accent to-[#25D366] rounded-full opacity-20" />
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.3 }}
              className="absolute inset-0 h-full bg-gradient-to-r from-primary via-accent to-[#25D366] rounded-full origin-left"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Icône circulaire avec le numéro */}
                  <div className="relative z-10 mb-5">
                    <div
                      className={`flex h-[72px] w-[72px] sm:h-[80px] sm:w-[80px] items-center justify-center rounded-full ${step.iconBg} shadow-sm ring-4 ring-white transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}
                    >
                      <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </div>
                    {/* Numéro flottant */}
                    <div
                      className={`absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${step.dot} shadow-sm`}
                    >
                      {step.number}
                    </div>
                  </div>

                  {/* Contenu */}
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                    {step.description}
                  </p>

                  {/* Flèche mobile (pas de ligne de connexion) */}
                  {i < STEPS.length - 1 && (
                    <div className="md:hidden mt-4 text-slate-300">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12l7 7 7-7" />
                      </svg>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
