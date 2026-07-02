import "server-only";

import { cookies } from "next/headers";
import { getD1Database } from "@/lib/cloudflare/d1";
import type { Profile } from "@/lib/types";

export const CLOUDFLARE_SESSION_COOKIE = "kais_cf_session";
export const CLOUDFLARE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 100000;

type CloudflareSession = {
  userId: string;
  email: string | null;
  exp: number;
};

type ProfileRow = Omit<Profile, "is_active"> & {
  is_active: number | boolean;
  password_hash?: string | null;
};

export function isCloudflareAuthEnabled() {
  return process.env.USE_CLOUDFLARE_AUTH === "1";
}

export async function signInWithD1(email: string, password: string) {
  const result = await authenticateD1User(email, password);
  if (!result.ok) return result;

  await setCloudflareSession({
    userId: result.profile.id,
    email: result.profile.email,
    exp: Math.floor(Date.now() / 1000) + CLOUDFLARE_SESSION_MAX_AGE_SECONDS
  });

  return result;
}

export async function authenticateD1User(email: string, password: string) {
  const db = await getD1Database();
  if (!db) {
    return { ok: false as const, error: "Cloudflare D1 no esta disponible." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const profile = await db
    .prepare("SELECT id, full_name, email, role, is_active, created_at, password_hash FROM profiles WHERE lower(email) = ? LIMIT 1")
    .bind(normalizedEmail)
    .first<ProfileRow>();

  if (!profile || !profile.password_hash) {
    return { ok: false as const, error: "Email o contrasena incorrectos." };
  }

  const passwordOk = await verifyCloudflarePassword(password, profile.password_hash);
  if (!passwordOk) {
    return { ok: false as const, error: "Email o contrasena incorrectos." };
  }

  const mappedProfile = mapProfileRow(profile);
  if (mappedProfile.is_active === false) {
    return { ok: false as const, error: "Tu usuario interno esta desactivado. Contacta al super admin de KAIS." };
  }

  return { ok: true as const, profile: mappedProfile };
}

export async function signOutFromD1() {
  const cookieStore = await cookies();
  cookieStore.set(CLOUDFLARE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentD1UserProfile() {
  const session = await getCloudflareSession();
  if (!session) {
    return { user: null, profile: null, error: null };
  }

  const db = await getD1Database();
  if (!db) {
    return { user: null, profile: null, error: new Error("Cloudflare D1 no esta disponible.") };
  }

  const profile = await db
    .prepare("SELECT id, full_name, email, role, is_active, created_at FROM profiles WHERE id = ? LIMIT 1")
    .bind(session.userId)
    .first<ProfileRow>();

  if (!profile) {
    await signOutFromD1();
    return { user: null, profile: null, error: null };
  }

  const mappedProfile = mapProfileRow(profile);
  return {
    user: {
      id: mappedProfile.id,
      email: mappedProfile.email
    },
    profile: mappedProfile,
    error: null
  };
}

export async function hashPassword(password: string, salt = crypto.randomUUID()) {
  const key = await derivePasswordKey(password, salt, PASSWORD_ITERATIONS);
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${salt}$${toBase64Url(key)}`;
}

export async function verifyCloudflarePassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, salt, expected] = storedHash.split("$");
  const iterations = Number(iterationsValue);

  if (algorithm !== PASSWORD_ALGORITHM || !Number.isFinite(iterations) || !salt || !expected) {
    return false;
  }

  try {
    const actual = toBase64Url(await derivePasswordKey(password, salt, iterations));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function derivePasswordKey(password: string, salt: string, iterations: number) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

async function setCloudflareSession(session: CloudflareSession) {
  const cookieStore = await cookies();
  const value = await createCloudflareSessionCookieValue(session.userId, session.email);
  cookieStore.set(CLOUDFLARE_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CLOUDFLARE_SESSION_MAX_AGE_SECONDS
  });
}

async function getCloudflareSession(): Promise<CloudflareSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CLOUDFLARE_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = await sign(payload);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const session = JSON.parse(fromBase64Url(payload)) as CloudflareSession;
    if (!session.userId || !session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function signSession(session: CloudflareSession) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function createCloudflareSessionCookieValue(userId: string, email: string | null) {
  return signSession({
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + CLOUDFLARE_SESSION_MAX_AGE_SECONDS
  });
}

async function sign(value: string) {
  const encoder = new TextEncoder();
  const secret = getAuthSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function getAuthSecret() {
  return process.env.KAIS_AUTH_SECRET ?? process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ?? "kais-cloudflare-auth-dev-secret";
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: row.is_active === true || row.is_active === 1,
    created_at: row.created_at
  };
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(base64);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
