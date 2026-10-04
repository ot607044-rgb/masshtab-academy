import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Compass, Play } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSupport } from "../context/SupportContext";
import { Modal, PageHeading } from "../components/AcademyUI";
import { ROLE_LABELS } from "../types";
import { guideFor, guideKey, workPath } from "./gettingStartedContent";
import styles from "./GettingStartedPage.module.css";

export default function GettingStartedPage() {
  const { user } = useAuth();
  const { session } = useSupport();
  const navigate = useNavigate();
  const [tourStep, setTourStep] = useState<number | null>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (tourStep === null && restoreFocus.current) {
      launchRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [tourStep]);
  if (!user) return null;
  const guide = guideFor(user.role);
  const current = tourStep === null ? null : guide.tour[tourStep];
  const closeTour = () => { restoreFocus.current = true; setTourStep(null); };
  const continueToWork = () => {
    try { localStorage.setItem(guideKey(user, session?.company_id), "seen"); } catch { /* Navigation still works with storage disabled. */ }
    navigate(`/dashboard/${workPath(user.role)}`);
  };

  return <div className={`academy-page ${styles.page}`}>
    <PageHeading title="С чего начать" subtitle={`Ваш путеводитель · ${ROLE_LABELS[user.role]}`}>
      <button className="btn-secondary" onClick={continueToWork}>Перейти к работе <ArrowRight size={16} /></button>
    </PageHeading>
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <div className={styles.compass}><Compass size={32} strokeWidth={1.5} /></div>
      <div><span className={styles.eyebrow}>ЗНАКОМСТВО С АКАДЕМИЕЙ</span><h2 id="welcome-title">Понятный маршрут от первого шага до результата</h2><p>{guide.intro}</p>
        <button ref={launchRef} className="btn-primary" onClick={() => setTourStep(0)}><Play size={16} />Показать экскурсию</button><span className={styles.hint}>4 коротких шага · можно пропустить</span>
      </div>
    </section>
    <section aria-labelledby="route-title">
      <div className={styles.sectionHeading}><h2 id="route-title">В каком порядке двигаться</h2><p>Идите сверху вниз. Если шаг уже выполнен — переходите к следующему.</p></div>
      <ol className={styles.steps}>{guide.steps.map((step, index) => <li key={step.title}>
        <span className={styles.number} aria-hidden="true">{index + 1}</span><div><h3>{step.title}</h3><p>{step.instruction}</p><p className={styles.result}><strong>Результат:</strong> {step.result}</p><Link to={`/dashboard/${step.to}`} className={styles.link}>{step.action}<ArrowRight size={15} /></Link></div>
      </li>)}</ol>
    </section>
    <section aria-labelledby="daily-title"><div className={styles.sectionHeading}><h2 id="daily-title">Как работать каждый день</h2><p>После знакомства используйте эти разделы для текущих задач.</p></div><div className={styles.shortcuts}>{guide.daily.map(item => <Link key={item.to} to={`/dashboard/${item.to}`}><h3>{item.title}<ArrowRight size={17} /></h3><p>{item.description}</p></Link>)}</div></section>
    <footer className={styles.footer}><div><strong>Можно возвращаться в любой момент</strong><p>Откройте «С чего начать» в меню, чтобы перечитать маршрут или повторить экскурсию.</p></div><button className="btn-secondary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>К началу страницы</button></footer>
    {current && tourStep !== null && <Modal title="Экскурсия по академии" onClose={closeTour}>
      <div className={styles.tour} aria-live="polite" aria-atomic="true"><span className={styles.eyebrow}>Шаг {tourStep + 1} из {guide.tour.length}</span><div className={styles.dots} aria-hidden="true">{guide.tour.map((_, i) => <span key={i} className={i === tourStep ? styles.activeDot : ""} />)}</div><h3>{current.title}</h3><p>{current.description}</p></div>
      <div className={styles.tourActions}><button className={styles.skip} onClick={closeTour}>Пропустить экскурсию</button><div><button className="btn-secondary" disabled={tourStep === 0} onClick={() => setTourStep(tourStep - 1)}>Назад</button>{tourStep < guide.tour.length - 1 ? <button className="btn-primary" onClick={() => setTourStep(tourStep + 1)}>Далее <ArrowRight size={15} /></button> : <button className="btn-primary" onClick={closeTour}>Завершить экскурсию</button>}</div></div>
    </Modal>}
  </div>;
}
