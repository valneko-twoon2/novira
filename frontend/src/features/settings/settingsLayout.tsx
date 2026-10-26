// The building blocks of the settings modal: a titled section and a labelled row with its control on the right. A row's
// `help` is a longer explanation behind an "i"; `note` is text that stays in view (a consequence the user must see);
// `detail` is what the row holds (a folder, a list), under the label so the controls stay on one line at the right.
import type { ReactNode } from 'react';
import { InfoMark } from '@/ui';

export function Row({ label, help, note, detail, children }: { label: string; help?: string; note?: string; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row__text">
        <span className="st-row__label">
          {label}
          {help && <InfoMark info={help} />}
        </span>
        {note && <span className="st-row__help">{note}</span>}
        {detail}
      </div>
      <div className="st-row__control">{children}</div>
    </div>
  );
}

export function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="st-section">
      <h3 className="st-section__title">{title}</h3>
      <div className="st-section__body">{children}</div>
    </section>
  );
}
