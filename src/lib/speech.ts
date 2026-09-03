// ============================================================================
// TROUVETOU — Reconnaissance vocale (Web Speech API)
//
// Utilise l'API SpeechRecognition du navigateur (Chrome, Edge, Safari)
// pour convertir la voix en texte. Retourne une promise qui se résout
// avec le texte transcrit ou null si refusé/erreur.
// ============================================================================

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

function getRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

/**
 * Lance la reconnaissance vocale et retourne le texte transcrit.
 * @param lang Langue (défaut : "fr-FR")
 * @param onInterim Callback appelé avec les résultats intermédiaires
 * @returns Le texte final ou null en cas d'échec
 */
export function startVoiceRecognition(
  lang = "fr-FR",
  onInterim?: (text: string) => void
): Promise<string | null> {
  return new Promise((resolve) => {
    const recognition = getRecognition();
    if (!recognition) {
      resolve(null);
      return;
    }

    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let resolved = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (interimText && onInterim) {
        onInterim(interimText);
      }

      if (finalText && !resolved) {
        resolved = true;
        recognition.stop();
        resolve(finalText.trim());
      }
    };

    recognition.onerror = () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    };

    recognition.onend = () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    };

    try {
      recognition.start();
    } catch {
      resolve(null);
    }
  });
}

/** Vérifie si la reconnaissance vocale est supportée par le navigateur. */
export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
