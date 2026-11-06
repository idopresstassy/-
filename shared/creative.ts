export const CREATIVE_GENRES = [
  { value: "short_story", label: "단편소설" },
  { value: "romance", label: "로맨스" },
  { value: "fantasy", label: "판타지" },
  { value: "wuxia", label: "무협" },
  { value: "mystery", label: "미스터리" },
  { value: "other", label: "기타" },
] as const;

export type CreativeGenre = (typeof CREATIVE_GENRES)[number]["value"];

export const CREATIVE_GENRE_LABELS: Record<CreativeGenre, string> = Object.fromEntries(
  CREATIVE_GENRES.map(({ value, label }) => [value, label]),
) as Record<CreativeGenre, string>;
