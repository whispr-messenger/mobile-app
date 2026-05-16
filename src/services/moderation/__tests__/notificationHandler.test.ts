import {
  getModerationNotificationDisplay,
  handleModerationNotification,
  resolveNotificationRoute,
  type ModerationNotificationType,
} from "../notificationHandler";

describe("resolveNotificationRoute", () => {
  it.each([
    ["report_resolved", "ReportDetail", "reportId"],
    ["sanction_issued", "SanctionNotice", "sanctionId"],
    ["sanction_lifted", "SanctionNotice", "sanctionId"],
    ["appeal_update", "AppealStatus", "appealId"],
    ["appeal_accepted", "AppealStatus", "appealId"],
    ["appeal_rejected", "AppealStatus", "appealId"],
    ["new_report", "ReportReview", "reportId"],
    ["report_escalated", "ReportReview", "reportId"],
    ["new_appeal", "AppealReview", "appealId"],
  ])("maps %s to %s", (type, screen, paramKey) => {
    const route = resolveNotificationRoute({
      type: type as ModerationNotificationType,
      entityId: "e-1",
    });
    expect(route?.name).toBe(screen);
    expect(route?.params[paramKey]).toBe("e-1");
  });

  it("returns null for unknown types", () => {
    expect(
      resolveNotificationRoute({
        type: "carrier_pigeon" as ModerationNotificationType,
        entityId: "e-1",
      }),
    ).toBeNull();
  });
});

describe("handleModerationNotification", () => {
  it("navigates when the payload contains a known moderation_type", () => {
    const navigate = jest.fn();
    const handled = handleModerationNotification(
      { moderation_type: "report_resolved", entity_id: "r-1" },
      navigate,
    );
    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith("ReportDetail", { reportId: "r-1" });
  });

  it("returns false when there is no moderation_type", () => {
    const navigate = jest.fn();
    expect(handleModerationNotification({}, navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("returns false when the moderation_type is unknown", () => {
    const navigate = jest.fn();
    expect(
      handleModerationNotification(
        { moderation_type: "carrier_pigeon" },
        navigate,
      ),
    ).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("getModerationNotificationDisplay", () => {
  it.each<ModerationNotificationType>([
    "report_resolved",
    "sanction_issued",
    "sanction_lifted",
    "appeal_update",
    "appeal_accepted",
    "appeal_rejected",
    "new_report",
    "new_appeal",
    "report_escalated",
  ])("returns a non-empty fr title+body for %s", (t) => {
    const d = getModerationNotificationDisplay(t, "fr");
    expect(d.title.length).toBeGreaterThan(0);
    expect(d.body.length).toBeGreaterThan(0);
  });

  it("returns the english variant when lang is 'en'", () => {
    const fr = getModerationNotificationDisplay("report_resolved", "fr");
    const en = getModerationNotificationDisplay("report_resolved", "en");
    expect(fr.title).not.toBe(en.title);
  });

  it("defaults to french when lang is omitted", () => {
    expect(getModerationNotificationDisplay("report_resolved")).toEqual(
      getModerationNotificationDisplay("report_resolved", "fr"),
    );
  });
});
