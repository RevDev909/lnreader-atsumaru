// Atsumaru plugin for LNReader.
// Site: https://atsu.moe — a manga/novel platform; this plugin covers
// its novel catalog (2,669 titles). The catalog/search runs on a public
// Typesense collection; series details, chapter lists and chapter text
// come from the site's JSON API (see parsers.ts for the endpoints).
//
import {
  chooseChapterSet,
  parseAllChapters,
  parseChapterBody,
  parseNovelCards,
  parseNovelDetails,
} from './parsers';
import type { Plugin } from './lnreader-api';

// The host app injects these via `require`, but their exact shape has varied
// across app versions, so resolve them defensively at load with fallbacks.
declare function require(name: string): any;

function loadFetchLib(): {
  fetchText?: (url: string) => Promise<string>;
  fetchApi?: (url: string) => Promise<{ text: () => Promise<string> }>;
} {
  try {
    return require('@libs/fetch') || {};
  } catch (e) {
    return {};
  }
}

function loadNovelStatus(): Record<string, string> {
  try {
    const lib = require('@libs/novelStatus');
    if (lib && lib.NovelStatus) return lib.NovelStatus;
  } catch (e) {
    // fall through to the built-in copy below
  }
  // Built-in copy of the NovelStatus string enum, so the plugin keeps
  // working even if the host does not provide @libs/novelStatus.
  return {
    Unknown: 'Unknown',
    Ongoing: 'Ongoing',
    Completed: 'Completed',
    Licensed: 'Licensed',
    PublishingFinished: 'Publishing Finished',
    Cancelled: 'Cancelled',
    OnHiatus: 'On Hiatus',
  };
}

const fetchLib = loadFetchLib();
const NovelStatus = loadNovelStatus();

// --- Resilient fetching -------------------------------------------------
// Chapter downloads are one HTTP request per chapter, so a single flaky
// request used to fail the whole chapter. This wrapper adds a timeout and
// retries transient failures with exponential backoff. It never fires
// parallel requests and never retries definite client errors, so the site
// is treated respectfully.
const FETCH_TIMEOUT_MS = 30000;
const MAX_FETCH_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    if (typeof setTimeout === 'function') setTimeout(resolve, ms);
    else resolve();
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: any = undefined;
  const timeout = new Promise<T>((_, reject) => {
    if (typeof setTimeout === 'function') {
      timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    }
  });
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
  };
  return Promise.race([p, timeout]).then(
    v => {
      clear();
      return v;
    },
    e => {
      clear();
      throw e;
    },
  );
}

interface RawFetchResult {
  status?: number;
  retryAfter?: number;
  text: string;
}

async function fetchRaw(url: string): Promise<RawFetchResult> {
  if (typeof fetchLib.fetchApi === 'function') {
    const res: any = await fetchLib.fetchApi(url);
    const status =
      res && typeof res.status === 'number' ? res.status : undefined;
    const text =
      res && typeof res.text === 'function' ? await res.text() : '';
    // Retry-After only matters on 429; parse it defensively and cap it
    // at 10s so a hostile header can't stall the retry loop.
    let retryAfter: number | undefined;
    const rawHeader =
      res && res.headers && typeof res.headers.get === 'function'
        ? res.headers.get('retry-after')
        : undefined;
    if (typeof rawHeader === 'string') {
      const parsed = parseInt(rawHeader, 10);
      if (!isNaN(parsed) && parsed >= 0) retryAfter = Math.min(parsed, 10);
    }
    return { status, retryAfter, text };
  }
  if (typeof fetchLib.fetchText === 'function') {
    return { text: await fetchLib.fetchText(url) };
  }
  throw new Error('No fetch implementation provided by the host app');
}

/** Pull an HTTP status out of errors like "HTTP 503". */
function statusFromError(e: any): number | undefined {
  const m = /HTTP (\d{3})/.exec(String((e && e.message) || e || ''));
  return m ? parseInt(m[1], 10) : undefined;
}

async function fetchText(url: string): Promise<string> {
  let lastError: any = new Error('Request failed');
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    let status: number | undefined;
    let retryAfterSecs: number | undefined;
    try {
      const res = await withTimeout(fetchRaw(url), FETCH_TIMEOUT_MS);
      status = res.status;
      retryAfterSecs = res.retryAfter;
      if (status === 429 || (status !== undefined && status >= 500)) {
        throw new Error('Server responded with HTTP ' + status);
      }
      return res.text;
    } catch (e) {
      lastError = e;
      if (status === undefined) status = statusFromError(e);
      // Attach the status so callers (and the app) can tell a site
      // block or outage apart from a plugin bug.
      (lastError as any).status = status;
      const msg = String((e && (e as Error).message) || e || '');
      const retryable =
        status === undefined ||
        status === 429 ||
        status >= 500 ||
        /timed out|timeout|Network|network|fetch failed/i.test(msg);
      if (!retryable || attempt === MAX_FETCH_ATTEMPTS) throw lastError;
      const waitSecs =
        status === 429 && retryAfterSecs !== undefined
          ? retryAfterSecs
          : Math.pow(2, attempt - 1);
      await sleep(1000 * waitSecs); // 1s, then 2s, or Retry-After on 429
    }
  }
  throw lastError;
}

// --- Plugin -------------------------------------------------------------

const SITE = 'https://atsu.moe';
const QUERY_BY = 'title,englishTitle,otherNames,authors,acronyms';
const FILTER = 'medium:=Novel && hidden:!=true';
const PER_PAGE = 24;

// Genre list for the browse filter, sorted A-Z by name. The site has no
// genre-list endpoint, so this was built by walking the whole catalog
// (2,669 novels, 11 search pages) and resolving every genre id that
// actually appears through a novel detail page. Only 21 ids exist, so
// the list is complete, not a sample. Defined above the plugin class on
// purpose: the filters field reads it at construction time.
const GENRE_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: '0' },
  { label: 'Action', value: '39' },
  { label: 'Adult', value: '46' },
  { label: 'Adventure', value: '37' },
  { label: 'Boys Love', value: '180' },
  { label: 'Comedy', value: '6' },
  { label: 'Drama', value: '31' },
  { label: 'Fantasy', value: '36' },
  { label: 'Girls Love', value: '4' },
  { label: 'Hentai', value: '10' },
  { label: 'Historical', value: '45' },
  { label: 'Horror', value: '44' },
  { label: 'Martial Arts', value: '29' },
  { label: 'Mystery', value: '32' },
  { label: 'Psychological', value: '18' },
  { label: 'Romance', value: '9' },
  { label: 'Sci-Fi', value: '1' },
  { label: 'Slice of Life', value: '7' },
  { label: 'Smut', value: '41' },
  { label: 'Supernatural', value: '22' },
  { label: 'Thriller', value: '19' },
  { label: 'Tragedy', value: '5' },
];

function searchUrl(
  query: string,
  sortBy: string,
  pageNo: number,
  genreId?: string,
): string {
  let filter = FILTER;
  // Only a numeric id from the Picker ever reaches the query, so a
  // crafted filter value cannot inject extra Typesense clauses.
  if (genreId && genreId !== '0' && /^\d+$/.test(genreId)) {
    filter += ' && genreIds:=' + genreId;
  }
  return (
    `${SITE}/collections/manga/documents/search` +
    `?q=${encodeURIComponent(query)}` +
    `&query_by=${encodeURIComponent(QUERY_BY)}` +
    `&page=${pageNo}&per_page=${PER_PAGE}` +
    `&filter_by=${encodeURIComponent(filter)}` +
    `&sort_by=${encodeURIComponent(sortBy)}`
  );
}

class AtsumaruPlugin implements Plugin.PluginBase {
  id = 'atsumaru';
  name = 'Atsumaru';
  icon = 'src/en/atsumaru/icon.png';
  site = 'https://atsu.moe';
  version = '1.1.0';

  // The app renders this as a Picker in the browse filter sheet and
  // passes the chosen value back in options.filters.genre.value.
  // 'Picker' is the app's FilterTypes.Picker string value, so no
  // @libs/filterInputs import is needed here.
  filters = {
    genre: {
      label: 'Genre',
      value: '0',
      options: GENRE_OPTIONS,
      type: 'Picker',
    },
  };

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const sortBy =
      options && options.showLatestNovels ? 'dateAdded:desc' : 'views:desc';
    // Latest keeps its own sort even with a genre picked; the genre
    // only narrows the result set, it never replaces the sort.
    const rawFilters: any =
      options && (options as any).filters ? (options as any).filters : {};
    const genreValue: string =
      rawFilters.genre && typeof rawFilters.genre.value === 'string'
        ? rawFilters.genre.value
        : '0';
    const text = await fetchText(
      searchUrl('*', sortBy, pageNo, genreValue),
    );
    return parseNovelCards(text);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const id = novelPath.replace(/^\/+|\/+$/g, '');
    const details = parseNovelDetails(
      await fetchText(`${SITE}/api/manga/page?id=${encodeURIComponent(id)}`),
    );
    if (!details.name) {
      throw new Error('Could not load the novel ' + novelPath);
    }
    const all = parseAllChapters(
      await fetchText(
        `${SITE}/api/manga/allChapters?mangaId=${encodeURIComponent(id)}`,
      ),
    );
    const set = chooseChapterSet(all, details.scanlatorIds);
    const chapters: Plugin.ChapterItem[] = set.map(e => ({
      name: e.title,
      path: `${id}/${e.id}`,
      chapterNumber: e.number,
    }));
    const raw = details.statusRaw.toLowerCase();
    const status =
      details.statusRaw === 'Completed'
        ? NovelStatus.Completed
        : details.statusRaw === 'Ongoing'
          ? NovelStatus.Ongoing
          : raw.indexOf('hiatus') >= 0
            ? NovelStatus.OnHiatus
            : raw.indexOf('cancel') >= 0
              ? NovelStatus.Cancelled
              : NovelStatus.Unknown;
    return {
      path: novelPath,
      name: details.name,
      cover: details.cover,
      summary: details.summary,
      genres: details.genres.length ? details.genres.join(', ') : undefined,
      status,
      chapters,
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const parts = chapterPath.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length !== 2) {
      throw new Error('Unexpected chapter path: ' + chapterPath);
    }
    const url =
      `${SITE}/api/read/novelChapter?mangaId=${encodeURIComponent(parts[0])}` +
      `&chapterId=${encodeURIComponent(parts[1])}`;
    const content = parseChapterBody(await fetchText(url));
    if (!content) {
      throw new Error('Chapter content not found');
    }
    return content;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const text = await fetchText(searchUrl(searchTerm, 'views:desc', pageNo));
    return parseNovelCards(text);
  }

  resolveUrl = (path: string, _isNovel?: boolean) => {
    if (/^https?:\/\//i.test(path)) return path;
    if (path.indexOf('//') === 0) return 'https:' + path;
    return `${this.site}/title/${path}`;
  };
}

export default new AtsumaruPlugin();
