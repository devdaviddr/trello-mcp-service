import type { TrelloHttp } from "./http.js";
import type { TrelloAttachment } from "./types.js";

export class AttachmentsApi {
  constructor(private readonly http: TrelloHttp) {}

  onCard(cardId: string) {
    return this.http.request<TrelloAttachment[]>("GET", `/cards/${cardId}/attachments`);
  }

  addUrl(cardId: string, url: string, name?: string) {
    return this.http.request<TrelloAttachment>("POST", `/cards/${cardId}/attachments`, { url, name });
  }

  delete(cardId: string, attachmentId: string) {
    return this.http.request<unknown>("DELETE", `/cards/${cardId}/attachments/${attachmentId}`);
  }
}
