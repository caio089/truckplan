export async function publishSession(
  apiUrl: string,
  botSecret: string,
  event: { status: 'qr' | 'connected' | 'disconnected'; qr?: string; jid?: string }
): Promise<void> {
  await fetch(`${apiUrl}/webhooks/baileys/session/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Truckplan-Bot-Secret': botSecret
    },
    body: JSON.stringify(event)
  });
}

export async function fetchPanelConfig(
  apiUrl: string,
  botSecret: string
): Promise<{ groq_api_key?: string; authorized_number?: string }> {
  const response = await fetch(`${apiUrl}/webhooks/baileys/session/`, {
    headers: { 'X-Truckplan-Bot-Secret': botSecret }
  });
  if (!response.ok) return {};
  return await response.json() as { groq_api_key?: string; authorized_number?: string };
}
