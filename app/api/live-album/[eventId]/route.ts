import { NextResponse } from "next/server";
import { getD1Database } from "@/lib/cloudflare/d1";
import { listD1ApprovedLivePhotos } from "@/lib/cloudflare/public-events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LivePhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

type LiveComment = {
  id: string;
  photo_id: string;
  event_id: string;
  author_name: string;
  comment_text: string;
  created_at: string;
};

type LiveReaction = {
  id: string;
  photo_id: string;
  event_id: string;
  emoji: string;
  created_at: string;
};

type ReactionSummary = Record<string, number>;

type D1LiveCommentRow = {
  id: string;
  photo_id: string;
  event_id: string;
  author_name: string;
  message: string;
  created_at: string;
};

type D1LiveReactionRow = {
  id: string;
  photo_id: string;
  event_id: string;
  reaction: string;
  created_at: string;
};

type D1ReactionSummaryRow = {
  reaction: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  if (!eventId) {
    return NextResponse.json({ photos: [], comments: [], reactions: [] }, { status: 400 });
  }

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    const db = await getD1Database();
    if (!db) {
      return NextResponse.json(
        {
          photos: await listD1ApprovedLivePhotos(eventId, 60),
          comments: [],
          reactions: [],
          reactionSummary: {},
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [photos, commentsResult, reactionsResult, reactionSummaryResult] = await Promise.all([
      listD1ApprovedLivePhotos(eventId, 60),
      db
        .prepare(
          [
            "select id, photo_id, event_id, author_name, message, created_at",
            "from live_photo_comments",
            "where event_id = ?",
            "order by created_at desc",
            "limit 12",
          ].join(" "),
        )
        .bind(eventId)
        .all<D1LiveCommentRow>(),
      db
        .prepare(
          [
            "select id, photo_id, event_id, reaction, created_at",
            "from live_photo_reactions",
            "where event_id = ?",
            "order by created_at desc",
            "limit 20",
          ].join(" "),
        )
        .bind(eventId)
        .all<D1LiveReactionRow>(),
      db
        .prepare("select reaction from live_photo_reactions where event_id = ? limit 500")
        .bind(eventId)
        .all<D1ReactionSummaryRow>(),
    ]);

    const reactionSummary: ReactionSummary = {};
    for (const row of reactionSummaryResult.results ?? []) {
      if (!row.reaction) continue;
      reactionSummary[row.reaction] = (reactionSummary[row.reaction] ?? 0) + 1;
    }

    return NextResponse.json(
      {
        photos,
        comments: (commentsResult.results ?? []).map((comment) => ({
          id: comment.id,
          photo_id: comment.photo_id,
          event_id: comment.event_id,
          author_name: comment.author_name,
          comment_text: comment.message,
          created_at: comment.created_at,
        })),
        reactions: (reactionsResult.results ?? []).map((reaction) => ({
          id: reaction.id,
          photo_id: reaction.photo_id,
          event_id: reaction.event_id,
          emoji: reaction.reaction,
          created_at: reaction.created_at,
        })),
        reactionSummary,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = createAdminClient();
  const [photosResult, commentsResult, reactionsResult, reactionSummaryResult] = await Promise.all([
    admin
      .from("live_photos")
      .select("id,event_id,image_url,storage_path,guest_name,guest_message,approved,featured,rejected,created_at")
      .eq("event_id", eventId)
      .eq("approved", true)
      .eq("rejected", false)
      .order("created_at", { ascending: false })
      .limit(60),
    admin
      .from("live_photo_comments")
      .select("id,photo_id,event_id,author_name,comment_text,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("live_photo_reactions")
      .select("id,photo_id,event_id,emoji,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("live_photo_reactions")
      .select("emoji")
      .eq("event_id", eventId)
      .limit(500),
  ]);

  if (photosResult.error) {
    console.error("[live-album-api] photos error:", photosResult.error);
  }
  if (commentsResult.error) {
    console.error("[live-album-api] comments error:", commentsResult.error);
  }
  if (reactionsResult.error) {
    console.error("[live-album-api] reactions error:", reactionsResult.error);
  }
  if (reactionSummaryResult.error) {
    console.error("[live-album-api] reaction summary error:", reactionSummaryResult.error);
  }

  const reactionSummary: ReactionSummary = {};
  for (const reaction of (reactionSummaryResult.data ?? []) as { emoji: string }[]) {
    reactionSummary[reaction.emoji] = (reactionSummary[reaction.emoji] ?? 0) + 1;
  }

  return NextResponse.json(
    {
      photos: (photosResult.data ?? []) as LivePhoto[],
      comments: (commentsResult.data ?? []) as LiveComment[],
      reactions: (reactionsResult.data ?? []) as LiveReaction[],
      reactionSummary,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
