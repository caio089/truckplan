import type { Logger } from 'pino';
import type { BotMessenger, BotSession, FreightRepository, IncomingMessage } from './contracts.js';
import { parseFreightReport } from '../domain/freight-report.js';
import { extractReportWithGroq } from '../infra/groq-extractor.js';
import type { MemoryFreightRepository } from '../infra/memory-freight-repository.js';
import {
  CANCEL_MESSAGE,
  EXIT_MESSAGE,
  MENU_MESSAGE,
  NEW_REPORT_MESSAGE,
  confirmationMessage,
  lastReportMessage,
  successMessage,
  validationMessage
} from '../domain/messages.js';

function normalizeCommand(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function clearedSession(phoneNumber: string, state: BotSession['state'] = 'idle'): BotSession {
  return {
    phoneNumber,
    state,
    pendingReport: null,
    pendingSourceMessageId: null
  };
}

export class FreightBot {
  constructor(
    private readonly authorizedNumber: string | null,
    private readonly repository: FreightRepository,
    private readonly messenger: BotMessenger,
    private readonly logger: Logger,
    private readonly groqApiKey: string,
    private readonly groqModel: string
  ) {}

  async handleIncoming(message: IncomingMessage): Promise<void> {
    if (this.authorizedNumber && message.phoneNumber !== this.authorizedNumber) return;

    const claimed = await this.repository.claimMessage(message.messageId, message.phoneNumber);
    if (!claimed) return;

    try {
      await this.processClaimedMessage(message);
    } catch (error) {
      await this.repository.releaseMessage(message.messageId).catch(() => undefined);
      this.logger.error({ err: error, messageId: message.messageId }, 'Falha ao processar mensagem autorizada');
      throw error;
    }
  }

  private async processClaimedMessage(message: IncomingMessage): Promise<void> {
    const command = normalizeCommand(message.text);
    let session = await this.repository.getSession(message.phoneNumber);

    if (command === 'menu' || command === 'frete') {
      session = clearedSession(message.phoneNumber, 'menu');
      await this.repository.saveSession(session);
      await this.messenger.sendWhatsAppMessage(message.replyJid, MENU_MESSAGE);
      return;
    }

    if (command === 'cancelar') {
      await this.repository.saveSession(clearedSession(message.phoneNumber));
      await this.messenger.sendWhatsAppMessage(message.replyJid, CANCEL_MESSAGE);
      return;
    }

    switch (session.state) {
      case 'menu':
        await this.handleMenu(message, command);
        return;
      case 'awaiting_report':
        await this.handleReport(message, command);
        return;
      case 'awaiting_confirmation':
        await this.handleConfirmation(message, command, session);
        return;
      case 'idle':
      default:
        return;
    }
  }

  private async handleMenu(message: IncomingMessage, command: string): Promise<void> {
    if (command === '1') {
      await this.repository.saveSession({
        ...clearedSession(message.phoneNumber),
        state: 'awaiting_report'
      });
      await this.messenger.sendWhatsAppMessage(message.replyJid, NEW_REPORT_MESSAGE);
      return;
    }

    if (command === '2') {
      const lastReport = await this.repository.getLastReport(message.phoneNumber);
      const reply = lastReport
        ? lastReportMessage(lastReport)
        : '📭 Nenhum relatório cadastrado ainda.\n\nDigite "menu" para voltar.';
      await this.messenger.sendWhatsAppMessage(message.replyJid, reply);
      return;
    }

    if (command === '0' || command === 'sair') {
      await this.repository.saveSession(clearedSession(message.phoneNumber));
      await this.messenger.sendWhatsAppMessage(message.replyJid, EXIT_MESSAGE);
      return;
    }

    await this.messenger.sendWhatsAppMessage(message.replyJid, `Opção inválida.\n\n${MENU_MESSAGE}`);
  }

  private async handleReport(message: IncomingMessage, command: string): Promise<void> {
    if (command === '0' || command === '2') {
      await this.repository.saveSession(clearedSession(message.phoneNumber));
      await this.messenger.sendWhatsAppMessage(message.replyJid, CANCEL_MESSAGE);
      return;
    }

    const groqResult = this.groqApiKey.startsWith('gsk_')
      ? await extractReportWithGroq(
          this.groqApiKey,
          this.groqModel,
          message.text,
          new Date().toISOString().slice(0, 10)
        )
      : parseFreightReport(message.text);
    const result = groqResult.success ? groqResult : parseFreightReport(message.text);
    if (!result.success) {
      await this.messenger.sendWhatsAppMessage(message.replyJid, validationMessage(result.errors));
      return;
    }

    if ('rememberExtras' in this.repository && 'extras' in groqResult && groqResult.extras) {
      (this.repository as MemoryFreightRepository).rememberExtras(message.messageId, groqResult.extras);
    }

    await this.repository.saveSession({
      phoneNumber: message.phoneNumber,
      state: 'awaiting_confirmation',
      pendingReport: result.data,
      pendingSourceMessageId: message.messageId
    });
    await this.messenger.sendWhatsAppMessage(message.replyJid, confirmationMessage(result.data));
  }

  private async handleConfirmation(
    message: IncomingMessage,
    command: string,
    session: BotSession
  ): Promise<void> {
    if (command === '2' || command === '0') {
      await this.repository.saveSession(clearedSession(message.phoneNumber));
      await this.messenger.sendWhatsAppMessage(message.replyJid, CANCEL_MESSAGE);
      return;
    }

    if (command !== '1') {
      await this.messenger.sendWhatsAppMessage(
        message.replyJid,
        'Responda apenas:\n\n1️⃣ Confirmar\n2️⃣ Cancelar'
      );
      return;
    }

    if (!session.pendingReport || !session.pendingSourceMessageId) {
      await this.repository.saveSession(clearedSession(message.phoneNumber));
      await this.messenger.sendWhatsAppMessage(
        message.replyJid,
        '⚠️ O relatório pendente não foi encontrado. Digite "menu" e envie novamente.'
      );
      return;
    }

    await this.repository.saveReport(
      message.phoneNumber,
      session.pendingSourceMessageId,
      session.pendingReport
    );
    await this.repository.saveSession(clearedSession(message.phoneNumber));
    await this.messenger.sendWhatsAppMessage(message.replyJid, successMessage(session.pendingReport));
  }
}
