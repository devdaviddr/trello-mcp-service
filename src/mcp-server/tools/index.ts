import { attachmentTools } from "./attachments.js";
import { boardTools } from "./boards.js";
import { cardTools } from "./cards.js";
import { checklistTools } from "./checklists.js";
import { commentTools } from "./comments.js";
import { customFieldTools } from "./custom-fields.js";
import { labelTools } from "./labels.js";
import { listTools } from "./lists.js";
import { memberTools } from "./members.js";
import { notificationTools } from "./notifications.js";
import { workspaceTools } from "./workspaces.js";

export type { ToolDef } from "./helpers.js";

export const tools = [
  ...boardTools,
  ...listTools,
  ...cardTools,
  ...commentTools,
  ...attachmentTools,
  ...checklistTools,
  ...labelTools,
  ...memberTools,
  ...workspaceTools,
  ...notificationTools,
  ...customFieldTools,
];
