import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function LegacyCanvasRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/eventos/${id}/canvas-v3`);
}
