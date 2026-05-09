import {
  getCached,
  setCached,
  clearCache,
  _internalSize,
} from "./src/services/profile/miniProfileCache";
import { UserProfile } from "./src/services/UserService";

const baseProfile = (id: string): UserProfile => ({
  id,
  firstName: "Test",
  lastName: "User",
  username: `u_${id}`,
  phoneNumber: "",
  biography: "",
  isOnline: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  clearCache();
});

describe("miniProfileCache", () => {
  it("returns null on cache miss", () => {
    expect(getCached("u1")).toBeNull();
  });

  it("returns the profile and isStale=false on a fresh hit", () => {
    setCached("u1", baseProfile("u1"));
    const hit = getCached("u1");
    expect(hit).not.toBeNull();
    expect(hit!.profile.id).toBe("u1");
    expect(hit!.isStale).toBe(false);
  });

  it("marks an entry as stale after 5 minutes", () => {
    const realNow = Date.now;
    Date.now = jest.fn(() => 1_000_000_000_000);
    setCached("u1", baseProfile("u1"));
    Date.now = jest.fn(() => 1_000_000_000_000 + 6 * 60 * 1000);
    const hit = getCached("u1");
    expect(hit!.isStale).toBe(true);
    Date.now = realNow;
  });

  it("evicts the least recently used entry past 50 items", () => {
    for (let i = 0; i < 50; i++) setCached(`u${i}`, baseProfile(`u${i}`));
    expect(_internalSize()).toBe(50);
    setCached("u50", baseProfile("u50"));
    expect(_internalSize()).toBe(50);
    // u0 etait le plus ancien et n'a pas ete relu, il doit etre evicte
    expect(getCached("u0")).toBeNull();
    expect(getCached("u50")).not.toBeNull();
  });

  it("refreshes LRU position on read", () => {
    for (let i = 0; i < 50; i++) setCached(`u${i}`, baseProfile(`u${i}`));
    // on accede a u0 pour le re-promouvoir
    getCached("u0");
    // on insere u50 -> c'est u1 qui doit tomber, pas u0
    setCached("u50", baseProfile("u50"));
    expect(getCached("u0")).not.toBeNull();
    expect(getCached("u1")).toBeNull();
  });
});
