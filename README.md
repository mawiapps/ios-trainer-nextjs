# iOS Trainer – Prep para el assessment de GlobalTask (TestGorilla)

Entrenador interactivo en Next.js para fijar los fundamentos del plan de preparación: Swift core, algoritmos, ingeniería de software, REST/JWT, SwiftUI/arquitectura, seguridad mobile y testing/release. Sin temporizadores; todo con feedback inmediato.

## Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

## Modos

| Ruta | Qué hace |
| --- | --- |
| `/lecciones` | **Empezá acá.** 26 lecciones paso a paso: cada concepto explicado con ejemplos y salida, seguido de ejercicios (predecir salida, completar hueco, escribir código). No se avanza sin resolver. |
| `/teoria` | Referencia rápida: resumen comprimido del temario para repasar el día antes. |
| `/flashcards` | Tarjetas por tema; "Lo sabía" las retira, "Repetir" las manda al final del mazo. |
| `/quiz` | Opción múltiple estilo TestGorilla con explicación de cada respuesta. |
| `/salida` | "¿Qué imprime este Swift?" – entrena las trampas del lenguaje. |
| `/codigo` | Retos de código: escribís la función de memoria, recibís checklist, advertencias y solución. |
| `/bugs` | Debugging: hacé clic en la línea con el error. |
| `/entrevista` | Preguntas de entrevista/custom: respondés, comparás con puntos clave y te autoevaluás. |

## Progreso desde cualquier dispositivo

Por defecto el progreso vive en `localStorage` (solo ese navegador). Para verlo desde cualquier lado:

1. **Base de datos gratis (MongoDB Atlas)**: creá una cuenta en https://www.mongodb.com/atlas, un clúster gratuito (M0) y un usuario de base de datos. En *Network Access* permití `0.0.0.0/0` (Vercel no tiene IP fija). En *Connect → Drivers* copiá la cadena `mongodb+srv://...` (reemplazá `<password>`).
2. **Deploy gratis en Vercel**: subí la carpeta a un repo de GitHub, entrá a https://vercel.com/new, importá el repo y en *Environment Variables* pegá `MONGODB_URI` (y opcionalmente `DB_NAME`, por defecto `ios_trainer`). Deploy. Te da una URL tipo `https://ios-trainer-xxx.vercel.app`.
3. En la app, en **Inicio → Sincronización**, elegí un código (ej. `wilver-ios-2026`) y tocá Conectar. Usá el mismo código en cada dispositivo. El progreso se guarda en cada cambio y se fusiona (nunca pierde lo hecho).

Para correrlo local con sync, copiá `.env.example` a `.env.local` y completá `MONGODB_URI` (Atlas o un Mongo local, `mongodb://127.0.0.1:27017`). El progreso queda en la colección `progress`, un documento por código de sincronización.

Sin base configurada, la app funciona igual en modo local, y podés mover el progreso con **Exportar / Importar** (.json).

## Agregar contenido

Las lecciones viven en `data/lessons/*.ts` (tipos de paso: `explain`, `predict`, `fill`, `write`). El resto del contenido vive en `data/*.ts` (flashcards, quiz, output, code, bugs, interview, theory). Agregá un objeto al array y listo; los tipos están en `data/types.ts`.

- En `code.ts`, `checks` son regex que una buena solución debería contener (dan puntaje) y `warnings` regex de errores típicos (restan). No ejecuta Swift: es un chequeo de patrones + solución de referencia para comparar.
