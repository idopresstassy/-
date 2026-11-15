import { CREATIVE_GENRES, type CreativeGenre } from "@shared/creative";

type Genre = "classic" | "modern" | "foreign" | "creative";
export type CatalogState = {
  genre?: Genre;
  creativeGenre?: CreativeGenre;
  search: string;
  searchInput: string;
};
const KEY = "korealib:catalog-state:v1";
const genres = ["classic", "modern", "foreign", "creative"];
const emptyState = (): CatalogState => ({ search: "", searchInput: "" });

// Session storage keeps a tab's catalogue intact when the reader returns to '/'.
// Storage may be unavailable in private mode: reading books must still work.
export function readCatalogState(query: string): CatalogState {
  let state = emptyState();
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (saved && typeof saved === "object") {
      state = {
        genre: genres.includes(saved.genre) ? saved.genre : undefined,
        creativeGenre: CREATIVE_GENRES.some(g => g.value === saved.creativeGenre) ? saved.creativeGenre : undefined,
        search: typeof saved.search === "string" ? saved.search : "",
        searchInput: typeof saved.searchInput === "string" ? saved.searchInput : "",
      };
    }
  } catch { /* Empty state is safe when storage is blocked or corrupt. */ }
  const params = new URLSearchParams(query);
  // Explicit category links (including the creative submission return) win.
  if (params.has("genre")) {
    const genre = params.get("genre");
    const requestedGenre = genres.includes(genre ?? "") ? genre as Genre : undefined;
    if (requestedGenre !== state.genre) state = { ...emptyState(), genre: requestedGenre };
  }
  return state;
}

export function saveCatalogState(state: CatalogState): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Optional convenience. */ }
}
