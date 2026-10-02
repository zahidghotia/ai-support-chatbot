<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=28&duration=3000&pause=1000&color=6C63FF&center=true&vCenter=true&width=700&lines=Business+Knowledge+Assistant;AI+support+chatbot+for+any+business;Answers+only+from+YOUR+documents;English+%7C+Urdu+%7C+Roman+Urdu" alt="Business Knowledge Assistant" />

<br/>

[![Claude API](https://img.shields.io/badge/Claude_API-Haiku_4.5-6C63FF?style=for-the-badge&logo=anthropic&logoColor=white)](https://docs.anthropic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?style=for-the-badge)](LICENSE)

![Streaming](https://img.shields.io/badge/⚡_Streaming-replies-00C853?style=flat-square)
![Prompt Caching](https://img.shields.io/badge/💾_Prompt-caching-FF6F00?style=flat-square)
![No Hallucinations](https://img.shields.io/badge/🛡️_Grounded-no_invented_facts-E91E63?style=flat-square)
![Multilingual](https://img.shields.io/badge/🌍_3-languages-2196F3?style=flat-square)
![Zero Build](https://img.shields.io/badge/🚀_Zero-build_step-9C27B0?style=flat-square)

<br/>

**Drop your FAQs, price list and policies into a folder. Get a support agent that answers customers 24/7, in their own language, and never makes things up.**

</div>

---

## 🎬 Demo

<!-- Replace with a real GIF: record the terminal with `vhs` or QuickTime, save as docs/demo.gif -->
<!-- ![demo](docs/demo.gif) -->

```
You: Friday ko clinic kitne baje khulta hai?
Bot: Friday ko clinic do slots mein khulta hai:

     10:00 AM se 12:30 PM  (Jumma se pehle)
     3:00 PM  se 8:00 PM   (Jumma ke baad)

     Kya aap appointment book karna chahte hain?

You: How much does a root canal cost and does it hurt?
Bot: Root canal treatment is 18,000 to 25,000 PKR per tooth, done over
     2 visits of about 60 minutes each.

     It's done under local anesthesia so you shouldn't feel pain during
     the procedure. Mild soreness for 2 to 3 days afterwards is normal.

You: What's your refund policy?
Bot: I don't have information about a refund policy. Please call
     021-3456-7890 or WhatsApp 0300-1234567 and our staff will help.
```

> The demo knowledge base is a fictional dental clinic in Karachi. Swap the files in `data/` and it becomes your client's assistant.

---

## ✨ Features

| | Feature | What it means for the business |
|---|---|---|
| 🎯 | **Grounded answers** | Replies only from the documents you provide. Unknown question? It gives the phone number instead of guessing. |
| 🌍 | **Language matching** | Customer writes in English, Urdu, or Roman Urdu, bot replies in the same language and script. |
| 📅 | **Booking flow** | Collects name, phone, preferred time and service, then confirms the details back. |
| ⚡ | **Streaming** | Words appear as they are generated, no waiting for the full reply. |
| 💾 | **Prompt caching** | The knowledge base is cached on Anthropic's side, cutting input cost by up to 90% on repeat requests. |
| 🔁 | **Model switch in one line** | Haiku for cost, Sonnet or Opus for quality. The code adapts request parameters per model. |
| 🧪 | **Debug mode** | `DEBUG=1` prints token usage and cache hits after every reply. |

---

## 🏗️ How it works

```mermaid
flowchart LR
    A[📁 data/*.md] -->|loadKnowledgeBase| B[System prompt<br/>instructions + docs]
    B -->|cache_control| C[(Prompt cache)]
    U[👤 Customer] -->|question| H[Conversation history]
    H --> M[Claude API<br/>streaming]
    C --> M
    M -->|text chunks| U
    M -->|full message| H
```

1. **`src/knowledge.ts`** reads every `.md` / `.txt` in `data/` and wraps each in a `<document>` tag.
2. **`src/chat.ts`** builds a two-block system prompt. The large knowledge-base block carries `cache_control`, so it is cached after the first request.
3. **`src/index.ts`** runs the terminal chat loop. The API is stateless, so the full history is sent each turn.
4. **`src/server.ts`** exposes the same assistant over HTTP and serves `public/widget.js`, the embeddable chat bubble.
5. **`src/whatsapp.ts`** (Meta) and **`src/twilio.ts`** handle WhatsApp webhooks. **`src/sessions.ts`** is the conversation store shared by every channel.

---

## 🚀 Quick start

```bash
git clone <this-repo>
cd business-knowledge-assistant
npm install
cp .env.example .env     # paste your Anthropic API key
npm start
```

Requires **Node.js 22.6+**. TypeScript runs natively, there is no build step.

Want to see token usage and cache hits?

```bash
DEBUG=1 npm start
```

### Web widget

```bash
npm run web
```

Open **http://localhost:3000** for a demo landing page with the chat bubble in the corner. The server keeps the API key private, streams replies, and remembers each visitor's conversation for 30 minutes.

To put the widget on any website, add one line before `</body>`:

```html
<script src="https://YOUR-SERVER/widget.js"
        data-api="https://YOUR-SERVER/api/chat"
        data-title="Your Business Name"
        data-color="#6C63FF"></script>
```

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Model and business name, for uptime checks |
| `POST /api/chat` | `{ sessionId?, message }` → streamed text reply, session id in `X-Session-Id` header |
| `GET/POST /webhooks/whatsapp` | Meta WhatsApp Cloud API webhook (mounted when `WHATSAPP_*` env vars are set) |
| `POST /webhooks/twilio` | Twilio WhatsApp webhook, signature-verified (mounted when `TWILIO_AUTH_TOKEN` is set) |

### WhatsApp

The same assistant answers on WhatsApp. Each phone number gets its own conversation memory. Two providers are supported; pick one.

#### Option A: Twilio Sandbox (fastest, no Meta business account)

1. Sign up at [twilio.com](https://www.twilio.com), go to **Messaging → Try it out → Send a WhatsApp message**, and send the shown `join <word>` to the sandbox number from your phone.
2. Copy your **Auth Token** from the console home page into `.env`:
   ```
   TWILIO_AUTH_TOKEN=...
   ```
3. Deploy (or run `ngrok http 3000`), then in **Sandbox settings** set "When a message comes in" to `https://YOUR-SERVER/webhooks/twilio`.
4. Message the sandbox number. Replies are returned as TwiML, so no outbound API calls are needed. Every request's Twilio signature is verified.

#### Option B: Meta WhatsApp Cloud API (production, free tier)

1. Create an app at [developers.facebook.com](https://developers.facebook.com) (type: Business) and add the **WhatsApp** product.
2. From **WhatsApp → API Setup** copy the access token and Phone number ID into `.env`:
   ```
   WHATSAPP_TOKEN=EAAG...
   WHATSAPP_PHONE_NUMBER_ID=1234567890
   WHATSAPP_VERIFY_TOKEN=any-secret-word
   ```
3. Deploy (or expose localhost with `ngrok http 3000`), then in **WhatsApp → Configuration** set the webhook URL to `https://YOUR-SERVER/webhooks/whatsapp` with the same verify token, and subscribe to the `messages` field.
4. Add your phone as a test recipient and message the test number.

Long replies are split at the 4,096-character WhatsApp limit, duplicate webhook deliveries are ignored, and non-text messages get a polite "text only" reply.

---

## 🛠️ Adapt it to a client

| Step | Where |
|---|---|
| Replace the documents | `data/` folder (any `.md` or `.txt`) |
| Change the business name | `BUSINESS_NAME` in `src/index.ts`, or `BUSINESS_NAME=...` in `.env` for the web server |
| Adjust tone and booking rules | `buildSystemPrompt()` in `src/chat.ts` |
| Pick a model | `MODEL` in `src/chat.ts` |

### Model cost guide

| Model | Input / Output (per 1M tokens) | Best for |
|---|---|---|
| `claude-haiku-4-5` | $1 / $5 | FAQ bots, high volume, lowest cost **(default)** |
| `claude-sonnet-5-5` | $2 / $10 | Smarter replies, caches from 512 tokens |
| `claude-opus-5-5` | $4 / $20 | Highest quality |

A typical reply on Haiku costs around **$0.002**. One thousand customer questions is roughly **$2**.

---

## 🗺️ Roadmap

- [x] Terminal chat with streaming and history
- [x] Grounded answers with prompt caching
- [x] English / Urdu / Roman Urdu
- [x] 🌐 Web chat widget (embed on any site)
- [x] 💬 WhatsApp integration (Meta Cloud API or Twilio Sandbox)
- [ ] 🔍 Embeddings + vector search for 100+ page knowledge bases
- [ ] 📆 Booking tool that writes to Google Calendar

---

## 🤝 Want one for your business?

This project is the foundation I use to build custom support assistants for clinics, agencies, shops and service businesses. If you want one trained on your own documents and connected to your website or WhatsApp, open an issue or reach out.

<div align="center">

Built with the [Claude API](https://docs.anthropic.com) · Licensed under [MIT](LICENSE)

</div>
