import type Anthropic from "@anthropic-ai/sdk";

/**
 * In-memory conversation store shared by the web widget and WhatsApp.
 * Key: a session id (web) or a phone number (WhatsApp).
 *
 * Restarting the server forgets every conversation. For production, back
 * this with Redis or a database table keyed the same way.
 */
export type Session = { history: Anthropic.Beta.BetaMessageParam[]; lastSeen: number };

const SESSION_TTL_MS = 30 * 60 * 1000; // forget a conversation after 30 min idle
const sessions = new Map<string, Session>();

export function getSession(key: string): Session {
  const session = sessions.get(key) ?? { history: [], lastSeen: Date.now() };
  session.lastSeen = Date.now();
  sessions.set(key, session);
  return session;
}

export function hasSession(key: string): boolean {
  return sessions.has(key);
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [key, s] of sessions) if (s.lastSeen < cutoff) sessions.delete(key);
}, 60_000).unref();
