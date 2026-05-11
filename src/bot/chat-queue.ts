export class ChatQueue {
  private readonly queues = new Map<number, Promise<unknown>>();

  run<T>(chatId: number, work: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(chatId) ?? Promise.resolve();
    const next = prev.then(work, work);
    const settled: Promise<void> = next.then(
      () => undefined,
      () => undefined,
    ).finally(() => {
      if (this.queues.get(chatId) === settled) this.queues.delete(chatId);
    });
    this.queues.set(chatId, settled);
    return next;
  }
}
