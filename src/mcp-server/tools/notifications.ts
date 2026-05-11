import { z } from "zod";
import { def, type ToolDef } from "./helpers.js";

export const notificationTools: ToolDef[] = [
  def(
    "list_notifications",
    "List the user's Trello notifications.",
    z.object({
      unread_only: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    async (args, trello) => trello.notifications.list({ unreadOnly: args.unread_only, limit: args.limit }),
  ),
  def(
    "mark_notification_read",
    "Mark a single notification as read.",
    z.object({ notification_id: z.string() }),
    async (args, trello) => trello.notifications.markRead(args.notification_id),
  ),
  def(
    "mark_all_notifications_read",
    "Mark every notification as read.",
    z.object({}),
    async (_args, trello) => trello.notifications.markAllRead(),
  ),
];
