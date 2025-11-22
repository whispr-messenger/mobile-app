/**
 * WebSocket Service - Mock Phoenix Channels
 * Based on backend WebSocket specifications
 * Channels: user:{userId} and conversation:{conversationId}
 */

import { Message } from '../../types/messaging';

type EventCallback = (data: any) => void;

class MockPhoenixSocket {
  private channels: Map<string, MockChannel> = new Map();
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private connected: boolean = false;
  private userId?: string;

  connect(userId: string, token: string): void {
    this.userId = userId;
    this.connected = true;
    
    // Simulate connection delay
    setTimeout(() => {
      this.emit('connected', { user_id: userId });
    }, 200);
  }

  disconnect(): void {
    this.connected = false;
    this.channels.clear();
    this.eventListeners.clear();
  }

  channel(topic: string): MockChannel {
    if (!this.channels.has(topic)) {
      this.channels.set(topic, new MockChannel(topic, this));
    }
    return this.channels.get(topic)!;
  }

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  emit(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class MockChannel {
  constructor(
    private topic: string,
    private socket: MockPhoenixSocket
  ) {}

  join(params?: Record<string, any>): Promise<{ status: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ status: 'ok' });
      }, 100);
    });
  }

  on(event: string, callback: EventCallback): void {
    // Store channel-specific listeners
    const key = `${this.topic}:${event}`;
    this.socket.on(key, callback);
  }

  push(event: string, payload: Record<string, any>): void {
    // Simulate server response
    if (event === 'new_message') {
      setTimeout(() => {
        // Mock successful response
        this.socket.emit(`${this.topic}:phx_reply`, {
          status: 'ok',
          response: {
            message: {
              id: `msg-${Date.now()}`,
              conversation_id: payload.conversation_id,
              sender_id: this.socket['userId'],
              content: payload.content,
              message_type: payload.message_type,
              sent_at: new Date().toISOString(),
            },
          },
        });
      }, 200);
    }
  }

  leave(): void {
    // Cleanup
  }
}

export const createMockSocket = (): MockPhoenixSocket => {
  return new MockPhoenixSocket();
};

export type MockSocket = MockPhoenixSocket;

