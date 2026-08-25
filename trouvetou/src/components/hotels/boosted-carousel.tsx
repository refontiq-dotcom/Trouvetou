"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, Phone, Sparkles } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/hotels/booking-modal";
import { formatFCFA, PLACEHOLDER_IMAGE } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

interface BoostedCarouselProps {
  rooms: ListingView[];
  /** Libellé du prix (défaut : "/ nuit"). */
  priceSuffix?: string;
}

function BoostedCard({
  room,
  index,
  priceSuffix = "/ nuit",
}: {
  room: ListingView;
  index: number;
  priceSuffix?: string;
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const establishment = room.establishment;
  const image = room.images[0] ?? PLACEHOLDER_IMAGE;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="group relative h-80 overflow-hidden rounded-3xl border border-accent/40 shadow-lg shadow-accent/20"
      >
        <Image
          src={image}
          alt={establishment?.name ?? room.name}
          fill
          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          priority={index === 0}
          loading={index === 0 ? "eager" : "lazy"}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

        {/* Badge brillant "À la une" */}
        <div className="absolute left-4 top-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-gradient-to-r from-accent via-yellow-300 to-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground shadow-lg shadow-accent/30">
            <Sparkles className="h-3.5 w-3.5" />
            Établissement à la une
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h3 className="text-xl font-bold leading-snug drop-shadow">
            {establishment?.name ?? room.name}
          </h3>

          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-white/85">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1">{establishment?.address ?? establishment?.city ?? ""}</span>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-2xl font-bold drop-shadow">
              {formatFCFA(room.price ?? 0)}
              <span className="ml-1 text-sm font-normal text-white/80">
                {priceSuffix}
              </span>
            </p>

            <Button
              size="sm"
              className="rounded-full bg-white text-slate-900 shadow hover:bg-yellow-50"
              onClick={() => setBookingOpen(true)}
            >
              <Phone className="h-4 w-4" />
              Réserver
            </Button>
          </div>
        </div>
      </motion.div>

      <BookingModal
        room={room}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        priceSuffix={priceSuffix}
      />
    </>
  );
}

export function BoostedCarousel({ rooms, priceSuffix }: BoostedCarouselProps) {
  if (rooms.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-yellow-500 text-accent-foreground shadow">
            <Sparkles className="h-4 w-4" />
          </span>
          Établissements à la une
        </h2>
        <Badge variant="accent" className="hidden sm:inline-flex">
          Sponsorisés
        </Badge>
      </div>

      <Swiper
        modules={[Autoplay, Pagination]}
        autoplay={{ delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }}
        pagination={{ clickable: true }}
        loop={rooms.length > 1}
        spaceBetween={24}
        slidesPerView={1}
        breakpoints={{
          768: { slidesPerView: 2 },
          1280: { slidesPerView: 3 },
        }}
        className="!pb-10 [&_.swiper-pagination-bullet]:bg-accent"
      >
        {rooms.map((room, i) => (
          <SwiperSlide key={room.id}>
            <BoostedCard room={room} index={i} priceSuffix={priceSuffix} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
