"use client";

import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { startVoiceRecognition, isVoiceSupported } from "@/lib/speech";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  onResult: (text: string) => void;
  lang?: string;
  className?: string;
}

export function VoiceButton({ onResult, lang = "fr-FR", className }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(isVoiceSupported);

  if (!supported) return null;

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (listening) return;
    setListening(true);
    try {
      const text = await startVoiceRecognition(lang);
      if (text) onResult(text);
    } finally {
      setListening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={listening}
      className={cn(
        "absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-all",
        listening
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
          : "bg-primary/10 text-primary hover:bg-primary/20",
        className
      )}
      aria-label={listening ? "Écoute en cours…" : "Recherche vocale"}
    >
      {listening ? (
        <>
          <MicOff className="h-4 w-4" />
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
        </>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
