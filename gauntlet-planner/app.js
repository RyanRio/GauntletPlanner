import { SYNCPAIRS } from "./vendor/syncpairs.js";

const MAPPINGLEVELS = [1, 2, 3, 4, 5, 5, 5, 5, 5, 5];
const DEFAULT_PAIRS_PATHS = ["./my_pairs.json"];
const ICON_BASE = "./";
const MANUAL_MATCHES_KEY = "gauntletPlannerManualMatches";
const DIFFICULTY_LEGEND = {
  "🔰": "Beginner Difficulty: Beginners can easily do these solos, boils down to being incredibly consistent, or you literally just spam a single move without much strategy.",
  "✔️": "Normal Difficulty: Generally requires minimal strategy, but usually consistent runs with minimal RNG likely required.",
  "⚠️": "Moderate Difficulty: Usually will take a bit of practice, but these solos can be done pretty consistently when you understand the general strategy and get decent luck.",
  "⛔": "Difficult/RNG Heavy/Precise: Be prepared to attempt these solos multiple times. Usually these solos use an unconventional strategy or you must be tight with certain timings. Tread with caution.",
  "🚫": "Not Recommended: Solos that are too troublesome to be worthwhile in a LG setting.",
  "🕗": "Time Consuming: These solos are quite long battles that you must be prepared to endure.",
  "🔁": "Reset Heavy: Expect to be resetting a lot for good procs, dodges, MPRs, any multiple overall RNG based luck that is necessary to win. Prepare to reset a lot...",
  "⚙️": "Skill Gear Required: Solos that were likely only completable due to specific Skill Gear, likely Skill Gear with high stat values or possibly good passives (please always show your gears when uploading runs, even when they are regular gears!).",
  "🪽": "Dodge Reliant: Runs where the main strategy is to rely on key or frequent misses from the enemy due to either self Evasion Buffing or enemy Accuracy Debuffing, or both, or Dodging from moves such as Fly or Phantom Force.",
  "💦💤🧊": "Disable Spam: Runs that employ and rely on constant use of Disables such as Flinch💦, Sleep💤, and Freeze🧊 in order to either stay alive or stall for success.",
  "⚡": "Energy Overcap: Solos that use over 60+ Grid (BSB) Energy.",
  "*️⃣": "Lvl 181-200: Solos that use Plaques of Perfection for Lvl 181-200 units.",
  "🥠": "Special Cookie Required: Solos that use either a Personal Lucky Cookie or a Tower Lucky Cookie."
};

const els = {
  ownedCount: document.getElementById("ownedCount"),
  validClears: document.getElementById("validClears"),
  roundCount: document.getElementById("roundCount"),
  pairsFile: document.getElementById("pairsFile"),
  reloadPairs: document.getElementById("reloadPairs"),
  pairSearch: document.getElementById("pairSearch"),
  pairsStatus: document.getElementById("pairsStatus"),
  pairsList: document.getElementById("pairsList"),
  clearsJsonFile: document.getElementById("clearsJsonFile"),
  loadDefaultClearsJson: document.getElementById("loadDefaultClearsJson"),
  clearClears: document.getElementById("clearClears"),
  clearsStatus: document.getElementById("clearsStatus"),
  buildPlan: document.getElementById("buildPlan"),
  resetPlan: document.getElementById("resetPlan"),
  clearMatches: document.getElementById("clearMatches"),
  planStatus: document.getElementById("planStatus"),
  planOutput: document.getElementById("planOutput"),
  bossOutput: document.getElementById("bossOutput"),
  unmatched: document.getElementById("unmatched"),
  visualCompare: document.getElementById("visualCompare"),
  notOwned: document.getElementById("notOwned"),
  unmatchedCount: document.getElementById("unmatchedCount"),
  ambiguousCount: document.getElementById("ambiguousCount"),
  notOwnedCount: document.getElementById("notOwnedCount"),
  manualMatchCount: document.getElementById("manualMatchCount")
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
  imageByPairId: new Map(),
  imageByName: new Map(),
  matchedOwnedPairs: new Set(),
  manualMatches: new Map(),
  unmatchedRowData: new Map(),
  bossDetails: {},
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
  if (lower.startsWith("sygna suit (") && lower.endsWith(")")) {
    const inner = lower.slice("sygna suit (".length, -1).trim();
    if (inner) variants.add(`SS${inner[0].toUpperCase()}`);
  }
  if (lower.includes("special costume")) variants.add("SC");
  if (lower.includes("arc suit")) variants.add("Arc");
  if (lower.includes("palentine")) variants.add("Palentine's");
  if (lower.includes("new year")) variants.add("NY");
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
    variants.add(pokemon);

    altVariants(pair.trainerAlt).forEach((altVariant) => {
      const altText = altVariant ? ` ${altVariant}` : "";
      variants.add(`${trainer}${altText} & ${pokemon}`);
      variants.add(`${trainer}${altText} ${pokemon}`);
      if (altVariant) {
        variants.add(`${trainer} (${altVariant})`);
        variants.add(`${trainer} (${altVariant}) & ${pokemon}`);
      }
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

async function loadClearsJsonFromFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  loadClearsFromJsonPayload(payload, "./clears_images/");
}

async function loadDefaultClearsJson() {
  const res = await fetch("./clears_from_xlsx.json");
  if (!res.ok) {
    els.clearsStatus.textContent = "Missing clears_from_xlsx.json";
    return;
  }
  const payload = await res.json();
  loadClearsFromJsonPayload(payload, "./clears_images/");
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

function resetClearsState() {
  state.clears = [];
  state.clearsByBoss.clear();
  state.unmatched.clear();
  state.ambiguous.clear();
  state.notOwned.clear();
  state.notOwnedInfo.clear();
  state.imageByPairId.clear();
  state.imageByName.clear();
  state.matchedOwnedPairs.clear();
  state.unmatchedRowData.clear();
  state.bossDetails = {};
}

function loadManualMatches() {
  try {
    const raw = localStorage.getItem(MANUAL_MATCHES_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === "object") {
      Object.entries(data).forEach(([key, value]) => {
        state.manualMatches.set(key, value);
      });
    }
  } catch (err) {
    // ignore malformed data
  }
}

function saveManualMatches() {
  const obj = {};
  state.manualMatches.forEach((value, key) => {
    obj[key] = value;
  });
  localStorage.setItem(MANUAL_MATCHES_KEY, JSON.stringify(obj));
}

function applyManualMatches() {
  // Remove any prior manual clears and rebuild base indices
  const baseClears = state.clears.filter((clear) => !clear.manual);
  state.clears = baseClears;
  state.clearsByBoss.clear();
  state.matchedOwnedPairs.clear();
  baseClears.forEach((clear) => {
    if (!state.clearsByBoss.has(clear.boss)) {
      state.clearsByBoss.set(clear.boss, []);
    }
    state.clearsByBoss.get(clear.boss).push(clear);
    state.matchedOwnedPairs.add(clear.pairId);
  });

  if (!state.manualMatches.size) {
    els.validClears.textContent = state.clears.length;
    return;
  }

  const existing = new Set(state.clears.map((clear) => `${clear.boss}|${clear.pairId}`));

  state.manualMatches.forEach((pairId, label) => {
    const data = state.unmatchedRowData.get(label);
    if (!data) return;
    const entry = state.ownedById.get(pairId);
    if (!entry) return;
    state.matchedOwnedPairs.add(pairId);
    if (data.image) {
      state.imageByPairId.set(pairId, data.image);
    }
    Object.entries(data.bosses || {}).forEach(([boss, investment]) => {
      const key = `${boss}|${pairId}`;
      if (existing.has(key)) return;
      const detail = state.bossDetails?.[boss]?.[label] || null;
      const clear = {
        boss,
        pairId,
        investment,
        investmentScore: parseInvestmentScore(investment),
        image: data.image || null,
        detail,
        manual: true
      };
      state.clears.push(clear);
      existing.add(key);
      if (!state.clearsByBoss.has(boss)) {
        state.clearsByBoss.set(boss, []);
      }
      state.clearsByBoss.get(boss).push(clear);
    });
  });
  els.validClears.textContent = state.clears.length;
}
function clearManualMatches() {
  state.manualMatches.clear();
  localStorage.removeItem(MANUAL_MATCHES_KEY);
  applyManualMatches();
  renderUnmatched();
  renderBossClears();
  if (els.planStatus.textContent === "Drafted") {
    buildPlan();
  }
}

function loadClearsFromJsonPayload(payload, basePath) {
  resetClearsState();
  state.notOwnedInfo.clear();
  state.bossDetails = payload.bossDetails || {};
  state.headers = payload.headers || [];
  state.rows = [];
  state.dataStartRow = 0;
  state.syncPairColumn = payload.syncPairColumn || null;
  state.bossColumns = payload.bossColumns || [];

  const rows = payload.rows || [];
  rows.forEach((row) => {
    const syncName = row.syncPair || "";
    if (!syncName) return;
    const match = matchPairName(syncName);
    const imagePath = row.image ? `${basePath}${row.image}` : null;
    if (imagePath) {
      state.imageByName.set(syncName, imagePath);
    }

    if (match.status !== "match") {
      if (!state.unmatchedRowData.has(syncName)) {
        state.unmatchedRowData.set(syncName, { bosses: row.bosses || {}, image: imagePath });
      }
      if (match.status === "unmatched") {
        state.unmatched.set(syncName, (state.unmatched.get(syncName) || 0) + 1);
      } else if (match.status === "notOwned") {
        state.notOwned.set(syncName, (state.notOwned.get(syncName) || 0) + 1);
        if (row.bosses) {
          Object.entries(row.bosses).forEach(([boss, investment]) => {
            const score = parseInvestmentScore(investment);
            const existing = state.notOwnedInfo.get(syncName);
            if (!existing || score < existing.score) {
              state.notOwnedInfo.set(syncName, { boss, investment, score });
            }
          });
        }
      } else if (match.status === "ambiguous") {
        state.ambiguous.set(syncName, match.matches.map((entry) => pairDisplayName(entry.pair)));
      }
      return;
    }

    state.matchedOwnedPairs.add(match.pair.id);
    if (imagePath) {
      state.imageByPairId.set(match.pair.id, imagePath);
    }

    if (row.bosses) {
      Object.entries(row.bosses).forEach(([boss, investment]) => {
        if (!investment) return;
      const detail = state.bossDetails?.[boss]?.[syncName] || null;
      const clear = {
        boss,
        pairId: match.pair.id,
        investment,
        investmentScore: parseInvestmentScore(investment),
        image: imagePath,
        detail
      };
        state.clears.push(clear);
        if (!state.clearsByBoss.has(boss)) {
          state.clearsByBoss.set(boss, []);
        }
        state.clearsByBoss.get(boss).push(clear);
      });
    }
  });

  els.validClears.textContent = state.clears.length;
  els.clearsStatus.textContent = `${state.clears.length} solo clears loaded (xlsx).`;
  applyManualMatches();
  renderUnmatched();
  renderBossClears();
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

// CSV import path removed; XLSX extract is the only supported input.
function renderUnmatched() {
  const items = [];
  let unmatchedTotal = 0;
  let ambiguousTotal = 0;
  let notOwnedTotal = 0;
  const resolved = new Set(state.manualMatches.keys());
  state.unmatched.forEach((count, label) => {
    if (resolved.has(label)) return;
    items.push(`<div class="unmatched-item"><strong>${label}</strong> — ${count} rows</div>`);
    unmatchedTotal += count;
  });
  state.ambiguous.forEach((matches, label) => {
    if (resolved.has(label)) return;
    items.push(`<div class="unmatched-item"><strong>${label}</strong> — ambiguous (${matches.slice(0, 3).join("; ")})</div>`);
    ambiguousTotal += 1;
  });
  if (els.unmatched) {
    els.unmatched.innerHTML = items.length ? items.join("") : "<div class=\"muted\">All clear.</div>";
  }

  if (els.visualCompare) {
    const compareItems = [];

    state.ambiguous.forEach((matches, label) => {
      if (resolved.has(label)) return;
      compareItems.push({
        label,
        image: state.imageByName.get(label),
        candidates: matches
      });
    });

    const unmatchedOwned = state.ownedPairs.filter((entry) => !state.matchedOwnedPairs.has(entry.id));

    Array.from(state.unmatched.keys()).forEach((label) => {
      if (resolved.has(label)) return;
      const trainer = label.split(/[(&]/)[0].trim();
      if (!trainer) return;
      const matches = unmatchedOwned.filter((entry) => normalize(entry.pair.trainerName) === normalize(trainer));
      if (!matches.length) return;
      compareItems.push({
        label,
        image: state.imageByName.get(label),
        candidates: matches.map((entry) => pairDisplayName(entry.pair)),
        candidateEntries: matches
      });
    });

    els.visualCompare.innerHTML = compareItems.length
      ? compareItems
          .map((item) => {
            const candidateEntries =
              item.candidateEntries ||
              item.candidates
                .map((name) => {
                  const entry = state.ownedPairs.find((e) => pairDisplayName(e.pair) === name);
                  return entry || null;
                })
                .filter(Boolean);

            const candidatesHtml = candidateEntries.length
              ? candidateEntries
                  .slice(0, 12)
                  .map((entry) => {
                    const icon =
                      entry.pair.images && entry.pair.images.length > 0 ? `${ICON_BASE}${entry.pair.images[0]}` : "";
                    const selected = state.manualMatches.get(item.label) === entry.id;
                    return `
                      <label class="compare-candidate">
                        <input type="radio" name="match_${item.label}" value="${entry.id}" ${
                          selected ? "checked" : ""
                        } />
                        ${icon ? `<img src="${icon}" alt="">` : ""}
                        <div>${pairDisplayName(entry.pair)}</div>
                      </label>
                    `;
                  })
                  .join("")
              : `<div class="muted">${item.candidates.slice(0, 6).join("; ")}</div>`;

            return `
              <div class="compare-row">
                <div class="compare-left">
                  ${item.image ? `<img src="${item.image}" alt="">` : ""}
                </div>
                <div class="compare-right">
                  <div><strong>${item.label}</strong></div>
                  <div class="compare-candidates">${candidatesHtml}</div>
                </div>
              </div>
            `;
          })
          .join("")
      : "<div class=\"muted\">No visual comparisons available.</div>";

    els.visualCompare.querySelectorAll("input[type=\"radio\"]").forEach((input) => {
      input.addEventListener("change", (event) => {
        const name = event.target.name.replace("match_", "");
        state.manualMatches.set(name, event.target.value);
        saveManualMatches();
        applyManualMatches();
        renderUnmatched();
        renderBossClears();
        if (els.planStatus.textContent === "Drafted") {
          buildPlan();
        }
      });
    });
  }

  if (els.notOwned) {
    const notOwnedItems = Array.from(state.notOwned.entries())
      .filter(([label]) => !resolved.has(label))
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
  if (els.manualMatchCount) {
    els.manualMatchCount.textContent = `Manual: ${state.manualMatches.size}`;
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

  els.planOutput.classList.add("grid");
  els.planOutput.innerHTML = rounds
    .map((round, index) => {
      const entries = [...round]
        .sort((a, b) => (a.investmentScore || 0) - (b.investmentScore || 0))
        .map((clear) => {
          const entry = state.ownedById.get(clear.pairId);
          const name = entry ? pairDisplayName(entry.pair) : clear.pairId;
          const sheetImage = clear.image || state.imageByPairId.get(clear.pairId);
          const trackerIcon =
            entry && entry.pair.images && entry.pair.images.length > 0 ? `${ICON_BASE}${entry.pair.images[0]}` : null;
          const detail = clear.detail;
          const difficulty = detail?.difficulty || "";
          return `
            <div class="boss">
              <div class="boss-title">${clear.boss}</div>
              <div class="boss-line">
                ${sheetImage ? `<img src="${sheetImage}" alt="">` : ""}
                ${trackerIcon ? `<img src="${trackerIcon}" alt="">` : ""}
                <div class="muted">${name} — ${clear.investment}</div>
              </div>
              ${difficulty ? `<div class="difficulty">${renderDifficultyBadges(difficulty)}</div>` : ""}
              ${
                detail
                  ? `<details class="detail">
                      <summary>Details</summary>
                      <div class="muted">${detail.moveLevel || ""} ${detail.grid || ""}</div>
                      ${
                        detail.gridLink
                          ? `<div class="muted"><a href="${detail.gridLink}" target="_blank">Open Sync Grid</a></div>`
                          : ""
                      }
                      <div class="muted">Min: ${detail.minInvestment || "-"} ${
                      detail.minVideo ? `<a href="${detail.minVideo}" target="_blank">Video</a>` : ""
                    } | Max: ${detail.maxInvestment || "-"} ${
                      detail.maxVideo ? `<a href="${detail.maxVideo}" target="_blank">Video</a>` : ""
                    }</div>
                      ${detail.notes ? `<div class="muted">${detail.notes}</div>` : ""}
                      ${
                        detail.gridLink
                          ? `<div class="muted"><a href="${detail.gridLink}" target="_blank">Open Sync Grid</a></div>`
                          : ""
                      }
                    </details>`
                  : ""
              }
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

  els.bossOutput.classList.add("grid");
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
          const sheetImage = clear.image || state.imageByPairId.get(clear.pairId);
          const trackerIcon =
            entry && entry.pair.images && entry.pair.images.length > 0 ? `${ICON_BASE}${entry.pair.images[0]}` : null;
          const detail = clear.detail;
          const difficulty = detail?.difficulty || "";
          return `
            <div class="boss">
              <div class="boss-line">
                ${sheetImage ? `<img src="${sheetImage}" alt="">` : ""}
                ${trackerIcon ? `<img src="${trackerIcon}" alt="">` : ""}
                <div class="muted">${name} — ${clear.investment}</div>
              </div>
              ${difficulty ? `<div class="difficulty">${renderDifficultyBadges(difficulty)}</div>` : ""}
              ${
                detail
                  ? `<details class="detail">
                      <summary>Details</summary>
                      <div class="muted">${detail.moveLevel || ""} ${detail.grid || ""}</div>
                      ${
                        detail.gridLink
                          ? `<div class="muted"><a href="${detail.gridLink}" target="_blank">Open Sync Grid</a></div>`
                          : ""
                      }
                      <div class="muted">Min: ${detail.minInvestment || "-"} ${
                      detail.minVideo ? `<a href="${detail.minVideo}" target="_blank">Video</a>` : ""
                    } | Max: ${detail.maxInvestment || "-"} ${
                      detail.maxVideo ? `<a href="${detail.maxVideo}" target="_blank">Video</a>` : ""
                    }</div>
                      ${detail.notes ? `<div class="muted">${detail.notes}</div>` : ""}
                      ${
                        detail.gridLink
                          ? `<div class="muted"><a href="${detail.gridLink}" target="_blank">Open Sync Grid</a></div>`
                          : ""
                      }
                    </details>`
                  : ""
              }
            </div>
          `;
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

function renderDifficultyBadges(text) {
  const tokens = [];
  if (!text) return "";
  for (const key of Object.keys(DIFFICULTY_LEGEND)) {
    if (text.includes(key)) tokens.push(key);
  }
  if (!tokens.length) return text;
  return tokens
    .map((icon) => `<span class="diff-badge" data-tooltip="${DIFFICULTY_LEGEND[icon]}">${icon}</span>`)
    .join(" ");
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

els.clearsJsonFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  loadClearsJsonFromFile(file);
});

els.loadDefaultClearsJson.addEventListener("click", () => {
  loadDefaultClearsJson();
});

els.clearClears.addEventListener("click", () => {
  if (els.clearsJsonFile) els.clearsJsonFile.value = "";
  state.headers = [];
  state.rows = [];
  resetClearsState();
  els.clearsStatus.textContent = "Clears removed.";
  els.validClears.textContent = "0";
  renderUnmatched();
  renderBossClears();
});

els.buildPlan.addEventListener("click", buildPlan);
els.resetPlan.addEventListener("click", resetPlan);
els.clearMatches?.addEventListener("click", () => {
  clearManualMatches();
});

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
loadManualMatches();
loadDefaultPairs();
