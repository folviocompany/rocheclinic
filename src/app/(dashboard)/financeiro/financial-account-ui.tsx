'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentMethods } from '@/features/finances/schema';

type Notice = { kind: 'success' | 'error'; text: string } | null;

const methodLabels: Record<string, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  transfer: 'Transferência',
  other: 'Outros',
};

export const financialToday = new Date().toISOString().slice(0, 10);

export function formatFinancialDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export function FinancialAccountPanel({ overline, title, count, emptyText, notice, className = '', children }: {
  overline: string;
  title: string;
  count: number;
  emptyText: string;
  notice: Notice;
  className?: string;
  children: ReactNode;
}) {
  return <section className={`receivables-card ${className}`.trim()}>
    <div className="chart-heading">
      <div><span className="overline">{overline}</span><h2>{title}</h2></div>
      <span>{count} {count === 1 ? 'conta aberta' : 'contas abertas'}</span>
    </div>
    {notice && <p className={`alert ${notice.kind}`} role="status">{notice.text}</p>}
    {count ? <div className="receivable-list">{children}</div> : <div className="receivables-empty"><CheckCircle2 size={28} /><p>{emptyText}</p></div>}
  </section>;
}

export function FinancialAccountRow({ icon, iconClassName = '', overdue, title, detail, values, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }: {
  icon: ReactNode;
  iconClassName?: string;
  overdue: boolean;
  title: string;
  detail: ReactNode;
  values: ReactNode;
  actionLabel: string;
  onAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return <article className="receivable-row">
    <span className={`receivable-icon ${iconClassName} ${overdue ? 'overdue' : ''}`.trim()}>{icon}</span>
    <div className="receivable-main"><strong>{title}</strong><small>{detail}</small></div>
    <div className="receivable-values">{values}</div>
    <div className="financial-account-actions"><Button variant="outline" onClick={onAction}>{actionLabel}</Button>{secondaryActionLabel && onSecondaryAction && <Button variant="outline" onClick={onSecondaryAction}>{secondaryActionLabel}</Button>}</div>
  </article>;
}

export function FinancialModal({ labelledBy, overline, title, description, pending, onClose, children }: {
  labelledBy: string;
  overline: string;
  title: string;
  description: ReactNode;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return <div className="modal-backdrop" role="presentation"><section className="procedure-modal finance-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
    <div className="modal-heading"><div><span className="overline">{overline}</span><h2 id={labelledBy}>{title}</h2><p>{description}</p></div><button className="modal-close" onClick={onClose} disabled={pending} aria-label="Fechar"><X size={20}/></button></div>
    {children}
  </section></div>;
}

export function FinancialField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em>{error}</em>}</label>;
}

export function FinancialPaymentMethodOptions() {
  return paymentMethods.map((method) => <option value={method} key={method}>{methodLabels[method]}</option>);
}
