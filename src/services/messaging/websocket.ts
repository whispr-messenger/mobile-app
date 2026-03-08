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

  isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  connect(userId: string, token: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = 'localhost';
    const port = 4000;
    const url = `ws://${host}:${port}/socket/websocket?user_id=${encodeURIComponent(
      userId,
    )}&token=${encodeURIComponent(token)}`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

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
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.channels = {};
      this.pendingTopics.clear();
    }
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
