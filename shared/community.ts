import { z } from "zod";

export const COMMUNITY_CATEGORIES = [
  { value: "notice", label: "공지사항" },
  { value: "talk", label: "책 이야기" },
  { value: "request", label: "문의·건의" },
  { value: "private", label: "비공개 문의" },
] as const;
export const communityCategory = z.enum([
  "notice",
  "talk",
  "request",
  "private",
]);
export type CommunityCategory = z.infer<typeof communityCategory>;
export const categoryLabel = (value: CommunityCategory) =>
  COMMUNITY_CATEGORIES.find(c => c.value === value)!.label;
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "닉네임을 2자 이상 입력해 주세요.")
  .max(20)
  .regex(
    /^[\p{L}\p{N}_ ]+$/u,
    "닉네임에는 글자, 숫자, 공백, 밑줄만 사용할 수 있습니다."
  );
export const postFields = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(200),
  body: z.string().trim().min(1, "내용을 입력해 주세요.").max(20000),
});
export const createPostInput = postFields.extend({
  category: communityCategory,
  nickname: nicknameSchema,
  bookId: z.number().int().positive().optional(),
});
export const postIdInput = z.object({ id: z.string().uuid() });
// This separates browser query caches across accounts; authorization always
// uses the verified server session, never this client-provided value.
export const communityViewerInput = z.object({
  viewerKey: z.string().max(80).optional(),
});
export const commentBody = z
  .string()
  .trim()
  .min(1, "댓글을 입력해 주세요.")
  .max(3000);
export const communityListInput = z.object({
  viewerKey: z.string().max(80).optional(),
  mode: z.enum(["public", "mine", "private", "manage"]).default("public"),
  category: communityCategory.optional(),
  search: z.string().trim().max(100).default(""),
  page: z.number().int().min(1).max(5000).default(1),
});
export type CommunityListInput = z.infer<typeof communityListInput>;
export type CommunityPost = {
  id: string;
  title: string;
  category: CommunityCategory;
  nickname: string;
  authorIsAdmin: boolean;
  isMine: boolean;
  isHidden: boolean;
  isPinned: boolean;
  bookId: number | null;
  bookTitle: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  answered: boolean;
  lastReplyAt: string | null;
  hasNewReply: boolean;
};
export type CommunityComment = {
  id: string;
  body: string;
  nickname: string;
  authorIsAdmin: boolean;
  isMine: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
};
export type CommunityDetail = CommunityPost & { body: string };
