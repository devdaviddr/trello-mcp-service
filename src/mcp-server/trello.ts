const BASE = "https://api.trello.com/1";
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class TrelloClient {
  constructor(private readonly key: string, private readonly token: string) {}

  private auth(params: Record<string, string | undefined> = {}): string {
    const merged: Record<string, string> = { key: this.key, token: this.token };
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) merged[k] = v;
    }
    return new URLSearchParams(merged).toString();
  }

  private async request<T>(method: string, path: string, params: Record<string, string | undefined> = {}): Promise<T> {
    const url = `${BASE}${path}?${this.auth(params)}`;
    let lastBody = "";
    let lastStatus = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(url, { method });
      if (res.ok) {
        const text = await res.text();
        return text ? (JSON.parse(text) as T) : (undefined as T);
      }
      lastStatus = res.status;
      lastBody = await res.text();
      if (!RETRY_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.random() * 250;
      await sleep(backoff);
    }
    throw new Error(`Trello ${method} ${path} failed: ${lastStatus} ${lastBody}`);
  }

  getMe() {
    return this.request<TrelloMember & { email?: string; idOrganizations: string[] }>("GET", "/members/me", {
      fields: "id,username,fullName,email,idOrganizations",
    });
  }

  listBoards() {
    return this.request<TrelloBoard[]>("GET", "/members/me/boards", { fields: "id,name,url,closed,idOrganization" });
  }

  getBoard(
    boardId: string,
    opts: { lists?: "all" | "open" | "closed" | "none"; labels?: boolean; members?: boolean; cards?: "none" | "open" | "all" } = {},
  ) {
    return this.request<TrelloBoardDetail>("GET", `/boards/${boardId}`, {
      fields: "id,name,desc,url,closed,idOrganization,prefs",
      lists: opts.lists ?? "open",
      labels: opts.labels ? "all" : undefined,
      members: opts.members ? "all" : undefined,
      cards: opts.cards ?? "none",
      list_fields: "id,name,closed,pos",
      label_fields: "id,name,color",
      member_fields: "id,username,fullName",
      card_fields: "id,name,idList,url,due,start,idMembers,labels",
    });
  }

  createBoard(name: string, desc?: string, idOrganization?: string, defaultLists?: boolean) {
    return this.request<TrelloBoard>("POST", "/boards/", {
      name,
      desc,
      idOrganization,
      defaultLists: defaultLists === undefined ? undefined : String(defaultLists),
    });
  }

  updateBoard(boardId: string, fields: { name?: string; desc?: string; closed?: string }) {
    return this.request<TrelloBoard>("PUT", `/boards/${boardId}`, fields);
  }

  deleteBoard(boardId: string) {
    return this.request<unknown>("DELETE", `/boards/${boardId}`);
  }

  listLists(boardId: string) {
    return this.request<TrelloList[]>("GET", `/boards/${boardId}/lists`, { fields: "id,name,closed,pos" });
  }

  createList(boardId: string, name: string, pos?: string) {
    return this.request<TrelloList>("POST", "/lists", { idBoard: boardId, name, pos });
  }

  updateList(listId: string, fields: { name?: string; pos?: string; closed?: string; idBoard?: string }) {
    return this.request<TrelloList>("PUT", `/lists/${listId}`, fields);
  }

  archiveAllCardsInList(listId: string) {
    return this.request<unknown>("POST", `/lists/${listId}/archiveAllCards`);
  }

  moveAllCardsInList(listId: string, destListId: string, destBoardId: string) {
    return this.request<unknown>("POST", `/lists/${listId}/moveAllCards`, {
      idBoard: destBoardId,
      idList: destListId,
    });
  }

  listCards(listId: string) {
    return this.request<TrelloCard[]>("GET", `/lists/${listId}/cards`, { fields: "id,name,desc,url,due,idList,idMembers,labels" });
  }

  getCard(cardId: string) {
    return this.request<TrelloCard>("GET", `/cards/${cardId}`, { fields: "id,name,desc,url,due,idList,idBoard,idMembers,labels" });
  }

  createCard(listId: string, name: string, desc?: string, due?: string, pos?: string, idMembers?: string[], idLabels?: string[]) {
    return this.request<TrelloCard>("POST", "/cards", {
      idList: listId,
      name,
      desc,
      due,
      pos,
      idMembers: idMembers?.length ? idMembers.join(",") : undefined,
      idLabels: idLabels?.length ? idLabels.join(",") : undefined,
    });
  }

  copyCard(sourceCardId: string, destListId: string, name?: string, keep?: string[]) {
    return this.request<TrelloCard>("POST", "/cards", {
      idCardSource: sourceCardId,
      idList: destListId,
      name,
      keepFromSource: keep?.length ? keep.join(",") : "all",
    });
  }

  deleteCard(cardId: string) {
    return this.request<unknown>("DELETE", `/cards/${cardId}`);
  }

  setCardPosition(cardId: string, pos: string) {
    return this.request<TrelloCard>("PUT", `/cards/${cardId}`, { pos });
  }

  listCardActions(cardId: string, limit = 20, filter = "all") {
    return this.request<TrelloAction[]>("GET", `/cards/${cardId}/actions`, {
      filter,
      limit: String(limit),
    });
  }

  listCardComments(cardId: string, limit = 20) {
    return this.request<TrelloAction[]>("GET", `/cards/${cardId}/actions`, {
      filter: "commentCard",
      limit: String(limit),
    });
  }

  updateComment(cardId: string, actionId: string, text: string) {
    return this.request<TrelloAction>("PUT", `/cards/${cardId}/actions/${actionId}/comments`, { text });
  }

  deleteComment(cardId: string, actionId: string) {
    return this.request<unknown>("DELETE", `/cards/${cardId}/actions/${actionId}/comments`);
  }

  listAttachments(cardId: string) {
    return this.request<TrelloAttachment[]>("GET", `/cards/${cardId}/attachments`);
  }

  addAttachmentUrl(cardId: string, url: string, name?: string) {
    return this.request<TrelloAttachment>("POST", `/cards/${cardId}/attachments`, { url, name });
  }

  deleteAttachment(cardId: string, attachmentId: string) {
    return this.request<unknown>("DELETE", `/cards/${cardId}/attachments/${attachmentId}`);
  }

  moveCard(cardId: string, listId: string) {
    return this.request<TrelloCard>("PUT", `/cards/${cardId}`, { idList: listId });
  }

  updateCard(
    cardId: string,
    fields: {
      name?: string;
      desc?: string;
      due?: string;
      start?: string;
      dueComplete?: string;
      dueReminder?: string;
      closed?: string;
    },
  ) {
    return this.request<TrelloCard>("PUT", `/cards/${cardId}`, fields);
  }

  addComment(cardId: string, text: string) {
    return this.request<unknown>("POST", `/cards/${cardId}/actions/comments`, { text });
  }

  searchCards(query: string, limit = 10) {
    return this.request<{ cards: TrelloCard[] }>("GET", "/search", {
      query,
      modelTypes: "cards",
      cards_limit: String(limit),
      card_fields: "id,name,desc,url,idList,idBoard",
    });
  }

  listChecklists(cardId: string) {
    return this.request<TrelloChecklist[]>("GET", `/cards/${cardId}/checklists`, {
      fields: "id,name,idCard",
      checkItem_fields: "id,name,state,pos",
    });
  }

  async createChecklist(cardId: string, name: string, items?: string[]) {
    const checklist = await this.request<TrelloChecklist>("POST", "/checklists", { idCard: cardId, name });
    if (items?.length) {
      for (const item of items) {
        await this.addChecklistItem(checklist.id, item);
      }
    }
    return this.request<TrelloChecklist>("GET", `/checklists/${checklist.id}`, {
      fields: "id,name,idCard",
      checkItem_fields: "id,name,state,pos",
    });
  }

  addChecklistItem(checklistId: string, name: string, checked = false) {
    return this.request<TrelloCheckItem>("POST", `/checklists/${checklistId}/checkItems`, {
      name,
      checked: String(checked),
    });
  }

  setChecklistItemState(cardId: string, checkItemId: string, checked: boolean) {
    return this.request<TrelloCheckItem>("PUT", `/cards/${cardId}/checkItem/${checkItemId}`, {
      state: checked ? "complete" : "incomplete",
    });
  }

  deleteChecklist(checklistId: string) {
    return this.request<unknown>("DELETE", `/checklists/${checklistId}`);
  }

  listBoardLabels(boardId: string) {
    return this.request<TrelloLabel[]>("GET", `/boards/${boardId}/labels`, { fields: "id,name,color,idBoard" });
  }

  createLabel(boardId: string, name: string, color: TrelloColor | null) {
    return this.request<TrelloLabel>("POST", "/labels", {
      idBoard: boardId,
      name,
      color: color ?? "",
    });
  }

  addLabelToCard(cardId: string, labelId: string) {
    return this.request<unknown>("POST", `/cards/${cardId}/idLabels`, { value: labelId });
  }

  removeLabelFromCard(cardId: string, labelId: string) {
    return this.request<unknown>("DELETE", `/cards/${cardId}/idLabels/${labelId}`);
  }

  listBoardMembers(boardId: string) {
    return this.request<TrelloMember[]>("GET", `/boards/${boardId}/members`, { fields: "id,username,fullName" });
  }

  assignMemberToCard(cardId: string, memberId: string) {
    return this.request<unknown>("POST", `/cards/${cardId}/idMembers`, { value: memberId });
  }

  unassignMemberFromCard(cardId: string, memberId: string) {
    return this.request<unknown>("DELETE", `/cards/${cardId}/idMembers/${memberId}`);
  }

  searchMembers(query: string, limit = 8) {
    return this.request<TrelloMember[]>("GET", "/search/members/", {
      query,
      limit: String(limit),
    });
  }

  listWorkspaces() {
    return this.request<TrelloOrganization[]>("GET", "/members/me/organizations", {
      fields: "id,name,displayName,desc,url",
    });
  }

  listWorkspaceBoards(orgId: string) {
    return this.request<TrelloBoard[]>("GET", `/organizations/${orgId}/boards`, {
      fields: "id,name,url,closed",
    });
  }

  listNotifications(opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.request<TrelloNotification[]>("GET", "/members/me/notifications", {
      read_filter: opts.unreadOnly ? "unread" : "all",
      limit: String(opts.limit ?? 20),
    });
  }

  markNotificationRead(notificationId: string) {
    return this.request<TrelloNotification>("PUT", `/notifications/${notificationId}`, { unread: "false" });
  }

  markAllNotificationsRead() {
    return this.request<unknown>("POST", "/notifications/all/read");
  }

  findCardByUrlOrId(idOrShortLink: string) {
    return this.request<TrelloCard>("GET", `/cards/${idOrShortLink}`, {
      fields: "id,name,desc,url,due,start,idList,idBoard,idMembers,labels,shortLink",
    });
  }

  listMyCards(filter: "all" | "open" | "closed" | "visible" = "open") {
    return this.request<TrelloCard[]>("GET", "/members/me/cards", {
      filter,
      fields: "id,name,url,due,start,dueComplete,idList,idBoard,idMembers,labels",
    });
  }

  listCardsOnBoard(boardId: string) {
    return this.request<TrelloCard[]>("GET", `/boards/${boardId}/cards`, {
      fields: "id,name,url,due,start,dueComplete,idList,idMembers,labels",
    });
  }

  listCardsByMemberOnBoard(boardId: string, memberId: string) {
    return this.request<TrelloCard[]>("GET", `/boards/${boardId}/members/${memberId}/cards`, {
      fields: "id,name,url,due,start,dueComplete,idList,idMembers,labels",
    });
  }

  async listCardsByLabel(scope: { board_id?: string; list_id?: string }, labelId: string) {
    const cards = scope.list_id
      ? await this.listCards(scope.list_id)
      : scope.board_id
        ? await this.listCardsOnBoard(scope.board_id)
        : [];
    return cards.filter((c) => c.labels?.some((l) => l.id === labelId));
  }

  setCardCover(
    cardId: string,
    cover:
      | { color: TrelloColor | null; brightness?: "light" | "dark"; size?: "normal" | "full" }
      | { idAttachment: string; brightness?: "light" | "dark"; size?: "normal" | "full" }
      | "none",
  ) {
    const value =
      cover === "none"
        ? { color: null, idAttachment: null, idUploadedBackground: null }
        : cover;
    return this.request<TrelloCard>("PUT", `/cards/${cardId}`, {
      cover: JSON.stringify(value),
    });
  }

  voteOnCard(cardId: string, memberId = "me") {
    return this.request<unknown>("POST", `/cards/${cardId}/membersVoted`, { value: memberId });
  }

  unvoteCard(cardId: string, memberId = "me") {
    return this.request<unknown>("DELETE", `/cards/${cardId}/membersVoted/${memberId}`);
  }

  listCardVoters(cardId: string) {
    return this.request<TrelloMember[]>("GET", `/cards/${cardId}/membersVoted`, {
      fields: "id,username,fullName",
    });
  }

  updateLabel(labelId: string, fields: { name?: string; color?: string }) {
    return this.request<TrelloLabel>("PUT", `/labels/${labelId}`, fields);
  }

  deleteLabel(labelId: string) {
    return this.request<unknown>("DELETE", `/labels/${labelId}`);
  }

  updateChecklist(checklistId: string, fields: { name?: string; pos?: string }) {
    return this.request<TrelloChecklist>("PUT", `/checklists/${checklistId}`, fields);
  }

  updateChecklistItem(
    cardId: string,
    checkItemId: string,
    fields: { name?: string; pos?: string; due?: string; idMember?: string; state?: "complete" | "incomplete" },
  ) {
    return this.request<TrelloCheckItem>("PUT", `/cards/${cardId}/checkItem/${checkItemId}`, fields);
  }

  deleteChecklistItem(checklistId: string, checkItemId: string) {
    return this.request<unknown>("DELETE", `/checklists/${checklistId}/checkItems/${checkItemId}`);
  }

  listStarredBoards() {
    return this.request<TrelloBoardStar[]>("GET", "/members/me/boardStars");
  }

  starBoard(boardId: string, pos = "bottom") {
    return this.request<TrelloBoardStar>("POST", "/members/me/boardStars", { idBoard: boardId, pos });
  }

  unstarBoard(boardStarId: string) {
    return this.request<unknown>("DELETE", `/members/me/boardStars/${boardStarId}`);
  }

  listBoardCustomFields(boardId: string) {
    return this.request<TrelloCustomField[]>("GET", `/boards/${boardId}/customFields`);
  }

  listCardCustomFieldValues(cardId: string) {
    return this.request<TrelloCustomFieldItem[]>("GET", `/cards/${cardId}/customFieldItems`);
  }
}

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

export type TrelloColor = (typeof TRELLO_COLORS)[number];

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
