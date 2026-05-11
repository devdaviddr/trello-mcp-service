import { z } from "zod";
import { def, mapDefined, type ToolDef } from "./helpers.js";

export const listTools: ToolDef[] = [
  def(
    "list_lists",
    "List the columns (lists) on a given board.",
    z.object({ board_id: z.string().describe("Trello board id") }),
    async (args, trello) => trello.lists.onBoard(args.board_id),
  ),
  def(
    "create_list",
    "Create a new list (column) on a board. Position can be 'top', 'bottom', or a numeric string.",
    z.object({
      board_id: z.string(),
      name: z.string(),
      position: z.string().optional(),
    }),
    async (args, trello) => trello.lists.create(args.board_id, args.name, args.position),
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
      trello.lists.update(args.list_id, {
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
    async (args, trello) => trello.lists.archiveAllCards(args.list_id),
  ),
  def(
    "move_all_cards_in_list",
    "Move every card from one list to another (same or different board).",
    z.object({
      source_list_id: z.string(),
      dest_list_id: z.string(),
      dest_board_id: z.string(),
    }),
    async (args, trello) => trello.lists.moveAllCards(args.source_list_id, args.dest_list_id, args.dest_board_id),
  ),
];
