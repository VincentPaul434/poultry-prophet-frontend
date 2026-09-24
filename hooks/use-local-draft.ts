"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Small, explicit draft store for forms that may be interrupted by a weak
 * connection or a phone navigation gesture. Drafts are never submitted
 * automatically; the user must still press Save after the server is reached.
 */
export function useLocalDraft<T>(key: string | null, initialValue: T) {
  const initialRef = useRef(initialValue);
  const [value, setValue] = useState(initialValue);
  const [hasDraft, setHasDraft] = useState(false);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setValue(initialRef.current);
      setHasDraft(false);
      setHydratedKey(null);
      return;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        setValue(JSON.parse(raw) as T);
        setHasDraft(true);
      } else {
        setValue(initialRef.current);
        setHasDraft(false);
      }
    } catch {
      setValue(initialRef.current);
      setHasDraft(false);
    }
    setHydratedKey(key);
  }, [key]);

  useEffect(() => {
    if (!key || hydratedKey !== key) return;
    try {
      const serialized = JSON.stringify(value);
      if (serialized === JSON.stringify(initialRef.current)) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, serialized);
      }
    } catch {
      // Storage can be unavailable in private browsing; the online form still works.
    }
  }, [hydratedKey, key, value]);

  const clearDraft = useCallback(() => {
    if (key) window.localStorage.removeItem(key);
    setValue(initialRef.current);
    setHasDraft(false);
  }, [key]);

  return { value, setValue, clearDraft, hasDraft, isReady: key == null || hydratedKey === key };
}
