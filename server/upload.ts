import { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { invokeLLM } from "./_core/llm";
import * as db from "./supabaseDb";
import { getRequestUser } from "./supabase";

// 관리자 인증 미들웨어
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getRequestUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    (req as any).user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "인증이 필요합니다. 로그인 후 다시 시도해주세요." });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".txt") || file.originalname.endsWith(".docx")) {
      cb(null, true);
    } else {
      cb(new Error("지원하지 않는 파일 형식입니다. .docx 또는 .txt 파일만 업로드할 수 있습니다."));
    }
  },
});

// 텍스트 파일에서 구조화된 정보 파싱 시도
function parseStructuredText(text: string): {
  title?: string;
  author?: string;
  genre?: string;
  summary?: string;
  tableOfContents?: string;
  content?: string;
  studyMaterial?: string;
} {
  const result: any = {};

  // [도서 정보 시작] ... [도서 정보 끝] 형식 파싱
  const titleMatch = text.match(/■\s*제목:\s*(.+)/);
  if (titleMatch) result.title = titleMatch[1].trim();

  const authorMatch = text.match(/■\s*작가:\s*(.+)/);
  if (authorMatch) result.author = authorMatch[1].trim();

  const genreMatch = text.match(/■\s*분류:\s*(.+)/);
  if (genreMatch) result.genre = genreMatch[1].trim();

  const summaryMatch = text.match(/■\s*간단\s*요약:\s*([\s\S]*?)(?=■|$)/);
  if (summaryMatch) {
    const s = summaryMatch[1].trim();
    if (s && !s.startsWith("(※")) result.summary = s;
  }

  const tocMatch = text.match(/■\s*차례:\s*([\s\S]*?)(?=■|$)/);
  if (tocMatch) {
    const t = tocMatch[1].trim();
    if (t && !t.startsWith("(※")) result.tableOfContents = t;
  }

  const contentMatch = text.match(/■\s*본문\s*내용:\s*([\s\S]*?)(?=■\s*부록|$)/);
  if (contentMatch) result.content = contentMatch[1].trim();

  // 부록 (학습 자료) 파싱
  const appendixMatch = text.match(/■\s*부록\s*\(학습\s*자료\):\s*([\s\S]*?)(?=\[도서\s*정보\s*끝\]|$)/);
  if (appendixMatch) {
    const a = appendixMatch[1].trim();
    if (a && !a.startsWith("(※") && a.length > 20) result.studyMaterial = a;
  }

  return result;
}

// 분류 문자열을 genre enum으로 변환
function classifyGenre(genreStr: string): "classic" | "modern" | "foreign" {
  const lower = genreStr.toLowerCase();
  if (lower.includes("해외") || lower.includes("외국") || lower.includes("foreign")) return "foreign";
  if (lower.includes("고전") || lower.includes("classic")) return "classic";
  return "modern"; // 현대, 소설, 시, 수필 등 기본값
}

// AI로 도서 정보 추출
async function extractBookInfoWithAI(text: string): Promise<{
  title: string;
  author: string;
  genre: "classic" | "modern" | "foreign";
  description: string;
}> {
  // 텍스트가 너무 길면 앞부분만 사용
  const sample = text.slice(0, 3000);

  const result = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `당신은 한국문학 전문가입니다. 주어진 텍스트에서 도서 정보를 추출하세요.
분류는 반드시 다음 중 하나로 지정하세요: classic(고전), modern(현대), foreign(해외)
- 고전: 조선시대~개화기 작품 (허균, 김만중, 박지원 등)
- 현대: 근현대 한국 작가 작품 (이효석, 김유정, 현진건 등)
- 해외: 외국 작가 작품 (도스토옙스키, 셰익스피어 등)`
      },
      {
        role: "user",
        content: `다음 텍스트에서 도서 정보를 추출하세요:\n\n${sample}`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "book_info",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "도서 제목" },
            author: { type: "string", description: "작가 이름" },
            genre: { type: "string", enum: ["classic", "modern", "foreign"], description: "분류" },
            description: { type: "string", description: "작품 소개 (2~3문장)" },
          },
          required: ["title", "author", "genre", "description"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("AI 응답을 파싱할 수 없습니다.");
  }
  return JSON.parse(content);
}

// AI로 차례 자동 생성
async function generateTableOfContents(text: string, title: string): Promise<string> {
  // 본문 전체를 보내되 너무 길면 샘플링
  const maxLen = 15000;
  let sample = text;
  if (text.length > maxLen) {
    // 앞부분 + 중간 + 뒷부분 샘플링
    const partLen = Math.floor(maxLen / 3);
    const mid = Math.floor(text.length / 2);
    sample = text.slice(0, partLen) + "\n...\n" + text.slice(mid - partLen / 2, mid + partLen / 2) + "\n...\n" + text.slice(-partLen);
  }

  const result = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `당신은 한국문학 전문가입니다. 주어진 소설/작품의 본문을 분석하여 차례(목차)를 생성하세요.
규칙:
- 7~15개의 장(章)으로 나누세요
- 각 장에 내용을 잘 요약하는 소제목을 붙이세요
- 형식: "1. 소제목\n2. 소제목\n..." 
- 본문 내용을 절대 수정하지 마세요, 흐름만 분석하세요
- 마지막에 "부록: 수능/논술 대비 학습 자료"를 추가하세요`
      },
      {
        role: "user",
        content: `작품 제목: ${title}\n\n본문:\n${sample}`
      }
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("차례 생성 실패");
  }
  return content;
}

// AI로 학습자료 생성
async function generateStudyMaterial(text: string, title: string, author: string): Promise<string> {
  const maxLen = 12000;
  let sample = text;
  if (text.length > maxLen) {
    const partLen = Math.floor(maxLen / 3);
    const mid = Math.floor(text.length / 2);
    sample = text.slice(0, partLen) + "\n...\n" + text.slice(mid - partLen / 2, mid + partLen / 2) + "\n...\n" + text.slice(-partLen);
  }

  const result = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `당신은 중·고등학생 수능/논술 대비 학습자료를 만드는 국어 교사입니다.
주어진 작품을 분석하여 다음 형식의 학습자료를 생성하세요:

[핵심요약]
- 작품의 핵심 주제와 의미를 3~5줄로 요약

[줄거리]
- 작품의 전체 줄거리를 시간순으로 정리 (10~15줄)

[등장인물]
- 주요 등장인물과 각 인물의 성격, 역할 설명

[심화자료 (수능/논술 대비)]
- 작품의 문학사적 의의
- 주요 표현 기법 분석
- 출제 가능한 핵심 포인트 3~5개
- 관련 작품 비교 (같은 작가 또는 같은 주제의 다른 작품)`
      },
      {
        role: "user",
        content: `작품: ${title} (${author})\n\n본문:\n${sample}`
      }
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("학습자료 생성 실패");
  }
  return content;
}

export function registerUploadRoutes(app: Express) {
  // 파일 업로드 + AI 자동 처리 엔드포인트 (관리자 전용)
  app.post("/api/upload/book", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 없습니다." });
      }

      const file = req.file;
      let extractedText = "";

      // 파일 형식에 따라 텍스트 추출
      if (file.originalname.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value;
      } else {
        // .txt 파일
        extractedText = file.buffer.toString("utf-8");
      }

      if (!extractedText.trim()) {
        return res.status(400).json({ error: "파일에서 텍스트를 추출할 수 없습니다." });
      }

      // 1. 구조화된 형식 파싱 시도
      const parsed = parseStructuredText(extractedText);

      // 2. 파싱 결과가 없으면 AI로 추출
      let title = parsed.title || "";
      let author = parsed.author || "";
      let genre: "classic" | "modern" | "foreign" = "modern";
      let description = parsed.summary || "";
      let content = parsed.content || extractedText;

      if (!title || !author) {
        const aiInfo = await extractBookInfoWithAI(extractedText);
        title = title || aiInfo.title;
        author = author || aiInfo.author;
        genre = aiInfo.genre;
        description = description || aiInfo.description;
      } else {
        // 제목/작가가 있어도 분류는 항상 처리
        if (parsed.genre) {
          genre = classifyGenre(parsed.genre);
        } else {
          // 분류가 없으면 AI로 추론
          try {
            const aiInfo = await extractBookInfoWithAI(extractedText);
            genre = aiInfo.genre;
            description = description || aiInfo.description;
          } catch (e) {
            // AI 분류 실패 시 기본값 유지
          }
        }
      }

      // 3. 차례 생성 (파싱된 것이 없으면 AI 생성)
      let tableOfContents = parsed.tableOfContents || "";
      if (!tableOfContents) {
        tableOfContents = await generateTableOfContents(content, title);
      }

      // 4. 학습자료 생성 (파싱된 것이 없으면 AI 생성)
      let studyMaterial = parsed.studyMaterial || "";
      if (!studyMaterial) {
        studyMaterial = await generateStudyMaterial(content, title, author);
      }

      // 5. DB에 저장 (같은 제목+작가가 있으면 덮어쓰기)
      const { id: bookId, isUpdate } = await db.upsertBook({
        title,
        author,
        genre,
        content,
        description,
        tableOfContents,
        studyMaterial,
      });

      return res.json({
        success: true,
        bookId,
        isUpdate,
        message: isUpdate ? `기존 도서 "${title}"을(를) 업데이트했습니다.` : `새 도서 "${title}"을(를) 등록했습니다.`,
        title,
        author,
        genre,
        description,
        tableOfContents,
        studyMaterial: studyMaterial.slice(0, 500) + (studyMaterial.length > 500 ? "..." : ""),
      });
    } catch (error: any) {
      console.error("[Upload] Error:", error);
      // 사용자에게 친화적인 에러 메시지 반환 (내부 쿼리 정보 노출 방지)
      let userMessage = "파일 처리 중 오류가 발생했습니다.";
      if (error.message?.includes("Failed query")) {
        userMessage = "도서 저장 중 데이터베이스 오류가 발생했습니다. 파일 크기가 너무 크거나 형식이 올바르지 않을 수 있습니다.";
      } else if (error.message?.includes("AI") || error.message?.includes("생성 실패")) {
        userMessage = "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.";
      } else if (error.message) {
        userMessage = error.message;
      }
      return res.status(500).json({ error: userMessage });
    }
  });

  // 기존 도서에 AI 분석 적용 (차례 + 학습자료 생성, 관리자 전용)
  app.post("/api/upload/analyze/:bookId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bookId = parseInt(req.params.bookId);
      if (isNaN(bookId)) {
        return res.status(400).json({ error: "유효하지 않은 도서 ID입니다." });
      }

      const book = await db.getBookById(bookId);
      if (!book) {
        return res.status(404).json({ error: "도서를 찾을 수 없습니다." });
      }

      let content = book.content || "";
      
      // 구글 드라이브에서 콘텐츠 가져오기
      if (!content && book.googleDriveUrl) {
        const match = book.googleDriveUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
          const docId = match[1];
          const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
          const response = await fetch(exportUrl);
          if (response.ok) {
            content = await response.text();
          }
        }
      }

      if (!content) {
        return res.status(400).json({ error: "도서 본문이 없습니다. 콘텐츠를 먼저 등록해주세요." });
      }

      // 차례 생성
      const tableOfContents = await generateTableOfContents(content, book.title);

      // 학습자료 생성
      const studyMaterial = await generateStudyMaterial(content, book.title, book.author);

      // DB 업데이트
      await db.updateBook(bookId, { tableOfContents, studyMaterial });

      return res.json({
        success: true,
        tableOfContents,
        studyMaterial: studyMaterial.slice(0, 500) + (studyMaterial.length > 500 ? "..." : ""),
      });
    } catch (error: any) {
      console.error("[Analyze] Error:", error);
      return res.status(500).json({ error: error.message || "AI 분석 중 오류가 발생했습니다." });
    }
  });
}
