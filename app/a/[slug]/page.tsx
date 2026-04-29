import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ShortAlbumPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/evento/${slug}/album`);
}
