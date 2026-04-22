/**
 * Moderation Notification Handler
 *
 * Handles incoming push notifications for moderation events and routes
 * the user to the appropriate screen.
 */

// ─── Notification Types ──────────────────────────────────────────

export type ModerationNotificationType =
  | "report_resolved"
  | "sanction_issued"
  | "sanction_lifted"
  | "appeal_update"
  | "appeal_accepted"
  | "appeal_rejected"
  // Admin-only
  | "new_report"
  | "new_appeal"
  | "report_escalated";

export interface ModerationNotificationPayload {
  type: ModerationNotificationType;
  /** The entity id (report, sanction, or appeal) */
  entityId: string;
  /** Optional additional data */
  data?: Record<string, any>;
}

// ─── Route Resolution ────────────────────────────────────────────

interface NavigationRoute {
  name: string;
  params: Record<string, string>;
}

/**
 * Given a moderation push notification payload, return the screen
 * route + params the user should be navigated to.
 */
export const resolveNotificationRoute = (
  payload: ModerationNotificationPayload,
): NavigationRoute | null => {
  switch (payload.type) {
    // ── User-facing ──────────────────────────────────────────
    case "report_resolved":
      return {
        name: "ReportDetail",
        params: { reportId: payload.entityId },
      };

    case "sanction_issued":
      return {
        name: "SanctionNotice",
        params: { sanctionId: payload.entityId },
      };

    case "sanction_lifted":
      return {
        name: "SanctionNotice",
        params: { sanctionId: payload.entityId },
      };

    case "appeal_update":
    case "appeal_accepted":
    case "appeal_rejected":
      return {
        name: "AppealStatus",
        params: { appealId: payload.entityId },
      };

    // ── Admin-facing ─────────────────────────────────────────
    case "new_report":
    case "report_escalated":
      return {
        name: "ReportReview",
        params: { reportId: payload.entityId },
      };

    case "new_appeal":
      return {
        name: "AppealReview",
        params: { appealId: payload.entityId },
      };

    default:
      return null;
  }
};

// ─── Notification Processing ─────────────────────────────────────

type NavigateFn = (name: string, params?: Record<string, any>) => void;

/**
 * Process an incoming moderation push notification.
 *
 * Call this from your global notification handler when the notification
 * data contains `moderation_type`.
 *
 * @param data — the `data` object from the push notification
 * @param navigate — navigation.navigate function
 * @returns true if the notification was handled, false otherwise
 */
export const handleModerationNotification = (
  data: Record<string, any>,
  navigate: NavigateFn,
): boolean => {
  const moderationType = data?.moderation_type as
    | ModerationNotificationType
    | undefined;

  if (!moderationType) return false;

  const payload: ModerationNotificationPayload = {
    type: moderationType,
    entityId: data.entity_id as string,
    data,
  };

  const route = resolveNotificationRoute(payload);
  if (!route) return false;

  navigate(route.name, route.params);
  return true;
};

// ─── Notification Title / Body Helpers ───────────────────────────

interface NotificationDisplay {
  title: string;
  body: string;
}

/**
 * Generate a user-friendly title and body for a moderation notification.
 * Used when building local notifications or displaying in-app banners.
 */
export const getModerationNotificationDisplay = (
  type: ModerationNotificationType,
  lang: "fr" | "en" = "fr",
): NotificationDisplay => {
  const displays: Record<
    string,
    Record<ModerationNotificationType, NotificationDisplay>
  > = {
    fr: {
      report_resolved: {
        title: "Signalement resolu",
        body: "Votre signalement a ete traite.",
      },
      sanction_issued: {
        title: "Sanction appliquee",
        body: "Une sanction a ete appliquee a votre compte.",
      },
      sanction_lifted: {
        title: "Sanction levee",
        body: "Une sanction sur votre compte a ete levee.",
      },
      appeal_update: {
        title: "Mise a jour de contestation",
        body: "Le statut de votre contestation a change.",
      },
      appeal_accepted: {
        title: "Contestation acceptee",
        body: "Votre contestation a ete acceptee.",
      },
      appeal_rejected: {
        title: "Contestation rejetee",
        body: "Votre contestation a ete rejetee.",
      },
      new_report: {
        title: "Nouveau signalement",
        body: "Un nouveau signalement necessite votre attention.",
      },
      new_appeal: {
        title: "Nouvelle contestation",
        body: "Une nouvelle contestation necessite votre attention.",
      },
      report_escalated: {
        title: "Signalement escalade",
        body: "Un signalement a ete escalade automatiquement.",
      },
    },
    en: {
      report_resolved: {
        title: "Report resolved",
        body: "Your report has been processed.",
      },
      sanction_issued: {
        title: "Sanction applied",
        body: "A sanction has been applied to your account.",
      },
      sanction_lifted: {
        title: "Sanction lifted",
        body: "A sanction on your account has been lifted.",
      },
      appeal_update: {
        title: "Appeal update",
        body: "The status of your appeal has changed.",
      },
      appeal_accepted: {
        title: "Appeal accepted",
        body: "Your appeal has been accepted.",
      },
      appeal_rejected: {
        title: "Appeal rejected",
        body: "Your appeal has been rejected.",
      },
      new_report: {
        title: "New report",
        body: "A new report requires your attention.",
      },
      new_appeal: {
        title: "New appeal",
        body: "A new appeal requires your attention.",
      },
      report_escalated: {
        title: "Report escalated",
        body: "A report has been automatically escalated.",
      },
    },
  };

  return displays[lang]?.[type] ?? displays.en[type];
};
