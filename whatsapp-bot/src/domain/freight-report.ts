export const freightFieldOrder = [
  'cidade_origem',
  'cidade_destino',
  'diarias',
  'litros_oleo',
  'valor_oleo',
  'custo_adicional'
] as const;

export type FreightField = typeof freightFieldOrder[number];

export interface FreightReport {
  cidade_origem: string;
  cidade_destino: string;
  diarias: number;
  litros_oleo: number;
  valor_oleo: number;
  custo_adicional: number;
}

export interface FreightParseError {
  field?: FreightField;
  kind: 'missing' | 'invalid' | 'duplicate' | 'format';
  message: string;
}

export type FreightParseResult =
  | { success: true; data: FreightReport }
  | { success: false; errors: FreightParseError[] };

const fieldLabels: Record<FreightField, string> = {
  cidade_origem: 'Origem',
  cidade_destino: 'Chegada',
  diarias: 'Diárias',
  litros_oleo: 'Litros de óleo',
  valor_oleo: 'Valor do óleo',
  custo_adicional: 'Custo adicional'
};

const fieldAliases: Record<string, FreightField> = {
  origem: 'cidade_origem',
  partida: 'cidade_origem',
  chegada: 'cidade_destino',
  destino: 'cidade_destino',
  diarias: 'diarias',
  'quantidade de diarias': 'diarias',
  'litros de oleo': 'litros_oleo',
  'litros oleo': 'litros_oleo',
  'litros de diesel': 'litros_oleo',
  'litros diesel': 'litros_oleo',
  'valor do oleo': 'valor_oleo',
  'valor de oleo': 'valor_oleo',
  'valor do diesel': 'valor_oleo',
  'valor diesel': 'valor_oleo',
  'custo adicional': 'custo_adicional',
  adicional: 'custo_adicional'
};

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: string, monetary: boolean): number | null {
  let normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/[^0-9,.-]/g, '');

  if (!normalized || normalized.startsWith('-')) return null;
  normalized = normalized.replace(/-/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (monetary && /^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function getFreightFieldLabel(field: FreightField): string {
  return fieldLabels[field];
}

export function parseFreightReport(text: string): FreightParseResult {
  const values = new Map<FreightField, string>();
  const errors: FreightParseError[] = [];

  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator < 1) {
      errors.push({ kind: 'format', message: `Linha sem ":": ${line}` });
      continue;
    }

    const rawLabel = line.slice(0, separator).trim();
    const field = fieldAliases[normalizeLabel(rawLabel)];
    if (!field) continue;

    if (values.has(field)) {
      errors.push({ field, kind: 'duplicate', message: `${fieldLabels[field]} foi informado mais de uma vez.` });
      continue;
    }
    values.set(field, line.slice(separator + 1).trim());
  }

  for (const field of freightFieldOrder) {
    if (!values.has(field) || !values.get(field)?.trim()) {
      errors.push({ field, kind: 'missing', message: `${fieldLabels[field]} não foi informado.` });
    }
  }

  if (errors.some((error) => error.kind === 'missing' || error.kind === 'duplicate')) {
    return { success: false, errors };
  }

  const cidadeOrigem = values.get('cidade_origem')!;
  const cidadeDestino = values.get('cidade_destino')!;
  const diarias = parseNumber(values.get('diarias')!, false);
  const litrosOleo = parseNumber(values.get('litros_oleo')!, false);
  const valorOleo = parseNumber(values.get('valor_oleo')!, true);
  const custoAdicional = parseNumber(values.get('custo_adicional')!, true);

  if (diarias === null || !Number.isInteger(diarias)) {
    errors.push({ field: 'diarias', kind: 'invalid', message: 'Diárias precisa ser um número inteiro maior ou igual a zero.' });
  }
  if (litrosOleo === null) {
    errors.push({ field: 'litros_oleo', kind: 'invalid', message: 'Litros de óleo precisa ser um número maior ou igual a zero.' });
  }
  if (valorOleo === null) {
    errors.push({ field: 'valor_oleo', kind: 'invalid', message: 'Valor do óleo precisa ser um valor monetário maior ou igual a zero.' });
  }
  if (custoAdicional === null) {
    errors.push({ field: 'custo_adicional', kind: 'invalid', message: 'Custo adicional precisa ser um valor monetário maior ou igual a zero.' });
  }

  if (errors.length) return { success: false, errors };

  return {
    success: true,
    data: {
      cidade_origem: cidadeOrigem,
      cidade_destino: cidadeDestino,
      diarias: diarias!,
      litros_oleo: litrosOleo!,
      valor_oleo: valorOleo!,
      custo_adicional: custoAdicional!
    }
  };
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value).replace(/\u00a0/g, ' ');
}

export function formatLiters(value: number): string {
  return numberFormatter.format(value);
}
