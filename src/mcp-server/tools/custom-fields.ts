import { z } from "zod";
import { def, type ToolDef } from "./helpers.js";

export const customFieldTools: ToolDef[] = [
  def(
    "list_board_custom_fields",
    "List the custom field definitions on a board.",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.customFields.onBoard(args.board_id),
  ),
  def(
    "list_card_custom_field_values",
    "List the custom field values set on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.customFields.valuesOnCard(args.card_id),
  ),
];
