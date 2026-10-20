import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TEACHER_COOKIE = "entrepreneur_test_teacher";
const SESSION_DURATION_SECONDS = 4 * 60 * 60;

export function configuredTeacherPassword(): string | undefined {
  const password = process.env.TEACHER_PASSWORD;
  return password && password.length >= 16 ? password : undefined;
}

export function passwordMatches(candidate: string, expected: string): boolean {
  const candidateDigest = createHmac("sha256", "entrepreneur-test-password-check").update(candidate).digest();
  const expectedDigest = createHmac("sha256", "entrepreneur-test-password-check").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

function sign(payload: string, password: string): Buffer {
  return createHmac("sha256", password).update(payload).digest();
}

export function createTeacherSession(password: string): string {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
    nonce: randomBytes(18).toString("base64url"),
  })).toString("base64url");
  const signature = sign(payload, password).toString("base64url");
  return `${payload}.${signature}`;
}

export function isValidTeacherSession(token: string | undefined, password: string): boolean {
  if (!token) return false;
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return false;
  const payload = token.slice(0, separator);
  const suppliedSignature = Buffer.from(token.slice(separator + 1), "base64url");
  const expectedSignature = sign(payload, password);
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: unknown; nonce?: unknown };
    return typeof session.expiresAt === "number"
      && session.expiresAt > Date.now()
      && typeof session.nonce === "string"
      && session.nonce.length >= 16;
  } catch {
    return false;
  }
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
  }
  return undefined;
}

export function teacherCookieHeader(token: string): string {
  return `${TEACHER_COOKIE}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`;
}

export function clearTeacherCookieHeader(): string {
  return `${TEACHER_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}
