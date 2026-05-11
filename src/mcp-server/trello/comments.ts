import type { TrelloHttp } from "./http.js";
import type { TrelloAction } from "./types.js";

export class CommentsApi {
  constructor(private readonly http: TrelloHttp) {}

  onCard(cardId: string, limit = 20) {
    return this.http.request<TrelloAction[]>("GET", `/cards/${cardId}/actions`, {
      filter: "commentCard",
      limit: String(limit),
    });
  }

  add(cardId: string, text: string) {
    return this.http.request<unknown>("POST", `/cards/${cardId}/actions/comments`, { text });
  }

  update(cardId: string, actionId: string, text: string) {
    return this.http.request<TrelloAction>("PUT", `/cards/${cardId}/actions/${actionId}/comments`, { text });
  }

  delete(cardId: string, actionId: string) {
    return this.http.request<unknown>("DELETE", `/cards/${cardId}/actions/${actionId}/comments`);
  }
}
