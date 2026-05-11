import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private cachedTools: McpTool[] | null = null;
  private closeHandler: ((reason: string) => void) | null = null;
  private closed = false;

  async connect(): Promise<void> {
    const command = process.env.MCP_SERVER_COMMAND ?? "node";
    const args = (process.env.MCP_SERVER_ARGS ?? "dist/mcp-server/index.js").split(/\s+/).filter(Boolean);

    const childEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) childEnv[k] = v;
    }

    this.transport = new StdioClientTransport({ command, args, env: childEnv });
    this.transport.onclose = () => this.fireClose("transport closed");
    this.transport.onerror = (err) => this.fireClose(`transport error: ${err.message}`);

    this.client = new Client({ name: "trello-bot", version: "0.1.0" }, { capabilities: {} });
    await this.client.connect(this.transport);
  }

  onceClosed(handler: (reason: string) => void): void {
    this.closeHandler = handler;
  }

  private fireClose(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    const handler = this.closeHandler;
    this.closeHandler = null;
    if (!handler) return;
    try {
      handler(reason);
    } catch (err) {
      console.error("[mcp-client] close handler threw", err);
    }
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.client) throw new Error("MCP client not connected");
    if (this.cachedTools) return this.cachedTools;
    const { tools } = await this.client.listTools();
    this.cachedTools = tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
    }));
    return this.cachedTools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error("MCP client not connected");
    const result = await this.client.callTool({ name, arguments: args });
    const parts = (result.content ?? []) as { type: string; text?: string }[];
    const text = parts.map((p) => (p.type === "text" ? p.text ?? "" : "")).join("\n");
    if (result.isError) throw new Error(text || "tool failed");
    return text;
  }
}
