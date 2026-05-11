import type { TrelloHttp } from "./http.js";
import type { TrelloList } from "./types.js";

export class ListsApi {
  constructor(private readonly http: TrelloHttp) {}

  onBoard(boardId: string) {
    return this.http.request<TrelloList[]>("GET", `/boards/${boardId}/lists`, { fields: "id,name,closed,pos" });
  }

  create(boardId: string, name: string, pos?: string) {
    return this.http.request<TrelloList>("POST", "/lists", { idBoard: boardId, name, pos });
  }

  update(listId: string, fields: { name?: string; pos?: string; closed?: string; idBoard?: string }) {
    return this.http.request<TrelloList>("PUT", `/lists/${listId}`, fields);
  }

  archiveAllCards(listId: string) {
    return this.http.request<unknown>("POST", `/lists/${listId}/archiveAllCards`);
  }

  moveAllCards(listId: string, destListId: string, destBoardId: string) {
    return this.http.request<unknown>("POST", `/lists/${listId}/moveAllCards`, {
      idBoard: destBoardId,
      idList: destListId,
    });
  }
}
