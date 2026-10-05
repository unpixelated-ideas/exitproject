import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
export function IntroModal({ onClose }: {
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const previous = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); previous?.focus(); }; }, []);
    return <dialog ref={ref} aria-labelledby="intro-title" onCancel={e => { e.preventDefault(); onClose(); }}><h1 id="intro-title">{t('introTitle')}</h1><p>{t('introBody')}</p><button className="primary" autoFocus onClick={onClose}>{t('start')} <span aria-hidden="true">→</span></button></dialog>;
}
