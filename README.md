# iOS Trainer

Plataforma interactiva en Next.js para aprender iOS de cero a arquitecto, en español o inglés (selector en la barra lateral).

- **Módulos** (`/modulos`): 20 módulos en orden pedagógico, de Swift desde cero a system design: Swift, SwiftUI, UIKit, concurrencia, networking, testing, MVVM/Coordinator, VIPER/Clean, TCA, modularidad, legacy, CI/CD, App Store, compras in-app y suscripciones, seguridad, performance, capacidades del sistema y entrevistas. Cada módulo muestra su % de avance y tiene cuatro pestañas: **Lecciones** (con reto final), **Flashcards**, **Práctica** (todos los ejercicios mezclados) y **Quiz** (se aprueba con 70 %). El botón **Continuar** lleva siempre al próximo paso.
- **Prep TestGorilla** (`/modulos/prep-testgorilla`): los modos originales para el assessment de TestGorilla como pestañas de un módulo: lecciones sueltas, flashcards, quiz, predecir la salida, escribir código, cazar bugs, entrevista y referencia rápida.

## Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

## Progreso desde cualquier dispositivo

Al entrar, la app pide un **código personal** (ej. `wilver-ios-2026`). Con ese código todo el progreso se guarda solo en MongoDB y se fusiona con lo que haya en el navegador; en otro dispositivo se entra con el mismo código. Para que funcione en producción:

1. **Base de datos gratis (MongoDB Atlas)**: creá una cuenta en https://www.mongodb.com/atlas, un clúster gratuito (M0) y un usuario de base de datos. En *Network Access* permití `0.0.0.0/0` (Vercel no tiene IP fija). En *Connect → Drivers* copiá la cadena `mongodb+srv://...` (reemplazá `<password>`).
2. **Deploy gratis en Vercel**: subí la carpeta a un repo de GitHub, entrá a https://vercel.com/new, importá el repo y en *Environment Variables* pegá `MONGODB_URI` (y opcionalmente `DB_NAME`, por defecto `ios_trainer`). Deploy. Te da una URL tipo `https://ios-trainer-xxx.vercel.app`.
3. Entrá a la app y escribí tu código. El progreso se guarda en cada cambio, se vuelve a traer al volver a la pestaña y se fusiona (nunca pierde lo hecho). **Salir en este dispositivo** (en Inicio) sube lo pendiente y borra la copia local.

Para correrlo local con sync, copiá `.env.example` a `.env.local` y completá `MONGODB_URI` (Atlas o un Mongo local, `mongodb://127.0.0.1:27017`). El progreso queda en la colección `progress`, un documento por código personal.

Sin base configurada, el código igual se pide pero el progreso queda solo en el navegador, y podés mover el progreso con **Exportar / Importar** (.json).

## Agregar contenido

Los módulos viven en `data/courses/<id>/es.ts` y `en.ts`; las reglas están en [`docs/COURSE_AUTHORING.md`](docs/COURSE_AUTHORING.md). Después de editar, corré `node scripts/course-stats.mjs` (actualiza `data/courses/stats.json`, que da el % de cada módulo) y `node scripts/validate-courses.mjs`. Los textos de la interfaz están en `locales/es.json` y `locales/en.json`.


Las lecciones viven en `data/lessons/*.ts` (tipos de paso: `explain`, `predict`, `fill`, `write`). El resto del contenido vive en `data/*.ts` (flashcards, quiz, output, code, bugs, interview, theory). Agregá un objeto al array y listo; los tipos están en `data/types.ts`.

- En `code.ts`, `checks` son regex que una buena solución debería contener (dan puntaje) y `warnings` regex de errores típicos (restan). No ejecuta Swift: es un chequeo de patrones + solución de referencia para comparar.

## Flujo de trabajo

- Se trabaja en la rama `develop`.
- Para publicar, abrí un Pull Request de `develop` → `main`. Al mergearlo, Vercel despliega `main` a producción.
