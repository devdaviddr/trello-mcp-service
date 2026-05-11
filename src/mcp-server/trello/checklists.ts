import type { TrelloHttp } from "./http.js";
import type { TrelloCheckItem, TrelloChecklist } from "./types.js";

export class ChecklistsApi {
  constructor(private readonly http: TrelloHttp) {}

  onCard(cardId: string) {
    return this.http.request<TrelloChecklist[]>("GET", `/cards/${cardId}/checklists`, {
      fields: "id,name,idCard",
      checkItem_fields: "id,name,state,pos",
    });
  }

  async create(cardId: string, name: string, items?: string[]) {
    const checklist = await this.http.request<TrelloChecklist>("POST", "/checklists", { idCard: cardId, name });
    if (items?.length) {
      for (const item of items) {
        await this.addItem(checklist.id, item);
      }
    }
    return this.http.request<TrelloChecklist>("GET", `/checklists/${checklist.id}`, {
      fields: "id,name,idCard",
      checkItem_fields: "id,name,state,pos",
    });
  }

  update(checklistId: string, fields: { name?: string; pos?: string }) {
    return this.http.request<TrelloChecklist>("PUT", `/checklists/${checklistId}`, fields);
  }

  delete(checklistId: string) {
    return this.http.request<unknown>("DELETE", `/checklists/${checklistId}`);
  }

  addItem(checklistId: string, name: string, checked = false) {
    return this.http.request<TrelloCheckItem>("POST", `/checklists/${checklistId}/checkItems`, {
      name,
      checked: String(checked),
    });
  }

  updateItem(
    cardId: string,
    checkItemId: string,
    fields: { name?: string; pos?: string; due?: string; idMember?: string; state?: "complete" | "incomplete" },
  ) {
    return this.http.request<TrelloCheckItem>("PUT", `/cards/${cardId}/checkItem/${checkItemId}`, fields);
  }

  setItemState(cardId: string, checkItemId: string, checked: boolean) {
    return this.http.request<TrelloCheckItem>("PUT", `/cards/${cardId}/checkItem/${checkItemId}`, {
      state: checked ? "complete" : "incomplete",
    });
  }

  deleteItem(checklistId: string, checkItemId: string) {
    return this.http.request<unknown>("DELETE", `/checklists/${checklistId}/checkItems/${checkItemId}`);
  }
}
