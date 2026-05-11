import { z } from "zod";
import { def, type ToolDef } from "./helpers.js";

export const checklistTools: ToolDef[] = [
  def(
    "list_checklists",
    "List checklists (with their items) on a card.",
    z.object({ card_id: z.string() }),
    async (args, trello) => trello.checklists.onCard(args.card_id),
  ),
  def(
    "create_checklist",
    "Create a checklist on a card. Optionally seed it with items.",
    z.object({
      card_id: z.string(),
      name: z.string(),
      items: z.array(z.string()).optional().describe("Initial check-item names, added in order"),
    }),
    async (args, trello) => trello.checklists.create(args.card_id, args.name, args.items),
  ),
  def(
    "update_checklist",
    "Rename or reposition a checklist.",
    z.object({
      checklist_id: z.string(),
      name: z.string().optional(),
      position: z.string().optional().describe("'top', 'bottom', or numeric"),
    }),
    async (args, trello) => trello.checklists.update(args.checklist_id, { name: args.name, pos: args.position }),
  ),
  def(
    "delete_checklist",
    "Delete an entire checklist from its card.",
    z.object({ checklist_id: z.string() }),
    async (args, trello) => trello.checklists.delete(args.checklist_id),
  ),
  def(
    "add_checklist_item",
    "Add an item to an existing checklist.",
    z.object({ checklist_id: z.string(), name: z.string() }),
    async (args, trello) => trello.checklists.addItem(args.checklist_id, args.name),
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
      trello.checklists.updateItem(args.card_id, args.check_item_id, {
        name: args.name,
        pos: args.position,
        due: args.due,
        idMember: args.member_id,
        state: args.complete === undefined ? undefined : args.complete ? "complete" : "incomplete",
      }),
  ),
  def(
    "set_checklist_item_state",
    "Mark a checklist item as complete or incomplete.",
    z.object({ card_id: z.string(), check_item_id: z.string(), complete: z.boolean() }),
    async (args, trello) => trello.checklists.setItemState(args.card_id, args.check_item_id, args.complete),
  ),
  def(
    "delete_checklist_item",
    "Remove a single item from a checklist.",
    z.object({ checklist_id: z.string(), check_item_id: z.string() }),
    async (args, trello) => trello.checklists.deleteItem(args.checklist_id, args.check_item_id),
  ),
];
