import "dotenv/config";
import { Bot } from "grammy";
import type { Message } from "ollama";
import { Agent } from "./agent.js";
import { McpClient } from "./mcp-client.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN must be set");
  process.exit(1);
}

const allowed = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
for (const id of allowed) {
  if (!/^\d+$/.test(id)) {
    console.warn(`[bot] WARNING: TELEGRAM_ALLOWED_USER_IDS contains "${id}" which is not a numeric id. Telegram only returns numeric ids; this entry will never match. Use @userinfobot to find your numeric id.`);
  }
}

const mcp = new McpClient();
try {
  await mcp.connect();
} catch (err) {
  console.error("[bot] Failed to connect to MCP server. Common causes: TRELLO_API_KEY/TRELLO_API_TOKEN missing, or dist not built.", err);
  process.exit(1);
}
mcp.onceClosed((reason) => {
  console.error(`[bot] MCP subprocess died (${reason}) — exiting so Docker can restart us.`);
  process.exit(1);
});

const agent = new Agent(mcp);
try {
  await agent.init();
} catch (err) {
  console.error("[bot] Failed to initialize agent / list MCP tools.", err);
  process.exit(1);
}

const MAX_CHATS = 100;
const MAX_HISTORY = 40;
const histories = new Map<number, Message[]>();
const chatQueues = new Map<number, Promise<unknown>>();

function enqueueForChat<T>(chatId: number, work: () => Promise<T>): Promise<T> {
  const prev = chatQueues.get(chatId) ?? Promise.resolve();
  const next = prev.then(work, work);
  const settled = next.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    if (chatQueues.get(chatId) === settled) chatQueues.delete(chatId);
  });
  chatQueues.set(chatId, settled);
  return next;
}

process.on("unhandledRejection", (r) => console.error("[bot] unhandledRejection", r));
process.on("uncaughtException", (e) => console.error("[bot] uncaughtException", e));

const bot = new Bot(token);

bot.use(async (ctx, next) => {
  console.log(`[bot] update ${ctx.update.update_id} from=${ctx.from?.id} text=${JSON.stringify(ctx.message?.text)}`);
  try {
    await next();
  } catch (err) {
    console.error("[bot] middleware threw", err);
    throw err;
  }
});

bot.command("start", async (ctx) => {
  await ctx.reply("Hi — ask me anything about your Trello boards.");
});
bot.command("reset", async (ctx) => {
  histories.delete(ctx.chat.id);
  await ctx.reply("Cleared our chat history.");
});
bot.command("whoami", async (ctx) => {
  const id = ctx.from?.id;
  await ctx.reply(`Telegram id: ${id}\nAuthorized: ${allowed.size === 0 ? "anyone (no allowlist)" : allowed.has(String(id)) ? "yes" : "no"}`);
});

bot.on("message:text", async (ctx) => {
  const userId = ctx.from?.id?.toString();
  if (allowed.size && (!userId || !allowed.has(userId))) {
    console.log(`[bot] rejecting user id=${userId} (allowed: ${[...allowed].join(",")})`);
    await ctx.reply(`Sorry — this bot isn't authorized for your account (id=${userId}).`);
    return;
  }

  const chatId = ctx.chat.id;
  await enqueueForChat(chatId, async () => {
    const history = histories.get(chatId) ?? [];
    await ctx.replyWithChatAction("typing");
    try {
      const { reply, history: next } = await agent.chat(history, ctx.message.text);
      setHistory(chatId, trimHistory(next));
      await ctx.reply(reply);
    } catch (err) {
      console.error("[bot] agent error", err);
      await ctx.reply(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
});

bot.catch((err) => console.error("[bot] grammy error handler", err));

console.log("[bot] starting Telegram long-poll");
bot.start({
  onStart: (info) => console.log(`[bot] polling live as @${info.username}`),
}).catch((err) => {
  console.error("[bot] bot.start() rejected", err);
  process.exit(1);
});

function setHistory(chatId: number, messages: Message[]): void {
  // delete-then-set bumps insertion order so this chat becomes "most recent" — Map iteration is insertion-ordered.
  if (histories.has(chatId)) histories.delete(chatId);
  histories.set(chatId, messages);
  while (histories.size > MAX_CHATS) {
    const oldest = histories.keys().next().value;
    if (oldest === undefined) break;
    histories.delete(oldest);
  }
}

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= MAX_HISTORY) return messages;
  let cut = messages.length - MAX_HISTORY;
  while (cut < messages.length && messages[cut].role !== "user") cut++;
  return messages.slice(cut);
}
