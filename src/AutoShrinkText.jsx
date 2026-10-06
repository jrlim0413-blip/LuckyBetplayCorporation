import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';

/**
 * AutoShrinkText
 * Dynamically shrinks DOM font-size if text/figures overflow container width.
 * Prevents text-overflow ellipsis (...) and clipping completely.
 * Works seamlessly in both screen UI and Print Preview / Print output.
 */
export function AutoShrinkText({
  children,
  className = '',
  style = {},
  align = 'right',
  minFontSize = 5.0,
  as: Component = 'div',
  title,
}) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isShrunk, setIsShrunk] = useState(false);

  const checkAndAdjustSize = () => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Reset styles on content span to measure true unconstrained scrollWidth
    content.style.fontSize = '';
    content.style.lineHeight = '';
    content.style.maxWidth = 'none';
    content.style.width = 'auto';

    // Ensure container doesn't truncate or force ellipsis during measurement
    container.style.textOverflow = 'clip';

    const baseFontSize = parseFloat(window.getComputedStyle(container).fontSize) || 10.5;
    const containerWidth = container.clientWidth;
    const contentWidth = content.scrollWidth;

    if (containerWidth > 0 && contentWidth > containerWidth + 0.2) {
      // Content exceeds container width — scale font size down proportionally
      // Safety multiplier 0.94 ensures sub-pixel font rendering in print mode never clips
      const ratio = (containerWidth / contentWidth) * 0.94;
      const calculatedSize = Math.max(minFontSize, Math.floor(baseFontSize * ratio * 10) / 10);

      content.style.fontSize = `${calculatedSize}px`;
      content.style.lineHeight = '1.05';
      content.style.maxWidth = '100%';
      setIsShrunk(true);
    } else {
      content.style.fontSize = '';
      content.style.lineHeight = '';
      content.style.maxWidth = '100%';
      setIsShrunk(false);
    }
  };

  useLayoutEffect(() => {
    checkAndAdjustSize();
  }, [children]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      checkAndAdjustSize();
    });
    observer.observe(container);

    const handleResize = () => {
      checkAndAdjustSize();
      // Second tick for print rendering engine reflows
      setTimeout(checkAndAdjustSize, 30);
    };

    const mediaQueryList = window.matchMedia('print');
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleResize);
    } else if (mediaQueryList.addListener) {
      mediaQueryList.addListener(handleResize);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeprint', handleResize);

    return () => {
      observer.disconnect();
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleResize);
      } else if (mediaQueryList.removeListener) {
        mediaQueryList.removeListener(handleResize);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeprint', handleResize);
    };
  }, [children, minFontSize]);

  return (
    <Component
      ref={containerRef}
      className={`auto-shrink-container ${isShrunk ? 'is-shrunk' : ''} ${className}`}
      title={
        title ||
        (typeof children === 'string' || typeof children === 'number'
          ? String(children)
          : undefined)
      }
      style={{
        display: 'block',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'clip',
        boxSizing: 'border-box',
        textAlign: align,
        ...style,
      }}
    >
      <span
        ref={contentRef}
        className="auto-shrink-content"
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          textOverflow: 'clip',
          maxWidth: '100%',
          transition: 'font-size 0.04s ease-out',
        }}
      >
        {children}
      </span>
    </Component>
  );
}

export default AutoShrinkText;
