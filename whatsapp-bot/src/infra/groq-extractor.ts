import { parseFreightReport, type FreightParseResult, type FreightReport } from '../domain/freight-report.js';

const SYSTEM_PROMPT = `Você extrai dados de relatórios de viagem de caminhão em português.
Responda SOMENTE um JSON válido, sem markdown.
Campos: data_viagem (YYYY-MM-DD), partida, chegada, diarias, litros_oleo, valor_oleo,
receita_frete, motorista, caminhao, custo_adicional, missing (array de campos faltando).
Obrigatórios: partida, chegada, diarias, litros_oleo, valor_oleo, motorista, caminhao.
Não invente números que a pessoa não disse. Hoje é {hoje}.`;

export interface DailyFreightReport extends FreightReport {
  data_viagem: string;
  motorista: string;
  caminhao: string;
  receita_frete: number;
}

export async function extractReportWithGroq(
  apiKey: string,
  model: string,
  text: string,
  todayIso: string
): Promise<FreightParseResult & { extras?: Pick<DailyFreightReport, 'data_viagem' | 'motorista' | 'caminhao' | 'receita_frete'> }> {
  const labeled = parseFreightReport(text);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.replace('{hoje}', todayIso) },
        { role: 'user', content: text }
      ]
    })
  });

  if (!response.ok) {
    if (labeled.success) return labeled;
    return {
      success: false,
      errors: [{ kind: 'format', message: `Groq HTTP ${response.status}` }]
    };
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return labeled.success ? labeled : { success: false, errors: [{ kind: 'format', message: 'Groq não retornou JSON.' }] };
  }

  const data = JSON.parse(match[0]) as Record<string, unknown>;
  const missing = Array.isArray(data.missing) ? data.missing.map(String) : [];
  const cidade_origem = String(data.partida || data.cidade_origem || '').trim();
  const cidade_destino = String(data.chegada || data.cidade_destino || '').trim();
  const motorista = String(data.motorista || '').trim();
  const caminhao = String(data.caminhao || '').trim();
  const diarias = Number(data.diarias);
  const litros_oleo = Number(data.litros_oleo ?? data.litros_gasolina);
  const valor_oleo = Number(data.valor_oleo ?? data.gasto_gasolina);
  const custo_adicional = Number(data.custo_adicional ?? 0);
  const receita_frete = Number(data.receita_frete ?? 0);
  const data_viagem = String(data.data_viagem || todayIso);

  for (const [field, value] of Object.entries({ partida: cidade_origem, chegada: cidade_destino, motorista, caminhao })) {
    if (!value && !missing.includes(field)) missing.push(field);
  }
  if (!Number.isFinite(diarias) && !missing.includes('diarias')) missing.push('diarias');
  if (!Number.isFinite(litros_oleo) && !missing.includes('litros_oleo')) missing.push('litros_oleo');
  if (!Number.isFinite(valor_oleo) && !missing.includes('valor_oleo')) missing.push('valor_oleo');

  if (missing.length) {
    return {
      success: false,
      errors: missing.map((field) => ({ field: field as never, kind: 'missing' as const, message: `${field} não foi informado.` }))
    };
  }

  return {
    success: true,
    data: {
      cidade_origem,
      cidade_destino,
      diarias,
      litros_oleo,
      valor_oleo,
      custo_adicional: Number.isFinite(custo_adicional) ? custo_adicional : 0
    },
    extras: {
      data_viagem,
      motorista,
      caminhao,
      receita_frete: Number.isFinite(receita_frete) ? receita_frete : 0
    }
  };
}
