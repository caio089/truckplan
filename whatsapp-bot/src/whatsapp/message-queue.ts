import { delay, type WASocket } from '@whiskeysockets/baileys';
import type { BotMessenger } from '../application/contracts.js';

export class WhatsAppMessageQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly responseDelayMs: number) {}

  enqueue(send: () => Promise<void>): Promise<void> {
    const task = this.tail
      .catch(() => undefined)
      .then(() => delay(this.responseDelayMs))
      .then(send);

    this.tail = task.catch(() => undefined);
    return task;
  }
}

export function sendWhatsAppMessage(
  queue: WhatsAppMessageQueue,
  socket: WASocket,
  jid: string,
  text: string
): Promise<void> {
  return queue.enqueue(async () => {
    await socket.sendMessage(jid, { text });
  });
}

export class QueuedWhatsAppMessenger implements BotMessenger {
  constructor(
    private readonly queue: WhatsAppMessageQueue,
    private readonly getSocket: () => WASocket
  ) {}

  sendWhatsAppMessage(jid: string, text: string): Promise<void> {
    return sendWhatsAppMessage(this.queue, this.getSocket(), jid, text);
  }
}
