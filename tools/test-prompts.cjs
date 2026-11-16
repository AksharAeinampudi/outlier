// Quick checks for Outlier's prompt bank: run with  node tools/test-prompts.cjs
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(root, "opendata.js"), "utf8"));
const src = fs.readFileSync(path.join(root, "outlier.html"), "utf8");
const full = src.split("<script>")[1].split("</script>")[0];
new Function(full); console.log("syntax ok");
const js = full.split("/* ---------------- Game state")[0];
global.localStorage = {getItem: () => null, setItem: () => {}};
const t0 = Date.now();
vm.runInThisContext(js + `
;(function(){
console.log("bank built in", Date.now() - ${t0}, "ms (Node; a browser is similar)");
const k = t => PROMPTS.filter(p => p.kind === t).length;
console.log("classic", k("classic"), "· twist", k("twist"), "· template", k("template"), "· hidden", k("hidden"), "· playable total", PROMPTS.length - k("hidden"));
console.log("hidden:", PROMPTS.filter(p => p.kind === "hidden" && !p.q.startsWith("_")).map(p => p.q + " (" + p.map.size + ")").join("; "));
// Repeats: how many distinct prompts appear across a year of daily launches?
const seen = new Map(); let bad = 0;
for (let n = 1; n <= 365; n++){ const r = promptsFor(n); if (new Set(r).size !== 7 || r.some(i => i === undefined || PROMPTS[i].kind === "hidden")) bad++; r.forEach(i => seen.set(i, (seen.get(i) || 0) + 1)); }
console.log("365 days:", seen.size, "distinct prompts used,", "max repeats of one prompt:", Math.max(...seen.values()), "· bad days:", bad);
console.log("");
for (let n = 16; n <= 18; n++) console.log("Day " + n + ":", promptsFor(n).map(i => PROMPTS[i].q).join(" / "));
console.log("");
const tp = PROMPTS.filter(p => p.kind === "template");
for (let i = 0; i < tp.length; i += Math.ceil(tp.length / 12)){ const p = tp[i]; const n = Object.values(p.canon).reduce((s,a) => s + a.length, 0); console.log(String(n).padStart(4), p.q, "| e.g.", p.canon.c.slice(0,3).join(", ")); }
console.log("");
const t = (q, a) => { const p = PROMPTS.find(p => p.q === q); if (!p) { console.log("NO PROMPT", q); return; } const r = lookup(p, a); console.log(q.padEnd(52), JSON.stringify(a).padEnd(16), r ? r.t + " " + r.name : "MISS"); };
t("Name a river", "Amazon"); t("Name a river", "Mississippi"); t("Name a lake", "Victoria"); t("Name a currency", "dollar");
t("Name a bone in the human body", "femur"); t("Name a sport played on ice", "curling"); t("Name a novelist", "Tolstoy");
t("Name a country with the letter B in its name", "Brazil"); t("Name a country with the letter B in its name", "France");
t("Name a magical object from myth or fiction", "Excalibur"); t("Name a type of knife", "santoku");
console.log("Packs:", PACKS.map(p => p.name + " " + p.idx.length).join(" · "));
})();`);
