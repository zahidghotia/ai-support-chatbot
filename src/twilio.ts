import { Router } from "express";
import crypto from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { ask } from "./chat.ts";
import { getSession } from "./sessions.ts";
import { toWhatsAppText } from "./format.ts";

/**
 * Twilio WhatsApp Sandbox integration. Easiest way to get the bot on WhatsApp
 * without a Meta Business account.
 *
 * Setup (free trial):
 *  1. twilio.com -> sign up -> Console -> Messaging -> Try it out -> Send a WhatsApp message.
 *  2. On your phone, send the shown "join <word>" message to the sandbox number.
 *  3. In "Sandbox settings", set "When a message comes in" to
 *     https://YOUR-SERVER/webhooks/twilio  (method POST).
 *  4. In .env set TWILIO_AUTH_TOKEN (Console -> Account Info) so we can verify
 *     that requests really come from Twilio.
 *
 * Twilio sends a form-encoded POST and we reply with TwiML in the same response,
 * so no outbound API call or SDK is needed.
 */

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const MAX_TWIML_CHARS = 1500; // Twilio caps each <Message> at 1600 characters

export const twilioEnabled = Boolean(AUTH_TOKEN);

export function twilioRouter(system: Anthropic.Beta.BetaTextBlockParam[]) {
  const router = Router();

  router.post("/", async (req, res) => {
    if (!isValidTwilioRequest(req)) return res.sendStatus(403);

    const from = typeof req.body?.From === "string" ? req.body.From : ""; // "whatsapp:+923001234567"
    const text = typeof req.body?.Body === "string" ? req.body.Body.trim() : "";
    if (!from || !text) return res.type("text/xml").send("<Response></Response>");

    const session = getSession(`tw:${from}`);
    session.history.push({ role: "user", content: text });

    let answer: string;
    try {
      const reply = await ask(system, session.history, () => {});
      session.history.push({ role: "assistant", content: reply.content });
      answer = reply.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      answer = toWhatsAppText(answer);
    } catch (err) {
      session.history.pop();
      console.error("twilio chat error:", err instanceof Error ? err.message : err);
      answer = "Sorry, something went wrong. Please try again in a moment.";
    }

    const messages = splitMessage(answer)
      .map((part) => `<Message>${escapeXml(part)}</Message>`)
      .join("");
    res.type("text/xml").send(`<Response>${messages}</Response>`);
  });

  return router;
}

/**
 * Twilio signs each request: HMAC-SHA1 over the full URL + sorted POST params,
 * using your auth token. Rejecting unsigned requests stops strangers from
 * running up your Claude bill through this endpoint.
 */
function isValidTwilioRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, string>;
  originalUrl: string;
  protocol: string;
  get(name: string): string | undefined;
}): boolean {
  if (!AUTH_TOKEN) return false;
  const signature = req.headers["x-twilio-signature"];
  if (typeof signature !== "string") return false;

  // Behind Render/Railway/ngrok the original scheme arrives in x-forwarded-proto.
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? req.protocol;
  const url = `${proto}://${req.get("host")}${req.originalUrl}`;

  const params = Object.keys(req.body ?? {})
    .sort()
    .map((k) => k + req.body[k])
    .join("");
  const expected = crypto.createHmac("sha1", AUTH_TOKEN).update(url + params).digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function splitMessage(text: string): string[] {
  if (text.length <= MAX_TWIML_CHARS) return [text];
  const parts: string[] = [];
  let current = "";
  for (const para of text.split("\n\n")) {
    if ((current + "\n\n" + para).length > MAX_TWIML_CHARS && current) {
      parts.push(current);
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
