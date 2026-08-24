"use client";

import { useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { startVoiceRecognition, isVoiceSupported } from "@/lib/speech";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  /** Callback appelé avec le texte transcrit. */
  onResult: (text: string) => void;
  /** Langue de reconnaissance (défaut : "fr-FR"). */
  lang?: string;
  /** Classes CSS supplémentaires. */
  className?: string;
  /** Taille du bouton. */
  size?: "sm" | "md" | "lg";
}

export function VoiceButton({
  onResult,
  lang = "fr-FR",
  className,
  size = "md",
}: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(isVoiceSupported);

  if (!supported) return null;

  async function handleClick() {
    if (listening) return;
    setListening(true);
    try {
      const text = await startVoiceRecognition(lang);
      if (text) onResult(text);
    } finally {
      setListening(false);
    }
  }

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSize = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <button
      onClick={handleClick}
      disabled={listening}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full transition-all",
        sizeClasses[size],
        listening
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        className
      )}
      aria-label={listening ? "Écoute en cours…" : "Recherche vocale"}
      title="Recherche vocale"
    >
      {listening ? (
        <>
          <MicOff className={iconSize[size]} />
          {/* Ondes sonores animées */}
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
        </>
      ) : (
        <Mic className={iconSize[size]} />
      )}
    </button>
  );
}
