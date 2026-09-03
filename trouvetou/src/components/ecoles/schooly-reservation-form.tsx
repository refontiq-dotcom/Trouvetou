"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CircleAlert, Loader2 } from "lucide-react";
import type { SchoolyEstablishment } from "@/lib/schooly";
import { cn } from "@/lib/utils";

interface SchoolyReservationFormProps {
  establishment: SchoolyEstablishment;
  /** URL du Route Handler qui crée la réservation. */
  action: string;
  /** Libellé du bouton principal. */
  submitLabel?: string;
  /** Mode "page dédiée" : redirige vers /confirmation. */
  redirectToConfirmation?: boolean;
}

type FieldErrors = Partial<
  Record<
    | "level_id"
    | "student_full_name"
    | "student_birthdate"
    | "parent_full_name"
    | "parent_phone"
    | "parent_email"
    | "_root",
    string
  >
>;

export function SchoolyReservationForm({
  establishment,
  action,
  submitLabel = "Réserver ma place",
  redirectToConfirmation = true,
}: SchoolyReservationFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const availableLevels = useMemo(
    () => establishment.availability.filter((l) => l.seats_available > 0),
    [establishment.availability]
  );

  async function handleSubmit(formData: FormData) {
    setErrors({});
    setServerError(null);
    setSubmitting(true);

    const payload = {
      establishment_id: establishment.id,
      level_id: String(formData.get("level_id") ?? "").trim(),
      student_full_name: String(formData.get("student_full_name") ?? "").trim(),
      student_birthdate: emptyToNull(formData.get("student_birthdate")),
      parent_full_name: String(formData.get("parent_full_name") ?? "").trim(),
      parent_phone: String(formData.get("parent_phone") ?? "").trim(),
      parent_email: emptyToNull(formData.get("parent_email")),
    };

    const localErrors = validateLocally(payload);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        reservation?: { id: string };
        error?: string;
      };

      if (!res.ok || !body.reservation) {
        setServerError(body.error ?? "Impossible de créer la réservation.");
        setSubmitting(false);
        return;
      }

      if (redirectToConfirmation) {
        router.push(
          `/ecoles/partenaires/${encodeURIComponent(establishment.id)}/confirmation?id=${encodeURIComponent(body.reservation.id)}`
        );
      } else {
        router.refresh();
      }
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Erreur réseau inconnue."
      );
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <Field
        label="Niveau"
        name="level_id"
        required
        error={errors.level_id}
        options={availableLevels.map((l) => ({
          value: l.level_id,
          label: `${l.level_name} — ${l.seats_available} place${
            l.seats_available > 1 ? "s" : ""
          }`,
        }))}
        placeholder={availableLevels.length === 0 ? "Aucun niveau disponible" : "Choisir un niveau"}
        disabled={availableLevels.length === 0}
      />

      <Field
        label="Nom complet de l'élève"
        name="student_full_name"
        required
        error={errors.student_full_name}
        placeholder="Ex. Aïcha Diallo"
      />

      <Field
        label="Date de naissance"
        name="student_birthdate"
        type="date"
        error={errors.student_birthdate}
      />

      <Field
        label="Nom complet du parent"
        name="parent_full_name"
        required
        error={errors.parent_full_name}
        placeholder="Ex. Mamadou Diallo"
      />

      <Field
        label="Téléphone du parent"
        name="parent_phone"
        type="tel"
        required
        error={errors.parent_phone}
        placeholder="+225 07 00 00 00 00"
      />

      <Field
        label="Email du parent (facultatif)"
        name="parent_email"
        type="email"
        error={errors.parent_email}
        placeholder="parent@exemple.com"
      />

      <SubmitButton submitting={submitting} label={submitLabel} />
    </form>
  );
}

function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
  const { pending } = useFormStatus();
  const busy = submitting || pending;
  return (
    <button
      type="submit"
      disabled={busy}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1769e8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102a72] disabled:opacity-60"
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {busy ? "Envoi en cours…" : label}
    </button>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: "text" | "email" | "tel" | "date";
  required?: boolean;
  error?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  disabled?: boolean;
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  error,
  placeholder,
  options,
  disabled = false,
}: FieldProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </span>
      {options ? (
        <select
          name={name}
          required={required}
          defaultValue=""
          disabled={disabled}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground outline-none focus:border-[#1769e8] focus:ring-2 focus:ring-[#1769e8]/20 disabled:opacity-60"
        >
          <option value="" disabled>
            {placeholder ?? "Choisir…"}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-foreground outline-none focus:border-[#1769e8] focus:ring-2 focus:ring-[#1769e8]/20 disabled:opacity-60"
        />
      )}
      {error && (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      )}
    </label>
  );
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateLocally(
  payload: Record<string, string | null>
): FieldErrors {
  const errors: FieldErrors = {};
  if (!payload.level_id) errors.level_id = "Veuillez choisir un niveau.";
  if (!payload.student_full_name || payload.student_full_name.length < 2) {
    errors.student_full_name = "Le nom de l'élève est requis.";
  }
  if (!payload.parent_full_name || payload.parent_full_name.length < 2) {
    errors.parent_full_name = "Le nom du parent est requis.";
  }
  if (!payload.parent_phone || payload.parent_phone.length < 6) {
    errors.parent_phone = "Le téléphone du parent est requis.";
  }
  if (payload.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.parent_email)) {
    errors.parent_email = "Email invalide.";
  }
  return errors;
}
