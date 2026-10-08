import React, { useId, useRef } from "react";
import { Bold, Heading, List, ListOrdered } from "lucide-react";
import type { DescriptionFont } from "../types";
import DescriptionText, { DESCRIPTION_FONTS, DESCRIPTION_SIZES } from "./DescriptionText";
import s from "./DescriptionEditor.module.css";

interface Props {
  label: string;
  value: string;
  font: DescriptionFont;
  size: number;
  onChange: (value: string) => void;
  onFont: (font: DescriptionFont) => void;
  onSize: (size: number) => void;
  placeholder?: string;
  /** Растягивать по высоте родителя (окно отдела) или фиксированная высота (форма сотрудника). */
  fill?: boolean;
}

// Текстовое поле с панелью оформления и предпросмотром «как будет в карточке».
const DescriptionEditor: React.FC<Props> = ({ label, value, font, size, onChange, onFont, onSize, placeholder, fill }) => {
  const id = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const edit = (fn: (text: string, start: number, end: number) => { text: string; start: number; end: number }) => {
    const el = textRef.current;
    if (!el) return;
    const r = fn(value, el.selectionStart, el.selectionEnd);
    onChange(r.text);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  };
  const wrapBold = () => edit((t, a, b) => {
    const inner = t.slice(a, b) || "текст";
    return { text: `${t.slice(0, a)}**${inner}**${t.slice(b)}`, start: a + 2, end: a + 2 + inner.length };
  });
  const insertHeading = () => edit((t, a, b) => {
    const heading = t.slice(a, b).replace(/:$/, "") || "Заголовок";
    const before = t.slice(0, a);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    return { text: `${before}${lead}${heading}: ${t.slice(b)}`, start: a + lead.length, end: a + lead.length + heading.length };
  });
  const prefixLines = (numbered: boolean) => edit((t, a, b) => {
    const from = t.lastIndexOf("\n", a - 1) + 1;
    const toIdx = t.indexOf("\n", b);
    const to = toIdx === -1 ? t.length : toIdx;
    const block = t.slice(from, to).split("\n").map((l, i) => `${numbered ? `${i + 1}.` : "•"} ${l.replace(/^(\d{1,2}[.)]|[•\-–])\s+/, "")}`).join("\n");
    return { text: t.slice(0, from) + block + t.slice(to), start: from, end: from + block.length };
  });

  return (
    <section className={`${s.editor} ${fill ? s.fill : ""}`}>
      <div className={s.toolbar} role="toolbar" aria-label={`Оформление: ${label}`}>
        <label className={s.toolField}>
          <span>Шрифт</span>
          <select value={font} onChange={(e) => onFont(e.target.value as DescriptionFont)}>
            {DESCRIPTION_FONTS.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>)}
          </select>
        </label>
        <label className={s.toolField}>
          <span>Размер</span>
          <select value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {DESCRIPTION_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className={s.sep} />
        <button type="button" className={s.tool} onClick={wrapBold} title="Жирный (**текст**)" aria-label="Жирный"><Bold size={15} /></button>
        <button type="button" className={s.tool} onClick={insertHeading} title="Заголовок («Работы:»)" aria-label="Заголовок"><Heading size={15} /></button>
        <button type="button" className={s.tool} onClick={() => prefixLines(true)} title="Нумерованный список" aria-label="Нумерованный список"><ListOrdered size={15} /></button>
        <button type="button" className={s.tool} onClick={() => prefixLines(false)} title="Маркированный список" aria-label="Маркированный список"><List size={15} /></button>
      </div>
      <div className={s.panes}>
        <div className={s.pane}>
          <label htmlFor={`${id}-text`}>{label}</label>
          <textarea
            id={`${id}-text`} ref={textRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            style={{ fontFamily: DESCRIPTION_FONTS.find((f) => f.value === font)?.css, fontSize: size }}
          />
        </div>
        <div className={s.pane}>
          <span className={s.paneLabel}>Как будет в карточке</span>
          <div className={s.preview}>
            {value.trim() ? <DescriptionText text={value} font={font} size={size} /> : <p className={s.empty}>Пока пусто</p>}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DescriptionEditor;
