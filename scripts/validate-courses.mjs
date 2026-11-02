// Valida el contenido de los cursos (data/courses/<id>/{es,en}.ts) sin ejecutar Swift.
// Uso: node scripts/validate-courses.mjs [id ...] [--allow-empty]
// Node >= 23.6 importa .ts directamente (type stripping).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const allowEmpty = args.includes("--allow-empty");
const catalog = readFileSync(join(root, "data/courses/catalog.ts"), "utf8");
const allIds = [...catalog.matchAll(/id: "(c\d\d-[a-z0-9-]+)"/g)].map((m) => m[1]);
const ids = args.filter((a) => !a.startsWith("--"));
for (const id of ids) if (!allIds.includes(id)) { console.error(`Curso desconocido: ${id}`); process.exit(2); }

const MIN = { lessons: 5, exercises: 3, flashcards: 10, exam: 10 };
let errors = 0, warnings = 0;
const err = (where, msg) => { errors++; console.log(`  ✗ ${where}: ${msg}`); };
const warn = (where, msg) => { warnings++; console.log(`  ⚠ ${where}: ${msg}`); };

function regex(where, src, flags) {
  try { return new RegExp(src, flags); } catch (e) { err(where, `regex inválida ${JSON.stringify(src)}: ${e.message}`); return null; }
}
function backticks(where, text) {
  if (typeof text !== "string") return;
  if ((text.match(/`/g) ?? []).length % 2) err(where, `backticks sin cerrar en ${JSON.stringify(text.slice(0, 60))}…`);
}
function nonEmpty(where, field, v) {
  if (typeof v !== "string" || !v.trim()) err(where, `falta ${field}`);
}
function unique(where, arr, what) {
  const seen = new Set();
  for (const x of arr) { if (seen.has(x)) err(where, `${what} repetido: ${x}`); seen.add(x); }
}
function skew(where, answers) {
  if (answers.length < 4) return;
  const counts = [0, 0, 0, 0];
  answers.forEach((a) => counts[a]++);
  if (Math.max(...counts) / answers.length > 0.5) warn(where, `respuestas poco variadas (por índice: ${counts.join("/")})`);
}
const norm = (s) => s.trim().replace(/\s+/g, " ");
// Lo que LessonPlayer muestra como "respuesta esperada" tras 3 intentos.
const revealed = (re) => re.replace(/^\^|\$$/g, "").replace(/\\/g, "").replace(/\(\\\)/g, "()");

function checkOne(id, lang, c) {
  const at = `${id}/${lang}`;
  if (!c || !Array.isArray(c.lessons) || !Array.isArray(c.flashcards) || !Array.isArray(c.exam)) { err(at, "no exporta { lessons, flashcards, exam }"); return; }
  const empty = !c.lessons.length && !c.flashcards.length && !c.exam.length;
  if (empty && allowEmpty) return;
  if (c.lessons.length < MIN.lessons) err(at, `${c.lessons.length} lecciones (mínimo ${MIN.lessons})`);
  if (c.flashcards.length < MIN.flashcards) err(at, `${c.flashcards.length} flashcards (mínimo ${MIN.flashcards})`);
  if (c.exam.length < MIN.exam) err(at, `${c.exam.length} preguntas de examen (mínimo ${MIN.exam})`);
  unique(at, c.lessons.map((l) => l.id), "id de lección");
  unique(at, c.flashcards.map((f) => f.id), "id de flashcard");
  unique(at, c.exam.map((q) => q.id), "id de examen");
  const predictAnswers = [];

  for (const l of c.lessons) {
    const lw = `${at} ${l.id}`;
    nonEmpty(lw, "title", l.title); nonEmpty(lw, "goal", l.goal);
    backticks(lw, l.title); backticks(lw, l.goal);
    if (!(l.minutes > 0)) err(lw, "minutes debe ser > 0");
    if (!Array.isArray(l.steps) || !l.steps.length) { err(lw, "sin pasos"); continue; }
    if (l.steps[0].kind !== "explain") err(lw, "el primer paso debe ser explain");
    const ex = l.steps.filter((s) => s.kind !== "explain").length;
    if (ex < MIN.exercises) err(lw, `${ex} ejercicios (mínimo ${MIN.exercises})`);
    l.steps.forEach((s, n) => {
      const sw = `${lw} paso ${n + 1} (${s.kind})`;
      switch (s.kind) {
        case "explain":
          nonEmpty(sw, "title", s.title);
          if (!Array.isArray(s.body) || !s.body.length) err(sw, "body vacío");
          (s.body ?? []).forEach((p) => backticks(sw, p));
          backticks(sw, s.title);
          if (!s.code) err(sw, "explain sin code");
          break;
        case "predict":
          if (!Array.isArray(s.options) || s.options.length !== 4) err(sw, "debe tener 4 opciones");
          unique(sw, s.options ?? [], "opción");
          if (!Number.isInteger(s.answer) || s.answer < 0 || s.answer >= (s.options?.length ?? 0)) err(sw, "answer fuera de rango");
          nonEmpty(sw, "code", s.code); nonEmpty(sw, "explanation", s.explanation);
          [s.prompt, s.explanation, ...(s.options ?? [])].forEach((t) => backticks(sw, t));
          predictAnswers.push(s.answer);
          break;
        case "fill": {
          const holes = (s.code?.match(/____/g) ?? []).length;
          if (holes !== 1) err(sw, `code debe tener exactamente un ____ (tiene ${holes})`);
          if (!Array.isArray(s.accept) || !s.accept.length) { err(sw, "accept vacío"); break; }
          const res = s.accept.map((a) => {
            if (!a.startsWith("^") || !a.endsWith("$")) err(sw, `accept no anclado: ${a}`);
            return regex(sw, a, "i");
          });
          const shown = norm(revealed(s.accept[0]));
          if (res.every(Boolean) && !res.some((r) => r.test(shown))) warn(sw, `la respuesta que se revela (${JSON.stringify(shown)}) no pasa sus propias regex`);
          nonEmpty(sw, "prompt", s.prompt); nonEmpty(sw, "explanation", s.explanation);
          [s.prompt, s.explanation, s.hint].forEach((t) => backticks(sw, t));
          break;
        }
        case "write": {
          nonEmpty(sw, "prompt", s.prompt); nonEmpty(sw, "solution", s.solution);
          if (!Array.isArray(s.checks) || !s.checks.length) { err(sw, "checks vacío"); break; }
          for (const ch of s.checks) {
            const r = regex(sw, ch.pattern, "m");
            if (r && s.solution && !r.test(s.solution)) err(sw, `la solución no cumple su check "${ch.label}"`);
            backticks(sw, ch.label);
          }
          for (const w of s.warnings ?? []) {
            const r = regex(sw, w.pattern, "m");
            if (r && s.solution && r.test(s.solution)) err(sw, `la solución dispara su warning "${w.label}"`);
            backticks(sw, w.label);
          }
          if (s.starter && s.checks.every((ch) => { try { return new RegExp(ch.pattern, "m").test(s.starter); } catch { return false; } }))
            err(sw, "el starter ya cumple todos los checks");
          [s.prompt, s.hint].forEach((t) => backticks(sw, t));
          break;
        }
        default:
          err(sw, `kind desconocido`);
      }
    });
  }
  skew(`${at} predict`, predictAnswers);

  for (const f of c.flashcards) {
    const fw = `${at} ${f.id}`;
    nonEmpty(fw, "front", f.front); nonEmpty(fw, "back", f.back);
    backticks(fw, f.front); backticks(fw, f.back);
  }
  for (const q of c.exam) {
    const qw = `${at} ${q.id}`;
    nonEmpty(qw, "question", q.question); nonEmpty(qw, "explanation", q.explanation);
    if (!Array.isArray(q.options) || q.options.length !== 4) err(qw, "debe tener 4 opciones");
    unique(qw, q.options ?? [], "opción");
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) err(qw, "answer fuera de rango");
    [q.question, q.explanation, ...(q.options ?? [])].forEach((t) => backticks(qw, t));
  }
  skew(`${at} exam`, c.exam.map((q) => q.answer));
}

// es y en tienen que ser el mismo curso: mismos ids, pasos, respuestas y regex.
function checkParity(id, es, en) {
  const at = `${id} es↔en`;
  const same = (what, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) err(at, `${what} difiere: ${JSON.stringify(a)?.slice(0, 120)} vs ${JSON.stringify(b)?.slice(0, 120)}`); };
  same("ids de lecciones", es.lessons.map((l) => l.id), en.lessons.map((l) => l.id));
  same("ids de flashcards", es.flashcards.map((f) => f.id), en.flashcards.map((f) => f.id));
  same("ids de examen", es.exam.map((q) => q.id), en.exam.map((q) => q.id));
  same("respuestas de examen", es.exam.map((q) => q.answer), en.exam.map((q) => q.answer));
  for (const l of es.lessons) {
    const o = en.lessons.find((x) => x.id === l.id);
    if (!o) continue;
    same(`${l.id} tipos de paso`, l.steps.map((s) => s.kind), o.steps.map((s) => s.kind));
    l.steps.forEach((s, n) => {
      const t = o.steps[n];
      if (!t || t.kind !== s.kind) return;
      if (s.kind === "predict") same(`${l.id} paso ${n + 1} answer`, s.answer, t.answer);
      if (s.kind === "fill") same(`${l.id} paso ${n + 1} accept`, s.accept, t.accept);
      if (s.kind === "write") {
        same(`${l.id} paso ${n + 1} checks`, s.checks.map((c) => c.pattern), t.checks.map((c) => c.pattern));
        same(`${l.id} paso ${n + 1} warnings`, (s.warnings ?? []).map((c) => c.pattern), (t.warnings ?? []).map((c) => c.pattern));
      }
    });
  }
}

let totals = { lessons: 0, flashcards: 0, exam: 0 };
for (const id of ids.length ? ids : allIds) {
  console.log(`▸ ${id}`);
  const load = async (lang) => (await import(pathToFileURL(join(root, `data/courses/${id}/${lang}.ts`)).href)).default;
  let es, en;
  try { es = await load("es"); } catch (e) { err(`${id}/es`, `no carga: ${e.message}`); }
  try { en = await load("en"); } catch (e) { err(`${id}/en`, `no carga: ${e.message}`); }
  if (es) checkOne(id, "es", es);
  if (en) checkOne(id, "en", en);
  if (es && en) checkParity(id, es, en);
  if (es) { totals.lessons += es.lessons.length; totals.flashcards += es.flashcards.length; totals.exam += es.exam.length; }
}
console.log(`\n${totals.lessons} lecciones, ${totals.flashcards} flashcards, ${totals.exam} preguntas de examen por idioma`);
console.log(errors ? `✗ ${errors} errores, ${warnings} advertencias` : `✓ sin errores (${warnings} advertencias)`);
process.exit(errors ? 1 : 0);
