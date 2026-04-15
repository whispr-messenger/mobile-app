import { getWsBaseUrl } from "../apiBase";
import { TokenService } from "../TokenService";
import { AuthService } from "../AuthService";
import { logger } from "../../utils/logger";

type EventCallback = (data: any) => void;

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type Channel = {
  join: (params?: Record<string, any>) => Promise<{ status: string }>;
  on: (event: string, callback: EventCallback) => void;
  off: (event: string, callback: EventCallback) => void;
  push: (event: string, payload: Record<string, any>) => void;
  leave: () => void;
};

/**
 * Phoenix protocol message (normalised from v1 object or v2 array).
 */
interface PhxMessage {
  join_ref: string | null;
  ref: string | null;
  topic: string;
  event: string;
  payload: any;
}

/**
 * Parse an incoming WebSocket frame into a normalised PhxMessage.
 * Supports both Phoenix v2 (array) and v1 (object) formats.
 */
function parseMessage(raw: string): PhxMessage | null {
  const data = JSON.parse(raw);

  // v2 format: [join_ref, ref, topic, event, payload]
  if (Array.isArray(data) && data.length >= 5) {
    return {
      join_ref: data[0] ?? null,
      ref: data[1] ?? null,
      topic: data[2],
      event: data[3],
      payload: data[4],
    };
  }

  // v1 format: { topic, event, payload, ref }
  if (data && typeof data === "object" && data.topic && data.event) {
    return {
      join_ref: data.join_ref ?? null,
      ref: data.ref ?? null,
      topic: data.topic,
      event: data.event,
      payload: data.payload,
    };
  }

  return null;
}

/** Monotonically increasing ref counter for Phoenix protocol */
let refCounter = 0;
function nextRef(): string {
  refCounter += 1;
  return String(refCounter);
}

/**
 * Encode a message in Phoenix v2 array format.
 */
function encodeMessage(
  join_ref: string | null,
  ref: string | null,
  topic: string,
  event: string,
  payload: any,
): string {
  return JSON.stringify([join_ref, ref, topic, event, payload]);
}

/**
 * Convert a camelCase string to snake_case.
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert all keys in an object/array from camelCase to snake_case.
 * The backend sends camelCase keys over WebSocket but our types use snake_case.
 */
function snakecaseKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakecaseKeys);
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        toSnakeCase(key),
        snakecaseKeys(value),
      ]),
    );
  }
  return obj;
}

export class SocketConnection {
  private socket: WebSocket | null = null;
  private channels: Record<
    string,
    {
      callbacks: Record<string, EventCallback[]>;
      joined: boolean;
      joinRef: string | null; // tracks the join_ref for this channel
    }
  > = {};
  private pendingTopics: Set<string> = new Set();

  // Reconnection state
  private _connectionState: ConnectionState = "disconnected";
  private connectionStateListeners: Set<(state: ConnectionState) => void> =
    new Set();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectDelay = 30000;
  private baseReconnectDelay = 1000;
  private maxReconnectAttempts = 20;
  private shouldReconnect = false;
  private lastUserId: string | null = null;
  private lastToken: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 30000;

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  addConnectionStateListener(cb: (state: ConnectionState) => void): () => void {
    this.connectionStateListeners.add(cb);
    return () => {
      this.connectionStateListeners.delete(cb);
    };
  }

  private setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    this.connectionStateListeners.forEach((cb) => cb(state));
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  connect(userId: string, token: string): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.lastUserId = userId;
    this.lastToken = token;
    this.shouldReconnect = true;

    // Explicitly request v2 serializer so both sides agree on array format
    const url = `${getWsBaseUrl()}/messaging/socket/websocket?user_id=${encodeURIComponent(
      userId,
    )}&token=${encodeURIComponent(token)}&vsn=2.0.0`;

    this.setConnectionState(
      this.reconnectAttempt > 0 ? "reconnecting" : "connecting",
    );
    this.socket = new WebSocket(url);
    console.log("[WS] Connecting to", url.replace(/token=[^&]+/, "token=***"));
    logger.info(
      "WS",
      `Connecting to ${url.replace(/token=[^&]+/, "token=***")}`,
    );

    this.socket.onopen = () => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      console.log("[WS] Connected");
      logger.info("WS", "Connected");
      this.reconnectAttempt = 0;
      this.setConnectionState("connected");
      this.startHeartbeat();

      // Join pending topics
      this.pendingTopics.forEach((topic) => {
        this.sendJoin(socket, topic);
      });
      this.pendingTopics.clear();

      // Rejoin existing channels after reconnect
      Object.keys(this.channels).forEach((topic) => {
        const ch = this.channels[topic];
        if (ch && !ch.joined) {
          this.sendJoin(socket, topic);
        }
      });
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = parseMessage(event.data);
        if (!msg) {
          logger.warn(
            "WS",
            "Unparseable frame",
            event.data?.substring?.(0, 200),
          );
          return;
        }

        // Handle join reply
        if (msg.event === "phx_reply") {
          const ch = this.channels[msg.topic];
          logger.debug("WS", `phx_reply ${msg.topic} ${msg.payload?.status}`);
          if (ch && msg.payload?.status === "ok") {
            ch.joined = true;
          }
          // Don't dispatch phx_reply to user callbacks
          return;
        }

        // Handle phx_error (channel crashed server-side)
        if (msg.event === "phx_error") {
          const ch = this.channels[msg.topic];
          if (ch) {
            ch.joined = false;
          }
          return;
        }

        // Handle phx_close
        if (msg.event === "phx_close") {
          const ch = this.channels[msg.topic];
          if (ch) {
            ch.joined = false;
          }
          return;
        }

        // Dispatch to user callbacks (normalise keys to snake_case)
        if (msg.topic && msg.event) {
          const ch = this.channels[msg.topic];
          const cbs = ch?.callbacks[msg.event] || [];
          const normalised = snakecaseKeys(msg.payload);
          logger.debug(
            "WS",
            `Event ${msg.topic} ${msg.event} callbacks=${cbs.length}`,
          );
          cbs.forEach((cb) => {
            try {
              cb(normalised);
            } catch {
              /* isolate bad callbacks */
            }
          });
        }
      } catch {
        // ignore unparseable frames
      }
    };

    this.socket.onclose = (ev) => {
      console.log("[WS] Closed, code:", ev.code, "reason:", ev.reason);
      logger.info("WS", `Closed code=${ev.code} reason=${ev.reason}`);
      this.stopHeartbeat();
      Object.values(this.channels).forEach((ch) => {
        ch.joined = false;
        ch.joinRef = null;
      });
      if (this.shouldReconnect) {
        this.setConnectionState("reconnecting");
        this.scheduleReconnect();
      } else {
        this.setConnectionState("disconnected");
      }
    };

    this.socket.onerror = (err) => {
      console.error("[WS] Error:", err);
      logger.error("WS", "Socket error", err);
    };
  }

  /** Send a phx_join for a topic using v2 array format */
  private sendJoin(socket: WebSocket, topic: string): void {
    const ref = nextRef();
    const joinRef = ref;
    const ch = this.channels[topic];
    if (ch) ch.joinRef = joinRef;
    const payload = encodeMessage(joinRef, ref, topic, "phx_join", {});
    console.log("[WS] Joining", topic, "ref:", ref);
    logger.debug("WS", `Joining ${topic} ref=${ref}`);
    socket.send(payload);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const ref = nextRef();
        this.socket.send(encodeMessage(null, ref, "phoenix", "heartbeat", {}));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.shouldReconnect || !this.lastUserId || !this.lastToken) return;

    // Stop reconnecting after max attempts (~10 minutes with exponential backoff)
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.warn("[WS] Max reconnect attempts reached, giving up");
      logger.warn("WS", "Max reconnect attempts reached, giving up");
      this.shouldReconnect = false;
      this.setConnectionState("disconnected");
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    );
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(async () => {
      if (!this.shouldReconnect || !this.lastUserId || !this.lastToken) return;

      // If the token is expired, try to refresh it before reconnecting
      if (TokenService.isTokenExpired(this.lastToken)) {
        try {
          logger.info(
            "WS",
            "Token expired, attempting refresh before reconnect",
          );
          await AuthService.refreshTokens();
          const newToken = await TokenService.getAccessToken();
          if (newToken) {
            this.lastToken = newToken;
          } else {
            logger.warn(
              "WS",
              "Token refresh returned null, stopping reconnect",
            );
            this.shouldReconnect = false;
            this.setConnectionState("disconnected");
            return;
          }
        } catch (err) {
          console.warn("[WS] Token refresh failed, stopping reconnect", err);
          logger.warn("WS", "Token refresh failed, stopping reconnect", err);
          this.shouldReconnect = false;
          this.setConnectionState("disconnected");
          return;
        }
      }

      this.socket = null;
      this.connect(this.lastUserId!, this.lastToken!);
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.channels = {};
      this.pendingTopics.clear();
    }
    this.reconnectAttempt = 0;
    this.setConnectionState("disconnected");
  }

  channel(topic: string): Channel {
    if (!this.channels[topic]) {
      this.channels[topic] = {
        callbacks: {},
        joined: false,
        joinRef: null,
      };
    }

    const join = async (): Promise<{ status: string }> => {
      const ch = this.channels[topic];
      if (ch?.joined) return { status: "ok" };

      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.pendingTopics.add(topic);
        return { status: "pending" };
      }

      this.sendJoin(this.socket, topic);
      return { status: "ok" };
    };

    const on = (event: string, callback: EventCallback): void => {
      const ch = this.channels[topic];
      if (!ch) return;
      if (!ch.callbacks[event]) ch.callbacks[event] = [];
      ch.callbacks[event].push(callback);
    };

    const off = (event: string, callback: EventCallback): void => {
      const ch = this.channels[topic];
      if (!ch?.callbacks[event]) return;
      ch.callbacks[event] = ch.callbacks[event].filter((cb) => cb !== callback);
    };

    const push = (event: string, payload: Record<string, any>): void => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      const ch = this.channels[topic];
      const ref = nextRef();
      this.socket.send(
        encodeMessage(ch?.joinRef ?? null, ref, topic, event, payload),
      );
    };

    const leave = (): void => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const ch = this.channels[topic];
        const ref = nextRef();
        this.socket.send(
          encodeMessage(ch?.joinRef ?? null, ref, topic, "phx_leave", {}),
        );
      }
      delete this.channels[topic];
      this.pendingTopics.delete(topic);
    };

    return { join, on, off, push, leave };
  }
}

// Singleton
let sharedSocket: SocketConnection | null = null;

export const getSharedSocket = (): SocketConnection => {
  if (!sharedSocket) sharedSocket = new SocketConnection();
  return sharedSocket;
};

export const destroySharedSocket = (): void => {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
};

/** @deprecated Use getSharedSocket() instead */
export const createSocket = (): SocketConnection => {
  return new SocketConnection();
};
