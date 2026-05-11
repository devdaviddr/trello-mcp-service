import type { TrelloHttp } from "./http.js";
import type { TrelloMember } from "./types.js";

export type TrelloMe = TrelloMember & { email?: string; idOrganizations: string[] };

export class MembersApi {
  constructor(private readonly http: TrelloHttp) {}

  me() {
    return this.http.request<TrelloMe>("GET", "/members/me", {
      fields: "id,username,fullName,email,idOrganizations",
    });
  }

  onBoard(boardId: string) {
    return this.http.request<TrelloMember[]>("GET", `/boards/${boardId}/members`, {
      fields: "id,username,fullName",
    });
  }

  assignToCard(cardId: string, memberId: string) {
    return this.http.request<unknown>("POST", `/cards/${cardId}/idMembers`, { value: memberId });
  }

  unassignFromCard(cardId: string, memberId: string) {
    return this.http.request<unknown>("DELETE", `/cards/${cardId}/idMembers/${memberId}`);
  }

  search(query: string, limit = 8) {
    return this.http.request<TrelloMember[]>("GET", "/search/members/", {
      query,
      limit: String(limit),
    });
  }
}
