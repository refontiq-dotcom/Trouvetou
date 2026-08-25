"use client";

import { motion } from "framer-motion";
import { Search, MapPin, MessageCircle } from "lucide-react";

const STEPS = [
  {
    number: 1,
    icon: Search,
    title: "Recherchez",
    color: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  {
    number: 2,
    icon: MapPin,
    title: "Localisez",
    color: "bg-accent/10 text-accent",
    dot: "bg-accent",
  },
  {
    number: 3,
    icon: MessageCircle,
    title: "Contactez",
    color: "bg-[#25D366]/10 text-[#25D366]",
    dot: "bg-[#25D366]",
  },
];

export function HowItWorks() {
  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                {/* Icône */}
                <div className="relative mb-2">
                  <div
                    className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full ${step.color}`}
                  >
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div
                    className={`absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${step.dot}`}
                  >
                    {step.number}
                  </div>
                </div>

                {/* Titre court */}
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  {step.title}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
