import 'dotenv/config';
import pino from 'pino';
import { FreightBot } from './application/freight-bot.js';
import { loadConfig } from './config.js';
import { createServerSupabaseClient } from './infra/supabase-client.js';
import { SupabaseFreightRepository } from './infra/supabase-freight-repository.js';
import { WhatsAppGateway } from './whatsapp/gateway.js';
import { QueuedWhatsAppMessenger, WhatsAppMessageQueue } from './whatsapp/message-queue.js';

const config = loadConfig();
const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ['supabaseSecretKey', 'req.headers.authorization', '*.authorization'],
    censor: '[SEGREDO]'
  }
});

const supabase = createServerSupabaseClient(config.supabaseUrl, config.supabaseSecretKey);
const repository = new SupabaseFreightRepository(supabase);
const responseQueue = new WhatsAppMessageQueue(config.responseDelayMs);

let bot: FreightBot;
const gateway = new WhatsAppGateway(
  supabase,
  config.whatsappSessionId,
  config.authorizedNumber,
  logger.child({ component: 'baileys' }),
  async (message) => bot.handleIncoming(message)
);

const messenger = new QueuedWhatsAppMessenger(responseQueue, () => gateway.getSocket());
bot = new FreightBot(
  config.authorizedNumber,
  repository,
  messenger,
  logger.child({ component: 'freight-bot' })
);

let shutdownStarted = false;
async function shutdown(signal: string): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;
  logger.info({ signal }, 'Encerrando bot');

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  await gateway.stop().catch((error) => logger.error({ err: error }, 'Erro durante encerramento'));
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Exceção não tratada');
  void shutdown('uncaughtException');
});
process.on('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'Promise rejeitada sem tratamento');
  void shutdown('unhandledRejection');
});

await gateway.start();
logger.info('Bot TruckPlan iniciado. Aguardando conexão do WhatsApp.');
