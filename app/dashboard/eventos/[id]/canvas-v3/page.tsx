import { redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { CanvasEditorV3 } from "./canvas-v3-editor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: "Canvas V3 · Editor experimental" };
}

export default async function CanvasV3Page({ params }: Props) {
  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  void params;

  return <CanvasEditorV3 />;
}
