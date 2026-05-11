import { z } from "zod";
import { def, mapDefined, type ToolDef } from "./helpers.js";

export const boardTools: ToolDef[] = [
  def(
    "list_boards",
    "List all Trello boards the user has access to.",
    z.object({}),
    async (_args, trello) => trello.boards.list(),
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
      trello.boards.get(args.board_id, {
        lists: args.include_lists,
        labels: args.include_labels,
        members: args.include_members,
        cards: args.include_cards,
      }),
  ),
  def(
    "get_workspace_summary",
    "Cheap overview tool. With no board_id, returns the list of the user's open boards. With a board_id, returns that board with its lists, labels, and members in a single call — useful as a first step before more specific actions.",
    z.object({ board_id: z.string().optional() }),
    async (args, trello) => {
      if (args.board_id) {
        return trello.boards.get(args.board_id, { lists: "open", labels: true, members: true });
      }
      const boards = await trello.boards.list();
      return { boards: boards.filter((b) => !b.closed) };
    },
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
      trello.boards.create(args.name, args.description, args.workspace_id, args.with_default_lists),
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
      trello.boards.update(args.board_id, {
        name: args.name,
        desc: args.description,
        closed: mapDefined(args.archived, String),
      }),
  ),
  def(
    "delete_board",
    "Permanently delete a board. Irreversible — confirm with the user first.",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.boards.delete(args.board_id),
  ),
];
