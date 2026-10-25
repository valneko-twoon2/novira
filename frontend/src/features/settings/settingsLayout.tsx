// The building blocks of the settings modal: a titled section and a labelled row with its control on the right.
import type { ReactNode } from 'react';

export function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row__text">
        <span className="st-row__label">{label}</span>
        {help && <span className="st-row__help">{help}</span>}
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
