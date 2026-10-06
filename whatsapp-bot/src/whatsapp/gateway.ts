import makeWASocket, {
  Browsers,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  useMultiFileAuthState,
  type WAMessage,
  type WAMessageKey,
  type WASocket
} from '@whiskeysockets/baileys';
import type { Logger } from 'pino';
import qrcode from 'qrcode-terminal';
import type { IncomingMessage } from '../application/contracts.js';

type ExtendedMessageKey = WAMessageKey & {
  remoteJidAlt?: string;
  participantAlt?: string;
};

function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid?.endsWith('@s.whatsapp.net')) return null;
  const phone = jid.slice(0, jid.indexOf(':') >= 0 ? jid.indexOf(':') : jid.indexOf('@')).replace(/\D/g, '');
  return phone || null;
}

function extractText(message: WAMessage): string | null {
  const content = normalizeMessageContent(message.message);
  const text = content?.conversation
    ?? content?.extendedTextMessage?.text
    ?? content?.imageMessage?.caption
    ?? content?.videoMessage?.caption;
  return text?.trim() || null;
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as { output?: { statusCode?: number } }).output?.statusCode;
}

export class WhatsAppGateway {
  private socket: WASocket | null = null;
  private generation = 0;
  private stopping = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private inboundChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly authDir: string,
    private readonly authorizedNumber: string | null,
    private readonly logger: Logger,
    private readonly onAuthorizedMessage: (message: IncomingMessage) => Promise<void>
  ) {}

  getSocket(): WASocket {
    if (!this.socket) throw new Error('WhatsApp ainda não está conectado.');
    return this.socket;
  }

  async start(): Promise<void> {
    this.stopping = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.generation += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.end(new Error('Encerramento solicitado'));
    this.socket = null;
    await this.inboundChain.catch(() => undefined);
  }

  private async connect(): Promise<void> {
    const currentGeneration = ++this.generation;
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.logger)
      },
      browser: Browsers.ubuntu('Chrome'),
      logger: this.logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      generateHighQualityLinkPreview: false
    });
    this.socket = socket;

    socket.ev.on('creds.update', () => {
      void saveCreds().catch((error) => {
        this.logger.error({ err: error }, 'Falha ao persistir credenciais do WhatsApp');
      });
    });

    socket.ev.on('connection.update', (update) => {
      if (currentGeneration !== this.generation) return;

      if (update.qr) {
        this.logger.info('Escaneie o QR em WhatsApp > Dispositivos conectados > Conectar dispositivo');
        qrcode.generate(update.qr, { small: true });
      }

      if (update.connection === 'open') {
        this.logger.info({ user: socket.user?.id }, 'WhatsApp conectado');
        return;
      }

      if (update.connection !== 'close' || this.stopping) return;

      const statusCode = getStatusCode(update.lastDisconnect?.error);
      if (statusCode === DisconnectReason.loggedOut) {
        this.logger.error('WhatsApp desconectado. Apague a pasta auth_info e escaneie o QR de novo.');
        return;
      }

      const waitMs = statusCode === DisconnectReason.restartRequired ? 500 : 5000;
      this.logger.warn({ statusCode, waitMs }, 'Conexão fechada; nova tentativa agendada');
      this.reconnectTimer = setTimeout(() => {
        if (this.stopping || currentGeneration !== this.generation) return;
        void this.connect().catch((error) => {
          this.logger.error({ err: error }, 'Falha ao reconectar WhatsApp');
        });
      }, waitMs);
    });

    socket.ev.on('messages.upsert', (event) => {
      if (event.type !== 'notify') return;

      for (const message of event.messages) {
        this.inboundChain = this.inboundChain
          .catch(() => undefined)
          .then(() => this.processMessage(message));
      }
    });
  }

  private async processMessage(message: WAMessage): Promise<void> {
    if (!message.message || message.key.fromMe || !message.key.id) return;

    const key = message.key as ExtendedMessageKey;
    const remoteJid = key.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@newsletter')) {
      return;
    }

    const candidateNumbers = [
      key.remoteJid,
      key.remoteJidAlt,
      key.participant,
      key.participantAlt
    ].map(phoneFromJid).filter((phone): phone is string => Boolean(phone));

    const phone = candidateNumbers[0];
    if (!phone) return;
    if (this.authorizedNumber && !candidateNumbers.includes(this.authorizedNumber)) return;

    const text = extractText(message);
    if (!text) return;

    await this.onAuthorizedMessage({
      messageId: message.key.id,
      phoneNumber: phone,
      replyJid: remoteJid,
      text
    });
  }
}
