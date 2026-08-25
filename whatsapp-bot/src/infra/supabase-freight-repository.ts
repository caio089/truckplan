import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BotSession,
  ConversationState,
  FreightRepository
} from '../application/contracts.js';
import type { FreightReport } from '../domain/freight-report.js';

interface SessionRow {
  phone_number: string;
  state: ConversationState;
  pending_report: FreightReport | null;
  pending_source_message_id: string | null;
}

interface ReportRow extends FreightReport {
  phone_number: string;
  source_message_id: string;
}

function defaultSession(phoneNumber: string): BotSession {
  return {
    phoneNumber,
    state: 'idle',
    pendingReport: null,
    pendingSourceMessageId: null
  };
}

export class SupabaseFreightRepository implements FreightRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async claimMessage(messageId: string, phoneNumber: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('processed_whatsapp_messages')
      .insert({ message_id: messageId, phone_number: phoneNumber });

    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error(`Falha ao registrar idempotência: ${error.message}`);
  }

  async releaseMessage(messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('processed_whatsapp_messages')
      .delete()
      .eq('message_id', messageId);
    if (error) throw new Error(`Falha ao liberar mensagem: ${error.message}`);
  }

  async getSession(phoneNumber: string): Promise<BotSession> {
    const { data, error } = await this.supabase
      .from('whatsapp_bot_sessions')
      .select('phone_number,state,pending_report,pending_source_message_id')
      .eq('phone_number', phoneNumber)
      .maybeSingle<SessionRow>();

    if (error) throw new Error(`Falha ao consultar sessão: ${error.message}`);
    if (!data) return defaultSession(phoneNumber);

    return {
      phoneNumber: data.phone_number,
      state: data.state,
      pendingReport: data.pending_report,
      pendingSourceMessageId: data.pending_source_message_id
    };
  }

  async saveSession(session: BotSession): Promise<void> {
    const row: SessionRow & { updated_at: string } = {
      phone_number: session.phoneNumber,
      state: session.state,
      pending_report: session.pendingReport,
      pending_source_message_id: session.pendingSourceMessageId,
      updated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('whatsapp_bot_sessions')
      .upsert(row, { onConflict: 'phone_number' });
    if (error) throw new Error(`Falha ao salvar sessão: ${error.message}`);
  }

  async saveReport(phoneNumber: string, sourceMessageId: string, report: FreightReport): Promise<void> {
    const row: ReportRow = {
      phone_number: phoneNumber,
      source_message_id: sourceMessageId,
      ...report
    };

    const { error } = await this.supabase.from('freight_reports').insert(row);
    if (!error || error.code === '23505') return;
    throw new Error(`Falha ao salvar relatório: ${error.message}`);
  }

  async getLastReport(phoneNumber: string): Promise<FreightReport | null> {
    const { data, error } = await this.supabase
      .from('freight_reports')
      .select('cidade_origem,cidade_destino,diarias,litros_oleo,valor_oleo,custo_adicional')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<FreightReport>();

    if (error) throw new Error(`Falha ao consultar último relatório: ${error.message}`);
    if (!data) return null;

    return {
      cidade_origem: String(data.cidade_origem),
      cidade_destino: String(data.cidade_destino),
      diarias: Number(data.diarias),
      litros_oleo: Number(data.litros_oleo),
      valor_oleo: Number(data.valor_oleo),
      custo_adicional: Number(data.custo_adicional)
    };
  }
}
