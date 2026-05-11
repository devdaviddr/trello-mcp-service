import type { TrelloHttp } from "./http.js";
import type { TrelloColor, TrelloLabel } from "./types.js";

export class LabelsApi {
  constructor(private readonly http: TrelloHttp) {}

  onBoard(boardId: string) {
    return this.http.request<TrelloLabel[]>("GET", `/boards/${boardId}/labels`, {
      fields: "id,name,color,idBoard",
    });
  }

  create(boardId: string, name: string, color: TrelloColor | null) {
    return this.http.request<TrelloLabel>("POST", "/labels", {
      idBoard: boardId,
      name,
      color: color ?? "",
    });
  }

  update(labelId: string, fields: { name?: string; color?: string }) {
    return this.http.request<TrelloLabel>("PUT", `/labels/${labelId}`, fields);
  }

  delete(labelId: string) {
    return this.http.request<unknown>("DELETE", `/labels/${labelId}`);
  }

  attachToCard(cardId: string, labelId: string) {
    return this.http.request<unknown>("POST", `/cards/${cardId}/idLabels`, { value: labelId });
  }

  detachFromCard(cardId: string, labelId: string) {
    return this.http.request<unknown>("DELETE", `/cards/${cardId}/idLabels/${labelId}`);
  }
}
