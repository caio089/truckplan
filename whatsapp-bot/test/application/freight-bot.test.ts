import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Logger } from 'pino';
import type {
  BotMessenger,
  BotSession,
  FreightRepository,
  IncomingMessage
} from '../../src/application/contracts.js';
import { FreightBot } from '../../src/application/freight-bot.js';
import type { FreightReport } from '../../src/domain/freight-report.js';

const authorized = '5586999999999';

class MemoryRepository implements FreightRepository {
  readonly processed = new Set<string>();
  readonly sessions = new Map<string, BotSession>();
  readonly reports: Array<FreightReport & { phoneNumber: string; sourceMessageId: string }> = [];

  async claimMessage(messageId: string): Promise<boolean> {
    if (this.processed.has(messageId)) return false;
    this.processed.add(messageId);
    return true;
  }

  async releaseMessage(messageId: string): Promise<void> {
    this.processed.delete(messageId);
  }

  async getSession(phoneNumber: string): Promise<BotSession> {
    return this.sessions.get(phoneNumber) ?? {
      phoneNumber,
      state: 'idle',
      pendingReport: null,
      pendingSourceMessageId: null
    };
  }

  async saveSession(session: BotSession): Promise<void> {
    this.sessions.set(session.phoneNumber, structuredClone(session));
  }

  async saveReport(phoneNumber: string, sourceMessageId: string, report: FreightReport): Promise<void> {
    if (this.reports.some((item) => item.sourceMessageId === sourceMessageId)) return;
    this.reports.push({ ...structuredClone(report), phoneNumber, sourceMessageId });
  }

  async getLastReport(phoneNumber: string): Promise<FreightReport | null> {
    const report = this.reports.findLast((item) => item.phoneNumber === phoneNumber);
    return report ? structuredClone(report) : null;
  }
}

class MemoryMessenger implements BotMessenger {
  readonly messages: Array<{ jid: string; text: string }> = [];

  async sendWhatsAppMessage(jid: string, text: string): Promise<void> {
    this.messages.push({ jid, text });
  }
}

function incoming(messageId: string, text: string, phoneNumber = authorized): IncomingMessage {
  return {
    messageId,
    phoneNumber,
    replyJid: `${phoneNumber}@s.whatsapp.net`,
    text
  };
}

describe('FreightBot', () => {
  let repository: MemoryRepository;
  let messenger: MemoryMessenger;
  let bot: FreightBot;

  beforeEach(() => {
    repository = new MemoryRepository();
    messenger = new MemoryMessenger();
    const logger = { error: () => undefined } as unknown as Logger;
    bot = new FreightBot(authorized, repository, messenger, logger);
  });

  it('ignora completamente qualquer número não autorizado', async () => {
    await bot.handleIncoming(incoming('unauthorized', 'menu', '5511999999999'));
    assert.equal(messenger.messages.length, 0);
    assert.equal(repository.processed.size, 0);
  });

  it('executa o fluxo curto e só salva depois da confirmação', async () => {
    await bot.handleIncoming(incoming('m1', 'frete'));
    await bot.handleIncoming(incoming('m2', '1'));
    await bot.handleIncoming(incoming('m3', `Origem: Teresina
Chegada: Fortaleza
Diárias: 2
Litros de óleo: 180
Valor do óleo: 1080
Custo adicional: 85`));

    assert.equal(repository.reports.length, 0);
    assert.equal(repository.sessions.get(authorized)?.state, 'awaiting_confirmation');
    assert.match(messenger.messages.at(-1)!.text, /CONFIRME O RELATÓRIO/);

    await bot.handleIncoming(incoming('m4', '1'));
    assert.equal(repository.reports.length, 1);
    assert.equal(repository.sessions.get(authorized)?.state, 'idle');
    assert.equal(repository.sessions.get(authorized)?.pendingReport, null);
    assert.match(messenger.messages.at(-1)!.text, /CADASTRADO COM SUCESSO/);
  });

  it('não processa novamente o mesmo messageId', async () => {
    await bot.handleIncoming(incoming('same-id', 'menu'));
    await bot.handleIncoming(incoming('same-id', 'menu'));
    assert.equal(messenger.messages.length, 1);
  });

  it('mantém a sessão e não salva quando falta um campo', async () => {
    await bot.handleIncoming(incoming('a1', 'menu'));
    await bot.handleIncoming(incoming('a2', '1'));
    await bot.handleIncoming(incoming('a3', `Origem: A
Chegada: B
Diárias: 1
Litros de óleo: 10
Valor do óleo: 50`));

    assert.equal(repository.reports.length, 0);
    assert.equal(repository.sessions.get(authorized)?.state, 'awaiting_report');
    assert.match(messenger.messages.at(-1)!.text, /Custo adicional/);
  });

  it('cancela e limpa os dados temporários', async () => {
    await bot.handleIncoming(incoming('c1', 'menu'));
    await bot.handleIncoming(incoming('c2', '1'));
    await bot.handleIncoming(incoming('c3', `Origem: A
Chegada: B
Diárias: 1
Litros de óleo: 10
Valor do óleo: 50
Custo adicional: 0`));
    await bot.handleIncoming(incoming('c4', '2'));

    assert.equal(repository.reports.length, 0);
    assert.equal(repository.sessions.get(authorized)?.state, 'idle');
    assert.equal(repository.sessions.get(authorized)?.pendingReport, null);
    assert.match(messenger.messages.at(-1)!.text, /cancelado/);
  });
});
