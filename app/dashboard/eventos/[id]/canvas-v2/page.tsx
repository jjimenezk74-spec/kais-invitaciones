import { redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { CanvasEditorV2 } from "./canvas-editor-v2";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: "Canvas V2 · Editor experimental" };
}

export default async function CanvasV2Page({ params }: Props) {
  // Reuse existing auth guard — same permission as production canvas
  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  // We don't load event data here — design is hardcoded in the client.
  // The `id` param is available for future use.
  void params;

  return <CanvasEditorV2 />;
}
