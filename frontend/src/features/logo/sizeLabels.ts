import type { MessageKey } from '@/i18n';
import type { LogoSize } from '@/state/media/logo';

export const SIZE_LABELS: Record<LogoSize, MessageKey> = {
  square: 'logo.size.square',
  wide: 'logo.size.wide',
  tall: 'logo.size.tall',
};
