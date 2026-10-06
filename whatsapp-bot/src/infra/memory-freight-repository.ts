import type { BotSession, FreightRepository } from '../application/contracts.js';
import type { FreightReport } from '../domain/freight-report.js';
import type { DailyFreightReport } from './groq-extractor.js';

function defaultSession(phoneNumber: string): BotSession {
  return { phoneNumber, state: 'idle', pendingReport: null, pendingSourceMessageId: null };
}

export class MemoryFreightRepository implements FreightRepository {
  private readonly claimed = new Set<string>();
  private readonly sessions = new Map<string, BotSession>();
  private readonly reports = new Map<string, FreightReport[]>();
  extras = new Map<string, DailyFreightReport['data_viagem'] | DailyFreightReport>();

  constructor(
    private readonly truckplanApiUrl: string,
    private readonly botSecret: string,
    private readonly extrasByMessage = new Map<string, Pick<DailyFreightReport, 'data_viagem' | 'motorista' | 'caminhao' | 'receita_frete'>>()
  ) {}

  rememberExtras(
    messageId: string,
    extras: Pick<DailyFreightReport, 'data_viagem' | 'motorista' | 'caminhao' | 'receita_frete'>
  ): void {
    this.extrasByMessage.set(messageId, extras);
  }

  async claimMessage(messageId: string, _phoneNumber: string): Promise<boolean> {
    if (this.claimed.has(messageId)) return false;
    this.claimed.add(messageId);
    return true;
  }

  async releaseMessage(messageId: string): Promise<void> {
    this.claimed.delete(messageId);
  }

  async getSession(phoneNumber: string): Promise<BotSession> {
    return this.sessions.get(phoneNumber) ?? defaultSession(phoneNumber);
  }

  async saveSession(session: BotSession): Promise<void> {
    this.sessions.set(session.phoneNumber, session);
  }

  async saveReport(phoneNumber: string, sourceMessageId: string, report: FreightReport): Promise<void> {
    const extras = this.extrasByMessage.get(sourceMessageId);
    const list = this.reports.get(phoneNumber) ?? [];
    list.unshift(report);
    this.reports.set(phoneNumber, list);

    const body = {
      data_viagem: extras?.data_viagem,
      partida: report.cidade_origem,
      chegada: report.cidade_destino,
      diarias: report.diarias,
      litros_gasolina: report.litros_oleo,
      gasto_gasolina: report.valor_oleo,
      receita_frete: extras?.receita_frete ?? 0,
      custo_adicional: report.custo_adicional,
      motorista: extras?.motorista ?? 'WhatsApp',
      caminhao: extras?.caminhao ?? 'WhatsApp'
    };

    const response = await fetch(`${this.truckplanApiUrl}/webhooks/baileys/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Truckplan-Bot-Secret': this.botSecret
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Falha ao gravar no TruckPlan (${response.status}): ${detail}`);
    }
  }

  async getLastReport(phoneNumber: string): Promise<FreightReport | null> {
    return this.reports.get(phoneNumber)?.[0] ?? null;
  }
}
