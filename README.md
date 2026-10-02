# Business Knowledge Assistant

A customer-support chatbot that answers questions from a business's own documents, built with the Claude API in TypeScript.

Drop your business's FAQs, price lists, and policies into the `data/` folder as Markdown or text files. The assistant answers only from those documents, replies in the customer's language (English, Urdu, Roman Urdu), collects booking details, and never invents prices or hours.

The included demo knowledge base is a fictional dental clinic in Karachi.

## How it works

1. `src/knowledge.ts` loads every `.md` / `.txt` file in `data/` and wraps each one in a `<document>` tag.
2. `src/chat.ts` builds a two-part system prompt: short instructions plus the full knowledge base. The knowledge base block has `cache_control` set, so after the first request it is served from the prompt cache at roughly a tenth of the cost.
3. `src/index.ts` runs a terminal chat loop. Every reply is streamed, and the full conversation history is sent on each request because the API is stateless.

## Setup

Requirements: Node.js 22.6 or newer (the project runs TypeScript directly, no build step).

```bash
npm install
cp .env.example .env   # then paste your key
npm start
```

`.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
# Only needed if your key is organization-level rather than workspace-scoped:
# ANTHROPIC_WORKSPACE_ID=wrkspc_...
```

Run with `DEBUG=1 npm start` to print token usage after each reply, including how many input tokens were served from the cache.

## Adapting it to a client

- Replace the files in `data/` with the client's documents.
- Change `BUSINESS_NAME` in `src/index.ts`.
- Edit the instructions in `buildSystemPrompt` in `src/chat.ts` for the client's tone and booking flow.
- The default model is `claude-haiku-4-5` (cheapest). Change `MODEL` in `src/chat.ts` to `claude-sonnet-5-5` or `claude-opus-5-5` for higher answer quality; the code adjusts the request parameters per model.

## Roadmap

- [ ] Embeddings + vector search for knowledge bases larger than ~100 pages
- [ ] WhatsApp integration (Twilio or Meta Cloud API)
- [ ] Web chat widget
- [ ] Booking tool that writes appointments to Google Calendar
