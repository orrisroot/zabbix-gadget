import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  role?: string;
}

export function ScrollArea({ children, className = '', style, role }: ScrollAreaProps) {
  const id = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateThumb = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const contentHeight = el.firstElementChild?.scrollHeight ?? el.scrollHeight;
    const overflow = contentHeight > el.clientHeight;
    setHasOverflow(overflow);
    if (overflow) {
      const thumbH = Math.max(24, (el.clientHeight / contentHeight) * el.clientHeight);
      setThumbHeight(thumbH);
      const maxScrollTop = contentHeight - el.clientHeight;
      const maxThumbTop = el.clientHeight - thumbH;
      setThumbTop(maxScrollTop > 0 ? (el.scrollTop / maxScrollTop) * maxThumbTop : 0);
    }
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    updateThumb();
    el.addEventListener('scroll', updateThumb);
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }
    return () => {
      el.removeEventListener('scroll', updateThumb);
      ro.disconnect();
    };
  }, [updateThumb]);

  const scrollByRatio = (ratio: number) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop += ratio * el.clientHeight;
  };

  const getContentHeight = () => {
    const el = viewportRef.current;
    if (!el) return 0;
    return el.firstElementChild?.scrollHeight ?? el.scrollHeight;
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const contentHeight = getContentHeight();
    el.scrollTop = y * (contentHeight - el.clientHeight);
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const startY = e.clientY;
    const startScrollTop = el.scrollTop;
    const maxScrollTop = getContentHeight() - el.clientHeight;
    const maxThumbTop = el.clientHeight - thumbHeight;

    const onMove = (ev: MouseEvent) => {
      if (!el) return;
      const deltaY = ev.clientY - startY;
      el.scrollTop = startScrollTop + maxScrollTop * (maxThumbTop > 0 ? deltaY / maxThumbTop : 0);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };

  const handleThumbKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        scrollByRatio(-0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        scrollByRatio(0.1);
        break;
      case 'PageUp':
        e.preventDefault();
        scrollByRatio(-0.9);
        break;
      case 'PageDown':
        e.preventDefault();
        scrollByRatio(0.9);
        break;
      case 'Home':
        e.preventDefault();
        if (viewportRef.current) viewportRef.current.scrollTop = 0;
        break;
      case 'End':
        e.preventDefault();
        if (viewportRef.current) viewportRef.current.scrollTop = getContentHeight();
        break;
    }
  };

  const el = viewportRef.current;
  const contentHeight = getContentHeight();
  const maxScrollTop = el ? contentHeight - el.clientHeight : 0;
  const scrollTop = el?.scrollTop ?? 0;
  const valuenow = maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * 100) : 0;

  return (
    <div className={`scroll-area ${className}`} style={style} role={role}>
      <div ref={viewportRef} id={`${id}-viewport`} className="scroll-area-viewport">
        {children}
      </div>
      {hasOverflow && (
        <div className="scroll-area-track" role="none" onClick={handleTrackClick} onKeyDown={() => {}}>
          <div
            className="scroll-area-thumb"
            role="scrollbar"
            aria-controls={`${id}-viewport`}
            aria-valuenow={valuenow}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            style={{ height: thumbHeight, top: thumbTop }}
            onMouseDown={handleThumbMouseDown}
            onKeyDown={handleThumbKeyDown}
          />
        </div>
      )}
    </div>
  );
}
