"use client";

import { motion } from "framer-motion";
import { MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MessagesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center text-center py-20"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageCircle className="h-8 w-8 text-[#25D366]" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-foreground">
          Messages
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Vos conversations avec les établissements apparaîtront ici.
          Contactez-les directement via WhatsApp depuis n&apos;importe quelle annonce.
        </p>
        <Link href="/ecoles" className="mt-6">
          <Button>
            Découvrir les annonces
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
