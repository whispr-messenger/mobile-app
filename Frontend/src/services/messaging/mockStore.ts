/**
 * Mock Store - In-memory state management for mock data
 * Simulates backend state for development without backend
 */

import { Message, MessageReaction } from '../../types/messaging';

interface MockStoreData {
  messages: Record<string, Message[]>; // conversationId -> messages
  reactions: Record<string, MessageReaction[]>; // messageId -> reactions
  pinnedMessages: Record<string, string[]>; // conversationId -> messageIds
}

class MockStore {
  private store: MockStoreData = {
    messages: {},
    reactions: {},
    pinnedMessages: {},
  };

  // Messages
  getMessages(conversationId: string): Message[] {
    return this.store.messages[conversationId] || [];
  }

  setMessages(conversationId: string, messages: Message[]): void {
    this.store.messages[conversationId] = messages;
  }

  addMessage(conversationId: string, message: Message): void {
    if (!this.store.messages[conversationId]) {
      this.store.messages[conversationId] = [];
    }
    this.store.messages[conversationId].push(message);
  }

  updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): void {
    const messages = this.store.messages[conversationId] || [];
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      messages[index] = { ...messages[index], ...updates };
    }
  }

  deleteMessage(conversationId: string, messageId: string, deleteForEveryone: boolean): void {
    const messages = this.store.messages[conversationId] || [];
    if (deleteForEveryone) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages[index] = {
          ...messages[index],
          is_deleted: true,
          delete_for_everyone: true,
          content: '[Message supprimé]',
        };
      }
    } else {
      // Soft delete - remove from this conversation's view
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages.splice(index, 1);
      }
    }
  }

  // Reactions
  getReactions(messageId: string): MessageReaction[] {
    return this.store.reactions[messageId] || [];
  }

  addReaction(messageId: string, userId: string, reaction: string): void {
    if (!this.store.reactions[messageId]) {
      this.store.reactions[messageId] = [];
    }
    
    // Check if user already reacted with this emoji
    const existingIndex = this.store.reactions[messageId].findIndex(
      r => r.user_id === userId && r.reaction === reaction
    );

    if (existingIndex !== -1) {
      // Remove reaction (toggle off)
      this.store.reactions[messageId].splice(existingIndex, 1);
    } else {
      // Add reaction
      const newReaction: MessageReaction = {
        id: `reaction-${Date.now()}-${Math.random()}`,
        message_id: messageId,
        user_id: userId,
        reaction,
        created_at: new Date().toISOString(),
      };
      this.store.reactions[messageId].push(newReaction);
    }
  }

  removeReaction(messageId: string, userId: string, reaction: string): void {
    const reactions = this.store.reactions[messageId] || [];
    const index = reactions.findIndex(
      r => r.user_id === userId && r.reaction === reaction
    );
    if (index !== -1) {
      reactions.splice(index, 1);
    }
  }

  getReactionSummary(messageId: string): Record<string, number> {
    const reactions = this.store.reactions[messageId] || [];
    const summary: Record<string, number> = {};
    
    reactions.forEach(reaction => {
      summary[reaction.reaction] = (summary[reaction.reaction] || 0) + 1;
    });
    
    return summary;
  }

  // Pinned messages
  getPinnedMessages(conversationId: string): string[] {
    return this.store.pinnedMessages[conversationId] || [];
  }

  pinMessage(conversationId: string, messageId: string): void {
    if (!this.store.pinnedMessages[conversationId]) {
      this.store.pinnedMessages[conversationId] = [];
    }
    if (!this.store.pinnedMessages[conversationId].includes(messageId)) {
      this.store.pinnedMessages[conversationId].push(messageId);
    }
  }

  unpinMessage(conversationId: string, messageId: string): void {
    const pinned = this.store.pinnedMessages[conversationId] || [];
    const index = pinned.indexOf(messageId);
    if (index !== -1) {
      pinned.splice(index, 1);
    }
  }

  isPinned(conversationId: string, messageId: string): boolean {
    return this.store.pinnedMessages[conversationId]?.includes(messageId) || false;
  }

  // Clear all data (for testing)
  clear(): void {
    this.store = {
      messages: {},
      reactions: {},
      pinnedMessages: {},
    };
  }
}

export const mockStore = new MockStore();

