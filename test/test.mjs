// Live parser tests for the Atsumaru plugin.
// Runs against the real site; every check must pass.
import {
  chooseChapterSet,
  parseAllChapters,
  parseChapterBody,
  parseNovelCards,
  parseNovelDetails,
} from './parsers.bundle.mjs';

const SITE = 'https://atsu.moe';
const QUERY_BY = 'title,englishTitle,otherNames,authors,acronyms';
const FILTER = 'medium:=Novel && hidden:!=true';
let failures = 0;

function check(label, ok, extra) {
  if (ok) {
    console.log('  PASS', label);
  } else {
    failures++;
    console.log('  FAIL', label, extra !== undefined ? '-> ' + extra : '');
  }
}

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
    },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.text();
}

function searchUrl(q, sortBy, page) {
  return (
    `${SITE}/collections/manga/documents/search?q=${encodeURIComponent(q)}` +
    `&query_by=${encodeURIComponent(QUERY_BY)}&page=${page}&per_page=24` +
    `&filter_by=${encodeURIComponent(FILTER)}&sort_by=${encodeURIComponent(sortBy)}`
  );
}

console.log('catalog (popular, page 1):');
{
  const cards = parseNovelCards(await get(searchUrl('*', 'views:desc', 1)));
  check('24 cards', cards.length === 24, cards.length);
  check('first is Shadow Slave', cards[0].path === '8kL3', cards[0].name);
  check(
    'all cards have name, id path and cover',
    cards.every(c => c.name && c.path && c.cover),
  );
  const beyond = parseNovelCards(await get(searchUrl('*', 'views:desc', 999)));
  check('page past the end is empty', beyond.length === 0, beyond.length);
}

console.log('search:');
{
  const cards = parseNovelCards(
    await get(searchUrl('lord of the mysteries', 'views:desc', 1)),
  );
  check(
    'finds Lord of Mysteries',
    cards.some(c => /Lord of Mysteries/i.test(c.name)),
  );
}

console.log('novel details (Shadow Slave):');
let details;
{
  details = parseNovelDetails(await get(`${SITE}/api/manga/page?id=8kL3`));
  check('name parsed', details.name === 'Shadow Slave', details.name);
  check('synopsis mentions poverty', /poverty/.test(details.summary || ''));
  check('genres include Action', details.genres.indexOf('Action') >= 0);
  check('status Ongoing', details.statusRaw === 'Ongoing', details.statusRaw);
  check('cover is a CDN URL', (details.cover || '').indexOf('cdn.atsu.moe') >= 0);
  check('scanlators listed', details.scanlatorIds.length >= 1);
}

console.log('chapter list (one group, complete):');
{
  const all = parseAllChapters(
    await get(`${SITE}/api/manga/allChapters?mangaId=8kL3`),
  );
  check('raw entries across groups 6000+', all.length >= 6000, all.length);
  const set = chooseChapterSet(all, details.scanlatorIds);
  check('chosen set 3000+ chapters', set.length >= 3000, set.length);
  check('ascending', set[0].number === 1 && set[set.length - 1].number >= 3000);
  check(
    'numbers unique',
    new Set(set.map(e => e.number)).size === set.length,
  );
  check(
    'all from one group',
    set.every(e => e.scanId === set[0].scanId),
  );
}

console.log('chapter body (chapter 1):');
{
  const body = parseChapterBody(
    await get(
      `${SITE}/api/read/novelChapter?mangaId=8kL3&chapterId=H51rMO`,
    ),
  );
  check('body long', body.length > 8000, body.length);
  check('has story text', /frail-looking young man/.test(body));
  check('paragraphs wrapped in <p>', body.indexOf('<p>') === 0);
  check('no raw script', !/<script/.test(body));
}

console.log('shape validation:');
{
  let threw = false;
  try {
    parseAllChapters('{"error":"boom"}');
  } catch (e) {
    threw = /unexpected shape/.test(e.message);
  }
  check('bad chapter-list payload throws', threw);
  threw = false;
  try {
    parseNovelCards('{"error":"boom"}');
  } catch (e) {
    threw = /unexpected shape/.test(e.message);
  }
  check('bad list payload throws', threw);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
