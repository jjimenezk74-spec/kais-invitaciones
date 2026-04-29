import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    g?: string | string[];
    guest?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function ShortEventPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const nextQuery = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === "g" || key === "guest") continue;
    const values = Array.isArray(value) ? value : value ? [value] : [];
    values.forEach((item) => nextQuery.append(key, item));
  }

  const guestToken = getFirst(query.g) || getFirst(query.guest);
  if (guestToken) nextQuery.set("guest", guestToken.trim());

  const search = nextQuery.toString();
  redirect(`/evento/${slug}${search ? `?${search}` : ""}`);
}

function getFirst(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
