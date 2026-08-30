type SitemapBook = { id: number; updatedAt: Date };

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}

function formatLastModified(date: Date): string {
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

/** 공개 홈과 도서 읽기 페이지를 검색 엔진에 알리는 XML sitemap을 생성합니다. */
export function buildSitemap(baseUrl: string, books: SitemapBook[]): string {
  const canonicalBase = baseUrl.replace(/\/+$/, "");
  const home = `<url><loc>${escapeXml(`${canonicalBase}/`)}</loc></url>`;
  const bookUrls = books.map((book) => (
    `<url><loc>${escapeXml(`${canonicalBase}/read/${book.id}`)}</loc><lastmod>${formatLastModified(book.updatedAt)}</lastmod></url>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${home}${bookUrls}</urlset>`;
}
