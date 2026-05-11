import { z } from "zod";
import { def, type ToolDef } from "./helpers.js";

export const commentTools: ToolDef[] = [
  def(
    "list_card_comments",
    "List the comments on a card.",
    z.object({ card_id: z.string(), limit: z.number().int().min(1).max(50).optional() }),
    async (args, trello) => trello.comments.onCard(args.card_id, args.limit),
  ),
  def(
    "add_comment",
    "Post a comment on a card.",
    z.object({ card_id: z.string(), text: z.string() }),
    async (args, trello) => trello.comments.add(args.card_id, args.text),
  ),
  def(
    "update_comment",
    "Edit the text of an existing comment.",
    z.object({ card_id: z.string(), action_id: z.string(), text: z.string() }),
    async (args, trello) => trello.comments.update(args.card_id, args.action_id, args.text),
  ),
  def(
    "delete_comment",
    "Delete a comment from a card.",
    z.object({ card_id: z.string(), action_id: z.string() }),
    async (args, trello) => trello.comments.delete(args.card_id, args.action_id),
  ),
];
