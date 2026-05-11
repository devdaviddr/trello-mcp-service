import type { Message } from "ollama";

const MAX_CHATS = 100;
const MAX_HISTORY = 40;

export class HistoryStore {
  private readonly chats = new Map<number, Message[]>();

  get(chatId: number): Message[] {
    return this.chats.get(chatId) ?? [];
  }

  set(chatId: number, messages: Message[]): void {
    const trimmed = trimAtUserBoundary(messages, MAX_HISTORY);
    // delete-then-set bumps insertion order so this chat becomes "most recent" — Map iteration is insertion-ordered.
    if (this.chats.has(chatId)) this.chats.delete(chatId);
    this.chats.set(chatId, trimmed);
    while (this.chats.size > MAX_CHATS) {
      const oldest = this.chats.keys().next().value;
      if (oldest === undefined) break;
      this.chats.delete(oldest);
    }
  }

  clear(chatId: number): void {
    this.chats.delete(chatId);
  }
}

function trimAtUserBoundary(messages: Message[], max: number): Message[] {
  if (messages.length <= max) return messages;
  let cut = messages.length - max;
  while (cut < messages.length && messages[cut].role !== "user") cut++;
  return messages.slice(cut);
}
