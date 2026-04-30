"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  LIVE_PHOTO_REACTION_EMOJIS,
  type LivePhotoComment,
  type LivePhotoInteractions,
  type LivePhotoReactionCount,
  type LivePhotoReactionEmoji,
} from "@/lib/live-photo-interactions";

type RawReaction = {
  photo_id: string;
  emoji: string;
};

export async function getPublicLivePhotoInteractions(
  eventId: string,
  photoIds: string[],
): Promise<LivePhotoInteractions> {
  if (!eventId || photoIds.length === 0) {
    return { commentsByPhotoId: {}, reactionsByPhotoId: {} };
  }

  const admin = createAdminClient();
  const [commentsResult, reactionsResult] = await Promise.all([
    admin
      .from("live_photo_comments")
      .select("id, photo_id, event_id, author_name, comment_text, created_at")
      .eq("event_id", eventId)
      .in("photo_id", photoIds)
      .order("created_at", { ascending: true }),
    admin
      .from("live_photo_reactions")
      .select("photo_id, emoji")
      .eq("event_id", eventId)
      .in("photo_id", photoIds),
  ]);

  if (commentsResult.error) {
    console.error("[live-photo-interactions] comments read error:", commentsResult.error.message);
  }

  if (reactionsResult.error) {
    console.error("[live-photo-interactions] reactions read error:", reactionsResult.error.message);
  }

  const commentsByPhotoId: Record<string, LivePhotoComment[]> = {};
  for (const comment of (commentsResult.data ?? []) as LivePhotoComment[]) {
    commentsByPhotoId[comment.photo_id] ??= [];
    commentsByPhotoId[comment.photo_id].push(comment);
  }

  const reactionsByPhotoId: Record<string, LivePhotoReactionCount> = {};
  for (const photoId of photoIds) {
    reactionsByPhotoId[photoId] = createEmptyReactionCount();
  }

  for (const reaction of (reactionsResult.data ?? []) as RawReaction[]) {
    if (!isReactionEmoji(reaction.emoji)) continue;
    reactionsByPhotoId[reaction.photo_id] ??= createEmptyReactionCount();
    reactionsByPhotoId[reaction.photo_id][reaction.emoji] += 1;
  }

  return { commentsByPhotoId, reactionsByPhotoId };
}

export async function addLivePhotoComment(payload: {
  eventId: string;
  photoId: string;
  authorName: string;
  commentText: string;
}): Promise<{ error: string | null; comment: LivePhotoComment | null }> {
  const eventId = payload.eventId?.trim();
  const photoId = payload.photoId?.trim();
  const authorName = sanitizeText(payload.authorName, 80);
  const commentText = sanitizeText(payload.commentText, 300);

  if (!eventId || !photoId) return { error: "Foto no válida.", comment: null };
  if (!authorName) return { error: "Escribe tu nombre para comentar.", comment: null };
  if (!commentText) return { error: "Escribe un comentario.", comment: null };

  const admin = createAdminClient();
  const allowed = await assertPublicPhotoBelongsToEvent(admin, eventId, photoId);
  if (!allowed.ok) return { error: allowed.error, comment: null };

  const { data, error } = await admin
    .from("live_photo_comments")
    .insert({
      event_id: eventId,
      photo_id: photoId,
      author_name: authorName,
      comment_text: commentText,
    })
    .select("id, photo_id, event_id, author_name, comment_text, created_at")
    .single();

  if (error) {
    console.error("[addLivePhotoComment] insert error:", error.message);
    return { error: "No se pudo publicar el comentario.", comment: null };
  }

  return { error: null, comment: data as LivePhotoComment };
}

export async function addLivePhotoReaction(payload: {
  eventId: string;
  photoId: string;
  emoji: string;
  anonymousSessionId: string;
}): Promise<{ error: string | null; counts: LivePhotoReactionCount | null }> {
  const eventId = payload.eventId?.trim();
  const photoId = payload.photoId?.trim();
  const anonymousSessionId = sanitizeSessionId(payload.anonymousSessionId);

  if (!eventId || !photoId) return { error: "Foto no válida.", counts: null };
  if (!isReactionEmoji(payload.emoji)) return { error: "Reacción no válida.", counts: null };
  if (!anonymousSessionId) return { error: "Sesión anónima no válida.", counts: null };

  const admin = createAdminClient();
  const allowed = await assertPublicPhotoBelongsToEvent(admin, eventId, photoId);
  if (!allowed.ok) return { error: allowed.error, counts: null };

  const { error } = await admin
    .from("live_photo_reactions")
    .upsert(
      {
        event_id: eventId,
        photo_id: photoId,
        emoji: payload.emoji,
        anonymous_session_id: anonymousSessionId,
      },
      { onConflict: "photo_id,anonymous_session_id,emoji", ignoreDuplicates: true },
    );

  if (error) {
    console.error("[addLivePhotoReaction] upsert error:", error.message);
    return { error: "No se pudo guardar la reacción.", counts: null };
  }

  const { data, error: countError } = await admin
    .from("live_photo_reactions")
    .select("emoji")
    .eq("event_id", eventId)
    .eq("photo_id", photoId);

  if (countError) {
    console.error("[addLivePhotoReaction] count error:", countError.message);
    return { error: null, counts: null };
  }

  const counts = createEmptyReactionCount();
  for (const item of (data ?? []) as { emoji: string }[]) {
    if (isReactionEmoji(item.emoji)) counts[item.emoji] += 1;
  }

  return { error: null, counts };
}

function createEmptyReactionCount(): LivePhotoReactionCount {
  return { "❤️": 0, "😂": 0, "😍": 0, "👏": 0, "🥹": 0, "🎉": 0 };
}

function isReactionEmoji(value: string): value is LivePhotoReactionEmoji {
  return LIVE_PHOTO_REACTION_EMOJIS.includes(value as LivePhotoReactionEmoji);
}

function sanitizeText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeSessionId(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
  return clean.length >= 8 ? clean : "";
}

async function assertPublicPhotoBelongsToEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  photoId: string,
) {
  const { data, error } = await admin
    .from("live_photos")
    .select("id, event_id, approved, rejected, events!inner(status)")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[live-photo-interactions] photo lookup error:", error.message);
    return { ok: false, error: "No se pudo validar la foto." };
  }

  const row = data as {
    approved: boolean;
    rejected: boolean;
    events?: { status?: string } | { status?: string }[];
  } | null;

  const eventStatus = Array.isArray(row?.events) ? row?.events[0]?.status : row?.events?.status;

  if (!row || !row.approved || row.rejected || eventStatus !== "publicado") {
    return { ok: false, error: "Esta foto no está disponible." };
  }

  return { ok: true, error: null };
}
