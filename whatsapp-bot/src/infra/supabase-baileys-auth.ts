import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap
} from '@whiskeysockets/baileys';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AuthRow {
  auth_key: string;
  value: unknown;
}

function serialize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function deserialize<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;
}

export async function useSupabaseAuthState(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  let writeChain = Promise.resolve();

  const runSerialized = async <T>(operation: () => Promise<T>): Promise<T> => {
    const run = writeChain.then(operation, operation);
    writeChain = run.then(() => undefined, () => undefined);
    return run;
  };

  const readData = async <T>(key: string): Promise<T | null> => {
    const { data, error } = await supabase
      .from('whatsapp_baileys_auth')
      .select('auth_key,value')
      .eq('session_id', sessionId)
      .eq('auth_key', key)
      .maybeSingle<AuthRow>();
    if (error) throw new Error(`Falha ao ler autenticação do WhatsApp: ${error.message}`);
    return data ? deserialize<T>(data.value) : null;
  };

  const creds: AuthenticationCreds = await readData<AuthenticationCreds>('creds') ?? initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const authKeys = ids.map((id) => `${type}:${id}`);
        const { data, error } = await supabase
          .from('whatsapp_baileys_auth')
          .select('auth_key,value')
          .eq('session_id', sessionId)
          .in('auth_key', authKeys);
        if (error) throw new Error(`Falha ao ler chaves do WhatsApp: ${error.message}`);

        const byKey = new Map((data as AuthRow[] | null)?.map((row) => [row.auth_key, row.value]) ?? []);
        const result: { [id: string]: SignalDataTypeMap[typeof type] } = {};

        for (const id of ids) {
          const stored = byKey.get(`${type}:${id}`);
          let value = stored === undefined ? null : deserialize<SignalDataTypeMap[typeof type]>(stored);
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(
              value as unknown as Record<string, unknown>
            ) as unknown as SignalDataTypeMap[typeof type];
          }
          result[id] = value!;
        }
        return result;
      },
      set: async (data) => runSerialized(async () => {
        const upserts: Array<{
          session_id: string;
          auth_key: string;
          value: unknown;
          updated_at: string;
        }> = [];
        const removals: string[] = [];
        const now = new Date().toISOString();

        for (const category of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
          const categoryValues = data[category];
          if (!categoryValues) continue;

          for (const id of Object.keys(categoryValues)) {
            const value = categoryValues[id];
            const authKey = `${category}:${id}`;
            if (value == null) {
              removals.push(authKey);
            } else {
              upserts.push({
                session_id: sessionId,
                auth_key: authKey,
                value: serialize(value),
                updated_at: now
              });
            }
          }
        }

        if (upserts.length) {
          const { error } = await supabase
            .from('whatsapp_baileys_auth')
            .upsert(upserts, { onConflict: 'session_id,auth_key' });
          if (error) throw new Error(`Falha ao salvar chaves do WhatsApp: ${error.message}`);
        }
        if (removals.length) {
          const { error } = await supabase
            .from('whatsapp_baileys_auth')
            .delete()
            .eq('session_id', sessionId)
            .in('auth_key', removals);
          if (error) throw new Error(`Falha ao remover chaves do WhatsApp: ${error.message}`);
        }
      })
    }
  };

  const saveCreds = async (): Promise<void> => runSerialized(async () => {
    const { error } = await supabase
      .from('whatsapp_baileys_auth')
      .upsert({
        session_id: sessionId,
        auth_key: 'creds',
        value: serialize(creds),
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id,auth_key' });
    if (error) throw new Error(`Falha ao salvar credenciais do WhatsApp: ${error.message}`);
  });

  return { state, saveCreds };
}
