export default function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return <>{parts.map((p, i) => p.startsWith("`") ? <code className="inline" key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>)}</>;
}
