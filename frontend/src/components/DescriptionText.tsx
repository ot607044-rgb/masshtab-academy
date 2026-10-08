import React from "react";
import type { DescriptionFont } from "../types";
import s from "./DescriptionText.module.css";

export const DESCRIPTION_FONTS: { value: DescriptionFont; label: string; css: string }[] = [
  { value: "sans", label: "Без засечек", css: "inherit" },
  { value: "serif", label: "С засечками", css: 'Georgia, "Times New Roman", serif' },
  { value: "mono", label: "Моноширинный", css: '"JetBrains Mono", Consolas, monospace' },
];
export const DESCRIPTION_SIZES = [12, 13, 14, 15, 16, 18];
export const DEFAULT_DESCRIPTION_SIZE = 12;

// Сплошной текст описания → строки: «Продукт: …», «Работы:», «1. …», «2. …», «• …»
export const descriptionLines = (text: string) => text
  .replace(/(^|[\s.;,])([А-ЯЁA-Z][а-яёa-z]+(?: [а-яёa-z]+)?):\s*/g, (_, pre, label) => `${pre.trim()}\n${label}: `)
  .replace(/\s+(\d{1,2})[.)]\s+/g, "\n$1. ")
  .split(/\n+/).map((l) => l.trim()).filter(Boolean);

// **жирный** внутри строки
const inline = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
  part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part);

interface Props { text: string; font?: DescriptionFont | null; size?: number | null }

const DescriptionText: React.FC<Props> = ({ text, font, size }) => {
  const family = DESCRIPTION_FONTS.find((f) => f.value === font)?.css ?? "inherit";
  return (
    <div className={s.description} style={{ fontFamily: family, fontSize: size ?? DEFAULT_DESCRIPTION_SIZE }}>
      {descriptionLines(text).map((line, i) => {
        const item = line.match(/^(\d{1,2})\.\s+(.*)$/);
        if (item) return <p key={i} className={s.item}><span>{item[1]}.</span><span>{inline(item[2])}</span></p>;
        const bullet = line.match(/^[•\-–]\s+(.*)$/);
        if (bullet) return <p key={i} className={s.item}><span>•</span><span>{inline(bullet[1])}</span></p>;
        const label = line.match(/^(?:\*\*)?([^:*]{1,40}):(?:\*\*)?\s*(.*)$/);
        if (label) return <p key={i} className={s.line}><strong>{label[1]}:</strong>{label[2] && <> {inline(label[2])}</>}</p>;
        return <p key={i} className={s.line}>{inline(line)}</p>;
      })}
    </div>
  );
};

export default DescriptionText;
