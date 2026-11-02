// Genera data/courses/stats.json (ids de lecciones y cantidades por curso) para mostrar el % de cada módulo
// sin cargar su contenido. Correr después de editar un curso: node scripts/course-stats.mjs
// Con --check falla si el archivo está desactualizado (lo usa validate-courses.mjs).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data/courses/stats.json");

export async function buildStats() {
  const catalog = readFileSync(join(root, "data/courses/catalog.ts"), "utf8");
  const ids = [...catalog.matchAll(/id: "(c\d\d-[a-z0-9-]+)"/g)].map((m) => m[1]);
  const stats = {};
  for (const id of ids) {
    const c = (await import(pathToFileURL(join(root, `data/courses/${id}/es.ts`)).href)).default;
    stats[id] = { lessons: c.lessons.map((l) => l.id), flashcards: c.flashcards.map((f) => f.id), exam: c.exam.length };
  }
  return JSON.stringify(stats, null, 2) + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = await buildStats();
  if (process.argv.includes("--check")) {
    let cur = "";
    try { cur = readFileSync(out, "utf8"); } catch {}
    if (cur !== next) { console.error("✗ data/courses/stats.json desactualizado: corré node scripts/course-stats.mjs"); process.exit(1); }
    console.log("✓ stats.json al día");
  } else {
    writeFileSync(out, next);
    console.log(`✓ ${out}`);
  }
}
