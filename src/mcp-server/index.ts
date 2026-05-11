import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TrelloClient } from "./trello.js";
import { tools } from "./tools.js";

const key = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_API_TOKEN;
if (!key || !token) {
  console.error("TRELLO_API_KEY and TRELLO_API_TOKEN must be set");
  process.exit(1);
}
const trello = new TrelloClient(key, token);

const server = new Server(
  { name: "trello-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const toolSchemas = tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
const toolsByName = new Map(tools.map((t) => [t.name, t]));

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolSchemas }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = toolsByName.get(req.params.name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
  try {
    const result = await tool.handler(req.params.arguments ?? {}, trello);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: message }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[trello-mcp] server ready on stdio");
