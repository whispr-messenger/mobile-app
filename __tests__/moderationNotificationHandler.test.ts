import {
  resolveNotificationRoute,
  handleModerationNotification,
  getModerationNotificationDisplay,
} from "../src/services/moderation/notificationHandler";

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
  ])("maps %s to %s with param %s", (type, name, paramKey) => {
    const route = resolveNotificationRoute({ type: type as any, entityId: "id-1" });
    expect(route).toEqual({ name, params: { [paramKey]: "id-1" } });
  });

  it("returns null for unknown notification types", () => {
    const route = resolveNotificationRoute({ type: "unknown" as any, entityId: "x" });
    expect(route).toBeNull();
  });
});

describe("handleModerationNotification", () => {
  it("returns false when moderation_type is missing", () => {
    const navigate = jest.fn();
    const handled = handleModerationNotification({}, navigate);
    expect(handled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("returns false when route is unresolvable", () => {
    const navigate = jest.fn();
    const handled = handleModerationNotification(
      { moderation_type: "unknown_type", entity_id: "x" },
      navigate,
    );
    expect(handled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("navigates and returns true for a known notification", () => {
    const navigate = jest.fn();
    const handled = handleModerationNotification(
      { moderation_type: "report_resolved", entity_id: "r1" },
      navigate,
    );
    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith("ReportDetail", { reportId: "r1" });
  });
});

describe("getModerationNotificationDisplay", () => {
  it("returns French strings for fr lang", () => {
    expect(getModerationNotificationDisplay("report_resolved", "fr").title).toBe(
      "Signalement resolu",
    );
  });

  it("returns English strings for en lang", () => {
    expect(getModerationNotificationDisplay("report_resolved", "en").title).toBe(
      "Report resolved",
    );
  });

  it("defaults to French when lang omitted", () => {
    expect(getModerationNotificationDisplay("sanction_issued").title).toBe(
      "Sanction appliquee",
    );
  });

  it.each([
    "report_resolved",
    "sanction_issued",
    "sanction_lifted",
    "appeal_update",
    "appeal_accepted",
    "appeal_rejected",
    "new_report",
    "new_appeal",
    "report_escalated",
  ] as const)("returns title and body for %s in both langs", (type) => {
    const fr = getModerationNotificationDisplay(type, "fr");
    const en = getModerationNotificationDisplay(type, "en");
    expect(fr.title).toBeTruthy();
    expect(fr.body).toBeTruthy();
    expect(en.title).toBeTruthy();
    expect(en.body).toBeTruthy();
  });
});
