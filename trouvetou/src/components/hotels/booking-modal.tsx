"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  MessageCircle,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { buildWhatsAppUrl, formatFCFA } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

interface BookingModalProps {
  room: ListingView;
  open: boolean;
  onClose: () => void;
  /** Libellé du prix (défaut : "/ nuit"). */
  priceSuffix?: string;
}

type CheckResult = {
  available: boolean;
  available_rooms: number;
  nights: number;
};

type BookingResult = {
  booking_code?: string;
  status?: string;
  check_in_date?: string;
  check_out_date?: string;
  total_amount?: number;
  number_of_guests?: number;
};

type Step = "dates" | "guest" | "success";

export function BookingModal({
  room,
  open,
  onClose,
  priceSuffix = "par nuit",
}: BookingModalProps) {
  const establishment = room.establishment;
  const maxGuests = room.capacity && room.capacity > 0 ? room.capacity : 10;

  const [step, setStep] = useState<Step>("dates");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requests, setRequests] = useState("");

  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);

  // Garde-fou : la réservation « par nuit » n'a de sens que pour l'hôtellerie.
  if (room.category_slug !== "hotel" && room.category_slug !== "residence") {
    return null;
  }

  const reset = () => {
    setStep("dates");
    setCheckIn("");
    setCheckOut("");
    setGuests(1);
    setFullName("");
    setPhone("");
    setEmail("");
    setRequests("");
    setChecking(false);
    setCreating(false);
    setCheckError(null);
    setCheckResult(null);
    setCreateError(null);
    setBooking(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const checkAvailability = async () => {
    if (!checkIn || !checkOut) {
      setCheckError("Sélectionnez les dates d'arrivée et de départ.");
      return;
    }
    if (checkIn >= checkOut) {
      setCheckError("La date de départ doit être postérieure à l'arrivée.");
      return;
    }
    setChecking(true);
    setCheckError(null);
    setCheckResult(null);
    try {
      const res = await fetch("/api/catalog/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check",
          listing_id: room.id,
          check_in_date: checkIn,
          check_out_date: checkOut,
          number_of_guests: guests,
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        available?: boolean;
        available_rooms?: number;
        nights?: number;
        error?: string;
        code?: string;
      };
      if (!res.ok || body.success !== true) {
        setCheckError(body.error ?? "Impossible de vérifier la disponibilité.");
        return;
      }
      setCheckResult({
        available: body.available === true,
        available_rooms: body.available_rooms ?? 0,
        nights: body.nights ?? 1,
      });
      if (body.available === true) {
        setStep("guest");
      } else {
        setCheckError("Aucune chambre n'est disponible pour ces dates. Veuillez sélectionner d'autres dates.");
      }
    } catch {
      setCheckError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setChecking(false);
    }
  };

  const createBooking = async () => {
    if (!fullName.trim()) {
      setCreateError("Le nom complet est requis.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/catalog/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          listing_id: room.id,
          check_in_date: checkIn,
          check_out_date: checkOut,
          number_of_guests: guests,
          special_requests: requests.trim() ? requests.trim() : null,
          guest: {
            full_name: fullName.trim(),
            phone: phone.trim() ? phone.trim() : null,
            email: email.trim() ? email.trim() : null,
          },
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        booking?: BookingResult;
        error?: string;
        code?: string;
      };
      if (!res.ok || body.success !== true) {
        setCreateError(body.error ?? "La réservation a échoué.");
        return;
      }
      setBooking(body.booking ?? {});
      setStep("success");
    } catch {
      setCreateError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setCreating(false);
    }
  };

  const whatsappMessage = `Bonjour, je vous contacte depuis Trouvetou. Je suis intéressé(e) par « ${room.name} » à ${formatFCFA(
    room.price ?? 0
  )} ${priceSuffix}.`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Réserver en ligne"
      description="Vérification de la disponibilité en temps réel puis confirmation immédiate"
      size="lg"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          <Image
            src={room.images[0]}
            alt={room.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium text-foreground">
              {establishment?.name}
            </span>
          </div>
          <h3 className="truncate text-lg font-semibold text-foreground">
            {room.name}
          </h3>
          <p className="text-sm font-bold text-primary">
            {formatFCFA(room.price ?? 0)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {priceSuffix}
            </span>
          </p>
        </div>
      </div>

      {step === "dates" && (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Arrivée</span>
              <Input
                type="date"
                value={checkIn}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Départ</span>
              <Input
                type="date"
                value={checkOut}
                min={checkIn || new Date().toISOString().split("T")[0]}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Voyageurs</span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                max={maxGuests}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
              />
              <span className="text-sm text-muted-foreground">
                / {maxGuests} max
              </span>
            </div>
          </label>

          {checkError && (
            <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              {checkError}
            </p>
          )}

          <Button onClick={checkAvailability} loading={checking} size="lg">
            <CalendarCheck className="h-4 w-4" />
            Vérifier la disponibilité
          </Button>
        </div>
      )}

      {step === "guest" && checkResult && (
        <div className="mt-5 grid gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Disponible : {checkResult.available_rooms} chambre
              {checkResult.available_rooms > 1 ? "s" : ""} sur{" "}
              {checkResult.nights} nuit{checkResult.nights > 1 ? "s" : ""} ·
              Total estimé :{" "}
              <strong>{formatFCFA((room.price ?? 0) * checkResult.nights)}</strong>
            </span>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Nom complet *
            </span>
            <Input
              placeholder="Ex : Awa Diallo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Téléphone</span>
              <Input
                type="tel"
                placeholder="+225 07 00 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Email</span>
              <Input
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Demandes particulières
            </span>
            <textarea
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              rows={3}
              placeholder="Berlingot au miel, heure d'arrivée tardive, ..."
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
            />
          </label>

          {createError && (
            <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              {createError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setStep("dates")}
              disabled={creating}
            >
              Retour
            </Button>
            <Button onClick={createBooking} loading={creating} size="lg" className="flex-1">
              <CheckCircle2 className="h-4 w-4" />
              Confirmer la réservation
            </Button>
          </div>
        </div>
      )}

      {step === "success" && booking && (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-50 px-4 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <div>
              <p className="text-lg font-bold text-emerald-800">
                Réservation confirmée
              </p>
              {booking.booking_code && (
                <p className="mt-1 text-sm text-emerald-700">
                  Référence : <strong>{booking.booking_code}</strong>
                </p>
              )}
            </div>
            <div className="mt-2 grid gap-1 text-sm text-emerald-800">
              <p>
                {booking.check_in_date ?? checkIn} → {booking.check_out_date ?? checkOut} ·{" "}
                {booking.number_of_guests ?? guests} voyageur
                {(booking.number_of_guests ?? guests) > 1 ? "s" : ""}
              </p>
              {booking.total_amount != null && (
                <p className="font-bold">
                  Total : {formatFCFA(booking.total_amount)}
                </p>
              )}
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            L&apos;établissement a bien été notifié. Vous recevrez les détails de
            votre séjour.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            {establishment?.whatsapp && (
              <a
                href={buildWhatsAppUrl(establishment.whatsapp, whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                <MessageCircle className="h-4 w-4" />
                Contacter sur WhatsApp
              </a>
            )}
            <Button onClick={handleClose} className="flex-1">
              Fermer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
