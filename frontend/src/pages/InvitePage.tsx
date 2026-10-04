import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { acceptInvitation, getInvitation, type InvitationInfo } from "../api/access";
import { apiError } from "../api/workspace";
import { useAuth } from "../context/AuthContext";
import styles from "./LoginPage.module.css";

const MIN_LENGTH = 8;

export default function InvitePage() {
  const { token = "" } = useParams();
  const { signInWithToken } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InvitationInfo>();
  const [loadError, setLoadError] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getInvitation(token).then(setInfo).catch(e => setLoadError(apiError(e))); }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password.length < MIN_LENGTH) return setError(`Пароль должен быть не короче ${MIN_LENGTH} символов`);
    if (password !== repeat) return setError("Пароли не совпадают");
    setBusy(true);
    try {
      const { access_token } = await acceptInvitation(token, password);
      await signInWithToken(access_token);
      navigate("/dashboard", { replace: true });
    } catch (e) { setError(apiError(e)); setBusy(false); }
  }

  return <div className={styles.container}><div className={styles.card}>
    <div className={styles.logo}>МА</div>
    <h1 className={styles.title}>Академия Масштаба</h1>
    {loadError ? <>
      <p className={styles.subtitle}>{loadError}</p>
      <Link to="/login">Перейти ко входу</Link>
    </> : !info ? <p className={styles.subtitle}>Проверяем приглашение...</p> : <>
      <p className={styles.subtitle}>{info.full_name}, вам открыт доступ{info.company_name ? ` в компании «${info.company_name}»` : ""}. Придумайте пароль для входа.</p>
      <form onSubmit={submit} className={styles.form}>
        <div className="form-group"><label htmlFor="invite-email">Логин</label><input id="invite-email" type="email" value={info.email} readOnly autoComplete="username" /></div>
        <div className="form-group"><label htmlFor="invite-password">Пароль</label><input id="invite-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={MIN_LENGTH} required autoFocus autoComplete="new-password" /></div>
        <div className="form-group"><label htmlFor="invite-repeat">Повторите пароль</label><input id="invite-repeat" type="password" value={repeat} onChange={e => setRepeat(e.target.value)} required autoComplete="new-password" /></div>
        {error && <div className="error-msg" role="alert">{error}</div>}
        <button type="submit" disabled={busy} className={styles.submitBtn}>{busy ? "Сохраняем..." : "Задать пароль и войти"}</button>
      </form>
    </>}
  </div></div>;
}
