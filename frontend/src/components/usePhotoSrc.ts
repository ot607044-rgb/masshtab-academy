import { useEffect, useState } from "react";
import { getEmployeePhoto } from "../api/employees";

// Фото отдаётся только с авторизацией, поэтому грузим blob и держим object URL
// в общем кэше: на схеме структуры один и тот же сотрудник встречается много раз.
const cache = new Map<string, Promise<string>>();

const load = (url: string) => {
  let pending = cache.get(url);
  if (!pending) {
    pending = getEmployeePhoto(url).then((blob) => URL.createObjectURL(blob));
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
};

export default function usePhotoSrc(url?: string | null) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    setSrc("");
    if (url) load(url).then((value) => { if (!cancelled) setSrc(value); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [url]);
  return src;
}
