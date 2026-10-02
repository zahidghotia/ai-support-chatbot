import express from "express";
import crypto from "node:crypto";
import { loadKnowledgeBase } from "./knowledge.ts";
import { ask, buildSystemPrompt, MODEL } from "./chat.ts";
import { getSession, hasSession } from "./sessions.ts";
import { whatsappEnabled, whatsappRouter } from "./whatsapp.ts";
import { twilioEnabled, twilioRouter } from "./twilio.ts";

const BUSINESS_NAME = process.env.BUSINESS_NAME ?? "Al-Shifa Dental Clinic";
const PORT = Number(process.env.PORT ?? 3000);
const MAX_MESSAGE_CHARS = 2000;

const system = buildSystemPrompt(BUSINESS_NAME, loadKnowledgeBase("data"));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio posts form data
app.use(express.static("public"));

// Allow the widget to be embedded on other websites.
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, business: BUSINESS_NAME });
});

// POST /api/chat  { sessionId?: string, message: string }
// Streams the reply as plain text chunks. The session id comes back in a header.
app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "message is required" });
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `message must be under ${MAX_MESSAGE_CHARS} characters` });
  }

  const sessionId =
    typeof req.body?.sessionId === "string" && hasSession(req.body.sessionId)
      ? req.body.sessionId
      : crypto.randomUUID();
  const session = getSession(sessionId);
  session.history.push({ role: "user", content: message });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("X-Session-Id", sessionId);
  res.setHeader("Access-Control-Expose-Headers", "X-Session-Id");
  res.flushHeaders();

  try {
    const reply = await ask(system, session.history, (chunk) => res.write(chunk));
    session.history.push({ role: "assistant", content: reply.content });
  } catch (err) {
    session.history.pop(); // keep user/assistant turns alternating
    console.error("chat error:", err instanceof Error ? err.message : err);
    res.write("\n[Sorry, something went wrong. Please try again.]");
  } finally {
    res.end();
  }
});

if (whatsappEnabled) {
  app.use("/webhooks/whatsapp", whatsappRouter(system));
}
if (twilioEnabled) {
  app.use("/webhooks/twilio", twilioRouter(system));
}

app.listen(PORT, () => {
  console.log(`${BUSINESS_NAME} assistant (${MODEL})`);
  console.log(`Demo page:  http://localhost:${PORT}`);
  console.log(`Chat API:   POST http://localhost:${PORT}/api/chat`);
  console.log(
    whatsappEnabled
      ? `WhatsApp:   Meta webhook at /webhooks/whatsapp`
      : `WhatsApp:   Meta off (set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN)`,
  );
  console.log(
    twilioEnabled
      ? `WhatsApp:   Twilio webhook at /webhooks/twilio`
      : `WhatsApp:   Twilio off (set TWILIO_AUTH_TOKEN)`,
  );
});
