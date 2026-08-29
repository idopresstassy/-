import { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import mammoth from "mammoth";
import * as db from "./supabaseDb";
import { getRequestUser } from "./supabase";

const AI_ANALYSIS_UNAVAILABLE_MESSAGE = "자동 AI 분석은 새 Render 환경에서 아직 연결되지 않았습니다. 제목·작가·분류를 포함한 구조화 문서를 올리거나 수동 추가를 이용해 주세요.";

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
  void text;
  throw new Error(AI_ANALYSIS_UNAVAILABLE_MESSAGE);
}

// AI로 차례 자동 생성
async function generateTableOfContents(text: string, title: string): Promise<string> {
  void text;
  void title;
  throw new Error(AI_ANALYSIS_UNAVAILABLE_MESSAGE);
}

// AI로 학습자료 생성
async function generateStudyMaterial(text: string, title: string, author: string): Promise<string> {
  void text;
  void title;
  void author;
  throw new Error(AI_ANALYSIS_UNAVAILABLE_MESSAGE);
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

      // Render에는 Manus AI가 없으므로, 문서 안에 제목·작가를 명시해야 합니다.
      const title = parsed.title || "";
      const author = parsed.author || "";
      if (!title || !author) {
        return res.status(422).json({ error: AI_ANALYSIS_UNAVAILABLE_MESSAGE });
      }
      let genre: "classic" | "modern" | "foreign" = "modern";
      let description = parsed.summary || "";
      let content = parsed.content || extractedText;

      if (parsed.genre) genre = classifyGenre(parsed.genre);
      const tableOfContents = parsed.tableOfContents || "";
      const studyMaterial = parsed.studyMaterial || "";

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

  // 새 Render 환경에 AI 제공자가 연결되기 전까지는 명확히 비활성화합니다.
  app.post("/api/upload/analyze/:bookId", requireAdmin, async (req: Request, res: Response) => {
    void req;
    return res.status(501).json({ error: AI_ANALYSIS_UNAVAILABLE_MESSAGE });
  });
}
