import { z } from "zod";
import type { TrelloCard, TrelloClient } from "./trello.js";
import { TRELLO_COLORS } from "./trello.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: unknown, trello: TrelloClient) => Promise<unknown>;
}

const def = <S extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: S,
  handler: (args: z.infer<S>, trello: TrelloClient) => Promise<unknown>,
): ToolDef => {
  const json = zodToJsonSchema(schema);
  return {
    name,
    description,
    inputSchema: json,
    handler: async (raw, trello) => handler(schema.parse(raw), trello),
  };
};

const mapDefined = <T, U>(v: T | undefined, fn: (t: T) => U): U | undefined =>
  v === undefined ? undefined : fn(v);

const colorEnum = z.enum(TRELLO_COLORS);

function parseCardRef(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/trello\.com\/c\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]{8,32}$/.test(trimmed)) return trimmed;
  return null;
}

function coverToTrello(
  cover:
    | { kind: "color"; color: TrelloColor | null; brightness?: "light" | "dark"; size?: "normal" | "full" }
    | { kind: "attachment"; attachment_id: string; brightness?: "light" | "dark"; size?: "normal" | "full" }
    | { kind: "none" },
): Parameters<TrelloClient["setCardCover"]>[1] {
  if (cover.kind === "none") return "none";
  if (cover.kind === "attachment") {
    return { idAttachment: cover.attachment_id, brightness: cover.brightness, size: cover.size };
  }
  return { color: cover.color, brightness: cover.brightness, size: cover.size };
}

function filterOpenDues(cards: TrelloCard[], predicate: (dueMs: number, nowMs: number) => boolean): TrelloCard[] {
  const now = Date.now();
  return cards.filter((c) => {
    if (!c.due || c.dueComplete) return false;
    return predicate(Date.parse(c.due), now);
  });
}

type TrelloColor = (typeof TRELLO_COLORS)[number];

export const tools: ToolDef[] = [
  def(
    "list_boards",
    "List all Trello boards the user has access to.",
    z.object({}),
    async (_args, trello) => trello.listBoards(),
  ),
  def(
    "list_lists",
    "List the columns (lists) on a given board.",
    z.object({ board_id: z.string().describe("Trello board id") }),
    async (args, trello) => trello.listLists(args.board_id),
  ),
  def(
    "list_cards",
    "List the cards in a given list.",
    z.object({ list_id: z.string().describe("Trello list id") }),
    async (args, trello) => trello.listCards(args.list_id),
  ),
  def(
    "get_card",
    "Get full details of a single card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.getCard(args.card_id),
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
    async (args, trello) => trello.createCard(args.list_id, args.name, args.description, args.due),
  ),
  def(
    "move_card",
    "Move a card to a different list.",
    z.object({ card_id: z.string(), list_id: z.string() }),
    async (args, trello) => trello.moveCard(args.card_id, args.list_id),
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
      trello.updateCard(args.card_id, {
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
    "add_comment",
    "Post a comment on a card.",
    z.object({ card_id: z.string(), text: z.string() }),
    async (args, trello) => trello.addComment(args.card_id, args.text),
  ),
  def(
    "search_cards",
    "Search cards by free-text query across the user's boards.",
    z.object({ query: z.string(), limit: z.number().int().min(1).max(50).optional() }),
    async (args, trello) => trello.searchCards(args.query, args.limit),
  ),
  def(
    "list_checklists",
    "List checklists (with their items) on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.listChecklists(args.card_id),
  ),
  def(
    "create_checklist",
    "Create a checklist on a card. Optionally seed it with items.",
    z.object({
      card_id: z.string(),
      name: z.string(),
      items: z.array(z.string()).optional().describe("Initial check-item names, added in order"),
    }),
    async (args, trello) => trello.createChecklist(args.card_id, args.name, args.items),
  ),
  def(
    "add_checklist_item",
    "Add an item to an existing checklist.",
    z.object({ checklist_id: z.string(), name: z.string() }),
    async (args, trello) => trello.addChecklistItem(args.checklist_id, args.name),
  ),
  def(
    "set_checklist_item_state",
    "Mark a checklist item as complete or incomplete.",
    z.object({ card_id: z.string(), check_item_id: z.string(), complete: z.boolean() }),
    async (args, trello) => trello.setChecklistItemState(args.card_id, args.check_item_id, args.complete),
  ),
  def(
    "delete_checklist",
    "Delete an entire checklist from its card.",
    z.object({ checklist_id: z.string() }),
    async (args, trello) => trello.deleteChecklist(args.checklist_id),
  ),
  def(
    "list_board_labels",
    "List the labels defined on a board.",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.listBoardLabels(args.board_id),
  ),
  def(
    "create_label",
    `Create a new label on a board. Color is one of ${TRELLO_COLORS.join(",")} — or null for no color.`,
    z.object({
      board_id: z.string(),
      name: z.string(),
      color: colorEnum.nullable().optional(),
    }),
    async (args, trello) => trello.createLabel(args.board_id, args.name, args.color ?? null),
  ),
  def(
    "add_label_to_card",
    "Attach an existing label (by label id) to a card.",
    z.object({ card_id: z.string(), label_id: z.string() }),
    async (args, trello) => trello.addLabelToCard(args.card_id, args.label_id),
  ),
  def(
    "remove_label_from_card",
    "Detach a label from a card.",
    z.object({ card_id: z.string(), label_id: z.string() }),
    async (args, trello) => trello.removeLabelFromCard(args.card_id, args.label_id),
  ),
  def(
    "list_board_members",
    "List members of a board (needed to look up member ids before assigning).",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.listBoardMembers(args.board_id),
  ),
  def(
    "assign_member_to_card",
    "Assign a board member to a card.",
    z.object({ card_id: z.string(), member_id: z.string() }),
    async (args, trello) => trello.assignMemberToCard(args.card_id, args.member_id),
  ),
  def(
    "unassign_member_from_card",
    "Remove a member assignment from a card.",
    z.object({ card_id: z.string(), member_id: z.string() }),
    async (args, trello) => trello.unassignMemberFromCard(args.card_id, args.member_id),
  ),
  def(
    "get_me",
    "Get the authenticated Trello user's profile (id, username, full name, email, workspace ids).",
    z.object({}),
    async (_args, trello) => trello.getMe(),
  ),
  def(
    "get_workspace_summary",
    "Cheap overview tool. With no board_id, returns the list of the user's open boards. With a board_id, returns that board with its lists, labels, and members in a single call — useful as a first step before more specific actions.",
    z.object({ board_id: z.string().optional() }),
    async (args, trello) => {
      if (args.board_id) {
        return trello.getBoard(args.board_id, { lists: "open", labels: true, members: true });
      }
      const boards = await trello.listBoards();
      return { boards: boards.filter((b) => !b.closed) };
    },
  ),
  def(
    "get_board",
    "Fetch a board's details with optional embedded lists, labels, members, and cards.",
    z.object({
      board_id: z.string(),
      include_lists: z.enum(["all", "open", "closed", "none"]).optional(),
      include_labels: z.boolean().optional(),
      include_members: z.boolean().optional(),
      include_cards: z.enum(["none", "open", "all"]).optional(),
    }),
    async (args, trello) =>
      trello.getBoard(args.board_id, {
        lists: args.include_lists,
        labels: args.include_labels,
        members: args.include_members,
        cards: args.include_cards,
      }),
  ),
  def(
    "create_board",
    "Create a new Trello board.",
    z.object({
      name: z.string(),
      description: z.string().optional(),
      workspace_id: z.string().optional().describe("Trello organization id to put the board under"),
      with_default_lists: z.boolean().optional().describe("Create the default To-Do/Doing/Done lists"),
    }),
    async (args, trello) =>
      trello.createBoard(args.name, args.description, args.workspace_id, args.with_default_lists),
  ),
  def(
    "update_board",
    "Rename a board, change its description, or open/close (archive) it.",
    z.object({
      board_id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      archived: z.boolean().optional(),
    }),
    async (args, trello) =>
      trello.updateBoard(args.board_id, {
        name: args.name,
        desc: args.description,
        closed: mapDefined(args.archived, String),
      }),
  ),
  def(
    "delete_board",
    "Permanently delete a board. Irreversible — confirm with the user first.",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.deleteBoard(args.board_id),
  ),
  def(
    "create_list",
    "Create a new list (column) on a board. Position can be 'top', 'bottom', or a numeric string.",
    z.object({
      board_id: z.string(),
      name: z.string(),
      position: z.string().optional(),
    }),
    async (args, trello) => trello.createList(args.board_id, args.name, args.position),
  ),
  def(
    "update_list",
    "Rename a list, change its position, archive/restore it, or move it to a different board.",
    z.object({
      list_id: z.string(),
      name: z.string().optional(),
      position: z.string().optional(),
      archived: z.boolean().optional(),
      move_to_board_id: z.string().optional(),
    }),
    async (args, trello) =>
      trello.updateList(args.list_id, {
        name: args.name,
        pos: args.position,
        closed: mapDefined(args.archived, String),
        idBoard: args.move_to_board_id,
      }),
  ),
  def(
    "archive_all_cards_in_list",
    "Archive every card in a list (the list itself stays).",
    z.object({ list_id: z.string() }),
    async (args, trello) => trello.archiveAllCardsInList(args.list_id),
  ),
  def(
    "move_all_cards_in_list",
    "Move every card from one list to another (same or different board).",
    z.object({
      source_list_id: z.string(),
      dest_list_id: z.string(),
      dest_board_id: z.string(),
    }),
    async (args, trello) => trello.moveAllCardsInList(args.source_list_id, args.dest_list_id, args.dest_board_id),
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
    async (args, trello) => trello.copyCard(args.source_card_id, args.dest_list_id, args.name, args.keep),
  ),
  def(
    "delete_card",
    "Permanently delete a card. Irreversible — confirm with the user first; usually `update_card archived:true` is what you want.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.deleteCard(args.card_id),
  ),
  def(
    "set_card_position",
    "Reorder a card within its list. Position is 'top', 'bottom', or a numeric string.",
    z.object({ card_id: z.string(), position: z.string() }),
    async (args, trello) => trello.setCardPosition(args.card_id, args.position),
  ),
  def(
    "list_card_actions",
    "List the activity history of a card (creates, moves, comments, etc.).",
    z.object({
      card_id: z.string(),
      limit: z.number().int().min(1).max(50).optional(),
      filter: z.string().optional().describe("Trello action-type filter, e.g. 'commentCard' or 'updateCard'"),
    }),
    async (args, trello) => trello.listCardActions(args.card_id, args.limit, args.filter),
  ),
  def(
    "list_card_comments",
    "List the comments on a card.",
    z.object({ card_id: z.string(), limit: z.number().int().min(1).max(50).optional() }),
    async (args, trello) => trello.listCardComments(args.card_id, args.limit),
  ),
  def(
    "update_comment",
    "Edit the text of an existing comment.",
    z.object({ card_id: z.string(), action_id: z.string(), text: z.string() }),
    async (args, trello) => trello.updateComment(args.card_id, args.action_id, args.text),
  ),
  def(
    "delete_comment",
    "Delete a comment from a card.",
    z.object({ card_id: z.string(), action_id: z.string() }),
    async (args, trello) => trello.deleteComment(args.card_id, args.action_id),
  ),
  def(
    "list_attachments",
    "List the attachments (files and URLs) on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.listAttachments(args.card_id),
  ),
  def(
    "add_attachment_url",
    "Attach a URL to a card.",
    z.object({ card_id: z.string(), url: z.string(), name: z.string().optional() }),
    async (args, trello) => trello.addAttachmentUrl(args.card_id, args.url, args.name),
  ),
  def(
    "delete_attachment",
    "Remove an attachment from a card.",
    z.object({ card_id: z.string(), attachment_id: z.string() }),
    async (args, trello) => trello.deleteAttachment(args.card_id, args.attachment_id),
  ),
  def(
    "search_members",
    "Search for Trello users by partial username, email, or full name.",
    z.object({ query: z.string(), limit: z.number().int().min(1).max(20).optional() }),
    async (args, trello) => trello.searchMembers(args.query, args.limit),
  ),
  def(
    "list_workspaces",
    "List the Trello workspaces (organizations) the user belongs to.",
    z.object({}),
    async (_args, trello) => trello.listWorkspaces(),
  ),
  def(
    "list_workspace_boards",
    "List the boards inside a workspace.",
    z.object({ workspace_id: z.string() }),
    async (args, trello) => trello.listWorkspaceBoards(args.workspace_id),
  ),
  def(
    "list_notifications",
    "List the user's Trello notifications.",
    z.object({
      unread_only: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    async (args, trello) => trello.listNotifications({ unreadOnly: args.unread_only, limit: args.limit }),
  ),
  def(
    "mark_notification_read",
    "Mark a single notification as read.",
    z.object({ notification_id: z.string() }),
    async (args, trello) => trello.markNotificationRead(args.notification_id),
  ),
  def(
    "mark_all_notifications_read",
    "Mark every notification as read.",
    z.object({}),
    async (_args, trello) => trello.markAllNotificationsRead(),
  ),
  def(
    "find_card",
    "Resolve a card from a Trello URL, short link, or id. Accepts what a user typically pastes from the browser.",
    z.object({ id_or_url: z.string() }),
    async (args, trello) => {
      const ref = parseCardRef(args.id_or_url);
      if (!ref) throw new Error(`Couldn't parse "${args.id_or_url}" as a Trello card URL, short link, or id.`);
      return trello.findCardByUrlOrId(ref);
    },
  ),
  def(
    "list_my_cards",
    "List cards assigned to the authenticated user across all boards.",
    z.object({
      filter: z.enum(["all", "open", "closed", "visible"]).optional(),
    }),
    async (args, trello) => trello.listMyCards(args.filter ?? "open"),
  ),
  def(
    "list_cards_due_soon",
    "List the user's open cards due within the next N hours (default 48). Excludes already-completed dues.",
    z.object({ hours: z.number().int().min(1).max(720).optional() }),
    async (args, trello) => {
      const horizonMs = (args.hours ?? 48) * 3600_000;
      return filterOpenDues(await trello.listMyCards("open"), (due, now) => due >= now && due - now <= horizonMs);
    },
  ),
  def(
    "list_overdue_cards",
    "List the user's open cards whose due date has passed and which are not marked complete.",
    z.object({}),
    async (_args, trello) => filterOpenDues(await trello.listMyCards("open"), (due, now) => due < now),
  ),
  def(
    "list_cards_by_member_on_board",
    "List cards on a board assigned to a specific member.",
    z.object({ board_id: z.string(), member_id: z.string() }),
    async (args, trello) => trello.listCardsByMemberOnBoard(args.board_id, args.member_id),
  ),
  def(
    "list_cards_by_label",
    "List cards on a board or list that carry a given label id.",
    z.object({
      label_id: z.string(),
      board_id: z.string().optional(),
      list_id: z.string().optional(),
    }),
    async (args, trello) => trello.listCardsByLabel({ board_id: args.board_id, list_id: args.list_id }, args.label_id),
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
    async (args, trello) => trello.setCardCover(args.card_id, coverToTrello(args.cover)),
  ),
  def(
    "vote_on_card",
    "Vote yes on a card as the authenticated user.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.voteOnCard(args.card_id),
  ),
  def(
    "unvote_card",
    "Remove the authenticated user's vote from a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.unvoteCard(args.card_id),
  ),
  def(
    "list_card_voters",
    "List members who voted on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.listCardVoters(args.card_id),
  ),
  def(
    "update_label",
    "Rename or recolor an existing board label.",
    z.object({
      label_id: z.string(),
      name: z.string().optional(),
      color: colorEnum.nullable().optional(),
    }),
    async (args, trello) =>
      trello.updateLabel(args.label_id, { name: args.name, color: mapDefined(args.color, (c) => c ?? "") }),
  ),
  def(
    "delete_label",
    "Delete a board label. Removes it from every card it was on.",
    z.object({ label_id: z.string() }),
    async (args, trello) => trello.deleteLabel(args.label_id),
  ),
  def(
    "update_checklist",
    "Rename or reposition a checklist.",
    z.object({
      checklist_id: z.string(),
      name: z.string().optional(),
      position: z.string().optional().describe("'top', 'bottom', or numeric"),
    }),
    async (args, trello) => trello.updateChecklist(args.checklist_id, { name: args.name, pos: args.position }),
  ),
  def(
    "update_checklist_item",
    "Edit a checklist item: rename, reposition, set due, assign a member, or set state.",
    z.object({
      card_id: z.string(),
      check_item_id: z.string(),
      name: z.string().optional(),
      position: z.string().optional(),
      due: z.string().optional().describe("ISO 8601 due, or empty string to clear"),
      member_id: z.string().optional(),
      complete: z.boolean().optional(),
    }),
    async (args, trello) =>
      trello.updateChecklistItem(args.card_id, args.check_item_id, {
        name: args.name,
        pos: args.position,
        due: args.due,
        idMember: args.member_id,
        state: args.complete === undefined ? undefined : args.complete ? "complete" : "incomplete",
      }),
  ),
  def(
    "delete_checklist_item",
    "Remove a single item from a checklist.",
    z.object({ checklist_id: z.string(), check_item_id: z.string() }),
    async (args, trello) => trello.deleteChecklistItem(args.checklist_id, args.check_item_id),
  ),
  def(
    "list_starred_boards",
    "List the boards the authenticated user has starred.",
    z.object({}),
    async (_args, trello) => trello.listStarredBoards(),
  ),
  def(
    "star_board",
    "Star (pin) a board for the authenticated user.",
    z.object({
      board_id: z.string(),
      position: z.string().optional().describe("'top', 'bottom', or numeric. Default 'bottom'."),
    }),
    async (args, trello) => trello.starBoard(args.board_id, args.position),
  ),
  def(
    "unstar_board",
    "Remove a board star (use the boardStar id returned by list_starred_boards).",
    z.object({ board_star_id: z.string() }),
    async (args, trello) => trello.unstarBoard(args.board_star_id),
  ),
  def(
    "list_board_custom_fields",
    "List the custom field definitions on a board.",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.listBoardCustomFields(args.board_id),
  ),
  def(
    "list_card_custom_field_values",
    "List the custom field values set on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.listCardCustomFieldValues(args.card_id),
  ),
];

function zodToJsonSchema(schema: z.ZodTypeAny): ToolDef["inputSchema"] {
  if (!(schema instanceof z.ZodObject)) {
    return { type: "object", properties: {} };
  }
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodFieldToJson(value);
    if (!value.isOptional()) required.push(key);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

function zodFieldToJson(field: z.ZodTypeAny): Record<string, unknown> {
  const description = field.description;
  let inner = field;
  while (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) {
    inner = inner._def.innerType;
  }
  const base: Record<string, unknown> = description ? { description } : {};
  if (inner instanceof z.ZodString) return { ...base, type: "string" };
  if (inner instanceof z.ZodNumber) return { ...base, type: "number" };
  if (inner instanceof z.ZodBoolean) return { ...base, type: "boolean" };
  if (inner instanceof z.ZodArray) return { ...base, type: "array", items: zodFieldToJson(inner.element) };
  if (inner instanceof z.ZodEnum) return { ...base, type: "string", enum: inner.options };
  if (inner instanceof z.ZodObject) return { ...base, ...zodToJsonSchema(inner) };
  if (inner instanceof z.ZodLiteral) {
    const value = inner.value;
    const type = typeof value === "string" ? "string" : typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
    return { ...base, type, const: value };
  }
  if (inner instanceof z.ZodUnion) {
    const options = (inner._def.options as z.ZodTypeAny[]).map(zodFieldToJson);
    return { ...base, oneOf: options };
  }
  return { ...base, type: "string" };
}
