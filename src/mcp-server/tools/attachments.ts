import { z } from "zod";
import { def, type ToolDef } from "./helpers.js";

export const attachmentTools: ToolDef[] = [
  def(
    "list_attachments",
    "List the attachments (files and URLs) on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.attachments.onCard(args.card_id),
  ),
  def(
    "add_attachment_url",
    "Attach a URL to a card.",
    z.object({ card_id: z.string(), url: z.string(), name: z.string().optional() }),
    async (args, trello) => trello.attachments.addUrl(args.card_id, args.url, args.name),
  ),
  def(
    "delete_attachment",
    "Remove an attachment from a card.",
    z.object({ card_id: z.string(), attachment_id: z.string() }),
    async (args, trello) => trello.attachments.delete(args.card_id, args.attachment_id),
  ),
];
