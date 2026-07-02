"use server";

import { getD1Database } from "@/lib/cloudflare/d1";
import { getD1EventByIdOrSlug } from "@/lib/cloudflare/public-events";
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
  emoji?: string;
  reaction?: string;
};

type D1CommentRow = {
  id: string;
  photo_id: string;
  event_id: string;
  author_name: string;
  message: string;
  created_at: string;
};

export async function getPublicLivePhotoInteractions(
  eventId: string,
  photoIds: string[],
): Promise<LivePhotoInteractions> {
  if (!eventId || photoIds.length === 0) {
    return { commentsByPhotoId: {}, reactionsByPhotoId: {} };
  }

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    const db = await getD1Database();
    if (!db) return { commentsByPhotoId: {}, reactionsByPhotoId: {} };

    const placeholders = photoIds.map(() => "?").join(",");
    const [commentsResult, reactionsResult] = await Promise.all([
      db
        .prepare(`select id, photo_id, event_id, author_name, message, created_at from live_photo_comments where event_id = ? and photo_id in (${placeholders}) order by created_at asc`)
        .bind(eventId, ...photoIds)
        .all<D1CommentRow>(),
      db
        .prepare(`select photo_id, reaction from live_photo_reactions where event_id = ? and photo_id in (${placeholders})`)
        .bind(eventId, ...photoIds)
        .all<RawReaction>(),
    ]);

    return buildInteractions(
      (commentsResult.results ?? []).map((comment) => ({
        id: comment.id,
        event_id: comment.event_id,
        photo_id: comment.photo_id,
        author_name: comment.author_name,
        comment_text: comment.message,
        created_at: comment.created_at,
      })),
      reactionsResult.results ?? [],
      photoIds
    );
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

  return buildInteractions((commentsResult.data ?? []) as LivePhotoComment[], (reactionsResult.data ?? []) as RawReaction[], photoIds);
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

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    const allowed = await assertD1PublicPhotoBelongsToEvent(eventId, photoId);
    if (!allowed.ok) return { error: allowed.error, comment: null };

    const db = await getD1Database();
    if (!db) return { error: "Cloudflare D1 no esta disponible.", comment: null };

    await db
      .prepare("insert into live_photo_comments (id, event_id, photo_id, author_name, message, created_at) values (?, ?, ?, ?, ?, ?)")
      .bind(commentId, eventId, photoId, authorName, commentText, createdAt)
      .run();

    return {
      error: null,
      comment: { id: commentId, event_id: eventId, photo_id: photoId, author_name: authorName, comment_text: commentText, created_at: createdAt },
    };
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
    return { error: buildPublicDbError("No se pudo publicar. Intenta nuevamente.", error), comment: null };
  }

  return {
    error: null,
    comment: { id: commentId, event_id: eventId, photo_id: photoId, author_name: authorName, comment_text: commentText, created_at: createdAt },
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

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    const allowed = await assertD1PublicPhotoBelongsToEvent(eventId, photoId);
    if (!allowed.ok) return { error: allowed.error, counts: null };

    const db = await getD1Database();
    if (!db) return { error: "Cloudflare D1 no esta disponible.", counts: null };

    await db
      .prepare("insert or ignore into live_photo_reactions (id, event_id, photo_id, session_id, reaction, created_at) values (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), eventId, photoId, anonymousSessionId, payload.emoji, new Date().toISOString())
      .run();

    const rows = await db
      .prepare("select reaction from live_photo_reactions where event_id = ? and photo_id = ?")
      .bind(eventId, photoId)
      .all<{ reaction: string }>();

    const counts = createEmptyReactionCount();
    for (const item of rows.results ?? []) {
      if (isReactionEmoji(item.reaction)) counts[item.reaction] += 1;
    }

    return { error: null, counts };
  }

  const admin = createAdminClient();
  const allowed = await assertPublicPhotoBelongsToEvent(admin, eventId, photoId);
  if (!allowed.ok) return { error: allowed.error, counts: null };

  const { data: existingReaction, error: existingError } = await admin
    .from("live_photo_reactions")
    .select("id")
    .eq("event_id", eventId)
    .eq("photo_id", photoId)
    .eq("emoji", payload.emoji)
    .eq("anonymous_session_id", anonymousSessionId)
    .maybeSingle();

  if (existingError) {
    console.error("[addLivePhotoReaction] lookup error:", existingError);
    return { error: buildPublicDbError("No se pudo guardar la reaccion.", existingError), counts: null };
  }

  if (!existingReaction) {
    const { error: insertError } = await admin
      .from("live_photo_reactions")
      .insert({
        id: crypto.randomUUID(),
        event_id: eventId,
        photo_id: photoId,
        emoji: payload.emoji,
        anonymous_session_id: anonymousSessionId,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[addLivePhotoReaction] insert error:", insertError);
      return { error: buildPublicDbError("No se pudo guardar la reaccion.", insertError), counts: null };
    }
  }

  const { data, error: countError } = await admin
    .from("live_photo_reactions")
    .select("emoji")
    .eq("event_id", eventId)
    .eq("photo_id", photoId);

  if (countError) {
    console.error("[addLivePhotoReaction] count error:", countError);
    return { error: buildPublicDbError("No se pudo contar la reaccion.", countError), counts: null };
  }

  const counts = createEmptyReactionCount();
  for (const item of (data ?? []) as { emoji: string }[]) {
    if (isReactionEmoji(item.emoji)) counts[item.emoji] += 1;
  }

  return { error: null, counts };
}

function buildInteractions(comments: LivePhotoComment[], reactions: RawReaction[], photoIds: string[]): LivePhotoInteractions {
  const commentsByPhotoId: Record<string, LivePhotoComment[]> = {};
  for (const comment of comments) {
    commentsByPhotoId[comment.photo_id] ??= [];
    commentsByPhotoId[comment.photo_id].push(comment);
  }

  const reactionsByPhotoId: Record<string, LivePhotoReactionCount> = {};
  for (const photoId of photoIds) {
    reactionsByPhotoId[photoId] = createEmptyReactionCount();
  }

  for (const reaction of reactions) {
    const emoji = reaction.emoji ?? reaction.reaction ?? "";
    if (!isReactionEmoji(emoji)) continue;
    reactionsByPhotoId[reaction.photo_id] ??= createEmptyReactionCount();
    reactionsByPhotoId[reaction.photo_id][emoji] += 1;
  }

  return { commentsByPhotoId, reactionsByPhotoId };
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

function buildPublicDbError(message: string, error: { code?: string; message?: string; details?: string }) {
  const code = error.code ? ` Codigo: ${error.code}` : "";
  if (error.code === "42P01") return `${message} Falta crear la tabla en Supabase.${code}`;
  if (error.code === "42703") return `${message} Falta una columna en Supabase.${code}`;
  if (error.code === "23503") return `${message} La foto no pertenece al evento.${code}`;
  if (error.code === "42501") return `${message} Permisos insuficientes en Supabase.${code}`;
  if (error.code === "23514") return `${message} El dato no cumple las reglas de la tabla.${code}`;
  return `${message}${code}`;
}

async function assertD1PublicPhotoBelongsToEvent(eventId: string, photoId: string) {
  const db = await getD1Database();
  if (!db) return { ok: false, error: "Cloudflare D1 no esta disponible." };

  const photo = await db
    .prepare("select id, event_id, approved, rejected from live_photos where id = ? and event_id = ? limit 1")
    .bind(photoId, eventId)
    .first<{ approved: number | boolean; rejected: number | boolean }>();

  if (!photo || !(photo.approved === 1 || photo.approved === true) || photo.rejected === 1 || photo.rejected === true) {
    return { ok: false, error: "Esta foto no esta disponible." };
  }

  const event = await getD1EventByIdOrSlug(eventId);
  if (!event || event.status !== "publicado") {
    return { ok: false, error: "Esta foto no esta disponible." };
  }

  return { ok: true, error: null };
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
