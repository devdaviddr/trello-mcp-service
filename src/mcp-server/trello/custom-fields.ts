import type { TrelloHttp } from "./http.js";
import type { TrelloCustomField, TrelloCustomFieldItem } from "./types.js";

export class CustomFieldsApi {
  constructor(private readonly http: TrelloHttp) {}

  onBoard(boardId: string) {
    return this.http.request<TrelloCustomField[]>("GET", `/boards/${boardId}/customFields`);
  }

  valuesOnCard(cardId: string) {
    return this.http.request<TrelloCustomFieldItem[]>("GET", `/cards/${cardId}/customFieldItems`);
  }
}
