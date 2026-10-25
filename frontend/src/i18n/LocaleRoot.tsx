import { useEffect, useState, type ReactNode } from 'react';
import { getLocale, onLocaleChange } from './index';

/** Remounts the tree when the locale changes so every t() call re-renders. */
export function LocaleRoot({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(getLocale());
  useEffect(() => onLocaleChange(setLocaleState), []);
  return <div key={locale} style={{ display: 'contents' }}>{children}</div>;
}
