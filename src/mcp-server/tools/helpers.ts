import { z } from "zod";
import { TRELLO_COLORS, type TrelloCard, type TrelloClient, type TrelloColor } from "../trello/index.js";
import type { CardCover } from "../trello/index.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: unknown, trello: TrelloClient) => Promise<unknown>;
}

export const def = <S extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: S,
  handler: (args: z.infer<S>, trello: TrelloClient) => Promise<unknown>,
): ToolDef => {
  const json = zodToJsonSchema(schema);
  return {
    name,
    description,
    inputSchema: json,
    handler: async (raw, trello) => handler(schema.parse(raw), trello),
  };
};

export const mapDefined = <T, U>(v: T | undefined, fn: (t: T) => U): U | undefined =>
  v === undefined ? undefined : fn(v);

export const colorEnum = z.enum(TRELLO_COLORS);

export function parseCardRef(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/trello\.com\/c\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]{8,32}$/.test(trimmed)) return trimmed;
  return null;
}

export type CoverInput =
  | { kind: "color"; color: TrelloColor | null; brightness?: "light" | "dark"; size?: "normal" | "full" }
  | { kind: "attachment"; attachment_id: string; brightness?: "light" | "dark"; size?: "normal" | "full" }
  | { kind: "none" };

export function coverToTrello(cover: CoverInput): CardCover {
  if (cover.kind === "none") return "none";
  if (cover.kind === "attachment") {
    return { idAttachment: cover.attachment_id, brightness: cover.brightness, size: cover.size };
  }
  return { color: cover.color, brightness: cover.brightness, size: cover.size };
}

export function filterOpenDues(
  cards: TrelloCard[],
  predicate: (dueMs: number, nowMs: number) => boolean,
): TrelloCard[] {
  const now = Date.now();
  return cards.filter((c) => {
    if (!c.due || c.dueComplete) return false;
    return predicate(Date.parse(c.due), now);
  });
}

function zodToJsonSchema(schema: z.ZodTypeAny): ToolDef["inputSchema"] {
  if (!(schema instanceof z.ZodObject)) return { type: "object", properties: {} };
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodFieldToJson(value);
    if (!value.isOptional()) required.push(key);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

function zodFieldToJson(field: z.ZodTypeAny): Record<string, unknown> {
  const description = field.description;
  let inner = field;
  while (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) {
    inner = inner._def.innerType;
  }
  const base: Record<string, unknown> = description ? { description } : {};
  if (inner instanceof z.ZodString) return { ...base, type: "string" };
  if (inner instanceof z.ZodNumber) return { ...base, type: "number" };
  if (inner instanceof z.ZodBoolean) return { ...base, type: "boolean" };
  if (inner instanceof z.ZodArray) return { ...base, type: "array", items: zodFieldToJson(inner.element) };
  if (inner instanceof z.ZodEnum) return { ...base, type: "string", enum: inner.options };
  if (inner instanceof z.ZodObject) return { ...base, ...zodToJsonSchema(inner) };
  if (inner instanceof z.ZodLiteral) {
    const value = inner.value;
    const type =
      typeof value === "string" ? "string" : typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
    return { ...base, type, const: value };
  }
  if (inner instanceof z.ZodUnion) {
    const options = (inner._def.options as z.ZodTypeAny[]).map(zodFieldToJson);
    return { ...base, oneOf: options };
  }
  return { ...base, type: "string" };
}
