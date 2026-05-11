import { z } from "zod";
import { TRELLO_COLORS } from "../trello/index.js";
import { colorEnum, def, mapDefined, type ToolDef } from "./helpers.js";

export const labelTools: ToolDef[] = [
  def(
    "list_board_labels",
    "List the labels defined on a board.",
    z.object({ board_id: z.string() }),
    async (args, trello) => trello.labels.onBoard(args.board_id),
  ),
  def(
    "create_label",
    `Create a new label on a board. Color is one of ${TRELLO_COLORS.join(",")} — or null for no color.`,
    z.object({
      board_id: z.string(),
      name: z.string(),
      color: colorEnum.nullable().optional(),
    }),
    async (args, trello) => trello.labels.create(args.board_id, args.name, args.color ?? null),
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
      trello.labels.update(args.label_id, { name: args.name, color: mapDefined(args.color, (c) => c ?? "") }),
  ),
  def(
    "delete_label",
    "Delete a board label. Removes it from every card it was on.",
    z.object({ label_id: z.string() }),
    async (args, trello) => trello.labels.delete(args.label_id),
  ),
  def(
    "add_label_to_card",
    "Attach an existing label (by label id) to a card.",
    z.object({ card_id: z.string(), label_id: z.string() }),
    async (args, trello) => trello.labels.attachToCard(args.card_id, args.label_id),
  ),
  def(
    "remove_label_from_card",
    "Detach a label from a card.",
    z.object({ card_id: z.string(), label_id: z.string() }),
    async (args, trello) => trello.labels.detachFromCard(args.card_id, args.label_id),
  ),
];
