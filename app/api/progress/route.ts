import { NextRequest, NextResponse } from "next/server";

// Persistencia remota con Upstash Redis (REST). Si no hay env vars, responde 501 y la app sigue en localStorage.
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function keyFor(code: string) {
  return `ios-trainer:${code.trim().toLowerCase()}`;
}

function validCode(code: string | null): code is string {
  return !!code && /^[a-z0-9-_]{6,64}$/i.test(code);
}

async function redis(cmd: unknown[]) {
  const r = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export async function GET(req: NextRequest) {
  if (!URL_ || !TOKEN) return NextResponse.json({ error: "sync no configurado" }, { status: 501 });
  const code = req.nextUrl.searchParams.get("code");
  if (!validCode(code)) return NextResponse.json({ error: "código inválido" }, { status: 400 });
  const raw = await redis(["GET", keyFor(code)]);
  return NextResponse.json({ progress: raw ? JSON.parse(raw) : null });
}

export async function PUT(req: NextRequest) {
  if (!URL_ || !TOKEN) return NextResponse.json({ error: "sync no configurado" }, { status: 501 });
  const code = req.nextUrl.searchParams.get("code");
  if (!validCode(code)) return NextResponse.json({ error: "código inválido" }, { status: 400 });
  const body = await req.json();
  if (!body || typeof body !== "object") return NextResponse.json({ error: "body inválido" }, { status: 400 });
  await redis(["SET", keyFor(code), JSON.stringify({ ...body, updatedAt: Date.now() })]);
  return NextResponse.json({ ok: true });
}
