// Builds opendata.js: extra answers and rarity estimates for Outlier from Wikidata (CC0 open data).
// Run from the Outlier folder:  node tools/build-opendata.mjs
//
// How rarity is estimated: Wikidata says how many language editions of Wikipedia have an article
// on each thing ("sitelinks"). More sitelinks ≈ better known ≈ more people will think of it.
// New answers are tiered against the sitelink counts of the answers already in each category.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = path.join(ROOT, "outlier.html");
const OUT = path.join(ROOT, "opendata.js");
const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "OutlierWordGame/1.0 (open-data build script; non-commercial)";
const MAX_NEW = 350;

// ---- the game's own bank and matching rules, read straight from outlier.html ----
const src = fs.readFileSync(HTML, "utf8");
const bankSrc = src.slice(src.indexOf("const BANK = ["), src.indexOf("/* ---------------- Constants"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(bankSrc.replace("const BANK", "var BANK").replace("const EXTRA", "var EXTRA") + ";this.BANK=BANK;", ctx);
const BANK = ctx.BANK;
function norm(s){
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/\+\+/g," plus plus ").replace(/#/g," sharp ").replace(/['’`]/g,"").replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g," ").trim().replace(/^(the|a|an) /,"");
}

// ---- which Wikidata classes feed which prompt ----
const Q = (pattern, min, opts = {}) => ({pattern, min, ...opts});
const SOURCES = {
  "Name a dog breed": Q("?item wdt:P31 wd:Q39367 .", 3),
  "Name a breed of cat": Q("?item wdt:P31 wd:Q43577 .", 3),
  "Name a programming language": Q("?item wdt:P31 wd:Q9143 .", 6),
  "Name a board game": Q("?item wdt:P31 wd:Q131436 .", 5),
  "Name a type of cheese": Q("{ ?item wdt:P31 wd:Q10943 } UNION { ?item wdt:P279 wd:Q10943 }", 4),
  "Name a type of pasta": Q("{ ?item wdt:P31 wd:Q178 } UNION { ?item wdt:P279 wd:Q178 }", 3),
  "Name a dessert": Q("{ ?item wdt:P31 wd:Q182940 } UNION { ?item wdt:P279 wd:Q182940 }", 6),
  "Name a musical instrument": Q("?item wdt:P279+ wd:Q34379 .", 12),
  "Name a language": Q("?item wdt:P31 wd:Q1288568 .", 25),
  "Name a mythical creature": Q("?item wdt:P31 wd:Q2239243 .", 6),
  "Name a gemstone": Q("{ ?item wdt:P31 wd:Q83437 } UNION { ?item wdt:P279 wd:Q83437 }", 5),
  "Name a sea or ocean": Q("?item wdt:P31 wd:Q165 .", 8),
  // Fruit, vegetables and gemstones come back mixed with scientific names and generic terms,
  // so they only contribute alternate names for answers the game already has.
  "Name a fruit": Q("{ ?item wdt:P31 wd:Q3314483 } UNION { ?item wdt:P279 wd:Q3314483 }", 12, {aliasesOnly: true}),
  "Name a vegetable": Q("{ ?item wdt:P31 wd:Q11004 } UNION { ?item wdt:P279 wd:Q11004 }", 12, {aliasesOnly: true}),
  "Name a gemstone": Q("{ ?item wdt:P31 wd:Q83437 } UNION { ?item wdt:P279 wd:Q83437 }", 5, {aliasesOnly: true}),
  "Name a profession": Q("?item wdt:P31 wd:Q28640 .", 40),
  // People famous mainly for something else (politicians, writers, musicians...) are left out.
  "Name a famous painter": Q("?item wdt:P106 wd:Q1028181 ; wdt:P31 wd:Q5 .", 35,
    {person: true, excludeOcc: ["Q82955","Q116","Q36180","Q49757","Q177220","Q488205","Q33999","Q2526255","Q11631","Q4964182","Q214917","Q6625963","Q36834","Q42973","Q11063","Q266569","Q28389","Q1622272"]}),
  "Name a famous scientist": Q("VALUES ?job { wd:Q169470 wd:Q593644 wd:Q864503 wd:Q170790 wd:Q11063 wd:Q901 } ?item wdt:P106 ?job ; wdt:P31 wd:Q5 .", 50,
    {person: true, excludeOcc: ["Q82955","Q116","Q4964182","Q36180","Q49757","Q1028181","Q188094","Q1234713","Q6625963","Q214917","Q250867","Q19546","Q1423891"]}),
  // Categories filled entirely from Wikidata (no hand-written tiers: rarity comes from sitelink rank).
  "Name a river": Q("?item wdt:P31 wd:Q4022 .", 40),
  "Name a mountain": Q("?item wdt:P31 wd:Q8502 .", 35),
  "Name an island": Q("?item wdt:P31 wd:Q23442 .", 60),
  "Name a lake": Q("?item wdt:P31 wd:Q23397 .", 50),
  "Name a desert": Q("?item wdt:P31 wd:Q8514 .", 20),
  "Name a volcano": Q("VALUES ?v { wd:Q8072 wd:Q169358 wd:Q159954 } ?item wdt:P31 ?v .", 20),
  "Name a constellation": Q("?item wdt:P31 wd:Q8928 .", 20),
  "Name a breed of horse": Q("?item wdt:P31 wd:Q1160573 .", 5),
  "Name a novelist": Q("?item wdt:P106 wd:Q6625963 ; wdt:P31 wd:Q5 .", 60, {person: true}),
  "Name a poet": Q("?item wdt:P106 wd:Q49757 ; wdt:P31 wd:Q5 .", 75, {person: true}),
  "Name a composer": Q("?item wdt:P106 wd:Q36834 ; wdt:P31 wd:Q5 .", 55, {person: true}),
  "Name an explorer": Q("?item wdt:P106 wd:Q11900058 ; wdt:P31 wd:Q5 .", 25, {person: true}),
  "Name an inventor": Q("?item wdt:P106 wd:Q205375 ; wdt:P31 wd:Q5 .", 40, {person: true}),
  "Name a currency": Q("?item wdt:P31 wd:Q8142 .", 25),
  "Name a cocktail": Q("?item wdt:P31 wd:Q134768 .", 8),
  "Name a type of bread": Q("{ ?item wdt:P279 wd:Q7802 } UNION { ?item wdt:P31 wd:Q7802 }", 8),
  "Name a soup": Q("{ ?item wdt:P279 wd:Q41415 } UNION { ?item wdt:P31 wd:Q41415 }", 8),
  "Name a martial art": Q("{ ?item wdt:P31 wd:Q11417 } UNION { ?item wdt:P279 wd:Q11417 }", 10),
  "Name a card game": Q("?item wdt:P31 wd:Q142714 .", 6),
  "Name a music genre": Q("?item wdt:P31 wd:Q188451 .", 40),
  "Name a typeface": Q("?item wdt:P31 wd:Q17451 .", 5),
  "Name a type of fabric": Q("{ ?item wdt:P279 wd:Q28823 } UNION { ?item wdt:P31 wd:Q28823 }", 12),
  "Name a spice or herb": Q("VALUES ?k { wd:Q42527 wd:Q207123 } { ?item wdt:P279 ?k } UNION { ?item wdt:P31 ?k }", 15),
  "Name a god or goddess": Q("VALUES ?k { wd:Q22989102 wd:Q16513881 wd:Q146083 wd:Q178885 } ?item wdt:P31 ?k .", 25),
  "Name a famous bridge": Q("VALUES ?k { wd:Q12280 wd:Q12570 } ?item wdt:P31 ?k .", 30),
  "Name a type of shoe": Q("{ ?item wdt:P279 wd:Q22676 } UNION { ?item wdt:P31 wd:Q22676 }", 8),
  "Name a piece of furniture": Q("{ ?item wdt:P279 wd:Q14745 } UNION { ?item wdt:P31 wd:Q14745 }", 15),
  "Name a famous novel": Q("?item wdt:P31 wd:Q7725634 ; wdt:P7937 wd:Q8261 .", 45),
  "Name a famous painting": Q("?item wdt:P31 wd:Q3305213 .", 35),
  "Name a video game": Q("?item wdt:P31 wd:Q7889 .", 50),
  "Name a band": Q("?item wdt:P31 wd:Q215380 .", 60),
  "Name a famous film": Q("?item wdt:P31 wd:Q11424 .", 80),
  "Name a sport": Q("?item wdt:P31 wd:Q349 .", 35)
};
const BLOCK = {
  "Name a musical instrument": /instrument|^(multimedia|siren|whistle|microphones?|loudspeakers?|headphones?|phonograph|top|soprano|tenor|alto|sweep-picking|membranophone|idiophone|aerophone|chordophone|electrophone|amplifier|turntable|metronome|tuning fork)$/i,
  "Name a dessert": /^(congee|youtiao|french toast|compote|dessert)$/i,
  "Name a mythical creature": /^(death|easter bunny|santa claus)$/i,
  "Name a type of cheese": /^(processed cheese|sheep milk cheese|goat cheese|cheese)$/i
};

async function sparql(query){
  for (let attempt = 0; attempt < 3; attempt++){
    const res = await fetch(ENDPOINT + "?format=json&query=" + encodeURIComponent(query), {headers: {"User-Agent": UA, "Accept": "application/sparql-results+json"}});
    if (res.ok) return (await res.json()).results.bindings;
    if (res.status === 429 || res.status >= 500){ await new Promise(r => setTimeout(r, 4000 * (attempt + 1))); continue; }
    throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
  }
  throw new Error("gave up after retries");
}
const clean = s => s.replace(/\s+/g, " ").trim().replace(/ (PDO|PGI|DOP|AOC|IGP|DOC)$/, "");
const okLabel = s => s.length >= 2 && s.length <= 40 && !/[,|()\[\]{}<>"\/\\:;]/.test(s) && !/^Q\d+$/.test(s) && /[a-z]/i.test(s) && !/\d{3,}/.test(s);
const median = a => { if (!a.length) return null; const b = [...a].sort((x,y) => x-y); return b[Math.floor(b.length/2)]; };

// Keep the previous build's results for any category whose query fails this time (the public endpoint can time out).
let previous = {};
try { const w = {}; vm.runInNewContext(fs.readFileSync(OUT, "utf8"), {window: w}); previous = w.OUTLIER_OPEN_DATA || {}; } catch {}
const out = {}, report = [];
for (const [q, cfg] of Object.entries(SOURCES)){
  const row = BANK.find(r => r[0] === q);
  if (!row){ report.push(`${q}: not in the bank, skipped`); continue; }
  const occSel = cfg.excludeOcc ? `(GROUP_CONCAT(DISTINCT STRAFTER(STR(?occ), "entity/"); separator=" ") AS ?occs)` : "";
  const occPat = cfg.excludeOcc ? `OPTIONAL { ?item wdt:P106 ?occ . }` : "";
  const query = `SELECT ?item ?label ?sl (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) ${occSel} WHERE {
    ${cfg.pattern}
    ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${cfg.min})
    ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
    OPTIONAL { ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }
    ${occPat}
  } GROUP BY ?item ?label ?sl`;
  let rows;
  try { rows = await sparql(query); }
  catch (e){
    if (previous[q]){ out[q] = previous[q]; report.push(`${q}: query failed (${e.message}), kept the previous build's data`); }
    else report.push(`${q}: query failed (${e.message})`);
    continue;
  }

  // Existing answers: key -> tier
  const known = new Map();
  ["c","u","r","x"].forEach((t,i) => row[i+1].split(",").forEach(entry => entry.split("|").forEach(a => { const k = norm(a); if (k && !known.has(k)) known.set(k, t); })));
  const tierSl = {c:[], u:[], r:[], x:[]};
  const items = [];
  const seen = new Set();
  for (const b of rows){
    const label = clean(b.label.value), sl = Number(b.sl.value);
    if (!okLabel(label) || label.length < 3 || BLOCK[q]?.test(label)) continue;
    if (cfg.excludeOcc && (b.occs?.value || "").split(" ").some(o => cfg.excludeOcc.includes(o))) continue;
    const key = norm(label); if (!key || seen.has(key)) continue; seen.add(key);
    let alts = (b.alts?.value || "").split("|").map(clean).filter(a => okLabel(a) && a.length >= 3 && norm(a) !== key);
    if (cfg.person){ const last = label.split(" ").pop(); if (last.length >= 4 && last !== label) alts.push(last); }
    alts = [...new Set(alts)].slice(0, 6);
    const hitTier = known.get(key) || alts.map(a => known.get(norm(a))).find(Boolean);
    if (hitTier) tierSl[hitTier].push(sl);
    items.push({label, key, sl, alts, hitTier});
  }
  // Thresholds from the answers already in the category; fall back to percentiles of this result set.
  const sorted = items.map(i => i.sl).sort((a,b) => b-a);
  const pct = p => sorted[Math.min(sorted.length-1, Math.floor(sorted.length*p))] ?? Infinity;
  const tU = median(tierSl.u) ?? pct(0.1), tR = Math.min(tU, median(tierSl.r) ?? pct(0.4));
  // A category with no hand-written answers gets all four tiers from sitelink rank.
  const fromScratch = row.slice(1).every(s => !s.trim());
  const cap = fromScratch ? 450 : MAX_NEW;
  const nAll = Math.min(cap, items.length);
  const add = {c:[], u:[], r:[], x:[]};
  let newCount = 0, aliasCount = 0;
  for (const it of items.sort((a,b) => b.sl - a.sl)){
    if (fromScratch){
      if (newCount >= cap) break;
      const f = newCount / nAll, t = f < 0.08 ? "c" : f < 0.28 ? "u" : f < 0.6 ? "r" : "x";
      const alts = it.alts.filter(a => !known.has(norm(a)));
      add[t].push([it.label, ...alts].join("|"));
      known.set(it.key, t); alts.forEach(a => known.set(norm(a), t));
      newCount++; continue;
    }
    if (it.hitTier){
      // Already an answer: contribute its extra names (e.g. "Alsatian" for German Shepherd) at the same tier.
      const extra = it.alts.filter(a => !known.has(norm(a)));
      if (extra.length){ add[it.hitTier].push([it.label, ...extra].join("|")); aliasCount += extra.length; extra.forEach(a => known.set(norm(a), it.hitTier)); }
      continue;
    }
    if (cfg.aliasesOnly || newCount >= MAX_NEW) continue;
    const t = it.sl >= tU ? "u" : it.sl >= tR ? "r" : "x";
    add[t].push([it.label, ...it.alts.filter(a => !known.has(norm(a)))].join("|"));
    known.set(it.key, t); it.alts.forEach(a => { if (!known.has(norm(a))) known.set(norm(a), t); });
    newCount++;
  }
  out[q] = add;
  report.push(`${q}: ${rows.length} rows · ${newCount} new answers (u ${add.u.length - 0}, r ${add.r.length}, x ${add.x.length}) · ${aliasCount} alternate names · thresholds u≥${tU} r≥${tR}`);
  await new Promise(r => setTimeout(r, 1200));
}

const header = `// Generated by tools/build-opendata.mjs on ${new Date().toISOString().slice(0,10)}.
// Extra answers and rarity estimates from Wikidata (https://www.wikidata.org), released under CC0.
// Each prompt maps to entries per tier: c common, u uncommon, r rare, x long shot. "|" separates alternate names.
`;
fs.writeFileSync(OUT, header + "window.OUTLIER_OPEN_DATA = " + JSON.stringify(out, null, 1) + ";\n");
console.log(report.join("\n"));
console.log("\nWrote " + OUT + " (" + Math.round(fs.statSync(OUT).size/1024) + " KB)");
