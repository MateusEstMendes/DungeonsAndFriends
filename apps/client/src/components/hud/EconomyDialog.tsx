import { useUIStore } from '../../store/useUIStore';
import { useEffect, useRef, type ReactNode } from 'react';
export function EconomyDialog({ title, onClose, children, drawer = false }: { title: string; onClose: () => void; children: ReactNode; drawer?: boolean }) {
  const notice = useUIStore(s => s.notice);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); return () => { dialog.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className={`economy-dialog${drawer ? ' economy-drawer' : ''}`} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}><header><h2>{title}</h2><button aria-label="Fechar janela" onClick={onClose}>×</button></header>{notice && <div role="alert" className="economy-notice"><p>{notice}</p><button aria-label="Fechar aviso da janela" onClick={() => useUIStore.setState({ notice: '' })}>Entendi</button></div>}{children}</dialog>;
}
