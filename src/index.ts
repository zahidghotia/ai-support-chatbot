import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type Anthropic from "@anthropic-ai/sdk";
import { loadKnowledgeBase } from "./knowledge.ts";
import { ask, buildSystemPrompt, MODEL } from "./chat.ts";

const BUSINESS_NAME = "Al-Shifa Dental Clinic";
const DEBUG = process.env.DEBUG === "1";

const knowledgeBase = loadKnowledgeBase("data");
const system = buildSystemPrompt(BUSINESS_NAME, knowledgeBase);

// The API is stateless: we keep the whole conversation here and send it every time.
const history: Anthropic.Beta.BetaMessageParam[] = [];

const rl = readline.createInterface({ input: stdin, output: stdout });
let inputClosed = false;
rl.once("close", () => (inputClosed = true));
const prompt = () => {
  if (!inputClosed) rl.prompt();
};

console.log(`\n${BUSINESS_NAME} assistant (model: ${MODEL})`);
console.log(`Knowledge base: ${knowledgeBase.length.toLocaleString()} characters loaded.`);
console.log(`Type a question, or "exit" to quit.\n`);

rl.setPrompt("You: ");
prompt();

// Async iteration ends cleanly when input closes (Ctrl+D or piped input).
for await (const line of rl) {
  const question = line.trim();
  if (!question) {
    prompt();
    continue;
  }
  if (question.toLowerCase() === "exit") break;

  history.push({ role: "user", content: question });

  stdout.write("Bot: ");
  try {
    const reply = await ask(system, history, (chunk) => stdout.write(chunk));
    stdout.write("\n\n");

    // Append the full content array (not just the text) so the history is exact.
    history.push({ role: "assistant", content: reply.content });

    if (DEBUG) {
      const u = reply.usage;
      console.log(
        `[usage] input=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} ` +
          `cache_read=${u.cache_read_input_tokens ?? 0} output=${u.output_tokens}\n`,
      );
    }
  } catch (err) {
    // Remove the unanswered question so the history stays valid (user/assistant alternating).
    history.pop();
    stdout.write("\n");
    console.error("Error:", err instanceof Error ? err.message : err, "\n");
  }
  prompt();
}

rl.close();
