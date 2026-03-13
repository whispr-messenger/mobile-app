export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

type EventCallback = (data: any) => void;

type Channel = {
  join: (params?: Record<string, any>) => Promise<{ status: string }>;
  on: (event: string, callback: EventCallback) => void;
  push: (event: string, payload: Record<string, any>) => void;
  leave: () => void;
};

export class SocketConnection {
  private socket: WebSocket | null = null;
  private channels: Record<
    string,
    {
      callbacks: Record<string, EventCallback[]>;
      joined: boolean;
    }
  > = {};
  private pendingTopics: Set<string> = new Set();

  // Reconnection state
  private _connectionState: ConnectionState = 'disconnected';
  private _onConnectionStateChange: ((state: ConnectionState) => void) | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectDelay = 30000; // 30s cap
  private baseReconnectDelay = 1000; // 1s base
  private shouldReconnect = false;
  private lastUserId: string | null = null;
  private lastToken: string | null = null;

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  set onConnectionStateChange(cb: ((state: ConnectionState) => void) | null) {
    this._onConnectionStateChange = cb;
  }

  private setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    this._onConnectionStateChange?.(state);
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  connect(userId: string, token: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.lastUserId = userId;
    this.lastToken = token;
    this.shouldReconnect = true;

    const host = 'localhost';
    const port = 4010;
    const url = `ws://${host}:${port}/socket/websocket?user_id=${encodeURIComponent(
      userId,
    )}&token=${encodeURIComponent(token)}`;

    this.setConnectionState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      // Reset reconnect counter on successful connection
      this.reconnectAttempt = 0;
      this.setConnectionState('connected');

      this.pendingTopics.forEach((topic) => {
        const joinMsg = {
          topic,
          event: 'phx_join',
          payload: {},
          ref: Date.now().toString(),
        };

        socket.send(JSON.stringify(joinMsg));

        const channel = this.channels[topic];
        if (channel) {
          channel.joined = true;
        }
      });

      this.pendingTopics.clear();

      // Rejoin all existing channels after reconnect
      Object.keys(this.channels).forEach((topic) => {
        const channel = this.channels[topic];
        if (channel && !channel.joined) {
          const joinMsg = {
            topic,
            event: 'phx_join',
            payload: {},
            ref: Date.now().toString(),
          };
          socket.send(JSON.stringify(joinMsg));
        }
      });
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.topic && msg.event === 'phx_reply' && msg.payload?.status === 'ok') {
          const channel = this.channels[msg.topic];
          if (channel) {
            channel.joined = true;
          }
        }

        if (msg.topic && msg.event && msg.event !== 'phx_reply') {
          const channel = this.channels[msg.topic];
          const cbs = channel?.callbacks[msg.event] || [];
          cbs.forEach((cb) => cb(msg.payload));
        }
      } catch {
        // ignore invalid messages
      }
    };

    this.socket.onclose = () => {
      // Mark all channels as not joined so they rejoin on reconnect
      Object.values(this.channels).forEach((ch) => {
        ch.joined = false;
      });

      if (this.shouldReconnect) {
        this.setConnectionState('reconnecting');
        this.scheduleReconnect();
      } else {
        this.setConnectionState('disconnected');
      }
    };

    this.socket.onerror = () => {
      // onclose will fire after onerror, reconnect handled there
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (!this.shouldReconnect || !this.lastUserId || !this.lastToken) {
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    );

    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect && this.lastUserId && this.lastToken) {
        // Clear the old socket ref so connect() doesn't bail out
        this.socket = null;
        this.connect(this.lastUserId, this.lastToken);
      }
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.channels = {};
      this.pendingTopics.clear();
    }

    this.reconnectAttempt = 0;
    this.setConnectionState('disconnected');
  }

  channel(topic: string): Channel {
    if (!this.channels[topic]) {
      this.channels[topic] = {
        callbacks: {},
        joined: false,
      };
    }

    const join = async (): Promise<{ status: string }> => {
      if (!this.socket) {
        this.pendingTopics.add(topic);
        return { status: 'error' };
      }

      if (this.socket.readyState !== WebSocket.OPEN) {
        this.pendingTopics.add(topic);
        return { status: 'error' };
      }

      const joinMsg = {
        topic,
        event: 'phx_join',
        payload: {},
        ref: Date.now().toString(),
      };

      this.socket.send(JSON.stringify(joinMsg));

      return { status: 'ok' };
    };

    const on = (event: string, callback: EventCallback): void => {
      const channel = this.channels[topic];
      if (!channel.callbacks[event]) {
        channel.callbacks[event] = [];
      }
      channel.callbacks[event].push(callback);
    };

    const push = (event: string, payload: Record<string, any>): void => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const msg = {
        topic,
        event,
        payload,
        ref: Date.now().toString(),
      };

      this.socket.send(JSON.stringify(msg));
    };

    const leave = (): void => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const msg = {
        topic,
        event: 'phx_leave',
        payload: {},
        ref: Date.now().toString(),
      };

      this.socket.send(JSON.stringify(msg));
      delete this.channels[topic];
      this.pendingTopics.delete(topic);
    };

    return {
      join,
      on,
      push,
      leave,
    };
  }
}

export const createSocket = (): SocketConnection => {
  return new SocketConnection();
};
