import type { FreightReport } from '../domain/freight-report.js';

export type ConversationState = 'idle' | 'menu' | 'awaiting_report' | 'awaiting_confirmation';

export interface BotSession {
  phoneNumber: string;
  state: ConversationState;
  pendingReport: FreightReport | null;
  pendingSourceMessageId: string | null;
}

export interface IncomingMessage {
  messageId: string;
  phoneNumber: string;
  replyJid: string;
  text: string;
}

export interface FreightRepository {
  claimMessage(messageId: string, phoneNumber: string): Promise<boolean>;
  releaseMessage(messageId: string): Promise<void>;
  getSession(phoneNumber: string): Promise<BotSession>;
  saveSession(session: BotSession): Promise<void>;
  saveReport(phoneNumber: string, sourceMessageId: string, report: FreightReport): Promise<void>;
  getLastReport(phoneNumber: string): Promise<FreightReport | null>;
}

export interface BotMessenger {
  sendWhatsAppMessage(jid: string, text: string): Promise<void>;
}
