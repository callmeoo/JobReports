const DEFAULT_ALLOWED_EMAILS = [
  "yuanlj0119@gmail.com",
  "935170143@qq.com",
];

export function getAllowedEmails(): string[] {
  const fromEnv = process.env.ALLOWED_EMAILS?.split(",") ?? [];
  const normalized = fromEnv
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  return DEFAULT_ALLOWED_EMAILS;
}

export function isEmailAllowed(email: string): boolean {
  return getAllowedEmails().includes(email.trim().toLowerCase());
}
