import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { acknowledgeMyRegulation, getMyRegulation, type MyRegulation } from "../api/regulations";
import { apiError } from "../api/workspace";
import { LoadState } from "../components/AcademyUI";
import s from "./Regulations.module.css";

const dateLabel = (v: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

// Сотрудник видит назначенный ему регламент и подтверждает ознакомление
const MyRegulationPage: React.FC = () => {
  const [data, setData] = useState<MyRegulation | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { setError(""); getMyRegulation().then(setData).catch((e) => setError(apiError(e))); }, []);
  useEffect(load, [load]);

  if (data === undefined) return <div className={s.page}><LoadState error={error} retry={load} /></div>;
  if (data === null) {
    return (
      <div className={s.page}>
        <header className={s.heading}><div><h1>Мой регламент</h1><p>Здесь появится регламент вашей должности, когда HR его назначит.</p></div></header>
        <section className={`${s.card} ${s.emptyState}`}><ClipboardList size={28} /><p>Регламент пока не назначен.</p></section>
      </div>
    );
  }
  const { assignment, regulation, position_name } = data;
  const acknowledge = async () => {
    setBusy(true); setError("");
    try { const saved = await acknowledgeMyRegulation(); setData({ ...data, assignment: saved }); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div><h1>Мой регламент</h1><p>Цель и обязанности вашей должности. Назначен {dateLabel(assignment.assigned_at)}.</p></div>
      </header>
      <section className={`${s.card} ${s.detailCard}`}>
        <header className={s.band}>
          <div>
            {position_name && <span className={s.chip}>{position_name}</span>}
            <h2>{regulation.name}</h2>
            {regulation.summary && <p>{regulation.summary}</p>}
          </div>
        </header>
        <article className={s.detail}>
          {regulation.goal && (
            <div className={s.goal}><span className={s.overline} style={{ marginBottom: 10 }}>Цель должности</span><p>{regulation.goal}</p></div>
          )}
          <div className={s.dutiesHead}><div><h4>Обязанности</h4></div></div>
          <ol className={s.duties}>
            {regulation.duties.map((d, i) => <li key={i} className={s.duty}><span className={s.num}>{i + 1}</span><span className={s.dutyText}>{d}</span></li>)}
            {!regulation.duties.length && <li className={s.emptyDuties}>Обязанности пока не заполнены.</li>}
          </ol>
          <div className={s.goal} style={{ marginTop: 24, marginBottom: 0 }}>
            {assignment.acknowledged_at ? (
              <p className={s.ok} style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={18} />Вы ознакомились с регламентом {dateLabel(assignment.acknowledged_at)}.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <p>{assignment.require_ack ? "Прочитайте регламент и подтвердите ознакомление." : "Подтверждение не требуется, но вы можете отметить, что прочитали регламент."}</p>
                <button type="button" className={s.primaryBtn} onClick={acknowledge} disabled={busy}><CheckCircle2 size={17} />{busy ? "Сохранение..." : "Я ознакомлен(а)"}</button>
              </div>
            )}
            {error && <p className="error-msg" role="alert">{error}</p>}
          </div>
        </article>
      </section>
    </div>
  );
};

export default MyRegulationPage;
