/**
 * Render Free 인스턴스가 대기 상태에서 다시 시작할 때의 지연을 견디도록
 * 도서 목록 요청에 적용하는 공통 정책입니다.
 */
export const booksQueryOptions = {
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 8000),
  refetchOnWindowFocus: true,
} as const;

/** 오류가 발생한 경우에는 실제 빈 도서관 화면을 표시하지 않습니다. */
export function shouldShowEmptyBooks(books: unknown[] | undefined, isError: boolean) {
  return !isError && Array.isArray(books) && books.length === 0;
}

/** 목록 요청이 아직 진행 중이거나 실패한 경우 0권으로 보이지 않게 합니다. */
export function getBookCountLabel(books: unknown[] | undefined, isError: boolean) {
  if (isError) return "불러오기 실패";
  if (!books) return "불러오는 중";
  return `${books.length}`;
}
