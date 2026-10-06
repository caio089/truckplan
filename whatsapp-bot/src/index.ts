import 'dotenv/config';
import pino from 'pino';
import { FreightBot } from './application/freight-bot.js';
import { loadConfig } from './config.js';
import { MemoryFreightRepository } from './infra/memory-freight-repository.js';
import { publishSession } from './infra/truckplan-session.js';
import { WhatsAppGateway } from './whatsapp/gateway.js';
import { QueuedWhatsAppMessenger, WhatsAppMessageQueue } from './whatsapp/message-queue.js';

const config = loadConfig();
const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ['groqApiKey', 'truckplanBotSecret', 'req.headers.authorization', '*.authorization'],
    censor: '[SEGREDO]'
  }
});

const repository = new MemoryFreightRepository(config.truckplanApiUrl, config.truckplanBotSecret);
const responseQueue = new WhatsAppMessageQueue(config.responseDelayMs);

let bot: FreightBot;
const gateway = new WhatsAppGateway(
  config.authDir,
  config.authorizedNumber,
  logger.child({ component: 'baileys' }),
  async (message) => bot.handleIncoming(message),
  async (event) => {
    await publishSession(config.truckplanApiUrl, config.truckplanBotSecret, event);
  }
);

const messenger = new QueuedWhatsAppMessenger(responseQueue, () => gateway.getSocket());
bot = new FreightBot(
  config.authorizedNumber,
  repository,
  messenger,
  logger.child({ component: 'freight-bot' }),
  config.groqApiKey,
  config.groqModel
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
logger.info('Bot TruckPlan + Groq iniciado. Escaneie o QR se aparecer.');
