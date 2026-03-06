import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, originalHash] = passwordHash.split(":");
  if (!salt || !originalHash) {
    return false;
  }

  const currentHash = scryptSync(password, salt, KEYLEN);
  const original = Buffer.from(originalHash, "hex");

  if (original.length !== currentHash.length) {
    return false;
  }

  return timingSafeEqual(original, currentHash);
}

export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
