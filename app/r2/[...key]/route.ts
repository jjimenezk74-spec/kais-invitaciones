import { NextResponse } from "next/server";
import { getR2MediaBucket } from "@/lib/cloudflare/r2";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  const bucket = await getR2MediaBucket();
  if (!bucket) return NextResponse.json({ error: "Media no disponible." }, { status: 503 });

  const { key } = await context.params;
  const objectKey = key.map(decodeURIComponent).join("/");
  const object = await bucket.get(objectKey);

  if (!object) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", headers.get("cache-control") ?? "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
