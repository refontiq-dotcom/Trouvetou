"use client";

import { motion } from "framer-motion";
import { ClipboardList, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ReservationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center text-center py-20"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ClipboardList className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-foreground">
          Mes réservations
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Vos réservations d&apos;hôtels et de chambres apparaîtront ici.
          Réservez directement depuis les annonces_partenaires Séjoura.
        </p>
        <Link href="/hotels" className="mt-6">
          <Button>
            Explorer les hébergements
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
