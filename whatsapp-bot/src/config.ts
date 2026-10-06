export interface BotConfig {
  groqApiKey: string;
  groqModel: string;
  authorizedNumber: string | null;
  whatsappSessionId: string;
  responseDelayMs: number;
  logLevel: string;
  truckplanApiUrl: string;
  truckplanBotSecret: string;
  authDir: string;
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
  const groqApiKey = requireEnvironment('GROQ_API_KEY');
  const authorizedRaw = process.env.WHATSAPP_AUTHORIZED_NUMBER?.trim() || '';
  const authorizedNumber = authorizedRaw ? normalizePhoneNumber(authorizedRaw) : null;
  if (authorizedNumber && !/^\d{10,15}$/.test(authorizedNumber)) {
    throw new Error('WHATSAPP_AUTHORIZED_NUMBER deve conter DDI + DDD + número, somente dígitos.');
  }

  const parsedDelay = Number(process.env.BOT_RESPONSE_DELAY_MS ?? '1500');
  if (!Number.isInteger(parsedDelay) || parsedDelay < 500 || parsedDelay > 60000) {
    throw new Error('BOT_RESPONSE_DELAY_MS deve ser um inteiro entre 500 e 60000.');
  }

  return {
    groqApiKey,
    groqModel: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    authorizedNumber,
    whatsappSessionId: process.env.WHATSAPP_SESSION_ID?.trim() || 'truckplan-posto',
    responseDelayMs: parsedDelay,
    logLevel: process.env.LOG_LEVEL?.trim() || 'info',
    truckplanApiUrl: (process.env.TRUCKPLAN_API_URL || 'https://truckplan.vercel.app').replace(/\/$/, ''),
    truckplanBotSecret: requireEnvironment('TRUCKPLAN_BOT_SECRET'),
    authDir: process.env.WHATSAPP_AUTH_DIR?.trim() || './auth_info'
  };
}
