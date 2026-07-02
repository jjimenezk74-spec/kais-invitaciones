import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getD1Database() {
  try {
    const context = await getCloudflareContext({ async: true });
    return context.env.DB ?? null;
  } catch {
    return null;
  }
}
