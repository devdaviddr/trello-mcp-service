export const TRELLO_COLORS = [
  "yellow",
  "purple",
  "blue",
  "red",
  "green",
  "orange",
  "black",
  "sky",
  "pink",
  "lime",
] as const;

export type TrelloColor = (typeof TRELLO_COLORS)[number];

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  closed: boolean;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  url: string;
  due: string | null;
  start?: string | null;
  dueComplete?: boolean;
  idList: string;
  idBoard?: string;
  idMembers: string[];
  labels: { id: string; name: string; color: string | null }[];
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
  idBoard: string;
}

export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
}

export interface TrelloCheckItem {
  id: string;
  name: string;
  state: "complete" | "incomplete";
  pos: number;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  idCard: string;
  checkItems?: TrelloCheckItem[];
}

export interface TrelloAction {
  id: string;
  type: string;
  date: string;
  data: Record<string, unknown>;
  memberCreator?: { id: string; username: string; fullName: string };
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  bytes: number | null;
  date: string;
  mimeType: string | null;
  isUpload: boolean;
}

export interface TrelloOrganization {
  id: string;
  name: string;
  displayName: string;
  desc: string;
  url: string;
}

export interface TrelloNotification {
  id: string;
  unread: boolean;
  type: string;
  date: string;
  data: Record<string, unknown>;
}

export interface TrelloBoardDetail extends TrelloBoard {
  desc?: string;
  idOrganization?: string;
  lists?: TrelloList[];
  labels?: TrelloLabel[];
  members?: TrelloMember[];
  cards?: TrelloCard[];
}

export interface TrelloBoardStar {
  id: string;
  idBoard: string;
  pos: number;
}

export interface TrelloCustomField {
  id: string;
  idModel: string;
  name: string;
  type: "checkbox" | "list" | "number" | "text" | "date";
  options?: { id: string; value: { text?: string } }[];
}

export interface TrelloCustomFieldItem {
  id: string;
  idCustomField: string;
  idModel: string;
  value?: { text?: string; number?: string; date?: string; checked?: string };
  idValue?: string;
}
