import { Router } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { ask } from "./chat.ts";
import { getSession } from "./sessions.ts";
import { toWhatsAppText } from "./format.ts";

/**
 * WhatsApp Cloud API (Meta) integration.
 *
 * Setup (free):
 *  1. developers.facebook.com -> My Apps -> Create App -> Business -> add "WhatsApp".
 *  2. From the WhatsApp > API Setup page copy the temporary access token and the
 *     Phone number ID into .env as WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.
 *  3. Pick any secret word as WHATSAPP_VERIFY_TOKEN in .env.
 *  4. WhatsApp > Configuration -> Webhook: callback URL = https://YOUR-SERVER/webhooks/whatsapp,
 *     verify token = the same secret word. Subscribe to the "messages" field.
 *  5. Add your own number as a test recipient and send it a message.
 */

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const GRAPH_API = "https://graph.facebook.com/v21.0";
const MAX_WA_CHARS = 4000; // WhatsApp rejects text messages over 4096 characters

export const whatsappEnabled = Boolean(TOKEN && PHONE_NUMBER_ID && VERIFY_TOKEN);

// Meta retries a webhook if we are slow to answer, so remember what we've handled.
const seenMessageIds = new Set<string>();

export function whatsappRouter(system: Anthropic.Beta.BetaTextBlockParam[]) {
  const router = Router();

  // Meta calls this once when you save the webhook URL, to prove you own the server.
  router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN && typeof challenge === "string") {
      return res.status(200).send(challenge);
    }
    res.sendStatus(403);
  });

  // Every incoming message (and delivery status update) arrives here.
  router.post("/", (req, res) => {
    // Answer immediately; Meta expects a 200 within a few seconds.
    res.sendStatus(200);

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return; // status updates (sent/delivered/read) have no `messages`

    if (seenMessageIds.has(msg.id)) return;
    seenMessageIds.add(msg.id);
    if (seenMessageIds.size > 5000) seenMessageIds.clear();

    const from: string = msg.from; // customer's phone number, e.g. "923001234567"

    if (msg.type !== "text") {
      void sendText(from, "I can only read text messages for now. Please type your question.");
      return;
    }

    void handleText(system, from, msg.text.body as string);
  });

  return router;
}

async function handleText(
  system: Anthropic.Beta.BetaTextBlockParam[],
  from: string,
  text: string,
) {
  const session = getSession(`wa:${from}`);
  session.history.push({ role: "user", content: text });

  try {
    const reply = await ask(system, session.history, () => {});
    session.history.push({ role: "assistant", content: reply.content });

    const answer = reply.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const formatted = toWhatsAppText(answer);

    for (const part of splitMessage(formatted)) await sendText(from, part);
  } catch (err) {
    session.history.pop();
    console.error("whatsapp chat error:", err instanceof Error ? err.message : err);
    await sendText(from, "Sorry, something went wrong. Please try again in a moment.");
  }
}

async function sendText(to: string, body: string) {
  const res = await fetch(`${GRAPH_API}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!res.ok) {
    console.error(`whatsapp send failed (${res.status}):`, await res.text());
  }
}

// WhatsApp has a 4096-character limit per message; split long replies on paragraph breaks.
function splitMessage(text: string): string[] {
  if (text.length <= MAX_WA_CHARS) return [text];
  const parts: string[] = [];
  let current = "";
  for (const para of text.split("\n\n")) {
    if ((current + "\n\n" + para).length > MAX_WA_CHARS && current) {
      parts.push(current);
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current) parts.push(current);
  return parts;
}
