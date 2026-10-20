// Atsumaru parsers — pure functions over the site's JSON responses.
// atsu.moe is a React SPA; the data comes from two same-origin services:
//   Catalog/search: a Typesense collection —
//     GET /collections/manga/documents/search?q=..&query_by=title,
//         englishTitle,otherNames,authors,acronyms&page=N&per_page=24
//         &filter_by=medium:=Novel && hidden:!=true&sort_by=views:desc
//     (2,669 novels; the same collection also holds the site's manga.)
//   Series API:
//     GET /api/manga/page?id=<id>              details + scanlation groups
//     GET /api/manga/allChapters?mangaId=<id>  every chapter, newest first,
//                                              across ALL scanlation groups
//     GET /api/read/novelChapter?mangaId=<id>&chapterId=<id>
//                                              chapter text as paragraphs[]
//
// A novel can be carried by several scanlation groups; parseNovel reads
// one group's set (the largest, so the book is as complete as possible).
//
// Defensive cap so a corrupt or hostile response cannot make the app
// buffer unbounded data. The chapter-list payload is the big one: a
// 6,400-chapter novel across two groups is ~1.2 MB, so the cap sits
// well above legitimate responses.
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

const CDN = 'https://cdn.atsu.moe/static/';

function checkSize(text: string): void {
  if (text && text.length > MAX_RESPONSE_BYTES) {
    throw new Error('Response too large (' + text.length + ' bytes)');
  }
}

function parseJson(text: string, what: string): any {
  checkSize(text);
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(what + ' response was not valid JSON');
  }
  if (!data || typeof data !== 'object') {
    throw new Error(what + ' response had an unexpected shape');
  }
  return data;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface NovelCard {
  name: string;
  /** The series id used by the /api endpoints (e.g. "8kL3"). */
  path: string;
  cover?: string;
}

/** One Typesense search response (catalog listing or search results). */
export function parseNovelCards(text: string): NovelCard[] {
  const data = parseJson(text, 'Novel list');
  if (!Array.isArray(data.hits)) {
    // An error payload or a changed shape must surface as a failure,
    // not as an empty catalog page.
    throw new Error('Novel list response had an unexpected shape');
  }
  const cards: NovelCard[] = [];
  for (const hit of data.hits) {
    const doc = (hit && hit.document) || {};
    if (typeof doc.id !== 'string' || !doc.id) continue;
    cards.push({
      name: String(doc.title || doc.englishTitle || doc.id),
      path: doc.id,
      cover:
        typeof doc.poster === 'string' && doc.poster
          ? 'https://cdn.atsu.moe' + doc.poster
          : undefined,
    });
  }
  return cards;
}

export interface NovelDetails {
  name: string;
  cover?: string;
  summary?: string;
  genres: string[];
  /** Raw site status, e.g. "Ongoing" / "Completed". */
  statusRaw: string;
  /** Scanlation group ids, in the site's own preference order. */
  scanlatorIds: string[];
}

/** GET /api/manga/page — series details. */
export function parseNovelDetails(text: string): NovelDetails {
  const data = parseJson(text, 'Novel');
  const page = data.mangaPage;
  if (!page || typeof page !== 'object') {
    throw new Error('Novel response had an unexpected shape');
  }
  const genres: string[] = [];
  if (Array.isArray(page.genres)) {
    for (const g of page.genres) {
      if (g && typeof g.name === 'string' && g.name) genres.push(g.name);
    }
  }
  const scanlatorIds: string[] = [];
  if (Array.isArray(page.scanlators)) {
    for (const s of page.scanlators) {
      if (s && typeof s.id === 'string' && s.id) scanlatorIds.push(s.id);
    }
  }
  const poster = page.poster || {};
  return {
    name: String(page.title || page.englishTitle || ''),
    cover:
      typeof poster.image === 'string' && poster.image
        ? CDN + poster.image
        : undefined,
    summary:
      typeof page.synopsis === 'string' && page.synopsis
        ? page.synopsis
        : undefined,
    genres,
    statusRaw: typeof page.status === 'string' ? page.status : '',
    scanlatorIds,
  };
}

export interface ChapterEntry {
  id: string;
  scanId: string;
  number: number;
  title: string;
}

/** GET /api/manga/allChapters — raw entries across all groups. */
export function parseAllChapters(text: string): ChapterEntry[] {
  const data = parseJson(text, 'Chapter list');
  if (!Array.isArray(data.chapters)) {
    throw new Error('Chapter list response had an unexpected shape');
  }
  const entries: ChapterEntry[] = [];
  for (const c of data.chapters) {
    if (!c || typeof c.id !== 'string' || !c.id) continue;
    const num =
      typeof c.number === 'number' ? c.number : parseFloat(String(c.number));
    if (!isFinite(num)) continue;
    entries.push({
      id: c.id,
      scanId: typeof c.scanlationMangaId === 'string' ? c.scanlationMangaId : '',
      number: num,
      title: String(c.title || 'Chapter ' + num),
    });
  }
  return entries;
}

/**
 * Reduce the all-groups chapter dump to ONE group's set: the group with
 * the most chapters (ties broken by the site's own group order), sorted
 * ascending by chapter number, duplicates by number dropped.
 */
export function chooseChapterSet(
  entries: ChapterEntry[],
  preferredOrder: string[],
): ChapterEntry[] {
  const byGroup = new Map<string, ChapterEntry[]>();
  for (const e of entries) {
    const list = byGroup.get(e.scanId);
    if (list) list.push(e);
    else byGroup.set(e.scanId, [e]);
  }
  let best: ChapterEntry[] = [];
  let bestRank = Infinity;
  byGroup.forEach((list, scanId) => {
    const idx = preferredOrder.indexOf(scanId);
    const rank = idx < 0 ? preferredOrder.length : idx;
    if (
      list.length > best.length ||
      (list.length === best.length && rank < bestRank)
    ) {
      best = list;
      bestRank = rank;
    }
  });
  const sorted = best.slice().sort((a, b) => a.number - b.number);
  const seen = new Set<number>();
  const out: ChapterEntry[] = [];
  for (const e of sorted) {
    if (seen.has(e.number)) continue;
    seen.add(e.number);
    out.push(e);
  }
  return out;
}

/**
 * Chapter body from GET /api/read/novelChapter: the text arrives as an
 * array of plain-text paragraphs, wrapped into <p> HTML (escaped — the
 * paragraphs are raw text, not HTML).
 */
export function parseChapterBody(text: string): string {
  const data = parseJson(text, 'Chapter');
  const rc = data.readNovelChapter;
  if (!rc || !Array.isArray(rc.paragraphs)) {
    throw new Error('Chapter response had an unexpected shape');
  }
  const parts: string[] = [];
  for (const p of rc.paragraphs) {
    if (typeof p !== 'string') continue;
    const trimmed = p.trim();
    if (trimmed) parts.push('<p>' + escapeHtml(trimmed) + '</p>');
  }
  return parts.join('\n');
}
