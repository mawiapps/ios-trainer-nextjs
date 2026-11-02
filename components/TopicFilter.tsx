"use client";
import { Topic } from "@/data/types";
import { useI18n } from "@/lib/i18n";

export default function TopicFilter({ topics, value, onChange }: { topics: Topic[]; value: Topic | "all"; onChange: (t: Topic | "all") => void }) {
  const { t } = useI18n();
  return (
    <div className="filters">
      <button className={value === "all" ? "on" : ""} onClick={() => onChange("all")}>{t("common.all")}</button>
      {topics.map((topic) => (
        <button key={topic} className={value === topic ? "on" : ""} onClick={() => onChange(topic)}>{t(`topic.${topic}`)}</button>
      ))}
    </div>
  );
}
