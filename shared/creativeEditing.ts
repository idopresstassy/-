import { z } from "zod";

export const creativeManuscriptTargetSchema = z.object({
  kind: z.enum(["submission", "book"]),
  id: z.number().int().positive(),
});

export const creativeManuscriptFieldsSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(200),
  authorName: z.string().trim().min(1, "작가명을 입력해 주세요.").max(120),
  genre: z.enum(["short_story", "romance", "fantasy", "wuxia", "mystery", "other"]),
  description: z.string().trim().max(2000),
  content: z.string().trim().min(20, "원고 본문을 20자 이상 입력해 주세요.").max(500000),
});

export const updateCreativeManuscriptSchema = creativeManuscriptTargetSchema.extend({
  ...creativeManuscriptFieldsSchema.shape,
  // Keep the database timestamp as a string: Date would lose microseconds.
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export type CreativeManuscriptTarget = z.infer<typeof creativeManuscriptTargetSchema>;
export type CreativeManuscriptFields = z.infer<typeof creativeManuscriptFieldsSchema>;
export type CreativeManuscriptUpdate = z.infer<typeof updateCreativeManuscriptSchema>;
export type CreativeManuscript = CreativeManuscriptFields & {
  updatedAt: string;
  isPublic: boolean;
};
