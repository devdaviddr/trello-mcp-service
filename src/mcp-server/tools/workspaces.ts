import { z } from "zod";
import { def, type ToolDef } from "./helpers.js";

export const workspaceTools: ToolDef[] = [
  def(
    "list_workspaces",
    "List the Trello workspaces (organizations) the user belongs to.",
    z.object({}),
    async (_args, trello) => trello.workspaces.list(),
  ),
  def(
    "list_workspace_boards",
    "List the boards inside a workspace.",
    z.object({ workspace_id: z.string() }),
    async (args, trello) => trello.workspaces.boardsIn(args.workspace_id),
  ),
  def(
    "list_starred_boards",
    "List the boards the authenticated user has starred.",
    z.object({}),
    async (_args, trello) => trello.workspaces.starred(),
  ),
  def(
    "star_board",
    "Star (pin) a board for the authenticated user.",
    z.object({
      board_id: z.string(),
      position: z.string().optional().describe("'top', 'bottom', or numeric. Default 'bottom'."),
    }),
    async (args, trello) => trello.workspaces.star(args.board_id, args.position),
  ),
  def(
    "unstar_board",
    "Remove a board star (use the boardStar id returned by list_starred_boards).",
    z.object({ board_star_id: z.string() }),
    async (args, trello) => trello.workspaces.unstar(args.board_star_id),
  ),
];
