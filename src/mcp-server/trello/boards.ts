import type { TrelloHttp } from "./http.js";
import type { TrelloBoard, TrelloBoardDetail } from "./types.js";

export interface GetBoardOptions {
  lists?: "all" | "open" | "closed" | "none";
  labels?: boolean;
  members?: boolean;
  cards?: "none" | "open" | "all";
}

export class BoardsApi {
  constructor(private readonly http: TrelloHttp) {}

  list() {
    return this.http.request<TrelloBoard[]>("GET", "/members/me/boards", {
      fields: "id,name,url,closed,idOrganization",
    });
  }

  get(boardId: string, opts: GetBoardOptions = {}) {
    return this.http.request<TrelloBoardDetail>("GET", `/boards/${boardId}`, {
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

  create(name: string, desc?: string, idOrganization?: string, defaultLists?: boolean) {
    return this.http.request<TrelloBoard>("POST", "/boards/", {
      name,
      desc,
      idOrganization,
      defaultLists: defaultLists === undefined ? undefined : String(defaultLists),
    });
  }

  update(boardId: string, fields: { name?: string; desc?: string; closed?: string }) {
    return this.http.request<TrelloBoard>("PUT", `/boards/${boardId}`, fields);
  }

  delete(boardId: string) {
    return this.http.request<unknown>("DELETE", `/boards/${boardId}`);
  }
}
