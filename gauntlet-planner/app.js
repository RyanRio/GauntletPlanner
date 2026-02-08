import { SYNCPAIRS } from "./vendor/syncpairs.js";

const MAPPINGLEVELS = [1, 2, 3, 4, 5, 5, 5, 5, 5, 5];
const DEFAULT_PAIRS_PATHS = ["./my_pairs.json"];
const ICON_BASE = "./";

const els = {
  ownedCount: document.getElementById("ownedCount"),
  validClears: document.getElementById("validClears"),
  roundCount: document.getElementById("roundCount"),
  pairsFile: document.getElementById("pairsFile"),
  reloadPairs: document.getElementById("reloadPairs"),
  pairSearch: document.getElementById("pairSearch"),
  pairsStatus: document.getElementById("pairsStatus"),
  pairsList: document.getElementById("pairsList"),
  clearsFile: document.getElementById("clearsFile"),
  clearClears: document.getElementById("clearClears"),
  columnMapping: document.getElementById("columnMapping"),
  clearsStatus: document.getElementById("clearsStatus"),
  buildPlan: document.getElementById("buildPlan"),
  resetPlan: document.getElementById("resetPlan"),
  planStatus: document.getElementById("planStatus"),
  planOutput: document.getElementById("planOutput"),
  bossOutput: document.getElementById("bossOutput"),
  unmatched: document.getElementById("unmatched"),
  notOwned: document.getElementById("notOwned"),
  unmatchedCount: document.getElementById("unmatchedCount"),
  ambiguousCount: document.getElementById("ambiguousCount"),
  notOwnedCount: document.getElementById("notOwnedCount")
};

const state = {
  pairsMap: new Map(),
  ownedPairs: [],
  ownedById: new Map(),
  pairLookup: new Map(),
  pairLookupLoose: new Map(),
  allPairs: [],
  allLookup: new Map(),
  allLookupLoose: new Map(),
  clears: [],
  clearsByBoss: new Map(),
  unmatched: new Map(),
  ambiguous: new Map(),
  notOwned: new Map(),
  notOwnedInfo: new Map(),
  headers: [],
  rows: [],
  syncPairColumn: null,
  bossColumns: []
};

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value) {
  return normalize(value)
    .replace(/\b(other|form|dynamax|gigantamax|terastallization|tera)\b/g, " ")
    .replace(/\buniform\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function altAbbrevFromAlt(alt) {
  if (!alt) return null;
  const lower = alt.toLowerCase();
  if (lower === "sygna suit") return "SS";
  const match = lower.match(/^sygna suit \\(([^)]+)\\)$/);
  if (match) {
    const tag = match[1].replace(/\\./g, "").trim();
    if (!tag) return null;
    return `SS${tag[0].toUpperCase()}`;
  }
  return null;
}

function findByTrainerAltAbbrev(trainerName, abbrev, entries, status) {
  const matches = entries.filter((entry) => {
    const trainerMatch = normalize(entry.pair.trainerName) === normalize(trainerName);
    if (!trainerMatch) return false;
    const altAbbrev = altAbbrevFromAlt(entry.pair.trainerAlt);
    return altAbbrev === abbrev;
  });
  if (matches.length === 1) return { status, pair: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return null;
}

function stripDigits(value) {
  return (value || "").replace(/\d+/g, "").replace(/\s+/g, " ").trim();
}

function altVariants(alt) {
  const variants = new Set();
  if (!alt) return variants;
  variants.add(alt);
  variants.add(stripDigits(alt));

  const lower = alt.toLowerCase();
  if (lower === "sygna suit") variants.add("SS");
  if (lower.includes("sygna suit (renegade)") || lower.includes("sygna suit renegade")) variants.add("SSR");
  if (lower.includes("sygna suit (alt") || lower.includes("sygna suit alt")) variants.add("SSA");
  if (lower.includes("special costume")) variants.add("SC");
  if (lower.includes("arc suit")) variants.add("Arc");
  if (lower.includes("palentine")) variants.add("Palentine's");
  if (lower.includes("anniversary")) {
    variants.add("Anni");
    variants.add("Anniversary");
  }
  if (lower.includes("dojo uniform")) variants.add("Dojo");
  if (lower.includes("summer")) variants.add("Summer");
  if (lower.includes("fall")) variants.add("Fall");
  if (lower.includes("variety")) variants.add("Variety");

  return variants;
}

function parseInvestmentScore(value) {
  if (!value) return Infinity;
  const text = value.toString();
  const lower = text.toLowerCase();
  const numbers = text.match(/\d+/g) || [];
  let score = 0;

  if (numbers.length > 0) {
    score += parseInt(numbers[0], 10);
  }
  if (lower.includes("ex")) score += 1.0;
  if (lower.includes("20/20")) score += 1.0;
  if (lower.includes("+10e") || lower.includes("10e")) score += 0.5;
  if (/\br\b/i.test(text)) score += 0.5;

  return score || 0;
}

function buildPairsIndex() {
  state.pairsMap.clear();
  SYNCPAIRS.forEach((pair) => {
    const key = `${pair.dexNumber}|${pair.pokemonNumber}`;
    state.pairsMap.set(key, pair);
  });
}

function buildLookupForPairs(entries, exactMap, looseMap) {
  exactMap.clear();
  looseMap.clear();
  entries.forEach((entry) => {
    const pair = entry.pair;
    const variants = new Set();

    const trainer = pair.trainerName || "";
    const alt = pair.trainerAlt ? ` ${pair.trainerAlt}` : "";
    const pokemon = pair.pokemonName || "";

    variants.add(`${trainer}${alt} & ${pokemon}`);
    variants.add(`${trainer} & ${pokemon}`);
    variants.add(`${trainer} ${pokemon}`);
    variants.add(`${trainer}${alt} ${pokemon}`);
    variants.add(`${trainer}${alt}`.trim());
    variants.add(pokemon);

    altVariants(pair.trainerAlt).forEach((altVariant) => {
      const altText = altVariant ? ` ${altVariant}` : "";
      variants.add(`${trainer}${altText} & ${pokemon}`);
      variants.add(`${trainer}${altText} ${pokemon}`);
      variants.add(`${trainer}${altText}`.trim());
    });

    if (pair.pokemonForm && pair.pokemonForm.length > 0) {
      variants.add(`${trainer}${alt} & ${pokemon} ${pair.pokemonForm.join(" ")}`);
    }

    variants.forEach((variant) => {
      const key = normalize(variant);
      if (key) {
        if (!exactMap.has(key)) exactMap.set(key, []);
        exactMap.get(key).push(entry);
      }
      const looseKey = normalizeLoose(variant);
      if (looseKey) {
        if (!looseMap.has(looseKey)) looseMap.set(looseKey, []);
        looseMap.get(looseKey).push(entry);
      }
    });
  });
}

function buildPairLookup() {
  buildLookupForPairs(state.ownedPairs, state.pairLookup, state.pairLookupLoose);
  buildLookupForPairs(state.allPairs, state.allLookup, state.allLookupLoose);
}

function parseOwnedPairs(obj) {
  const owned = [];
  const missing = [];

  Object.entries(obj).forEach(([rawKey, rawValue]) => {
    const parts = rawKey.split("|");
    const dex = parts[0];
    const pokemonNumber = parts.slice(1).join("|");
    const key = `${dex}|${pokemonNumber}`;
    const pair = state.pairsMap.get(key);

    if (!pair) {
      missing.push(rawKey);
      return;
    }

    const values = rawValue.split("|");
    const syncLevelIndex = parseInt(values[0], 10);
    const syncLevel = Number.isNaN(syncLevelIndex) ? 1 : MAPPINGLEVELS[syncLevelIndex] || 1;

    owned.push({
      id: key,
      pair,
      syncLevel
    });
  });

  state.ownedPairs = owned;
  state.ownedById = new Map(owned.map((item) => [item.id, item]));
  buildPairLookup();

  renderOwnedPairs();
  els.pairsStatus.textContent = missing.length ? `Missing ${missing.length}` : "Loaded";
}

async function loadOwnedPairsFromFile(file) {
  const text = await file.text();
  parseOwnedPairs(JSON.parse(text));
}

async function loadDefaultPairs() {
  for (const path of DEFAULT_PAIRS_PATHS) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const json = await res.json();
      parseOwnedPairs(json);
      els.pairsStatus.textContent = `Loaded (${path})`;
      return;
    } catch (err) {
      // try next path
    }
  }
  els.pairsStatus.textContent = "Missing default file";
}

function pairDisplayName(pair) {
  const alt = pair.trainerAlt ? ` (${pair.trainerAlt})` : "";
  const form = pair.pokemonForm && pair.pokemonForm.length > 0 ? ` ${pair.pokemonForm.join(" ")}` : "";
  return `${pair.trainerName}${alt} & ${pair.pokemonName}${form}`;
}

function renderOwnedPairs() {
  const search = normalize(els.pairSearch.value);
  const filtered = state.ownedPairs.filter((item) => {
    if (!search) return true;
    const name = normalize(pairDisplayName(item.pair));
    return name.includes(search);
  });

  els.ownedCount.textContent = state.ownedPairs.length;
  els.pairsList.innerHTML = filtered
    .map((item) => {
      const icon = item.pair.images && item.pair.images.length > 0 ? `${ICON_BASE}${item.pair.images[0]}` : "";
      return `
        <div class="sync-item">
          ${icon ? `<img src="${icon}" alt="">` : ""}
          <div class="meta">
            <div>${pairDisplayName(item.pair)}</div>
            <div class="muted">Sync level ${item.syncLevel}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim().length)) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim().length)) {
      rows.push(row);
    }
  }

  return rows;
}

function renderMappingControls(headers, inferred) {
  els.columnMapping.innerHTML = `
    <label>
      Sync Pair Column
      <select data-field="sync">
        <option value="">(none)</option>
        ${headers
          .map((header, index) => {
            const selected = inferred.syncPairColumn === index ? "selected" : "";
            return `<option value="${index}" ${selected}>${header}</option>`;
          })
          .join("")}
      </select>
    </label>
    <label>
      Boss Columns
      <div class="boss-list">
        ${headers
          .map((header, index) => {
            const checked = inferred.bossColumns.includes(index) ? "checked" : "";
            return `
              <label class="boss-item">
                <input type="checkbox" data-boss="${index}" ${checked} />
                ${header}
              </label>
            `;
          })
          .join("")}
      </div>
    </label>
  `;

  const syncSelect = els.columnMapping.querySelector("select[data-field='sync']");
  syncSelect.addEventListener("change", () => {
    buildClearsFromMapping();
  });

  const bossChecks = els.columnMapping.querySelectorAll("input[data-boss]");
  bossChecks.forEach((check) => {
    check.addEventListener("change", () => {
      buildClearsFromMapping();
    });
  });
}

function getMapping() {
  const syncSelect = els.columnMapping.querySelector("select[data-field='sync']");
  const syncPairColumn = syncSelect?.value ? parseInt(syncSelect.value, 10) : null;
  const bossColumns = [];
  const bossChecks = els.columnMapping.querySelectorAll("input[data-boss]");
  bossChecks.forEach((check) => {
    if (check.checked) bossColumns.push(parseInt(check.dataset.boss, 10));
  });
  return { syncPairColumn, bossColumns };
}

function combineHeaderRows(rows, firstIndex, secondIndex) {
  const a = rows[firstIndex] || [];
  const b = rows[secondIndex] || [];
  const max = Math.max(a.length, b.length);
  const headers = [];
  for (let i = 0; i < max; i += 1) {
    const primary = (b[i] || "").trim();
    const fallback = (a[i] || "").trim();
    headers.push(primary || fallback || `Column ${i + 1}`);
  }
  return headers;
}

function inferLayout(rows) {
  const maxScan = Math.min(rows.length, 5);
  let syncHeaderRow = 0;
  let bossHeaderRow = 0;

  for (let i = 0; i < maxScan; i += 1) {
    const row = rows[i].map((cell) => normalize(cell));
    if (row.includes("sync pair")) syncHeaderRow = i;
    if (row.some((cell) => ["tornadus", "terrakion", "raikou"].includes(cell))) bossHeaderRow = i;
  }

  const headers = combineHeaderRows(rows, syncHeaderRow, bossHeaderRow);
  const ignore = new Set([
    "sync pair",
    "total",
    "number of solos",
    "las in depth infos",
    "las in-depth infos",
    "readme"
  ]);

  let syncPairColumn = headers.findIndex((h) => normalize(h) === "sync pair");
  if (syncPairColumn === -1) syncPairColumn = 0;

  const bossColumns = headers
    .map((h, index) => ({ header: h, index }))
    .filter(({ header }) => header && !ignore.has(normalize(header)))
    .map(({ index }) => index);

  const dataStart = Math.max(syncHeaderRow, bossHeaderRow) + 1;
  return { headers, syncPairColumn, bossColumns, dataStart };
}

function matchPairName(name) {
  if (!name) return { status: "empty" };
  const normalized = normalize(name);
  if (!normalized) return { status: "empty" };

  const abbrevMatch = name.match(/^(.*?)\\((SS[A-Z]?)\\)\\s*(?:&|and)?/i);
  if (abbrevMatch) {
    const trainer = abbrevMatch[1].trim();
    const abbrev = abbrevMatch[2].toUpperCase();
    const exact = findByTrainerAltAbbrev(trainer, abbrev, state.ownedPairs, "match");
    if (exact) return exact;
    const allExact = findByTrainerAltAbbrev(trainer, abbrev, state.allPairs, "notOwned");
    if (allExact) return allExact;
  }

  const direct = state.pairLookup.get(normalized);
  if (direct && direct.length === 1) {
    return { status: "match", pair: direct[0] };
  }
  if (direct && direct.length > 1) {
    return { status: "ambiguous", matches: direct };
  }

  const normalizedNoDigits = normalize(stripDigits(name));
  if (normalizedNoDigits && normalizedNoDigits !== normalized) {
    const loose = state.pairLookup.get(normalizedNoDigits);
    if (loose && loose.length === 1) return { status: "match", pair: loose[0] };
    if (loose && loose.length > 1) return { status: "ambiguous", matches: loose };
  }

  const looseNormalized = normalizeLoose(name);
  if (looseNormalized && looseNormalized !== normalized) {
    const loose = state.pairLookupLoose.get(looseNormalized);
    if (loose && loose.length === 1) return { status: "match", pair: loose[0] };
    if (loose && loose.length > 1) return { status: "ambiguous", matches: loose };
  }

  const maybeParts = normalized.split(" and ");
  if (maybeParts.length === 2) {
    const [left, right] = maybeParts;
    const matches = state.ownedPairs.filter((entry) => {
      const trainer = normalize(`${entry.pair.trainerName} ${entry.pair.trainerAlt || ""}`);
      const pokemon = normalize(entry.pair.pokemonName);
      return trainer.includes(left) && pokemon.includes(right);
    });
    if (matches.length === 1) return { status: "match", pair: matches[0] };
    if (matches.length > 1) return { status: "ambiguous", matches };
  }

  const allDirect = state.allLookup.get(normalized);
  if (allDirect && allDirect.length === 1) return { status: "notOwned", pair: allDirect[0] };
  if (allDirect && allDirect.length > 1) return { status: "ambiguous", matches: allDirect };

  if (normalizedNoDigits && normalizedNoDigits !== normalized) {
    const allLoose = state.allLookup.get(normalizedNoDigits);
    if (allLoose && allLoose.length === 1) return { status: "notOwned", pair: allLoose[0] };
    if (allLoose && allLoose.length > 1) return { status: "ambiguous", matches: allLoose };
  }

  if (looseNormalized && looseNormalized !== normalized) {
    const allLoose = state.allLookupLoose.get(looseNormalized);
    if (allLoose && allLoose.length === 1) return { status: "notOwned", pair: allLoose[0] };
    if (allLoose && allLoose.length > 1) return { status: "ambiguous", matches: allLoose };
  }

  return { status: "unmatched" };
}

function buildClearsFromMapping() {
  state.clears = [];
  state.clearsByBoss.clear();
  state.unmatched.clear();
  state.ambiguous.clear();
  state.notOwned.clear();
  state.notOwnedInfo.clear();
  state.notOwnedInfo.clear();

  const { syncPairColumn, bossColumns } = getMapping();
  if (syncPairColumn === null || bossColumns.length === 0) {
    els.clearsStatus.textContent = "Select a sync pair column and at least one boss column.";
    renderUnmatched();
    return;
  }

  for (let i = state.dataStartRow || 1; i < state.rows.length; i += 1) {
    const row = state.rows[i];
    const syncName = row[syncPairColumn] || "";
    if (!syncName.trim()) continue;
    const normalized = normalize(syncName);
    if (normalized === "readme" || normalized.startsWith("number of solos")) continue;

    const match = matchPairName(syncName);
    if (match.status !== "match") {
      if (match.status === "unmatched") {
        state.unmatched.set(syncName, (state.unmatched.get(syncName) || 0) + 1);
      } else if (match.status === "notOwned") {
        state.notOwned.set(syncName, (state.notOwned.get(syncName) || 0) + 1);
        bossColumns.forEach((col) => {
          const investment = (row[col] || "").trim();
          if (!investment) return;
          const boss = state.headers[col] || `Boss ${col + 1}`;
          const score = parseInvestmentScore(investment);
          const existing = state.notOwnedInfo.get(syncName);
          if (!existing || score < existing.score) {
            state.notOwnedInfo.set(syncName, { boss, investment, score });
          }
        });
      } else if (match.status === "ambiguous") {
        state.ambiguous.set(syncName, match.matches.map((entry) => pairDisplayName(entry.pair)));
      }
      continue;
    }

    bossColumns.forEach((col) => {
      const investment = (row[col] || "").trim();
      if (!investment) return;
      const boss = state.headers[col] || `Boss ${col + 1}`;
      const clear = {
        boss,
        pairId: match.pair.id,
        investment,
        investmentScore: parseInvestmentScore(investment)
      };
      state.clears.push(clear);
      if (!state.clearsByBoss.has(boss)) {
        state.clearsByBoss.set(boss, []);
      }
      state.clearsByBoss.get(boss).push(clear);
    });
  }

  els.validClears.textContent = state.clears.length;
  els.clearsStatus.textContent = `${state.clears.length} solo clears loaded.`;
  renderUnmatched();
  renderBossClears();
}

function renderUnmatched() {
  const items = [];
  let unmatchedTotal = 0;
  let ambiguousTotal = 0;
  let notOwnedTotal = 0;
  state.unmatched.forEach((count, label) => {
    items.push(`<div class="unmatched-item"><strong>${label}</strong> — ${count} rows</div>`);
    unmatchedTotal += count;
  });
  state.ambiguous.forEach((matches, label) => {
    items.push(`<div class="unmatched-item"><strong>${label}</strong> — ambiguous (${matches.slice(0, 3).join("; ")})</div>`);
    ambiguousTotal += 1;
  });
  if (els.unmatched) {
    els.unmatched.innerHTML = items.length ? items.join("") : "<div class=\"muted\">All clear.</div>";
  }

  if (els.notOwned) {
    const notOwnedItems = Array.from(state.notOwned.entries())
      .map(([label, count]) => {
        const info = state.notOwnedInfo.get(label);
        return {
          label,
          count,
          boss: info?.boss || "",
          investment: info?.investment || "",
          score: info?.score ?? Infinity
        };
      })
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));

    notOwnedTotal = notOwnedItems.reduce((sum, item) => sum + item.count, 0);

    els.notOwned.innerHTML = notOwnedItems.length
      ? notOwnedItems
          .map((item) => {
            const detail = item.boss ? ` — ${item.boss}: ${item.investment}` : "";
            return `<div class="unmatched-item"><strong>${item.label}</strong>${detail} (rows: ${item.count})</div>`;
          })
          .join("")
      : "<div class=\"muted\">All clear.</div>";
  }
  if (els.unmatchedCount) {
    els.unmatchedCount.textContent = `Unmatched: ${unmatchedTotal}`;
  }
  if (els.ambiguousCount) {
    els.ambiguousCount.textContent = `Ambiguous: ${ambiguousTotal}`;
  }
  if (els.notOwnedCount) {
    els.notOwnedCount.textContent = `Not owned: ${notOwnedTotal}`;
  }
}

function buildPlan() {
  const bosses = Array.from(state.clearsByBoss.keys());
  if (bosses.length === 0) {
    els.planStatus.textContent = "No clears loaded";
    return;
  }

  const remaining = new Map();
  bosses.forEach((boss) => {
    remaining.set(boss, state.clearsByBoss.get(boss).slice());
  });

  const rounds = [];
  const usedPairs = new Set();

  while (true) {
    const round = pickBestRound(bosses, remaining, usedPairs);
    if (!round) break;

    rounds.push(round);
    round.forEach((clear) => {
      usedPairs.add(clear.pairId);
    });

    bosses.forEach((boss) => {
      const filtered = remaining
        .get(boss)
        .filter((clear) => !usedPairs.has(clear.pairId));
      remaining.set(boss, filtered);
    });
  }

  els.roundCount.textContent = rounds.length;
  els.planStatus.textContent = rounds.length ? "Drafted" : "No rounds found";
  renderPlan(rounds);
}

function pickBestRound(bosses, remaining, usedPairs) {
  const candidatesByBoss = bosses.map((boss) => {
    const candidates = remaining.get(boss).filter((clear) => !usedPairs.has(clear.pairId));
    return { boss, candidates };
  });

  if (candidatesByBoss.some((entry) => entry.candidates.length === 0)) {
    return null;
  }

  const pairUsage = new Map();
  candidatesByBoss.forEach((entry) => {
    entry.candidates.forEach((clear) => {
      pairUsage.set(clear.pairId, (pairUsage.get(clear.pairId) || 0) + 1);
    });
  });

  const MAX_TEAMS = 160;
  candidatesByBoss.forEach((entry) => {
    entry.candidates = entry.candidates
      .map((clear) => {
        const scarcity = 1 / (pairUsage.get(clear.pairId) || 1);
        const investmentWeight = 1 / (1 + (clear.investmentScore || 0));
        const score = scarcity + investmentWeight;
        return { ...clear, score };
      })
      .sort((a, b) => {
        if (a.investmentScore !== b.investmentScore) return a.investmentScore - b.investmentScore;
        return b.score - a.score;
      })
      .slice(0, MAX_TEAMS);
  });

  candidatesByBoss.sort((a, b) => a.candidates.length - b.candidates.length);

  let best = null;
  let bestScore = -Infinity;

  function dfs(index, usedRound, chosen, score) {
    if (index === candidatesByBoss.length) {
      if (score > bestScore) {
        bestScore = score;
        best = [...chosen];
      }
      return;
    }

    const { candidates } = candidatesByBoss[index];
    for (const clear of candidates) {
      if (usedRound.has(clear.pairId)) continue;
      usedRound.add(clear.pairId);
      chosen.push(clear);
      dfs(index + 1, usedRound, chosen, score + clear.score);
      chosen.pop();
      usedRound.delete(clear.pairId);
    }
  }

  dfs(0, new Set(), [], 0);
  return best;
}

function renderPlan(rounds) {
  if (!rounds.length) {
    els.planOutput.innerHTML = "<div class=\"muted\">No complete rounds could be built.</div>";
    return;
  }

  els.planOutput.innerHTML = rounds
    .map((round, index) => {
      const entries = [...round]
        .sort((a, b) => (a.investmentScore || 0) - (b.investmentScore || 0))
        .map((clear) => {
          const entry = state.ownedById.get(clear.pairId);
          const name = entry ? pairDisplayName(entry.pair) : clear.pairId;
          return `
            <div class="boss">
              <div class="boss-title">${clear.boss}</div>
              <div class="muted">${name} — ${clear.investment}</div>
            </div>
          `;
        })
        .join("");
      return `
        <div class="round">
          <h4>Round ${index + 1}</h4>
          ${entries}
        </div>
      `;
    })
    .join("");
}

function renderBossClears() {
  if (!els.bossOutput) return;
  if (!state.clearsByBoss.size) {
    els.bossOutput.innerHTML = "<div class=\"muted\">No clears loaded.</div>";
    return;
  }

  const emptyMessage = '<div class="muted">No clears.</div>';
  const bosses = Array.from(state.clearsByBoss.keys()).sort();
  els.bossOutput.innerHTML = bosses
    .map((boss) => {
      const clears = state.clearsByBoss
        .get(boss)
        .slice()
        .sort((a, b) => (a.investmentScore || 0) - (b.investmentScore || 0));

      const rows = clears
        .map((clear) => {
          const entry = state.ownedById.get(clear.pairId);
          const name = entry ? pairDisplayName(entry.pair) : clear.pairId;
          return `<div class="boss"><div class="muted">${name} — ${clear.investment}</div></div>`;
        })
        .join("");

      return `
        <div class="round">
          <h4>${boss}</h4>
          ${rows || emptyMessage}
        </div>
      `;
    })
    .join("");
}

function resetPlan() {
  els.planOutput.innerHTML = "";
  els.planStatus.textContent = "No plan yet";
  els.roundCount.textContent = "0";
}

els.pairsFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    loadOwnedPairsFromFile(file);
  } catch (err) {
    if (els.pairsStatus) els.pairsStatus.textContent = "Failed to load JSON";
    throw err;
  }
});

els.reloadPairs.addEventListener("click", () => {
  loadDefaultPairs();
});

els.pairSearch.addEventListener("input", () => renderOwnedPairs());

els.clearsFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      els.clearsStatus.textContent = "No rows found.";
      return;
    }
    const layout = inferLayout(rows);
    state.headers = layout.headers;
    state.rows = rows;
    state.dataStartRow = layout.dataStart;
    state.syncPairColumn = layout.syncPairColumn;
    state.bossColumns = layout.bossColumns;
    renderMappingControls(state.headers, layout);
    els.clearsStatus.textContent = "CSV loaded. Confirm columns.";
    buildClearsFromMapping();
  } catch (err) {
    if (els.clearsStatus) els.clearsStatus.textContent = "Failed to load CSV";
    throw err;
  }
});

els.clearClears.addEventListener("click", () => {
  els.clearsFile.value = "";
  state.headers = [];
  state.rows = [];
  state.clears = [];
  state.clearsByBoss.clear();
  state.unmatched.clear();
  state.ambiguous.clear();
  state.notOwned.clear();
  state.notOwnedInfo.clear();
  els.columnMapping.innerHTML = "";
  els.clearsStatus.textContent = "Clears removed.";
  els.validClears.textContent = "0";
  renderUnmatched();
  renderBossClears();
});

els.buildPlan.addEventListener("click", buildPlan);
els.resetPlan.addEventListener("click", resetPlan);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    document.querySelector(`[data-tab-content=\"${target}\"]`)?.classList.add("active");
  });
});

buildPairsIndex();
state.allPairs = Array.from(state.pairsMap.entries()).map(([id, pair]) => ({ id, pair }));
buildPairLookup();
loadDefaultPairs();
