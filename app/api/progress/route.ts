import { NextRequest, NextResponse } from "next/server";
import { progressCollection } from "@/lib/mongo";

// Persistencia remota con MongoDB. Si no hay MONGODB_URI, responde 501 y la app sigue en localStorage.
export const runtime = "nodejs";

function keyFor(code: string) {
  return code.trim().toLowerCase();
}

function validCode(code: string | null): code is string {
  return !!code && /^[a-z0-9-_]{6,64}$/i.test(code);
}

export async function GET(req: NextRequest) {
  const col = await progressCollection();
  if (!col) return NextResponse.json({ error: "sync no configurado" }, { status: 501 });
  const code = req.nextUrl.searchParams.get("code");
  if (!validCode(code)) return NextResponse.json({ error: "código inválido" }, { status: 400 });
  const doc = await col.findOne({ _id: keyFor(code) });
  return NextResponse.json({ progress: doc ? { ...doc.progress, updatedAt: doc.updatedAt } : null });
}

export async function PUT(req: NextRequest) {
  const col = await progressCollection();
  if (!col) return NextResponse.json({ error: "sync no configurado" }, { status: 501 });
  const code = req.nextUrl.searchParams.get("code");
  if (!validCode(code)) return NextResponse.json({ error: "código inválido" }, { status: 400 });
  const body = await req.json();
  if (!body || typeof body !== "object") return NextResponse.json({ error: "body inválido" }, { status: 400 });
  await col.replaceOne(
    { _id: keyFor(code) },
    { progress: body, updatedAt: Date.now() },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
