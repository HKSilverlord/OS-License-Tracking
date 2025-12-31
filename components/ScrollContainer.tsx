import React, { useRef, useState, useEffect, useCallback } from 'react';

interface ScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  shadowColor?: string;
}

/**
 * ScrollContainer component with left/right shadow indicators
 * Shows shadows when content is scrollable in that direction
 */
export const ScrollContainer: React.FC<ScrollContainerProps> = ({
  children,
  className = '',
  shadowColor = 'rgba(0, 0, 0, 0.15)'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const updateShadows = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;

    // Show left shadow if scrolled from start
    setShowLeftShadow(scrollLeft > 10);

    // Show right shadow if not scrolled to end
    setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial check
    updateShadows();

    // Add scroll listener
    container.addEventListener('scroll', updateShadows);

    // Add resize observer to detect content changes
    const resizeObserver = new ResizeObserver(updateShadows);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateShadows);
      resizeObserver.disconnect();
    };
  }, [updateShadows]);

  return (
    <div className="relative">
      {/* Left Shadow Indicator */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-40 transition-opacity duration-200 ${
          showLeftShadow ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: `linear-gradient(to right, ${shadowColor}, transparent)`
        }}
      />

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className={`overflow-x-auto overflow-y-auto custom-scrollbar ${className}`}
      >
        {children}
      </div>

      {/* Right Shadow Indicator */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-40 transition-opacity duration-200 ${
          showRightShadow ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: `linear-gradient(to left, ${shadowColor}, transparent)`
        }}
      />
    </div>
  );
};
