import { MongoClient, type Collection } from "mongodb";

// Conexión a MongoDB (local o Atlas). Sin MONGODB_URI devuelve null y la app sigue en localStorage.
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "ios_trainer";

export type ProgressDoc = { _id: string; progress: Record<string, unknown>; updatedAt: number };

// Se cachea en globalThis para reusar la conexión entre hot reloads (dev) e invocaciones (serverless).
const g = globalThis as typeof globalThis & { _mongoClient?: Promise<MongoClient> };

export async function progressCollection(): Promise<Collection<ProgressDoc> | null> {
  if (!MONGODB_URI) return null;
  if (!g._mongoClient) {
    g._mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
      .connect()
      .catch((e) => {
        g._mongoClient = undefined; // reintenta en la próxima request
        throw e;
      });
  }
  const client = await g._mongoClient;
  return client.db(DB_NAME).collection<ProgressDoc>("progress");
}
