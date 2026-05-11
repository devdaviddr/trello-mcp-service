# Trello Telegram Bot with MCP 

A Telegram chatbot that manages Trello through natural language, powered by a local LLM via Ollama. Trello is exposed as an [MCP](https://modelcontextprotocol.io) server with 67 tools; the bot is a tool-calling agent loop on top of Ollama.

The MCP server is reusable on its own — point Claude Desktop, the Claude API agents framework, or any other MCP host at it.

## Architecture

```
Telegram  ──▶  bot (grammy) ──▶  agent loop (ollama SDK) ──▶  Ollama @ LAN
                  │                       │
                  │                       └─▶  MCP client (stdio) ─┐
                  │                                                │
                  └────────────────────────────────────────────────┴─▶  MCP server (subprocess) ──▶ Trello REST
```

The bot process spawns the MCP server as a stdio subprocess — they share a process tree but stay logically separated. Ollama lives outside the container (LAN/host).

## Quickstart

You need four secrets:

| Var | Where to get it |
|---|---|
| `TRELLO_API_KEY` | https://trello.com/power-ups/admin → your Power-Up → **API key** tab |
| `TRELLO_API_TOKEN` | Same page → click the **Token** link → authorize → copy the returned string |
| `TELEGRAM_BOT_TOKEN` | DM [@BotFather](https://t.me/BotFather) → `/newbot` |
| `TELEGRAM_ALLOWED_USER_IDS` | DM [@userinfobot](https://t.me/userinfobot) — paste the **numeric** id (not the @handle) |

Then:

```sh
cp .env.example .env       # fill in the four blanks above
docker compose up --build  # first build pulls node:20-slim, takes ~1 min
```

Send a message to your bot in Telegram. First reply is slow (Ollama loads the model into VRAM); subsequent ones are fast.

## Configuration

All knobs are env vars. See `.env.example` for the full list.

| Var | Default | Notes |
|---|---|---|
| `OLLAMA_HOST` | `http://192.168.4.90:11434` | HTTP URL of the Ollama instance |
| `OLLAMA_MODEL` | `qwen3-coder:latest` | Any tool-calling-capable model. Qwen3-coder, Qwen-Pro, and Llama 3.1 all work well; Gemma is weak at tool calling. |
| `TELEGRAM_ALLOWED_USER_IDS` | (empty = allow all) | Comma-separated numeric ids. Non-numeric entries are warned about at startup. |
| `MCP_SERVER_COMMAND` / `MCP_SERVER_ARGS` | `node` / `dist/mcp-server/index.js` | Subprocess to spawn for the MCP server. Override for dev with `tsx` + `src/mcp-server/index.ts`. |

## Bot commands

- `/start` — greeting
- `/reset` — clear this chat's conversation history
- `/whoami` — show your Telegram numeric id and whether you're authorized (handy during setup)

## Tool surface

The MCP server exposes 67 tools. By area:

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

## Local dev (no Docker)

```sh
npm ci
npm run build
npm run dev   # tsx watch on the bot, spawns built MCP server
```

To run the MCP server in dev mode too, set in `.env`:

```
MCP_SERVER_COMMAND=tsx
MCP_SERVER_ARGS=src/mcp-server/index.ts
```

Run the MCP server standalone (e.g. for inspector or Claude Desktop):

```sh
TRELLO_API_KEY=... TRELLO_API_TOKEN=... npm run mcp
```

## Connecting Claude Desktop to the MCP server

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/mcp-server/index.js"],
      "env": {
        "TRELLO_API_KEY": "...",
        "TRELLO_API_TOKEN": "..."
      }
    }
  }
}
```

## Troubleshooting

- **Bot is up but never replies in Telegram, no errors in logs**: on Apple Silicon, the `node:20-alpine` image runs under Rosetta and Node's TLS stack hangs on `api.telegram.org`. This project uses `node:20-slim` to avoid it — if you forked back to alpine, that's your problem.
- **"This bot isn't authorized for your account (id=...)"**: `TELEGRAM_ALLOWED_USER_IDS` must contain your **numeric** id, not your @handle. Send `/whoami` to the bot to see what id Telegram reports for you.
- **401 from Trello**: the **Secret** on the Power-Up API key page is **not** the Token. Click the blue "Token" link in the right-hand description text, authorize, and use that.
- **Bot says "I hit my tool-call limit"**: complex multi-step request exceeded `MAX_TURNS=16` in `src/bot/agent.ts`. Bump it or ask for the steps individually. Frequent hits usually mean the model is looping — try a stronger model.
- **Slow first reply**: Ollama cold-loads the model into VRAM on the first request. Expect 20–60s. Subsequent calls are normal-speed.

## Notes on this codebase

- **Robustness**: the Trello client auto-retries 429/502/503/504 with `Retry-After` honored; Ollama calls have a 120s abort timeout; tool output is truncated to 16 KB before entering chat history; chat history is trimmed at user-message boundaries so tool-call/result pairs stay intact; MCP subprocess death causes a clean exit so Docker restarts the container.
- **Memory**: per-chat history is kept in-memory only, capped at 100 chats LRU and 40 messages per chat. `/reset` clears your chat.
- **No persistence**: bot restarts wipe history. Add SQLite if you want durability.
