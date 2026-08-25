export interface BotConfig {
  supabaseUrl: string;
  supabaseSecretKey: string;
  authorizedNumber: string;
  whatsappSessionId: string;
  responseDelayMs: number;
  logLevel: string;
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

export function loadConfig(): BotConfig {
  const supabaseUrl = requireEnvironment('SUPABASE_URL');
  const supabaseSecretKey = (
    process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  if (!supabaseSecretKey) {
    throw new Error('Configure SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL não é uma URL válida.');
  }
  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw new Error('SUPABASE_URL deve usar http ou https.');
  }

  const authorizedNumber = normalizePhoneNumber(requireEnvironment('WHATSAPP_AUTHORIZED_NUMBER'));
  if (!/^\d{10,15}$/.test(authorizedNumber)) {
    throw new Error('WHATSAPP_AUTHORIZED_NUMBER deve conter DDI + DDD + número, somente dígitos.');
  }

  const parsedDelay = Number(process.env.BOT_RESPONSE_DELAY_MS ?? '5000');
  if (!Number.isInteger(parsedDelay) || parsedDelay < 1000 || parsedDelay > 60000) {
    throw new Error('BOT_RESPONSE_DELAY_MS deve ser um inteiro entre 1000 e 60000.');
  }

  return {
    supabaseUrl,
    supabaseSecretKey,
    authorizedNumber,
    whatsappSessionId: process.env.WHATSAPP_SESSION_ID?.trim() || 'truckplan-posto',
    responseDelayMs: parsedDelay,
    logLevel: process.env.LOG_LEVEL?.trim() || 'info'
  };
}
