import type { TrelloHttp } from "./http.js";
import type { TrelloAction, TrelloCard, TrelloColor, TrelloMember } from "./types.js";

export type CardCover =
  | { color: TrelloColor | null; brightness?: "light" | "dark"; size?: "normal" | "full" }
  | { idAttachment: string; brightness?: "light" | "dark"; size?: "normal" | "full" }
  | "none";

export type CardUpdate = {
  [k: string]: string | undefined;
  name?: string;
  desc?: string;
  due?: string;
  start?: string;
  dueComplete?: string;
  dueReminder?: string;
  closed?: string;
};

export class CardsApi {
  constructor(private readonly http: TrelloHttp) {}

  inList(listId: string) {
    return this.http.request<TrelloCard[]>("GET", `/lists/${listId}/cards`, {
      fields: "id,name,desc,url,due,idList,idMembers,labels",
    });
  }

  onBoard(boardId: string) {
    return this.http.request<TrelloCard[]>("GET", `/boards/${boardId}/cards`, {
      fields: "id,name,url,due,start,dueComplete,idList,idMembers,labels",
    });
  }

  get(cardId: string) {
    return this.http.request<TrelloCard>("GET", `/cards/${cardId}`, {
      fields: "id,name,desc,url,due,idList,idBoard,idMembers,labels",
    });
  }

  findByRef(idOrShortLink: string) {
    return this.http.request<TrelloCard>("GET", `/cards/${idOrShortLink}`, {
      fields: "id,name,desc,url,due,start,idList,idBoard,idMembers,labels,shortLink",
    });
  }

  create(
    listId: string,
    name: string,
    desc?: string,
    due?: string,
    pos?: string,
    idMembers?: string[],
    idLabels?: string[],
  ) {
    return this.http.request<TrelloCard>("POST", "/cards", {
      idList: listId,
      name,
      desc,
      due,
      pos,
      idMembers: idMembers?.length ? idMembers.join(",") : undefined,
      idLabels: idLabels?.length ? idLabels.join(",") : undefined,
    });
  }

  update(cardId: string, fields: CardUpdate) {
    return this.http.request<TrelloCard>("PUT", `/cards/${cardId}`, fields);
  }

  move(cardId: string, listId: string) {
    return this.http.request<TrelloCard>("PUT", `/cards/${cardId}`, { idList: listId });
  }

  copy(sourceCardId: string, destListId: string, name?: string, keep?: string[]) {
    return this.http.request<TrelloCard>("POST", "/cards", {
      idCardSource: sourceCardId,
      idList: destListId,
      name,
      keepFromSource: keep?.length ? keep.join(",") : "all",
    });
  }

  delete(cardId: string) {
    return this.http.request<unknown>("DELETE", `/cards/${cardId}`);
  }

  setPosition(cardId: string, pos: string) {
    return this.http.request<TrelloCard>("PUT", `/cards/${cardId}`, { pos });
  }

  setCover(cardId: string, cover: CardCover) {
    const value = cover === "none" ? { color: null, idAttachment: null, idUploadedBackground: null } : cover;
    return this.http.request<TrelloCard>("PUT", `/cards/${cardId}`, { cover: JSON.stringify(value) });
  }

  byMemberOnBoard(boardId: string, memberId: string) {
    return this.http.request<TrelloCard[]>("GET", `/boards/${boardId}/members/${memberId}/cards`, {
      fields: "id,name,url,due,start,dueComplete,idList,idMembers,labels",
    });
  }

  mine(filter: "all" | "open" | "closed" | "visible" = "open") {
    return this.http.request<TrelloCard[]>("GET", "/members/me/cards", {
      filter,
      fields: "id,name,url,due,start,dueComplete,idList,idBoard,idMembers,labels",
    });
  }

  async byLabel(scope: { board_id?: string; list_id?: string }, labelId: string): Promise<TrelloCard[]> {
    const cards = scope.list_id
      ? await this.inList(scope.list_id)
      : scope.board_id
        ? await this.onBoard(scope.board_id)
        : [];
    return cards.filter((c) => c.labels?.some((l) => l.id === labelId));
  }

  search(query: string, limit = 10) {
    return this.http.request<{ cards: TrelloCard[] }>("GET", "/search", {
      query,
      modelTypes: "cards",
      cards_limit: String(limit),
      card_fields: "id,name,desc,url,idList,idBoard",
    });
  }

  actions(cardId: string, limit = 20, filter = "all") {
    return this.http.request<TrelloAction[]>("GET", `/cards/${cardId}/actions`, {
      filter,
      limit: String(limit),
    });
  }

  vote(cardId: string, memberId = "me") {
    return this.http.request<unknown>("POST", `/cards/${cardId}/membersVoted`, { value: memberId });
  }

  unvote(cardId: string, memberId = "me") {
    return this.http.request<unknown>("DELETE", `/cards/${cardId}/membersVoted/${memberId}`);
  }

  voters(cardId: string) {
    return this.http.request<TrelloMember[]>("GET", `/cards/${cardId}/membersVoted`, {
      fields: "id,username,fullName",
    });
  }
}
