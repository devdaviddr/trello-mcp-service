import { TrelloHttp } from "./http.js";
import { BoardsApi } from "./boards.js";
import { ListsApi } from "./lists.js";
import { CardsApi } from "./cards.js";
import { CommentsApi } from "./comments.js";
import { AttachmentsApi } from "./attachments.js";
import { ChecklistsApi } from "./checklists.js";
import { LabelsApi } from "./labels.js";
import { MembersApi } from "./members.js";
import { WorkspacesApi } from "./workspaces.js";
import { NotificationsApi } from "./notifications.js";
import { CustomFieldsApi } from "./custom-fields.js";

export class TrelloClient {
  readonly boards: BoardsApi;
  readonly lists: ListsApi;
  readonly cards: CardsApi;
  readonly comments: CommentsApi;
  readonly attachments: AttachmentsApi;
  readonly checklists: ChecklistsApi;
  readonly labels: LabelsApi;
  readonly members: MembersApi;
  readonly workspaces: WorkspacesApi;
  readonly notifications: NotificationsApi;
  readonly customFields: CustomFieldsApi;

  constructor(key: string, token: string) {
    const http = new TrelloHttp(key, token);
    this.boards = new BoardsApi(http);
    this.lists = new ListsApi(http);
    this.cards = new CardsApi(http);
    this.comments = new CommentsApi(http);
    this.attachments = new AttachmentsApi(http);
    this.checklists = new ChecklistsApi(http);
    this.labels = new LabelsApi(http);
    this.members = new MembersApi(http);
    this.workspaces = new WorkspacesApi(http);
    this.notifications = new NotificationsApi(http);
    this.customFields = new CustomFieldsApi(http);
  }
}

export * from "./types.js";
export type { GetBoardOptions } from "./boards.js";
export type { CardCover, CardUpdate } from "./cards.js";
export type { TrelloMe } from "./members.js";
