import { useEffect } from "react";
import { BadgeService } from "../services/BadgeService";
import { NotificationService } from "../services/NotificationService";

/**
 * Synchronise le badge de l'icône au cold-start / après login en récupérant
 * le compteur serveur. Se (re)déclenche à chaque transition d'auth.
 */
export function useBadgeSync(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) {
      BadgeService.reset().catch(() => {});
      return;
    }

    let cancelled = false;

    NotificationService.getBadge()
      .then((count) => {
        if (!cancelled) {
          BadgeService.setCount(count).catch(() => {});
        }
      })
      .catch(() => {
        // best-effort — ne jamais casser l'app pour un badge
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
}
