function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} must be set`);
    process.exit(1);
  }
  return v;
}

function parseAllowedUserIds(raw: string | undefined): Set<string> {
  const set = new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  for (const id of set) {
    if (!/^\d+$/.test(id)) {
      console.warn(
        `[config] WARNING: TELEGRAM_ALLOWED_USER_IDS contains "${id}" which is not a numeric id. ` +
          `Telegram only returns numeric ids; this entry will never match. Use @userinfobot to find your numeric id.`,
      );
    }
  }
  return set;
}

export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  allowedUserIds: parseAllowedUserIds(process.env.TELEGRAM_ALLOWED_USER_IDS),
};
