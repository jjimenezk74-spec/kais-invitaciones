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
    console.error("[live-photo-interactions] comments read error:", commentsResult.error);
  }

  if (reactionsResult.error) {
    console.error("[live-photo-interactions] reactions read error:", reactionsResult.error);
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
  const authorName = sanitizeText(payload.authorName);
  const commentText = sanitizeText(payload.commentText);
  const commentId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (!eventId || !photoId) return { error: "El comentario no es valido.", comment: null };
  if (!authorName || authorName.length > 80) {
    return { error: "El comentario no es valido.", comment: null };
  }
  if (!commentText || commentText.length > 300) {
    return { error: "El comentario no es valido.", comment: null };
  }

  const admin = createAdminClient();
  const allowed = await assertPublicPhotoBelongsToEvent(admin, eventId, photoId);
  if (!allowed.ok) return { error: allowed.error, comment: null };

  const { error } = await admin
    .from("live_photo_comments")
    .insert({
      id: commentId,
      event_id: eventId,
      photo_id: photoId,
      author_name: authorName,
      comment_text: commentText,
      created_at: createdAt,
    });

  if (error) {
    console.error("[addLivePhotoComment] insert error:", error);
    return { error: "No se pudo publicar. Intenta nuevamente.", comment: null };
  }

  return {
    error: null,
    comment: {
      id: commentId,
      event_id: eventId,
      photo_id: photoId,
      author_name: authorName,
      comment_text: commentText,
      created_at: createdAt,
    },
  };
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

  if (!eventId || !photoId) return { error: "Foto no valida.", counts: null };
  if (!isReactionEmoji(payload.emoji)) return { error: "Reaccion no valida.", counts: null };
  if (!anonymousSessionId) return { error: "Sesion anonima no valida.", counts: null };

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
    console.error("[addLivePhotoReaction] upsert error:", error);
    return { error: "No se pudo guardar la reaccion.", counts: null };
  }

  const { data, error: countError } = await admin
    .from("live_photo_reactions")
    .select("emoji")
    .eq("event_id", eventId)
    .eq("photo_id", photoId);

  if (countError) {
    console.error("[addLivePhotoReaction] count error:", countError);
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

function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const { data: photo, error: photoError } = await admin
    .from("live_photos")
    .select("id, event_id, approved, rejected")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (photoError) {
    console.error("[live-photo-interactions] photo lookup error:", photoError);
    return { ok: false, error: "No se pudo validar la foto." };
  }

  const row = photo as { approved: boolean; rejected: boolean } | null;
  if (!row || !row.approved || row.rejected) {
    return { ok: false, error: "Esta foto no esta disponible." };
  }

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    console.error("[live-photo-interactions] event lookup error:", eventError);
    return { ok: false, error: "No se pudo validar el evento." };
  }

  if (!event || event.status !== "publicado") {
    return { ok: false, error: "Esta foto no esta disponible." };
  }

  return { ok: true, error: null };
}
