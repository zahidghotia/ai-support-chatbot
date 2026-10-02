import Anthropic from "@anthropic-ai/sdk";

// Pick the model once, here. Prices are per million tokens (input / output):
//   claude-haiku-4-5   $1 / $5     cheapest, fast, good for FAQ-style bots
//   claude-sonnet-5-5  $2 / $10    smarter, caches prompts from 512 tokens
//   claude-opus-5-5    $4 / $20    best quality
export const MODEL: keyof typeof MODEL_OPTIONS = "claude-haiku-4-5";

// Not every model accepts every parameter. Haiku 4.5 rejects `output_config.effort`
// and does not support server-side fallbacks, so we only send those where allowed.
const MODEL_OPTIONS = {
  "claude-haiku-4-5": { effort: false, fallbacks: false },
  "claude-sonnet-5-5": { effort: true, fallbacks: true },
  "claude-opus-5-5": { effort: true, fallbacks: true },
} as const;

// Reads ANTHROPIC_API_KEY from the environment (loaded from .env by node --env-file).
// Some API keys are created at organization level and must say which workspace
// to bill; set ANTHROPIC_WORKSPACE_ID in .env for those keys.
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
const client = new Anthropic({
  defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
});

/**
 * Builds the system prompt as two blocks:
 *  1. the instructions (small, changes per client)
 *  2. the knowledge base (large, identical on every request) with cache_control,
 *     so after the first request it is served from the prompt cache at ~10% cost.
 */
export function buildSystemPrompt(
  businessName: string,
  knowledgeBase: string,
): Anthropic.Beta.BetaTextBlockParam[] {
  const instructions = `You are the virtual assistant for ${businessName}.

Your job is to answer customer questions using ONLY the information in the knowledge base documents provided below.

Rules:
- Answer in the same language AND script the customer writes in. English -> English. Urdu script -> Urdu script. Roman Urdu (Urdu written in Latin letters, e.g. "clinic kab khulta hai") -> Roman Urdu in Latin letters only. Never mix Urdu script words into a Roman Urdu or English reply, not even inside brackets or examples.
- Be warm, concise, and professional. Use short paragraphs or bullet points.
- If the answer is not in the knowledge base, say you don't have that information and offer the phone or WhatsApp number so a staff member can help. Never invent prices, hours, names, or policies.
- Do not give medical diagnoses. For symptoms, suggest booking a consultation and mention the emergency line if it sounds urgent.
- When a customer wants to book, collect: full name, phone number, preferred day and time, and the service they need. Then confirm the details back to them and say the clinic will confirm by WhatsApp.`;

  return [
    { type: "text", text: instructions },
    {
      type: "text",
      text: `<knowledge_base>\n${knowledgeBase}\n</knowledge_base>`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * Sends the conversation to Claude and streams the reply.
 * `onText` is called with each chunk of text as it arrives.
 * Returns the full message so the caller can append it to the history.
 */
export async function ask(
  system: Anthropic.Beta.BetaTextBlockParam[],
  history: Anthropic.Beta.BetaMessageParam[],
  onText: (chunk: string) => void,
): Promise<Anthropic.Beta.BetaMessage> {
  const options = MODEL_OPTIONS[MODEL];

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system,
    messages: history,
    // Chat replies don't need deep reasoning; "low" keeps latency and cost down.
    ...(options.effort && { output_config: { effort: "low" } }),
    // If a safety classifier declines a request, the API re-runs it on a
    // fallback model inside the same call instead of returning nothing.
    ...(options.fallbacks && {
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    }),
  });

  stream.on("text", onText);

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    const why = message.stop_details?.explanation ?? "no explanation";
    onText(`\n[Request declined: ${why}]`);
  } else if (message.stop_reason === "max_tokens") {
    onText("\n[Reply was cut off: increase max_tokens]");
  }

  return message;
}
