"use client";

import { useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";
import { startVoiceRecognition, isVoiceSupported } from "@/lib/speech";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  onResult: (text: string) => void;
  lang?: string;
  className?: string;
}

// La disponibilité de la Web Speech API est une information EXTERNE (capacité
// du navigateur) : elle est lue via useSyncExternalStore, jamais dans un
// useEffect. Deux bénéfices :
//   - pas de setState en cascade (règle react-hooks/set-state-in-effect) ;
//   - getServerSnapshot garantit que le PREMIER rendu client est identique à
//     celui du serveur, donc plus d'erreur d'hydratation quand l'API existe
//     côté client mais est inconnue du serveur.
function subscribeToVoiceSupport() {
  // Aucun changement à diffuser : la capacité d'un navigateur est stable
  // pour toute la session. Retourne l'unsubscribe attendu par l'API.
  return () => {};
}

function getVoiceSupportSnapshot(): boolean {
  return isVoiceSupported();
}

function getVoiceSupportServerSnapshot(): boolean {
  return false;
}

export function VoiceButton({ onResult, lang = "fr-FR", className }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const supported = useSyncExternalStore(
    subscribeToVoiceSupport,
    getVoiceSupportSnapshot,
    getVoiceSupportServerSnapshot
  );

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (listening || !supported) return;
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
        "absolute right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full transition-all",
        // Seule la VISIBILITÉ dépend de la capability, jamais la présence de
        // l'élément : le balisage reste identique au premier rendu client.
        supported ? "flex" : "hidden",
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
