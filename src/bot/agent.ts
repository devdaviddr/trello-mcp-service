import { Ollama, type Message, type Tool } from "ollama";
import type { McpClient, McpTool } from "./mcp-client.js";

type ToolMessage = Message & { tool_name: string };

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SYSTEM_PROMPT = `You are a helpful assistant that manages the user's Trello workspace via tool calls.

Workflow guidance:
- For "what do I have / show me" questions, start with get_workspace_summary (no args = list of boards; with board_id = full board with lists, labels, members).
- For actions, you must usually look up ids first: boards → lists → cards. Use search_cards / search_members when names are partial. When the user pastes a Trello URL, call find_card.
- IDs returned by one tool can be reused in the same conversation — don't re-fetch unnecessarily.
- The DESTRUCTIVE tools delete_board, delete_card, delete_label, delete_checklist, delete_checklist_item, delete_comment, delete_attachment are PERMANENT. Confirm with the user before calling them; prefer archiving (update_card/update_list/update_board with archived:true) when reversible.
- After modifying something, give a one-line confirmation back to the user — don't dump the raw API response.

Style: terse, conversational, Telegram-friendly. No headers or markdown tables unless asked.`;

const MAX_TURNS = envNumber("MAX_TURNS", 16);
const TOOL_OUTPUT_CHAR_BUDGET = envNumber("TOOL_OUTPUT_CHAR_BUDGET", 16_000);
const OLLAMA_TIMEOUT_MS = envNumber("OLLAMA_TIMEOUT_MS", 120_000);

export class Agent {
  private readonly ollama: Ollama;
  private readonly model: string;
  private tools: Tool[] = [];

  constructor(private readonly mcp: McpClient) {
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? "http://localhost:11434" });
    this.model = process.env.OLLAMA_MODEL ?? "qwen3-coder:latest";
  }

  async init(): Promise<void> {
    const mcpTools = await this.mcp.listTools();
    this.tools = mcpTools.map(toOllamaTool);
  }

  async chat(history: Message[], userText: string): Promise<{ reply: string; history: Message[] }> {
    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userText },
    ];

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await this.callOllama(messages);
      const msg = res.message;
      messages.push(msg);

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        const reply = msg.content?.trim() || "(no reply)";
        return { reply, history: messages.slice(1) };
      }

      for (const call of calls) {
        const name = call.function?.name;
        if (!name) {
          messages.push({ role: "tool", content: "ERROR: tool call was missing a function name", tool_name: "unknown" } satisfies ToolMessage);
          continue;
        }
        const args = normalizeArgs(call.function.arguments);
        let toolResult: string;
        try {
          toolResult = await this.mcp.callTool(name, args);
        } catch (err) {
          toolResult = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
        }
        messages.push({ role: "tool", content: truncateForContext(toolResult), tool_name: name } satisfies ToolMessage);
      }
    }

    console.warn(`[agent] MAX_TURNS (${MAX_TURNS}) reached — giving up. Last user text: ${userText.slice(0, 80)}`);
    return {
      reply: "I hit my tool-call limit before finishing — could you rephrase or break that into smaller steps?",
      history: messages.slice(1),
    };
  }

  private async callOllama(messages: Message[]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
      const res = await this.ollama.chat({
        model: this.model,
        messages,
        tools: this.tools,
        stream: false,
      });
      return res;
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`Ollama did not respond within ${OLLAMA_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

function toOllamaTool(t: McpTool): Tool {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as Tool["function"]["parameters"],
    },
  };
}

function normalizeArgs(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function truncateForContext(text: string): string {
  if (text.length <= TOOL_OUTPUT_CHAR_BUDGET) return text;
  const dropped = text.length - TOOL_OUTPUT_CHAR_BUDGET;
  return `${text.slice(0, TOOL_OUTPUT_CHAR_BUDGET)}\n…[truncated, ${dropped} more chars]`;
}
