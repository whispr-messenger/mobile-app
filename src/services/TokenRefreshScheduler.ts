import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from "react-native";
import { AuthService } from "./AuthService";
import { TokenService } from "./TokenService";

// Lead time (seconds) before JWT `exp` at which we fire a proactive refresh.
// Must be strictly greater than the 60s buffer used by TokenService.isTokenExpired
// so the timer fires before any request starts rejecting the token locally.
const REFRESH_LEAD_TIME_SECONDS = 120;

type Timer = ReturnType<typeof setTimeout>;

export class TokenRefreshScheduler {
  private timer: Timer | null = null;
  private appStateSub: NativeEventSubscription | null = null;
  private lastAppState: AppStateStatus = AppState.currentState;
  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.appStateSub = AppState.addEventListener(
      "change",
      this.handleAppStateChange,
    );

    await this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
  }

  // Re-read the access token and (re)schedule the next proactive refresh.
  // Called after login, after each successful refresh, and on app resume.
  async scheduleNext(): Promise<void> {
    if (!this.running) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const token = await TokenService.getAccessToken();
    if (!token) return;

    const delayMs = TokenService.msUntilProactiveRefresh(
      token,
      REFRESH_LEAD_TIME_SECONDS,
    );

    if (delayMs <= 0) {
      // Already inside the refresh window — refresh immediately, then
      // schedule the next tick from the fresh token.
      await this.runRefresh();
      return;
    }

    this.timer = setTimeout(() => {
      void this.runRefresh();
    }, delayMs);
  }

  private async runRefresh(): Promise<void> {
    if (!this.running) return;
    // Skip refresh when app is backgrounded — setTimeout is unreliable there
    // and we'll re-check on resume via the AppState listener.
    if (this.lastAppState !== "active") return;

    try {
      await AuthService.refreshTokens();
    } catch (err) {
      // refreshTokens already handles session-expired emission; swallow here
      // so the scheduler doesn't crash. If the session died, stop() will be
      // called by AuthContext via the sessionExpired event.
      console.warn("[TokenRefreshScheduler] refresh failed", err);
      return;
    }

    await this.scheduleNext();
  }

  private handleAppStateChange = (next: AppStateStatus): void => {
    const prev = this.lastAppState;
    this.lastAppState = next;
    // On foreground resume, the scheduled setTimeout may have been frozen or
    // fired late. Re-evaluate the token and refresh if we're past the window.
    if (prev !== "active" && next === "active") {
      void this.scheduleNext();
    }
  };
}

export const tokenRefreshScheduler = new TokenRefreshScheduler();
