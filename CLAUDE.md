# iOS Trainer

Entrenador interactivo (Next.js 15, App Router, TypeScript, sin librerías de UI) para preparar el assessment de TestGorilla del rol iOS Engineer Sr en GlobalTask. Todo en español rioplatense/neutro.

## Comandos

- `npm run dev` → http://localhost:3000
- `npm run build` → debe compilar sin errores antes de entregar cambios
- `npx tsc --noEmit` → type-check rápido

## Estructura

- `app/` páginas (una por modo): `lecciones`, `teoria` (referencia rápida), `flashcards`, `quiz`, `salida` (predice la salida), `codigo`, `bugs`, `entrevista`. `app/api/progress` = sync remoto.
- `components/` UI compartida: `LessonPlayer` (motor de lecciones), `McqGame` (opción múltiple reutilizable), `SyncPanel`, `Inline` (renderiza `código` en backticks), `Code`.
- `data/` contenido. Tipos en `data/types.ts`. Lecciones en `data/lessons/*.ts` (tipos de paso en `data/lessons/types.ts`).
- `lib/progress.ts` hook `useProgress`: localStorage + sync opcional con Upstash Redis vía código de sincronización. Fusión por unión (nunca pierde progreso).

## Reglas de contenido

- Cada lección = alternar `explain` → ejercicio (`predict`, `fill`, `write`). Mínimo 3 ejercicios por lección. El alumno no avanza sin resolver.
- `explain` siempre con `code` y, si imprime algo, `output` real y verificado.
- `predict`: 4 opciones, una correcta, `explanation` que justifica paso a paso. Verificar mentalmente la salida antes de escribir la respuesta.
- `fill`: `accept` es lista de regex anclados (`^...$`); `code` contiene exactamente un `____`.
- `write`: `checks` = regex de construcciones que una buena solución tiene; `warnings` = regex de errores típicos. No se ejecuta Swift: es chequeo de patrones + `solution` de referencia.
- Swift moderno: `async/await`, `@Observable` (iOS 17) mencionado junto a `ObservableObject`, structs por defecto.
- Texto con `código` entre backticks se renderiza como inline code por `Inline`.

## Al agregar contenido

1. Agregar el objeto al array correspondiente en `data/`.
2. Si es una lección nueva, incluirla en `data/lessons/index.ts` en el orden pedagógico (cada lección usa lo de la anterior).
3. Correr `npm run build`.

## Persistencia

Sin `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` la app funciona solo con localStorage; `/api/progress` responde 501 y la UI lo indica. Ver README para deploy en Vercel.
