export const LIVE_PHOTO_REACTION_EMOJIS = ["❤️", "😂", "😍", "👏", "🥹", "🎉"] as const;

export type LivePhotoReactionEmoji = (typeof LIVE_PHOTO_REACTION_EMOJIS)[number];

export type LivePhotoComment = {
  id: string;
  photo_id: string;
  event_id: string;
  author_name: string;
  comment_text: string;
  created_at: string;
};

export type LivePhotoReactionCount = Record<LivePhotoReactionEmoji, number>;

export type LivePhotoInteractions = {
  commentsByPhotoId: Record<string, LivePhotoComment[]>;
  reactionsByPhotoId: Record<string, LivePhotoReactionCount>;
};
