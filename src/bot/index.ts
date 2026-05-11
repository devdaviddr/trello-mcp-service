import "dotenv/config";
import { Agent } from "./agent.js";
import { ChatQueue } from "./chat-queue.js";
import { config } from "./config.js";
import { HistoryStore } from "./history.js";
import { McpClient } from "./mcp-client.js";
import { createBot } from "./telegram.js";

process.on("unhandledRejection", (r) => console.error("[bot] unhandledRejection", r));
process.on("uncaughtException", (e) => console.error("[bot] uncaughtException", e));

async function main(): Promise<void> {
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

  const bot = createBot({
    token: config.telegramToken,
    allowedUserIds: config.allowedUserIds,
    agent,
    history: new HistoryStore(),
    queue: new ChatQueue(),
  });

  console.log("[bot] starting Telegram long-poll");
  await bot.start({
    onStart: (info) => console.log(`[bot] polling live as @${info.username}`),
  });
}

main().catch((err) => {
  console.error("[bot] fatal", err);
  process.exit(1);
});
