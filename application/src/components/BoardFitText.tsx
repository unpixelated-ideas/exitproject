import { useLayoutEffect, useRef } from 'react';

export function BoardFitText({ text }: { text: string }) {
  const line = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = line.current;
    const label = content.current;
    if (!box || !label) return;

    function fit() {
      if (!box || !label) return;
      label.style.fontSize = '';
      const width = label.offsetWidth;
      if (width > box.clientWidth && box.clientWidth > 0) {
        label.style.fontSize = `${box.clientWidth / width}em`;
      }
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);

  return <span className="board-fit-text" ref={line}><span ref={content}>{text}</span></span>;
}
