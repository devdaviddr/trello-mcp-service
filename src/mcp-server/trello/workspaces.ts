import type { TrelloHttp } from "./http.js";
import type { TrelloBoard, TrelloBoardStar, TrelloOrganization } from "./types.js";

export class WorkspacesApi {
  constructor(private readonly http: TrelloHttp) {}

  list() {
    return this.http.request<TrelloOrganization[]>("GET", "/members/me/organizations", {
      fields: "id,name,displayName,desc,url",
    });
  }

  boardsIn(orgId: string) {
    return this.http.request<TrelloBoard[]>("GET", `/organizations/${orgId}/boards`, {
      fields: "id,name,url,closed",
    });
  }

  starred() {
    return this.http.request<TrelloBoardStar[]>("GET", "/members/me/boardStars");
  }

  star(boardId: string, pos = "bottom") {
    return this.http.request<TrelloBoardStar>("POST", "/members/me/boardStars", { idBoard: boardId, pos });
  }

  unstar(boardStarId: string) {
    return this.http.request<unknown>("DELETE", `/members/me/boardStars/${boardStarId}`);
  }
}
