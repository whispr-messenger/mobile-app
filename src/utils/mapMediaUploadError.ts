import {
  isUploadValidationError,
  type UploadValidationError,
} from "../services/MediaService";

type ApiError = Error & { status?: number };

export function mapMediaUploadError(error: unknown): {
  userMessage: string;
  retryable: boolean;
} {
  if (isUploadValidationError(error)) {
    const ve = error as UploadValidationError;
    if (ve.code === "UPLOAD_TOO_LARGE") {
      const mb = ve.limitBytes
        ? Math.round(ve.limitBytes / (1024 * 1024))
        : 100;
      return {
        userMessage: `Fichier trop volumineux (max ${mb} Mo)`,
        retryable: false,
      };
    }
    return {
      userMessage: "Format de fichier non supporté",
      retryable: false,
    };
  }

  const err = error as ApiError;
  const status = err?.status;

  if (status === 413) {
    return {
      userMessage: "Fichier trop volumineux ou quota dépassé",
      retryable: false,
    };
  }
  if (status === 415) {
    return {
      userMessage: "Type de fichier refusé par le serveur",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      userMessage: "Trop d'envois en cours — réessayez dans quelques secondes",
      retryable: true,
    };
  }
  if (status === 401 || status === 403) {
    return {
      userMessage: "Session expirée — reconnectez-vous",
      retryable: true,
    };
  }

  const msg = err?.message ?? "";
  if (msg.includes("Network error")) {
    return {
      userMessage: "Connexion interrompue — appuyez pour réessayer",
      retryable: true,
    };
  }

  return {
    userMessage: "Échec de l'envoi — appuyez pour réessayer",
    retryable: true,
  };
}
