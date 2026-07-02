import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateD1User,
  CLOUDFLARE_SESSION_COOKIE,
  CLOUDFLARE_SESSION_MAX_AGE_SECONDS,
  createCloudflareSessionCookieValue,
  isCloudflareAuthEnabled
} from "@/lib/cloudflare/auth";

export async function POST(request: NextRequest) {
  if (!isCloudflareAuthEnabled()) {
    return NextResponse.redirect(new URL("/login?error=Login interno no disponible en este entorno.", request.url), 303);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await authenticateD1User(email, password);
  if (!result.ok) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", result.error);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.cookies.set({
    name: CLOUDFLARE_SESSION_COOKIE,
    value: await createCloudflareSessionCookieValue(result.profile.id, result.profile.email),
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: CLOUDFLARE_SESSION_MAX_AGE_SECONDS
  });

  return response;
}
