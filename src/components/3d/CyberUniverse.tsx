'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ScrollScene } from './ScrollScene';
import { useParallax3D } from '@/hooks/useParallax3D';

interface CyberUniverseProps {
  activeSection?: number;
  scrollProgress?: number;
  className?: string;
}

export const CyberUniverse: React.FC<CyberUniverseProps> = ({
  activeSection = 1,
  scrollProgress = 0,
  className = '',
}) => {
  const [mounted, setMounted] = useState(false);
  const parallax = useParallax3D(0.04);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // SSR Fallback background
    return (
      <div className={`fixed inset-0 bg-[#060a10] soc-grid-bg ${className}`} />
    );
  }

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 20], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]} // clamp device pixel ratio for smooth performance
      >
        <Suspense fallback={null}>
          <ScrollScene
            scrollProgress={scrollProgress || parallax.scrollProgress}
            mouseParallax={{ x: parallax.x, y: parallax.y }}
            activeSection={activeSection}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
