'use client';

import { useState, useEffect, useRef } from 'react';

export interface ParallaxState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scrollProgress: number; // 0 to 1
  reducedMotion: boolean;
}

export function useParallax3D(lerpFactor: number = 0.05) {
  const [state, setState] = useState<ParallaxState>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    scrollProgress: 0,
    reducedMotion: false,
  });

  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hasReducedMotion = mediaQuery.matches;

    const handleMouseMove = (e: MouseEvent) => {
      if (hasReducedMotion) return;
      // Normalize mouse coordinates from -1 to 1 centered on window
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;

      mouseRef.current.targetX = normX;
      mouseRef.current.targetY = normY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (hasReducedMotion || e.touches.length === 0) return;
      const touch = e.touches[0];
      const normX = (touch.clientX / window.innerWidth) * 2 - 1;
      const normY = -(touch.clientY / window.innerHeight) * 2 + 1;

      mouseRef.current.targetX = normX * 0.5; // less aggressive on touch
      mouseRef.current.targetY = normY * 0.5;
    };

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
      setState((prev) => ({ ...prev, scrollProgress: progress }));
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Smooth Lerp Animation Loop
    let currentX = 0;
    let currentY = 0;

    const animate = () => {
      if (!hasReducedMotion) {
        currentX += (mouseRef.current.targetX - currentX) * lerpFactor;
        currentY += (mouseRef.current.targetY - currentY) * lerpFactor;

        mouseRef.current.x = currentX;
        mouseRef.current.y = currentY;

        setState((prev) => ({
          ...prev,
          x: currentX,
          y: currentY,
          targetX: mouseRef.current.targetX,
          targetY: mouseRef.current.targetY,
          reducedMotion: hasReducedMotion,
        }));
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('scroll', handleScroll);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [lerpFactor]);

  return state;
}
