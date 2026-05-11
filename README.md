# Trello Telegram Bot with MCP

> Chat with your Trello in plain English from Telegram — backed entirely by your own [Ollama](https://ollama.com) instance, no cloud LLM. The Trello [MCP](https://modelcontextprotocol.io) server (67 tools) is reusable standalone with any MCP host like Claude Desktop.

![License](https://img.shields.io/github/license/devdaviddr/trello-mcp-service)
![Last commit](https://img.shields.io/github/last-commit/devdaviddr/trello-mcp-service)
![Node](https://img.shields.io/badge/node-20-339933?logo=node.js&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-compatible-blue)

## Example session

```
You:  what's overdue?
Bot:  3 cards past due:
      • "Migrate auth" — Roadmap, due Apr 30
      • "Q2 OKRs draft" — Planning, due May 2
      • "Fix flaky CI" — Roadmap, due May 5

You:  push the CI one to next Friday and assign me
Bot:  Done — "Fix flaky CI" → due May 16, assigned to you.

You:  add a checklist with steps: reproduce, bisect, fix, write regression test
Bot:  Added "Steps" checklist to "Fix flaky CI" (4 items).
```

## Architecture

```
                       ┌────────────────────┐
                       │   Telegram user    │
                       └──────────┬─────────┘
                                  │ HTTPS
                                  ▼
                       ┌────────────────────┐
                       │    Telegram API    │
                       └──────────┬─────────┘
                                  │ long-poll (HTTPS)
══════════════════════════════════│══════════════════════ Docker host ══════
                                  ▼
   ┌──────────────── container: trello-mcp-bot ─────────────────────┐
   │                                                                │
   │      ┌──────────────────────────────────┐                      │
   │      │           bot process            │ ── HTTP ─────────────┼──▶ ┌──────────────────────┐
   │      │  grammy • ollama SDK • agent     │                      │    │  Ollama host (LAN)   │
   │      └────────────────┬─────────────────┘                      │    │  qwen3-coder, …      │
   │                       │ stdio (spawns child process)           │    └──────────────────────┘
   │                       ▼                                        │
   │      ┌──────────────────────────────────┐                      │
   │      │      MCP server (subprocess)     │ ── HTTPS ────────────┼──▶ ┌──────────────────────┐
   │      │          67 Trello tools         │                      │    │  Trello REST API     │
   │      └──────────────────────────────────┘                      │    │  api.trello.com      │
   │                                                                │    └──────────────────────┘
   └────────────────────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════════════════════
```

The bot and MCP server run as separate processes communicating over stdio, so the MCP server is reusable standalone by any MCP host (Claude Desktop, Inspector, etc.) without the bot involved.

**Why these choices:**

- **stdio MCP transport.** The server is co-located with its consumer, so stdio avoids a network surface, eliminates auth, and adds zero per-call latency on a 16-turn agent loop.
- **Single container.** Bot and MCP server share a lifetime — if either dies, both restart together. Splitting them would buy nothing for one consumer.
- **External Ollama.** The inference host is decoupled so the container stays small and you can keep the GPU box on a different machine, reachable over Tailscale/WireGuard.

## Privacy

Trello content is sent only to the Ollama endpoint you configure. Nothing leaves your network unless `OLLAMA_HOST` points off-network. No cloud LLM, no telemetry, no third-party API beyond Trello + Telegram themselves.

## Quickstart

**Prerequisites:** Docker + Compose, an Ollama instance reachable from the container, a Trello account, a Telegram account. The default model (`qwen3-coder:latest`) wants ~16 GB VRAM; smaller models work but tool-call reliability drops.

Four secrets, all free:

| Var | Where to get it |
|---|---|
| `TRELLO_API_KEY` | https://trello.com/power-ups/admin → your Power-Up → **API key** tab |
| `TRELLO_API_TOKEN` | Same page → click the **Token** link → authorize → copy the returned string |
| `TELEGRAM_BOT_TOKEN` | DM [@BotFather](https://t.me/BotFather) → `/newbot` |
| `TELEGRAM_ALLOWED_USER_IDS` | DM [@userinfobot](https://t.me/userinfobot) — paste the **numeric** id (not the @handle) |

Clone and run:

```sh
git clone https://github.com/devdaviddr/trello-mcp-service.git
cd trello-mcp-service
cp .env.example .env
$EDITOR .env              # fill in the four secrets above
docker compose up --build
```

Send your bot a message in Telegram. First reply is slow (Ollama cold-loads the model into VRAM, ~20–60s); subsequent replies are normal-speed.

**Model notes:** tested with `qwen3-coder:latest`, `qwen-pro:latest`, and `llama3.1:8b` — all do tool-calling reliably across the 67-tool surface. Avoid Gemma family models; their tool-calling is too weak for an agent loop this size.

## Configuration

All knobs are env vars. See `.env.example` for the full list.

| Var | Default | Notes |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | From inside Docker, use `host.docker.internal` (Mac/Windows) or a LAN IP. |
| `OLLAMA_MODEL` | `qwen3-coder:latest` | Any tool-calling-capable model. |
| `TELEGRAM_ALLOWED_USER_IDS` | (empty = allow all) | Comma-separated numeric ids. Non-numeric entries are warned about at startup. |
| `MCP_SERVER_COMMAND` / `MCP_SERVER_ARGS` | `node` / `dist/mcp-server/index.js` | Subprocess to spawn for the MCP server. Override for dev with `tsx` + `src/mcp-server/index.ts`. |
| `MAX_TURNS` | `16` | Max chained tool calls per user message. |
| `TOOL_OUTPUT_CHAR_BUDGET` | `16000` | Tool output truncation before entering chat history. |
| `OLLAMA_TIMEOUT_MS` | `120000` | Per-call abort timeout for Ollama. |

## Bot commands

- `/start` — greeting
- `/reset` — clear this chat's conversation history
- `/whoami` — show your Telegram numeric id and whether you're authorized (handy during setup)

## Tool surface

<details>
<summary><b>67 tools across 13 areas</b> (click to expand)</summary>

- **Workspace / profile** — `get_me`, `get_workspace_summary`, `list_workspaces`, `list_workspace_boards`, `list_starred_boards`, `star_board`, `unstar_board`
- **Boards** — `list_boards`, `get_board`, `create_board`, `update_board`, `delete_board`
- **Lists** — `list_lists`, `create_list`, `update_list`, `archive_all_cards_in_list`, `move_all_cards_in_list`
- **Cards** — `list_cards`, `get_card`, `find_card` (resolves URLs/short links), `create_card`, `update_card` (name/desc/due/start/dueComplete/dueReminder/archived), `move_card`, `copy_card`, `delete_card`, `set_card_position`, `set_card_cover`, `search_cards`
- **Card queries** — `list_my_cards`, `list_cards_due_soon`, `list_overdue_cards`, `list_cards_by_member_on_board`, `list_cards_by_label`
- **Card history / comments** — `list_card_actions`, `list_card_comments`, `add_comment`, `update_comment`, `delete_comment`
- **Voting** — `vote_on_card`, `unvote_card`, `list_card_voters`
- **Checklists** — `list_checklists`, `create_checklist` (with optional items), `update_checklist`, `delete_checklist`, `add_checklist_item`, `update_checklist_item`, `set_checklist_item_state`, `delete_checklist_item`
- **Labels** — `list_board_labels`, `create_label`, `update_label`, `delete_label`, `add_label_to_card`, `remove_label_from_card`
- **Members** — `list_board_members`, `assign_member_to_card`, `unassign_member_from_card`, `search_members`
- **Attachments** — `list_attachments`, `add_attachment_url`, `delete_attachment`
- **Custom fields (read)** — `list_board_custom_fields`, `list_card_custom_field_values`
- **Notifications** — `list_notifications`, `mark_notification_read`, `mark_all_notifications_read`

</details>

## Local dev & standalone MCP use

```sh
npm ci
npm run build
npm run dev   # tsx watch on the bot, spawns built MCP server
```

To run the MCP server in dev mode too, override in `.env`:

```
MCP_SERVER_COMMAND=tsx
MCP_SERVER_ARGS=src/mcp-server/index.ts
```

Run the MCP server standalone (for the MCP Inspector, Claude Desktop, or any MCP host):

```sh
TRELLO_API_KEY=... TRELLO_API_TOKEN=... npm run mcp
```

For Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp-service/dist/mcp-server/index.js"],
      "env": {
        "TRELLO_API_KEY": "...",
        "TRELLO_API_TOKEN": "..."
      }
    }
  }
}
```

## Reliability

- **Retries.** Trello client auto-retries 429/502/503/504 with `Retry-After` honored, jittered exponential backoff, max 4 attempts.
- **Timeouts.** Ollama calls have a 120s abort timeout; hangs surface as a friendly error to the chat.
- **Output truncation.** Tool output > 16 KB gets truncated before entering chat history so a large `list_boards` doesn't blow past the context window.
- **History boundaries.** Chat history is trimmed at user-message boundaries so assistant tool-call/result pairs stay intact across truncation.
- **Subprocess death.** If the MCP server dies, the bot exits cleanly and Docker restarts the container.
- **Per-chat serialization.** Concurrent messages in the same chat are queued so history can't be corrupted by overlapping turns.
- **Bounded memory.** Per-chat history capped at 100 chats (LRU) × 40 messages.

## Security & threat model

The bot holds a Trello write token and a Telegram bot token. Both live in `.env`, which is gitignored. The included `.env.example` ships with placeholder values only.

- **Authorization.** `TELEGRAM_ALLOWED_USER_IDS` is the only authn layer. Don't leave it empty in any real deployment — anyone who finds your bot can drive your Trello.
- **All 67 tools are exposed to the LLM**, including destructive ones (`delete_board`, `delete_card`, `delete_label`, etc.). The agent's system prompt asks the model to confirm before destructive calls, but this is best-effort. Prefer archiving over deletion when running unattended.
- **No audit log.** Tool calls are logged to stdout only; there's no per-action persistence.

## Deployment

Runs on any host with Docker and Compose; developed on a Mac mini homelab. For a remote VPS, point `OLLAMA_HOST` at a GPU box over WireGuard or Tailscale rather than exposing Ollama publicly — Ollama has no auth.

## Logging

Unstructured logs to stdout via `console`. Tail with `docker compose logs -f bot`. Each Telegram update is logged with its `update_id`, sender id, and message text; each MCP tool call logs name + dispatch outcome.

## Troubleshooting

- **Bot is up but never replies in Telegram, no errors in logs.** On Apple Silicon, the `node:20-alpine` base image runs under Rosetta and Node's TLS stack hangs on `api.telegram.org`. This project uses `node:20-slim` to avoid it — if you forked back to alpine, that's your problem.
- **"This bot isn't authorized for your account (id=...)".** `TELEGRAM_ALLOWED_USER_IDS` must contain your **numeric** id, not your @handle. Send `/whoami` to the bot to see what id Telegram reports for you.
- **401 from Trello.** The **Secret** on the Power-Up API key page is **not** the Token. Click the blue "Token" link in the right-hand description text, authorize, and use that.
- **Bot says "I hit my tool-call limit".** Complex multi-step request exceeded `MAX_TURNS=16`. Bump it via env or break the request up. Frequent hits usually mean the model is looping — try a stronger model.
- **Slow first reply.** Ollama cold-loads the model into VRAM on the first request. Expect 20–60s. Subsequent calls are normal-speed.

## Roadmap & non-goals

**Planned:**
- SQLite persistence for chat history (currently in-memory, lost on restart).
- HTTP transport on the MCP server for remote MCP hosts.
- Per-user Trello tokens so one bot can serve multiple users.

**Non-goals:**
- Cloud LLM support — the point is local inference.
- A web UI — Telegram is the interface.
- Polling/webhooks for Trello → Telegram notifications (different shape of project).

## Contributing

Issues and PRs welcome. Especially appreciated: model recommendations, Trello endpoints I missed, and bug reports with repro steps. Star if it saved you a click.

## License

Apache 2.0 — see [LICENSE](./LICENSE).
