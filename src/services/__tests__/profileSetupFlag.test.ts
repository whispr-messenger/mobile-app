import AsyncStorage from "@react-native-async-storage/async-storage";
import { profileSetupFlag } from "./src/services/profileSetupFlag";

describe("profileSetupFlag", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns null when not set", async () => {
    expect(await profileSetupFlag.get()).toBeNull();
  });

  it('markPending stores "0"', async () => {
    await profileSetupFlag.markPending();
    expect(await profileSetupFlag.get()).toBe("0");
  });

  it('markDone stores "1"', async () => {
    await profileSetupFlag.markDone();
    expect(await profileSetupFlag.get()).toBe("1");
  });

  it("clear removes the flag", async () => {
    await profileSetupFlag.markDone();
    await profileSetupFlag.clear();
    expect(await profileSetupFlag.get()).toBeNull();
  });

  it("returns null for unexpected values", async () => {
    await AsyncStorage.setItem("@whispr/profile_setup_done", "garbage");
    expect(await profileSetupFlag.get()).toBeNull();
  });
});
