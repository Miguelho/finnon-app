/**
 * Parses a comma-separated list of demo emails from an env var value.
 * Returns an empty array if the value is undefined or empty,
 * which means the demo feature is disabled.
 */
export function parseDemoEmails(envValue: string | undefined): string[] {
  if (!envValue || !envValue.trim()) return [];
  return envValue
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * Checks if a given email is a demo account email.
 * Case-insensitive and trimmed comparison.
 * Returns false if the demo emails list is empty (feature disabled).
 */
export function isDemoEmail(
  email: string,
  demoEmails: string[]
): boolean {
  if (demoEmails.length === 0) return false;
  const normalized = email.trim().toLowerCase();
  return demoEmails.includes(normalized);
}
