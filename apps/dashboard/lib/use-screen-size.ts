import { useState, useEffect } from 'react';

type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export function useScreenSize(): {
  size: ScreenSize;
  isMobile: boolean;   // < 640px
  isTablet: boolean;   // 640px – 1024px
  isDesktop: boolean;  // > 1024px
  isTouch: boolean;    // touch device regardless of size
  width: number;
} {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [isTouch, setIsTouch] = useState<boolean>(false);

  useEffect(() => {
    // Track width via ResizeObserver (more reliable than resize event)
    const handler = () => setWidth(window.innerWidth);
    const observer = new ResizeObserver(handler);
    observer.observe(document.body);

    // Detect touch capability once on mount
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches);

    return () => observer.disconnect();
  }, []);

  const size: ScreenSize =
    width < 640  ? 'xs' :
    width < 768  ? 'sm' :
    width < 1024 ? 'md' :
    width < 1280 ? 'lg' : 'xl';

  return {
    size,
    isMobile:  width < 640,
    isTablet:  width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    isTouch,
    width,
  };
}
