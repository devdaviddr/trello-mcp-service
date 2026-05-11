import { Bot, type Context } from "grammy";
import type { Agent } from "./agent.js";
import type { ChatQueue } from "./chat-queue.js";
import type { HistoryStore } from "./history.js";

export interface BotDeps {
  token: string;
  allowedUserIds: Set<string>;
  agent: Agent;
  history: HistoryStore;
  queue: ChatQueue;
}

export function createBot(deps: BotDeps): Bot {
  const { token, allowedUserIds, agent, history, queue } = deps;
  const bot = new Bot(token);

  bot.use(logUpdate);
  bot.command("start", greet);
  bot.command("reset", async (ctx) => {
    history.clear(ctx.chat.id);
    await ctx.reply("Cleared our chat history.");
  });
  bot.command("whoami", async (ctx) => identify(ctx, allowedUserIds));
  bot.on("message:text", (ctx) => handleMessage(ctx, deps));
  bot.catch((err) => console.error("[bot] grammy error handler", err));

  return bot;
}

async function logUpdate(ctx: Context, next: () => Promise<void>): Promise<void> {
  console.log(`[bot] update ${ctx.update.update_id} from=${ctx.from?.id} text=${JSON.stringify(ctx.message?.text)}`);
  try {
    await next();
  } catch (err) {
    console.error("[bot] middleware threw", err);
    throw err;
  }
}

async function greet(ctx: Context): Promise<void> {
  await ctx.reply("Hi — ask me anything about your Trello boards.");
}

async function identify(ctx: Context, allowed: Set<string>): Promise<void> {
  const id = ctx.from?.id;
  const status = allowed.size === 0 ? "anyone (no allowlist)" : allowed.has(String(id)) ? "yes" : "no";
  await ctx.reply(`Telegram id: ${id}\nAuthorized: ${status}`);
}

async function handleMessage(ctx: Context, deps: BotDeps): Promise<void> {
  const userId = ctx.from?.id?.toString();
  if (deps.allowedUserIds.size && (!userId || !deps.allowedUserIds.has(userId))) {
    console.log(`[bot] rejecting user id=${userId} (allowed: ${[...deps.allowedUserIds].join(",")})`);
    await ctx.reply(`Sorry — this bot isn't authorized for your account (id=${userId}).`);
    return;
  }

  const text = ctx.message?.text;
  if (!text) return;
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  await deps.queue.run(chatId, async () => {
    const prior = deps.history.get(chatId);
    await ctx.replyWithChatAction("typing");
    try {
      const { reply, history: next } = await deps.agent.chat(prior, text);
      deps.history.set(chatId, next);
      await ctx.reply(reply);
    } catch (err) {
      console.error("[bot] agent error", err);
      await ctx.reply(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}
