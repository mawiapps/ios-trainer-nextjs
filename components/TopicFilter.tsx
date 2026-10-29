"use client";
import { Topic, TOPIC_LABEL } from "@/data/types";

export default function TopicFilter({ topics, value, onChange }: { topics: Topic[]; value: Topic | "all"; onChange: (t: Topic | "all") => void }) {
  return (
    <div className="filters">
      <button className={value === "all" ? "on" : ""} onClick={() => onChange("all")}>Todos</button>
      {topics.map((t) => (
        <button key={t} className={value === t ? "on" : ""} onClick={() => onChange(t)}>{TOPIC_LABEL[t]}</button>
      ))}
    </div>
  );
}
