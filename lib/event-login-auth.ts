import "server-only";

import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { isCloudflareAuthEnabled } from "@/lib/cloudflare/auth";
import { getD1EventLoginById } from "@/lib/cloudflare/public-events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventLogin } from "@/lib/types";

const COOKIE_NAME = "kais_event_login";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";

type SessionPayload = {
  loginId: string;
  eventId: string;
  exp: number;
};

export function generateEventPassword() {
  const code = Math.floor(1000 + Math.random() * 9000);
  return `KAIS-${code}`;
}

export function normalizeUsername(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("hex");
  return `pbkdf2:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, iterationsText, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "pbkdf2" || !iterationsText || !salt || !storedHash) {
    return false;
  }

  const iterations = Number(iterationsText);
  const hash = pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST);
  const stored = Buffer.from(storedHash, "hex");

  if (hash.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(hash, stored);
}

export async function setEventLoginSession(login: EventLogin) {
  const cookieStore = await cookies();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload: SessionPayload = {
    loginId: login.id,
    eventId: login.event_id,
    exp: expiresAt
  };

  cookieStore.set(COOKIE_NAME, signPayload(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export async function clearEventLoginSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getEventLoginSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  const payload = value ? verifySignedPayload(value) : null;

  if (!payload) {
    return null;
  }

  if (isCloudflareAuthEnabled()) {
    const login = await getD1EventLoginById(payload.loginId);

    if (!login || login.event_id !== payload.eventId || !login.active || isExpired(login.expires_at)) {
      return null;
    }

    return login;
  }

  const admin = createAdminClient();
  const { data: login } = await admin
    .from("event_logins")
    .select("id,event_id,username,password_hash,active,expires_at,last_login_at,created_at,created_by")
    .eq("id", payload.loginId)
    .eq("event_id", payload.eventId)
    .maybeSingle();

  if (!login || !login.active || isExpired(login.expires_at)) {
    return null;
  }

  return login as EventLogin;
}

export function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());
}

function signPayload(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySignedPayload(value: string): SessionPayload | null {
  const [body, signature] = value.split(".");

  if (!body || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;

    if (!payload.loginId || !payload.eventId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getSessionSecret() {
  return process.env.KAIS_AUTH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "kais-dev-secret";
}
