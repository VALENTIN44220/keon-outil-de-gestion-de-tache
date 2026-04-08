import { useCallback, useEffect, useRef, useState } from 'react';

type Serializer<T> = (value: T) => string;
type Parser<T> = (raw: string) => T;

type Options<T> = {
  serialize?: Serializer<T>;
  parse?: Parser<T>;
};

function safeGetItem(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore quota / privacy mode
  }
}

/**
 * Persist a piece of UI state in `sessionStorage` (per browser tab).
 * Useful for draft inputs (search bars, form fields) that should survive tab switching / refresh.
 */
export function useSessionStorageState<T>(
  key: string,
  initialValue: T,
  options: Options<T> = {},
) {
  const serialize = options.serialize ?? ((v: T) => JSON.stringify(v));
  const parse = options.parse ?? ((raw: string) => JSON.parse(raw) as T);

  const initialRef = useRef<T>(initialValue);
  const [state, setState] = useState<T>(() => {
    const raw = safeGetItem(key);
    if (raw == null) return initialRef.current;
    try {
      return parse(raw);
    } catch {
      return initialRef.current;
    }
  });

  useEffect(() => {
    safeSetItem(key, serialize(state));
  }, [key, serialize, state]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
    },
    [],
  );

  const clear = useCallback(() => {
    setState(initialRef.current);
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  return [state, set, clear] as const;
}

