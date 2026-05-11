import { z } from "zod";
import { colorEnum, coverToTrello, def, filterOpenDues, mapDefined, parseCardRef, type ToolDef } from "./helpers.js";

export const cardTools: ToolDef[] = [
  def(
    "list_cards",
    "List the cards in a given list.",
    z.object({ list_id: z.string().describe("Trello list id") }),
    async (args, trello) => trello.cards.inList(args.list_id),
  ),
  def(
    "get_card",
    "Get full details of a single card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.cards.get(args.card_id),
  ),
  def(
    "find_card",
    "Resolve a card from a Trello URL, short link, or id. Accepts what a user typically pastes from the browser.",
    z.object({ id_or_url: z.string() }),
    async (args, trello) => {
      const ref = parseCardRef(args.id_or_url);
      if (!ref) throw new Error(`Couldn't parse "${args.id_or_url}" as a Trello card URL, short link, or id.`);
      return trello.cards.findByRef(ref);
    },
  ),
  def(
    "create_card",
    "Create a new card in a list.",
    z.object({
      list_id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      due: z.string().optional().describe("ISO 8601 due date"),
    }),
    async (args, trello) => trello.cards.create(args.list_id, args.name, args.description, args.due),
  ),
  def(
    "update_card",
    "Update a card's name, description, dates, due-complete flag, due-reminder, or archived state. Dates are ISO 8601 (e.g. 2026-05-20T17:00:00Z). Pass empty string to clear a date.",
    z.object({
      card_id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      due: z.string().optional().describe("Due date in ISO 8601, or empty string to clear"),
      start: z.string().optional().describe("Start date in ISO 8601, or empty string to clear"),
      due_complete: z.boolean().optional().describe("Mark the due date as done"),
      due_reminder_minutes: z
        .number()
        .int()
        .optional()
        .describe("Minutes before due to notify. -1 disables. Common values: 0, 5, 60, 1440 (1 day)."),
      archived: z.boolean().optional(),
    }),
    async (args, trello) =>
      trello.cards.update(args.card_id, {
        name: args.name,
        desc: args.description,
        due: args.due,
        start: args.start,
        dueComplete: mapDefined(args.due_complete, String),
        dueReminder: mapDefined(args.due_reminder_minutes, String),
        closed: mapDefined(args.archived, String),
      }),
  ),
  def(
    "move_card",
    "Move a card to a different list.",
    z.object({ card_id: z.string(), list_id: z.string() }),
    async (args, trello) => trello.cards.move(args.card_id, args.list_id),
  ),
  def(
    "copy_card",
    "Duplicate a card into a destination list. By default copies everything; restrict via `keep`.",
    z.object({
      source_card_id: z.string(),
      dest_list_id: z.string(),
      name: z.string().optional(),
      keep: z
        .array(z.enum(["attachments", "checklists", "comments", "due", "labels", "members", "stickers"]))
        .optional()
        .describe("Which aspects of the source to copy. Omit to copy all."),
    }),
    async (args, trello) => trello.cards.copy(args.source_card_id, args.dest_list_id, args.name, args.keep),
  ),
  def(
    "delete_card",
    "Permanently delete a card. Irreversible — confirm with the user first; usually `update_card archived:true` is what you want.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.cards.delete(args.card_id),
  ),
  def(
    "set_card_position",
    "Reorder a card within its list. Position is 'top', 'bottom', or a numeric string.",
    z.object({ card_id: z.string(), position: z.string() }),
    async (args, trello) => trello.cards.setPosition(args.card_id, args.position),
  ),
  def(
    "set_card_cover",
    "Set or clear a card cover. Pick kind='color' with a color, kind='attachment' with attachment_id, or kind='none' to clear.",
    z.object({
      card_id: z.string(),
      cover: z.union([
        z.object({
          kind: z.literal("color"),
          color: colorEnum.nullable(),
          brightness: z.enum(["light", "dark"]).optional(),
          size: z.enum(["normal", "full"]).optional(),
        }),
        z.object({
          kind: z.literal("attachment"),
          attachment_id: z.string(),
          brightness: z.enum(["light", "dark"]).optional(),
          size: z.enum(["normal", "full"]).optional(),
        }),
        z.object({ kind: z.literal("none") }),
      ]),
    }),
    async (args, trello) => trello.cards.setCover(args.card_id, coverToTrello(args.cover)),
  ),
  def(
    "search_cards",
    "Search cards by free-text query across the user's boards.",
    z.object({ query: z.string(), limit: z.number().int().min(1).max(50).optional() }),
    async (args, trello) => trello.cards.search(args.query, args.limit),
  ),
  def(
    "list_card_actions",
    "List the activity history of a card (creates, moves, comments, etc.).",
    z.object({
      card_id: z.string(),
      limit: z.number().int().min(1).max(50).optional(),
      filter: z.string().optional().describe("Trello action-type filter, e.g. 'commentCard' or 'updateCard'"),
    }),
    async (args, trello) => trello.cards.actions(args.card_id, args.limit, args.filter),
  ),
  def(
    "list_my_cards",
    "List cards assigned to the authenticated user across all boards.",
    z.object({
      filter: z.enum(["all", "open", "closed", "visible"]).optional(),
    }),
    async (args, trello) => trello.cards.mine(args.filter ?? "open"),
  ),
  def(
    "list_cards_due_soon",
    "List the user's open cards due within the next N hours (default 48). Excludes already-completed dues.",
    z.object({ hours: z.number().int().min(1).max(720).optional() }),
    async (args, trello) => {
      const horizonMs = (args.hours ?? 48) * 3600_000;
      return filterOpenDues(await trello.cards.mine("open"), (due, now) => due >= now && due - now <= horizonMs);
    },
  ),
  def(
    "list_overdue_cards",
    "List the user's open cards whose due date has passed and which are not marked complete.",
    z.object({}),
    async (_args, trello) => filterOpenDues(await trello.cards.mine("open"), (due, now) => due < now),
  ),
  def(
    "list_cards_by_member_on_board",
    "List cards on a board assigned to a specific member.",
    z.object({ board_id: z.string(), member_id: z.string() }),
    async (args, trello) => trello.cards.byMemberOnBoard(args.board_id, args.member_id),
  ),
  def(
    "list_cards_by_label",
    "List cards on a board or list that carry a given label id.",
    z.object({
      label_id: z.string(),
      board_id: z.string().optional(),
      list_id: z.string().optional(),
    }),
    async (args, trello) => trello.cards.byLabel({ board_id: args.board_id, list_id: args.list_id }, args.label_id),
  ),
  def(
    "vote_on_card",
    "Vote yes on a card as the authenticated user.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.cards.vote(args.card_id),
  ),
  def(
    "unvote_card",
    "Remove the authenticated user's vote from a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.cards.unvote(args.card_id),
  ),
  def(
    "list_card_voters",
    "List members who voted on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.cards.voters(args.card_id),
  ),
];
