# iOS Trainer

Plataforma interactiva (Next.js 15, App Router, TypeScript, sin librerías de UI) para aprender iOS de cero a arquitecto: 20 módulos en orden, cada uno con lecciones, flashcards, práctica y quiz, más un módulo "Prep TestGorilla" con los modos de práctica originales. Bilingüe: español rioplatense y inglés.

## Comandos

- `npm run dev` → http://localhost:3000
- `npm run build` → debe compilar sin errores antes de entregar cambios
- `npx tsc --noEmit` → type-check rápido
- `node scripts/validate-courses.mjs [id ...]` → valida el contenido de los módulos (mínimos, regex, soluciones vs checks, paridad es↔en, `stats.json` al día)
- `node scripts/course-stats.mjs` → regenera `data/courses/stats.json` (ids y cantidades por módulo para calcular el %); correrlo después de editar contenido

## Estructura

- `app/modulos` lista, `app/modulos/[id]` (`ModuleView`: pestañas Lecciones, Flashcards, Práctica, Quiz en `?tab=`; `CourseDeck`, `ModulePractice`, `CourseExam`) y `app/modulos/prep-testgorilla` (`PrepModuleView` con los modos de `components/prep/`). Las rutas viejas (`/cursos`, `/lecciones`, `/quiz`…) redirigen en `next.config.mjs`. `app/api/progress` = sync remoto.
- `components/ProfileGate` pide el código personal antes de mostrar la app; `components/SyncPanel` es la cuenta (código, salir, exportar).
- `components/` UI compartida: `LessonPlayer` (motor de lecciones; exporta `Predict`, `Fill`, `WriteStep`), `McqGame` (opción múltiple reutilizable), `SyncPanel`, `Inline` (renderiza `código` en backticks), `Code`.
- `data/` contenido. Tipos en `data/types.ts`. Lecciones en `data/lessons/*.ts` (tipos de paso en `data/lessons/types.ts`).
- `data/courses/` módulos: `catalog.ts` (orden, niveles, título/descripción en ambos idiomas), `<id>/es.ts` y `<id>/en.ts` (contenido, cargado de forma perezosa vía `index.ts`). Reglas de autoría en `docs/COURSE_AUTHORING.md`.
- `lib/i18n.tsx` (`useI18n`: `locale`, `t`) con textos de UI en `locales/es.json` y `locales/en.json`. `lib/content.ts` (`useContent`) elige `data/es.ts` o `data/en/` para la práctica libre.
- `lib/modules.ts` % y próximo paso de cada módulo; `lib/prep.ts` % del módulo de preparación.
- `lib/progress.ts` `ProgressProvider` + `useProgress` (un solo estado para toda la app): localStorage + sync con MongoDB (`lib/mongo.ts`, colección `progress`) vía código personal (obligatorio, lo pide `ProfileGate`; se vuelve a sincronizar al volver a la pestaña). Fusión por unión (nunca pierde progreso). Las claves de cursos van con prefijo: `lessons["<curso>/<lección>"]`, `flash["<curso>/<tarjeta>"]`, `exams[<curso>]` = mejor nota.

## Reglas de contenido

- Cada lección = alternar `explain` → ejercicio (`predict`, `fill`, `write`). Mínimo 3 ejercicios por lección. El alumno no avanza sin resolver.
- `explain` siempre con `code` y, si imprime algo, `output` real y verificado.
- `predict`: 4 opciones, una correcta, `explanation` que justifica paso a paso. Verificar mentalmente la salida antes de escribir la respuesta.
- `fill`: `accept` es lista de regex anclados (`^...$`); `code` contiene exactamente un `____`.
- `write`: `checks` = regex de construcciones que una buena solución tiene; `warnings` = regex de errores típicos. No se ejecuta Swift: es chequeo de patrones + `solution` de referencia.
- Swift moderno: `async/await`, `@Observable` (iOS 17) mencionado junto a `ObservableObject`, structs por defecto.
- Texto con `código` entre backticks se renderiza como inline code por `Inline`.

## Idiomas

- Todo texto de UI va en `locales/es.json` y `locales/en.json` con la misma clave; nunca strings sueltos en componentes.
- Todo contenido existe en los dos idiomas con los mismos ids, respuestas y regex (el progreso se guarda por id y se comparte entre idiomas).

## Al agregar contenido

1. Cursos: editar `data/courses/<id>/es.ts` y `en.ts` siguiendo `docs/COURSE_AUTHORING.md`; correr `node scripts/validate-courses.mjs <id>`. Curso nuevo: sumarlo a `catalog.ts` e `index.ts`.
2. Práctica libre: agregar el objeto al array en `data/` y su traducción en `data/en/`. Lección suelta nueva: incluirla en `data/lessons/index.ts` y `data/en/lessons/index.ts` en el orden pedagógico.
3. Correr `npm run build`.

## Persistencia

Sin `MONGODB_URI` (opcional `DB_NAME`, por defecto `ios_trainer`) la app funciona solo con localStorage; `/api/progress` responde 501 y la UI lo indica. Ver README para deploy en Vercel.

## Ramas

Trabajar y commitear en `develop`. `main` solo recibe cambios por PR desde `develop`; Vercel despliega `main`.
