"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = function(cb, mod) {
  return function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
};

// .tsc-build/parsers.js
var require_parsers = __commonJS({
  ".tsc-build/parsers.js": function(exports2) {
    "use strict";
    var __values = exports2 && exports2.__values || function(o) {
      var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function() {
          if (o && i >= o.length) o = void 0;
          return { value: o && o[i++], done: !o };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseNovelCards = parseNovelCards;
    exports2.parseNovelDetails = parseNovelDetails;
    exports2.parseAllChapters = parseAllChapters;
    exports2.chooseChapterSet = chooseChapterSet;
    exports2.parseChapterBody = parseChapterBody;
    var MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
    var CDN = "https://cdn.atsu.moe/static/";
    function checkSize(text) {
      if (text && text.length > MAX_RESPONSE_BYTES) {
        throw new Error("Response too large (" + text.length + " bytes)");
      }
    }
    function parseJson(text, what) {
      checkSize(text);
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(what + " response was not valid JSON");
      }
      if (!data || typeof data !== "object") {
        throw new Error(what + " response had an unexpected shape");
      }
      return data;
    }
    function escapeHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function parseNovelCards(text) {
      var e_1, _a;
      var data = parseJson(text, "Novel list");
      if (!Array.isArray(data.hits)) {
        throw new Error("Novel list response had an unexpected shape");
      }
      var cards = [];
      try {
        for (var _b = __values(data.hits), _c = _b.next(); !_c.done; _c = _b.next()) {
          var hit = _c.value;
          var doc = hit && hit.document || {};
          if (typeof doc.id !== "string" || !doc.id)
            continue;
          cards.push({
            name: String(doc.title || doc.englishTitle || doc.id),
            path: doc.id,
            cover: typeof doc.poster === "string" && doc.poster ? "https://cdn.atsu.moe" + doc.poster : void 0
          });
        }
      } catch (e_1_1) {
        e_1 = { error: e_1_1 };
      } finally {
        try {
          if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      return cards;
    }
    function parseNovelDetails(text) {
      var e_2, _a, e_3, _b;
      var data = parseJson(text, "Novel");
      var page = data.mangaPage;
      if (!page || typeof page !== "object") {
        throw new Error("Novel response had an unexpected shape");
      }
      var genres = [];
      if (Array.isArray(page.genres)) {
        try {
          for (var _c = __values(page.genres), _d = _c.next(); !_d.done; _d = _c.next()) {
            var g = _d.value;
            if (g && typeof g.name === "string" && g.name)
              genres.push(g.name);
          }
        } catch (e_2_1) {
          e_2 = { error: e_2_1 };
        } finally {
          try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
          } finally {
            if (e_2) throw e_2.error;
          }
        }
      }
      var scanlatorIds = [];
      if (Array.isArray(page.scanlators)) {
        try {
          for (var _e = __values(page.scanlators), _f = _e.next(); !_f.done; _f = _e.next()) {
            var s = _f.value;
            if (s && typeof s.id === "string" && s.id)
              scanlatorIds.push(s.id);
          }
        } catch (e_3_1) {
          e_3 = { error: e_3_1 };
        } finally {
          try {
            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
          } finally {
            if (e_3) throw e_3.error;
          }
        }
      }
      var poster = page.poster || {};
      return {
        name: String(page.title || page.englishTitle || ""),
        cover: typeof poster.image === "string" && poster.image ? CDN + poster.image : void 0,
        summary: typeof page.synopsis === "string" && page.synopsis ? page.synopsis : void 0,
        genres: genres,
        statusRaw: typeof page.status === "string" ? page.status : "",
        scanlatorIds: scanlatorIds
      };
    }
    function parseAllChapters(text) {
      var e_4, _a;
      var data = parseJson(text, "Chapter list");
      if (!Array.isArray(data.chapters)) {
        throw new Error("Chapter list response had an unexpected shape");
      }
      var entries = [];
      try {
        for (var _b = __values(data.chapters), _c = _b.next(); !_c.done; _c = _b.next()) {
          var c = _c.value;
          if (!c || typeof c.id !== "string" || !c.id)
            continue;
          var num = typeof c.number === "number" ? c.number : parseFloat(String(c.number));
          if (!isFinite(num))
            continue;
          entries.push({
            id: c.id,
            scanId: typeof c.scanlationMangaId === "string" ? c.scanlationMangaId : "",
            number: num,
            title: String(c.title || "Chapter " + num)
          });
        }
      } catch (e_4_1) {
        e_4 = { error: e_4_1 };
      } finally {
        try {
          if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        } finally {
          if (e_4) throw e_4.error;
        }
      }
      return entries;
    }
    function chooseChapterSet(entries, preferredOrder) {
      var e_5, _a, e_6, _b;
      var byGroup = /* @__PURE__ */ new Map();
      try {
        for (var entries_1 = __values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
          var e = entries_1_1.value;
          var list = byGroup.get(e.scanId);
          if (list)
            list.push(e);
          else
            byGroup.set(e.scanId, [e]);
        }
      } catch (e_5_1) {
        e_5 = { error: e_5_1 };
      } finally {
        try {
          if (entries_1_1 && !entries_1_1.done && (_a = entries_1.return)) _a.call(entries_1);
        } finally {
          if (e_5) throw e_5.error;
        }
      }
      var best = [];
      var bestRank = Infinity;
      byGroup.forEach(function(list2, scanId) {
        var idx = preferredOrder.indexOf(scanId);
        var rank = idx < 0 ? preferredOrder.length : idx;
        if (list2.length > best.length || list2.length === best.length && rank < bestRank) {
          best = list2;
          bestRank = rank;
        }
      });
      var sorted = best.slice().sort(function(a, b) {
        return a.number - b.number;
      });
      var seen = /* @__PURE__ */ new Set();
      var out = [];
      try {
        for (var sorted_1 = __values(sorted), sorted_1_1 = sorted_1.next(); !sorted_1_1.done; sorted_1_1 = sorted_1.next()) {
          var e = sorted_1_1.value;
          if (seen.has(e.number))
            continue;
          seen.add(e.number);
          out.push(e);
        }
      } catch (e_6_1) {
        e_6 = { error: e_6_1 };
      } finally {
        try {
          if (sorted_1_1 && !sorted_1_1.done && (_b = sorted_1.return)) _b.call(sorted_1);
        } finally {
          if (e_6) throw e_6.error;
        }
      }
      return out;
    }
    function parseChapterBody(text) {
      var e_7, _a;
      var data = parseJson(text, "Chapter");
      var rc = data.readNovelChapter;
      if (!rc || !Array.isArray(rc.paragraphs)) {
        throw new Error("Chapter response had an unexpected shape");
      }
      var parts = [];
      try {
        for (var _b = __values(rc.paragraphs), _c = _b.next(); !_c.done; _c = _b.next()) {
          var p = _c.value;
          if (typeof p !== "string")
            continue;
          var trimmed = p.trim();
          if (trimmed)
            parts.push("<p>" + escapeHtml(trimmed) + "</p>");
        }
      } catch (e_7_1) {
        e_7 = { error: e_7_1 };
      } finally {
        try {
          if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        } finally {
          if (e_7) throw e_7.error;
        }
      }
      return parts.join("\n");
    }
  }
});

// .tsc-build/plugin.js
var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __generator = exports && exports.__generator || function(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
};
Object.defineProperty(exports, "__esModule", { value: true });
var parsers_1 = require_parsers();
function loadFetchLib() {
  try {
    return require("@libs/fetch") || {};
  } catch (e) {
    return {};
  }
}
function loadNovelStatus() {
  try {
    var lib = require("@libs/novelStatus");
    if (lib && lib.NovelStatus)
      return lib.NovelStatus;
  } catch (e) {
  }
  return {
    Unknown: "Unknown",
    Ongoing: "Ongoing",
    Completed: "Completed",
    Licensed: "Licensed",
    PublishingFinished: "Publishing Finished",
    Cancelled: "Cancelled",
    OnHiatus: "On Hiatus"
  };
}
var fetchLib = loadFetchLib();
var NovelStatus = loadNovelStatus();
var FETCH_TIMEOUT_MS = 3e4;
var MAX_FETCH_ATTEMPTS = 3;
function sleep(ms) {
  return new Promise(function(resolve) {
    if (typeof setTimeout === "function")
      setTimeout(resolve, ms);
    else
      resolve();
  });
}
function withTimeout(p, ms) {
  var timer = void 0;
  var timeout = new Promise(function(_, reject) {
    if (typeof setTimeout === "function") {
      timer = setTimeout(function() {
        return reject(new Error("Request timed out"));
      }, ms);
    }
  });
  var clear = function() {
    if (timer !== void 0)
      clearTimeout(timer);
  };
  return Promise.race([p, timeout]).then(function(v) {
    clear();
    return v;
  }, function(e) {
    clear();
    throw e;
  });
}
function fetchRaw(url) {
  return __awaiter(this, void 0, void 0, function() {
    var res, status_1, text, _a, retryAfter, rawHeader, parsed;
    var _b;
    return __generator(this, function(_c) {
      switch (_c.label) {
        case 0:
          if (!(typeof fetchLib.fetchApi === "function")) return [3, 5];
          return [4, fetchLib.fetchApi(url)];
        case 1:
          res = _c.sent();
          status_1 = res && typeof res.status === "number" ? res.status : void 0;
          if (!(res && typeof res.text === "function")) return [3, 3];
          return [4, res.text()];
        case 2:
          _a = _c.sent();
          return [3, 4];
        case 3:
          _a = "";
          _c.label = 4;
        case 4:
          text = _a;
          retryAfter = void 0;
          rawHeader = res && res.headers && typeof res.headers.get === "function" ? res.headers.get("retry-after") : void 0;
          if (typeof rawHeader === "string") {
            parsed = parseInt(rawHeader, 10);
            if (!isNaN(parsed) && parsed >= 0)
              retryAfter = Math.min(parsed, 10);
          }
          return [2, { status: status_1, retryAfter: retryAfter, text: text }];
        case 5:
          if (!(typeof fetchLib.fetchText === "function")) return [3, 7];
          _b = {};
          return [4, fetchLib.fetchText(url)];
        case 6:
          return [2, (_b.text = _c.sent(), _b)];
        case 7:
          throw new Error("No fetch implementation provided by the host app");
      }
    });
  });
}
function statusFromError(e) {
  var m = /HTTP (\d{3})/.exec(String(e && e.message || e || ""));
  return m ? parseInt(m[1], 10) : void 0;
}
function fetchText(url) {
  return __awaiter(this, void 0, void 0, function() {
    var lastError, attempt, status_2, retryAfterSecs, res, e_1, msg, retryable, waitSecs;
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          lastError = new Error("Request failed");
          attempt = 1;
          _a.label = 1;
        case 1:
          if (!(attempt <= MAX_FETCH_ATTEMPTS)) return [3, 7];
          status_2 = void 0;
          retryAfterSecs = void 0;
          _a.label = 2;
        case 2:
          _a.trys.push([2, 4, , 6]);
          return [4, withTimeout(fetchRaw(url), FETCH_TIMEOUT_MS)];
        case 3:
          res = _a.sent();
          status_2 = res.status;
          retryAfterSecs = res.retryAfter;
          if (status_2 === 429 || status_2 !== void 0 && status_2 >= 500) {
            throw new Error("Server responded with HTTP " + status_2);
          }
          return [2, res.text];
        case 4:
          e_1 = _a.sent();
          lastError = e_1;
          if (status_2 === void 0)
            status_2 = statusFromError(e_1);
          lastError.status = status_2;
          msg = String(e_1 && e_1.message || e_1 || "");
          retryable = status_2 === void 0 || status_2 === 429 || status_2 >= 500 || /timed out|timeout|Network|network|fetch failed/i.test(msg);
          if (!retryable || attempt === MAX_FETCH_ATTEMPTS)
            throw lastError;
          waitSecs = status_2 === 429 && retryAfterSecs !== void 0 ? retryAfterSecs : Math.pow(2, attempt - 1);
          return [4, sleep(1e3 * waitSecs)];
        case 5:
          _a.sent();
          return [3, 6];
        case 6:
          attempt++;
          return [3, 1];
        case 7:
          throw lastError;
      }
    });
  });
}
var SITE = "https://atsu.moe";
var QUERY_BY = "title,englishTitle,otherNames,authors,acronyms";
var FILTER = "medium:=Novel && hidden:!=true";
var PER_PAGE = 24;
var GENRE_OPTIONS = [
  { label: "All", value: "0" },
  { label: "Action", value: "39" },
  { label: "Adult", value: "46" },
  { label: "Adventure", value: "37" },
  { label: "Boys Love", value: "180" },
  { label: "Comedy", value: "6" },
  { label: "Drama", value: "31" },
  { label: "Fantasy", value: "36" },
  { label: "Girls Love", value: "4" },
  { label: "Hentai", value: "10" },
  { label: "Historical", value: "45" },
  { label: "Horror", value: "44" },
  { label: "Martial Arts", value: "29" },
  { label: "Mystery", value: "32" },
  { label: "Psychological", value: "18" },
  { label: "Romance", value: "9" },
  { label: "Sci-Fi", value: "1" },
  { label: "Slice of Life", value: "7" },
  { label: "Smut", value: "41" },
  { label: "Supernatural", value: "22" },
  { label: "Thriller", value: "19" },
  { label: "Tragedy", value: "5" }
];
function searchUrl(query, sortBy, pageNo, genreId) {
  var filter = FILTER;
  if (genreId && genreId !== "0" && /^\d+$/.test(genreId)) {
    filter += " && genreIds:=" + genreId;
  }
  return "".concat(SITE, "/collections/manga/documents/search") + "?q=".concat(encodeURIComponent(query)) + "&query_by=".concat(encodeURIComponent(QUERY_BY)) + "&page=".concat(pageNo, "&per_page=").concat(PER_PAGE) + "&filter_by=".concat(encodeURIComponent(filter)) + "&sort_by=".concat(encodeURIComponent(sortBy));
}
var AtsumaruPlugin = (
  /** @class */
  (function() {
    function AtsumaruPlugin2() {
      var _this = this;
      this.id = "atsumaru";
      this.name = "Atsumaru";
      this.icon = "src/en/atsumaru/icon.png";
      this.site = "https://atsu.moe";
      this.version = "1.1.0";
      this.filters = {
        genre: {
          label: "Genre",
          value: "0",
          options: GENRE_OPTIONS,
          type: "Picker"
        }
      };
      this.resolveUrl = function(path, _isNovel) {
        if (/^https?:\/\//i.test(path))
          return path;
        if (path.indexOf("//") === 0)
          return "https:" + path;
        return "".concat(_this.site, "/title/").concat(path);
      };
    }
    AtsumaruPlugin2.prototype.popularNovels = function(pageNo, options) {
      return __awaiter(this, void 0, void 0, function() {
        var sortBy, rawFilters, genreValue, text;
        return __generator(this, function(_a) {
          switch (_a.label) {
            case 0:
              sortBy = options && options.showLatestNovels ? "dateAdded:desc" : "views:desc";
              rawFilters = options && options.filters ? options.filters : {};
              genreValue = rawFilters.genre && typeof rawFilters.genre.value === "string" ? rawFilters.genre.value : "0";
              return [4, fetchText(searchUrl("*", sortBy, pageNo, genreValue))];
            case 1:
              text = _a.sent();
              return [2, (0, parsers_1.parseNovelCards)(text)];
          }
        });
      });
    };
    AtsumaruPlugin2.prototype.parseNovel = function(novelPath) {
      return __awaiter(this, void 0, void 0, function() {
        var id, details, _a, all, _b, set, chapters, raw, status;
        return __generator(this, function(_c) {
          switch (_c.label) {
            case 0:
              id = novelPath.replace(/^\/+|\/+$/g, "");
              _a = parsers_1.parseNovelDetails;
              return [4, fetchText("".concat(SITE, "/api/manga/page?id=").concat(encodeURIComponent(id)))];
            case 1:
              details = _a.apply(void 0, [_c.sent()]);
              if (!details.name) {
                throw new Error("Could not load the novel " + novelPath);
              }
              _b = parsers_1.parseAllChapters;
              return [4, fetchText("".concat(SITE, "/api/manga/allChapters?mangaId=").concat(encodeURIComponent(id)))];
            case 2:
              all = _b.apply(void 0, [_c.sent()]);
              set = (0, parsers_1.chooseChapterSet)(all, details.scanlatorIds);
              chapters = set.map(function(e) {
                return {
                  name: e.title,
                  path: "".concat(id, "/").concat(e.id),
                  chapterNumber: e.number
                };
              });
              raw = details.statusRaw.toLowerCase();
              status = details.statusRaw === "Completed" ? NovelStatus.Completed : details.statusRaw === "Ongoing" ? NovelStatus.Ongoing : raw.indexOf("hiatus") >= 0 ? NovelStatus.OnHiatus : raw.indexOf("cancel") >= 0 ? NovelStatus.Cancelled : NovelStatus.Unknown;
              return [2, {
                path: novelPath,
                name: details.name,
                cover: details.cover,
                summary: details.summary,
                genres: details.genres.length ? details.genres.join(", ") : void 0,
                status: status,
                chapters: chapters
              }];
          }
        });
      });
    };
    AtsumaruPlugin2.prototype.parseChapter = function(chapterPath) {
      return __awaiter(this, void 0, void 0, function() {
        var parts, url, content, _a;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              parts = chapterPath.replace(/^\/+|\/+$/g, "").split("/");
              if (parts.length !== 2) {
                throw new Error("Unexpected chapter path: " + chapterPath);
              }
              url = "".concat(SITE, "/api/read/novelChapter?mangaId=").concat(encodeURIComponent(parts[0])) + "&chapterId=".concat(encodeURIComponent(parts[1]));
              _a = parsers_1.parseChapterBody;
              return [4, fetchText(url)];
            case 1:
              content = _a.apply(void 0, [_b.sent()]);
              if (!content) {
                throw new Error("Chapter content not found");
              }
              return [2, content];
          }
        });
      });
    };
    AtsumaruPlugin2.prototype.searchNovels = function(searchTerm, pageNo) {
      return __awaiter(this, void 0, void 0, function() {
        var text;
        return __generator(this, function(_a) {
          switch (_a.label) {
            case 0:
              return [4, fetchText(searchUrl(searchTerm, "views:desc", pageNo))];
            case 1:
              text = _a.sent();
              return [2, (0, parsers_1.parseNovelCards)(text)];
          }
        });
      });
    };
    return AtsumaruPlugin2;
  })()
);
exports.default = new AtsumaruPlugin();
try { if (typeof module !== "undefined" && module && module.exports) module.exports.default = plugin_default; } catch (e) {}
