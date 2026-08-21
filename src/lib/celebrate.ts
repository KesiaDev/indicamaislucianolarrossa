import confetti from "canvas-confetti";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type CelebrateKind = "reward" | "tier" | "firstConversion" | "share";

/**
 * Dispara confetti contextual. No-op se o utilizador pediu reduced motion.
 */
export function celebrate(kind: CelebrateKind = "reward", tierColor?: string) {
  if (prefersReducedMotion()) return;

  switch (kind) {
    case "tier": {
      const colors = [tierColor ?? "#FFD700", "#ffffff"];
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors });
      setTimeout(
        () => confetti({ particleCount: 80, spread: 110, origin: { y: 0.6 }, colors }),
        220,
      );
      break;
    }
    case "firstConversion": {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      break;
    }
    case "share": {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      break;
    }
    case "reward":
    default: {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.6 } }), 220);
      break;
    }
  }
}

/**
 * Vibração háptica curta no mobile. Respeita reduced motion.
 */
export function vibrate(ms: number | number[] = 10) {
  if (prefersReducedMotion()) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(ms);
    } catch {
      /* no-op */
    }
  }
}
