import crypto from "crypto";

/**
 * Generates a cryptographically secure random token for invites.
 * Uses 32 bytes of randomness encoded as URL-safe base64.
 *
 * @returns Plain token string (never store this in database)
 */
export function generateInviteToken(): string {
  const buffer = crypto.randomBytes(32);
  return buffer.toString("base64url"); // URL-safe base64
}

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generates a short, human-friendly invite code.
 *
 * @param length - Length of the code (default 8)
 */
export function generateInviteCode(length: number = 8): string {
  const safeLength = Math.max(4, Math.min(length, 12));
  const buffer = crypto.randomBytes(safeLength);
  let code = "";

  for (let i = 0; i < safeLength; i += 1) {
    code += INVITE_CODE_ALPHABET[buffer[i] % INVITE_CODE_ALPHABET.length];
  }

  return code;
}

/**
 * Hashes an invite token using SHA-256.
 * This hash is stored in the database for lookup.
 *
 * @param token - Plain invite token
 * @returns SHA-256 hash of the token (hex string)
 */
export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Builds the invite URL for sharing.
 *
 * @param baseUrl - Application base URL (e.g., "https://finnon.app" or "http://localhost:3000")
 * @param token - Plain invite token
 * @returns Complete invite URL
 */
export function buildInviteUrl(baseUrl: string, token: string): string {
  const url = new URL("/join", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
