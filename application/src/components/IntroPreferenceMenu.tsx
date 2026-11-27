import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export function IntroPreferenceMenu({ label, icon, options, value, onSelect }: {
    label: string;
    icon: ReactNode;
    options: ReadonlyArray<{ value: string; label: string; lang?: string; disabled?: boolean; description?: string }>;
    value: string;
    onSelect: (value: string) => void;
}) {
    const [initialIndex, setInitialIndex] = useState<number | null>(null);
    const group = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const items = useRef<HTMLDivElement>(null);
    const id = useId();
    const open = initialIndex !== null;
    const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));

    useLayoutEffect(() => {
        if (initialIndex !== null) items.current?.querySelectorAll('button')[initialIndex]?.focus();
    }, [initialIndex]);

    useEffect(() => {
        if (!open) return;
        const dismiss = (event: PointerEvent) => {
            if (event.target instanceof Node && !group.current?.contains(event.target)) setInitialIndex(null);
        };
        document.addEventListener('pointerdown', dismiss);
        return () => document.removeEventListener('pointerdown', dismiss);
    }, [open]);

    function closeAndFocusTrigger() {
        trigger.current?.focus();
        setInitialIndex(null);
    }

    function navigate(event: KeyboardEvent<HTMLDivElement>) {
        const buttons = Array.from(items.current?.querySelectorAll('button') ?? []);
        const index = buttons.findIndex(button => button === document.activeElement);
        const destinations: Record<string, number> = {
            ArrowDown: (index + 1) % buttons.length,
            ArrowUp: (index + buttons.length - 1) % buttons.length,
            Home: 0,
            End: buttons.length - 1,
        };
        if (Object.hasOwn(destinations, event.key)) {
            event.preventDefault();
            buttons[destinations[event.key]]?.focus();
        }
    }

    return (
        <div className="intro-pref" ref={group}
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setInitialIndex(null);
            }}
            onKeyDown={event => {
                if (open && event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    closeAndFocusTrigger();
                }
            }}>
            <button type="button" className="intro-pref-trigger" ref={trigger} aria-label={label} title={label}
                aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
                onClick={() => open ? closeAndFocusTrigger() : setInitialIndex(selectedIndex)}
                onKeyDown={event => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setInitialIndex(event.key === 'ArrowDown' ? 0 : options.length - 1);
                    }
                }}>
                <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
            </button>
            {open && (
                <div className="intro-pref-menu" id={id} ref={items} role="menu" aria-label={label} onKeyDown={navigate}>
                    {options.map(option => (
                        <button type="button" role="menuitemradio" aria-checked={option.value === value} aria-disabled={option.disabled || undefined}
                            key={option.value} tabIndex={-1} onClick={() => {
                                if (option.disabled) return;
                                onSelect(option.value);
                                closeAndFocusTrigger();
                            }}>
                            <span><span lang={option.lang} dir="auto">{option.label}</span>{option.description && <> · {option.description}</>}</span>
                            {option.value === value && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
