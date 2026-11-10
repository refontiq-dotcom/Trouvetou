"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, GraduationCap, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { ListingView, SchoolLevelView } from "@/lib/supabase/listing-view";

interface SchoolReservationModalProps {
  school: ListingView;
  open: boolean;
  onClose: () => void;
}

type ReservationResult = {
  id: string;
  status: string;
  level?: { label?: string };
  qr_code?: string | null;
  expires_at?: string | null;
  availability_confirmed?: boolean;
  reused?: boolean;
};

export function SchoolReservationModal({ school, open, onClose }: SchoolReservationModalProps) {
  const [levels, setLevels] = useState<SchoolLevelView[]>([]);
  const [levelId, setLevelId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [loadedSchoolId, setLoadedSchoolId] = useState<string | null>(null);
  const loadingLevels = open && loadedSchoolId !== school.id;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/catalog/school-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "availability", listing_id: school.id }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.success !== true || !Array.isArray(body.levels)) {
          throw new Error(body?.error ?? "Impossible de charger les niveaux de cette école.");
        }
        if (!active) return;
        const nextLevels = body.levels as SchoolLevelView[];
        setLevels(nextLevels);
        const firstAvailable = nextLevels.find((level) => level.disponible !== false && !(level.disponible !== null && level.places_disponibles === 0));
        setLevelId(firstAvailable?.id ?? "");
        setLoadedSchoolId(school.id);
        if (nextLevels.length === 0) {
          setError("Aucun niveau n'est actuellement publié pour cette école.");
        } else if (!firstAvailable) {
          setError("Aucun niveau ne dispose de places annoncées disponibles pour le moment.");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Impossible de contacter Schooly.");
          setLoadedSchoolId(school.id);
        }
      });
    return () => { active = false; };
  }, [open, school.id]);

  const reset = () => {
    setLevels([]);
    setLevelId("");
    setStudentName("");
    setBirthdate("");
    setParentName("");
    setParentPhone("");
    setParentEmail("");
    setLoadedSchoolId(null);
    setSubmitting(false);
    setError(null);
    setResult(null);
    setIdempotencyKey("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (submitting) return;
    if (!levelId || !studentName.trim() || !birthdate || !parentName.trim() || !parentPhone.trim()) {
      setError("Complétez le niveau, les informations de l'élève et les coordonnées du parent.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const requestKey = idempotencyKey || globalThis.crypto.randomUUID();
    setIdempotencyKey(requestKey);
    try {
      const response = await fetch("/api/catalog/school-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          listing_id: school.id,
          level_id: levelId,
          idempotency_key: requestKey,
          student_full_name: studentName.trim(),
          student_birthdate: birthdate,
          parent_full_name: parentName.trim(),
          parent_phone: parentPhone.trim(),
          parent_email: parentEmail.trim() || null,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.success !== true || !body.reservation?.id) {
        throw new Error(body?.error ?? "La demande n'a pas pu être transmise.");
      }
      setResult(body.reservation as ReservationResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur réseau. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLevel = levels.find((level) => level.id === levelId);

  return (
    <Modal
      open={open}
      onClose={close}
      title={result ? "Demande transmise" : "Demander une place"}
      description={result ? "L'établissement a reçu les informations de votre demande." : `Demande auprès de ${school.name}. Aucun paiement en ligne n'est demandé.`}
      size="lg"
    >
      {result ? (
        <div className="mt-4 grid gap-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-50 px-4 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <div>
              <p className="text-lg font-bold text-emerald-800">{result.availability_confirmed ? "Votre place est réservée" : "Votre demande a bien été transmise"}</p>
              <p className="mt-1 text-sm text-emerald-700">{result.availability_confirmed ? "Présentez cette référence à l'établissement dans les 72 heures pour finaliser l'inscription." : "L'école doit confirmer la disponibilité de ce niveau et pourra vous contacter."}</p>
            </div>
            <div className="rounded-xl bg-white/70 px-4 py-3 text-sm text-emerald-900">
              <p>Niveau : <strong>{result.level?.label ?? selectedLevel?.label ?? "—"}</strong></p>
              <p className="mt-1">Référence : <strong>{result.qr_code ?? result.id}</strong></p>
              {result.expires_at && <p className="mt-1">À utiliser avant le : <strong>{new Date(result.expires_at).toLocaleString("fr-FR")}</strong></p>}
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Aucun paiement en ligne ni inscription définitive n&apos;a été effectué. Vous finaliserez les formalités directement auprès de l&apos;établissement.
          </p>
          <Button onClick={close} className="w-full">Fermer</Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>Envoyez une demande à l&apos;école. Elle sera traitée par son équipe dans Schooly. L&apos;inscription se fera ensuite directement auprès de l&apos;établissement.</span>
          </div>

          {loadingLevels ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des niveaux et disponibilités…
            </div>
          ) : (
            <>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-foreground">Niveau souhaité *</span>
                <select
                  value={levelId}
                  onChange={(event) => setLevelId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Choisir un niveau</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id} disabled={level.disponible === false || (level.disponible !== null && level.places_disponibles === 0)}>
                      {level.label}{level.disponible !== null && typeof level.places_disponibles === "number" ? ` — ${level.places_disponibles} place(s) annoncée(s)` : ""}{level.disponible === false ? " — complet" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-foreground">Nom complet de l&apos;élève *</span>
                  <Input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Nom et prénoms de l'élève" maxLength={180} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">Date de naissance *</span>
                  <Input type="date" value={birthdate} onChange={(event) => setBirthdate(event.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">Nom du parent *</span>
                  <Input value={parentName} onChange={(event) => setParentName(event.target.value)} placeholder="Nom complet" maxLength={180} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">Téléphone du parent *</span>
                  <Input type="tel" value={parentPhone} onChange={(event) => setParentPhone(event.target.value)} placeholder="+225 07 00 00 00 00" maxLength={40} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">Email du parent (facultatif)</span>
                  <Input type="email" value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} placeholder="parent@exemple.com" maxLength={160} />
                </label>
              </div>
            </>
          )}

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />{error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={close} disabled={submitting}>Annuler</Button>
            <Button onClick={submit} loading={submitting} disabled={loadingLevels || levels.length === 0 || !levelId} size="lg" className="flex-1">
              Envoyer la demande
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
