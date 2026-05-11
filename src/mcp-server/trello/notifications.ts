import type { TrelloHttp } from "./http.js";
import type { TrelloNotification } from "./types.js";

export class NotificationsApi {
  constructor(private readonly http: TrelloHttp) {}

  list(opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.http.request<TrelloNotification[]>("GET", "/members/me/notifications", {
      read_filter: opts.unreadOnly ? "unread" : "all",
      limit: String(opts.limit ?? 20),
    });
  }

  markRead(notificationId: string) {
    return this.http.request<TrelloNotification>("PUT", `/notifications/${notificationId}`, { unread: "false" });
  }

  markAllRead() {
    return this.http.request<unknown>("POST", "/notifications/all/read");
  }
}
