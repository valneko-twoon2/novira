// "5 minutes ago" for the session list, worded by the browser's Intl for the app's language.
import { getLocale } from '@/i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago `time` was: now, minutes, hours, days (up to a week), then the date. */
export function relativeTime(time: number, now = Date.now(), locale: string = getLocale()): string {
  const diff = Math.max(0, now - time);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diff < MINUTE) return rtf.format(0, 'second');
  if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), 'minute');
  if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), 'hour');
  if (diff < 7 * DAY) return rtf.format(-Math.floor(diff / DAY), 'day');
  return new Date(time).toLocaleDateString(locale);
}
