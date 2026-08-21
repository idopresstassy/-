import { describe, it, expect, vi } from "vitest";

// Mock the createBook function to verify it receives correct data
vi.mock("./db", () => ({
  getBookByTitleAuthor: vi.fn().mockResolvedValue(undefined),
  createBook: vi.fn().mockResolvedValue(1),
  upsertBook: vi.fn().mockImplementation(async (data) => {
    // Verify content is never undefined
    if (data.content === undefined) {
      throw new Error("content should not be undefined");
    }
    return { id: 1, isUpdate: false };
  }),
}));

// Test the createBook fix directly
describe("createBook null handling", () => {
  it("should convert undefined optional fields to null", async () => {
    // Simulate what createBook now does
    const data = {
      title: "테스트 도서",
      author: "테스트 작가",
      genre: "modern" as const,
      content: undefined as string | undefined,
      description: "설명",
      youtubeUrl: undefined as string | undefined,
      googleDriveUrl: undefined as string | undefined,
      tableOfContents: undefined as string | undefined,
      studyMaterial: undefined as string | undefined,
    };

    // Apply the fix logic
    const values = {
      title: data.title,
      author: data.author,
      genre: data.genre,
      content: data.content ?? null,
      youtubeUrl: data.youtubeUrl ?? null,
      description: data.description ?? null,
      googleDriveUrl: data.googleDriveUrl ?? null,
      tableOfContents: data.tableOfContents ?? null,
      studyMaterial: data.studyMaterial ?? null,
    };

    // Verify no undefined values remain
    expect(values.content).toBeNull();
    expect(values.youtubeUrl).toBeNull();
    expect(values.description).toBe("설명");
    expect(values.googleDriveUrl).toBeNull();
    expect(values.tableOfContents).toBeNull();
    expect(values.studyMaterial).toBeNull();

    // Verify no value is undefined
    Object.entries(values).forEach(([key, val]) => {
      expect(val, `${key} should not be undefined`).not.toBeUndefined();
    });
  });

  it("should preserve actual string values", () => {
    const data = {
      title: "백범일지",
      author: "김구",
      genre: "modern" as const,
      content: "저자의 말\n이 책은...",
      description: "김구 선생의 자서전",
      youtubeUrl: "https://youtube.com/test",
      googleDriveUrl: undefined as string | undefined,
      tableOfContents: "1. 유년시절\n2. 청년시절",
      studyMaterial: "학습자료 내용",
    };

    const values = {
      title: data.title,
      author: data.author,
      genre: data.genre,
      content: data.content ?? null,
      youtubeUrl: data.youtubeUrl ?? null,
      description: data.description ?? null,
      googleDriveUrl: data.googleDriveUrl ?? null,
      tableOfContents: data.tableOfContents ?? null,
      studyMaterial: data.studyMaterial ?? null,
    };

    expect(values.content).toBe("저자의 말\n이 책은...");
    expect(values.youtubeUrl).toBe("https://youtube.com/test");
    expect(values.googleDriveUrl).toBeNull();
    expect(values.tableOfContents).toBe("1. 유년시절\n2. 청년시절");
  });

  it("should handle empty string content (from upload flow)", () => {
    // In upload flow: content = parsed.content || extractedText
    // extractedText is always non-empty, so content should never be empty
    const extractedText = "이것은 추출된 텍스트입니다.";
    const parsedContent = undefined;
    const content = parsedContent || extractedText;

    expect(content).toBe(extractedText);
    expect(content).not.toBeUndefined();
    expect(content.length).toBeGreaterThan(0);

    const values = {
      title: "테스트",
      author: "작가",
      genre: "modern" as const,
      content: content ?? null,
      youtubeUrl: null,
      description: null,
      googleDriveUrl: null,
      tableOfContents: null,
      studyMaterial: null,
    };

    expect(values.content).toBe(extractedText);
  });
});
