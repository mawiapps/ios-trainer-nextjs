# Cómo escribir un curso

Cada curso vive en `data/courses/<id>/` con dos archivos: `es.ts` y `en.ts`. Ambos exportan por defecto un `CourseContent` (`data/courses/types.ts`) y son **el mismo curso en dos idiomas**: mismos ids, mismo orden de pasos, mismas respuestas, mismas regex. Solo cambia el texto para personas.

El catálogo (título, descripción, niveles, orden) está en `data/courses/catalog.ts`; la carga perezosa en `data/courses/index.ts`.

## Estructura de un curso

- `lessons`: 6 lecciones. Las 5 primeras enseñan; la sexta (`id: "final-challenge"`) es el **reto final**: 1 `explain` con el enunciado del escenario y 3 a 5 ejercicios `write`/`predict` que integran todo el curso.
- `flashcards`: 12 a 15 tarjetas de repaso (pregunta corta adelante, respuesta concreta atrás, `code` opcional).
- `exam`: 12 preguntas de opción múltiple para la evaluación final, con escenarios reales, no solo definiciones.

## Lecciones

Tipos de paso en `data/lessons/types.ts`. Reglas:

- Alternar `explain` → ejercicio (`predict`, `fill`, `write`). Primer paso siempre `explain`. Mínimo 3 ejercicios por lección; lo normal son 4 a 6.
- `explain`: `body` = 2 a 4 párrafos cortos; siempre con `code`. Si el código imprime algo, `output` con la salida **exacta** de Swift. En temas sin Swift (CI, App Store, firma) el `code` es la configuración real: `.xcconfig`, YAML, `Fastfile`, JSON, `Info.plist`, shell.
- `predict`: 4 opciones, una correcta, `explanation` que justifica paso a paso. Con `prompt` se vuelve pregunta de escenario (el `code` muestra el contexto). Variá el índice de la respuesta correcta.
- `fill`: `code` con exactamente un `____`; `accept` = regex anclados (`^...$`), se evalúan con flag `i` sobre la respuesta con espacios normalizados. El primero de `accept` se le muestra al alumno como respuesta esperada después de 3 intentos (sin `^`, `$` ni `\`), así que tiene que ser la forma canónica legible.
- `write`: `checks` = regex (flag `m`) de construcciones que una buena solución tiene; `warnings` = regex de errores típicos. La `solution` tiene que cumplir todos los checks y ningún warning. El `starter` no puede cumplir ya todos los checks. No se ejecuta Swift.
- Las regex son strings de TypeScript: escapá dos veces (`"\\bguard\\s+let\\b"`, `"\\(\\)"`).
- Texto entre backticks se muestra como código (`Inline`). Cerrá siempre cada backtick.

## Swift correcto y salidas verificadas

- Swift moderno (Swift 6, iOS 17+ salvo que el tema sea legacy): `async/await`, `@Observable` mencionado junto a `ObservableObject`, structs por defecto.
- Las salidas tienen que ser las reales: `print(Optional(3))` → `Optional(3)`, arrays `[1, 2]`, strings dentro de arrays con comillas `["a"]`, `0.1 + 0.2` → `0.30000000000000004`, `print(a, b)` separa con espacio.
- Nunca imprimas un `Dictionary` o `Set` con más de un elemento (el orden no está garantizado).
- APIs de terceros (TCA, Fastlane, RevenueCat) con su sintaxis actual. Si no estás seguro de un detalle, no lo pongas.
- Identificadores en inglés en ambos idiomas; los comentarios y los strings impresos se traducen (y entonces la `output` también).

## Idioma

- `es.ts`: español rioplatense como el resto de la app (voseo: "completá", "podés", "fijate"), claro y directo.
- `en.ts`: inglés natural de equipo de ingeniería, no traducción literal.
- Contenido orientado al día a día: qué se hace en un PR, en una guardia, en una entrevista. Nada de relleno teórico.

## Validar

```
node scripts/validate-courses.mjs <id>
npx tsc --noEmit --incremental false
```

El validador revisa mínimos, regex, backticks, que la solución pase sus checks, que el starter no los pase y la paridad es↔en. Tiene que terminar sin errores; revisá también las advertencias.
