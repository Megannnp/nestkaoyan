"use client";

import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title: string;
  children: ReactNode;
}

/** Reusable modal dialog wrapper */
export function Modal({ open, onClose, label, title, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><span>{label}</span><strong>{title}</strong></div>
          <button onClick={onClose}>关闭</button>
        </div>
        {children}
      </section>
    </div>
  );
}

interface CompactModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title: string;
  children: ReactNode;
}

/** Compact variant for completion/task dialogs */
export function CompactModal({ open, onClose, label, title, children }: CompactModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><span>{label}</span><strong>{title}</strong></div>
          <button onClick={onClose}>关闭</button>
        </div>
        {children}
      </section>
    </div>
  );
}