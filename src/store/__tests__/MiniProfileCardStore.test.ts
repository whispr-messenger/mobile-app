import { useMiniProfileCardStore } from "./src/store/miniProfileCardStore";

beforeEach(() => {
  useMiniProfileCardStore.getState().close();
});

describe("miniProfileCardStore singleton", () => {
  it("starts closed", () => {
    const s = useMiniProfileCardStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.userId).toBeNull();
  });

  it("open sets userId and isOpen", () => {
    useMiniProfileCardStore.getState().open("u1", null);
    const s = useMiniProfileCardStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.userId).toBe("u1");
  });

  it("openning B over A switches to B (singleton)", () => {
    useMiniProfileCardStore.getState().open("uA", null);
    useMiniProfileCardStore.getState().open("uB", null);
    const s = useMiniProfileCardStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.userId).toBe("uB");
  });

  it("close clears state", () => {
    useMiniProfileCardStore.getState().open("u1", null);
    useMiniProfileCardStore.getState().close();
    const s = useMiniProfileCardStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.userId).toBeNull();
  });
});
