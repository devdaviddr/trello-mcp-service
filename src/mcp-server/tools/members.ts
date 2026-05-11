import { z } from "zod";
import { def, type ToolDef } from "./helpers.js";

export const memberTools: ToolDef[] = [
  def(
    "get_me",
    "Get the authenticated Trello user's profile (id, username, full name, email, workspace ids).",
    z.object({}),
    async (_args, trello) => trello.members.me(),
  ),
  def(
    "list_board_members",
    "List members of a board (needed to look up member ids before assigning).",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.members.onBoard(args.board_id),
  ),
  def(
    "assign_member_to_card",
    "Assign a board member to a card.",
    z.object({ card_id: z.string(), member_id: z.string() }),
    async (args, trello) => trello.members.assignToCard(args.card_id, args.member_id),
  ),
  def(
    "unassign_member_from_card",
    "Remove a member assignment from a card.",
    z.object({ card_id: z.string(), member_id: z.string() }),
    async (args, trello) => trello.members.unassignFromCard(args.card_id, args.member_id),
  ),
  def(
    "search_members",
    "Search for Trello users by partial username, email, or full name.",
    z.object({ query: z.string(), limit: z.number().int().min(1).max(20).optional() }),
    async (args, trello) => trello.members.search(args.query, args.limit),
  ),
];
