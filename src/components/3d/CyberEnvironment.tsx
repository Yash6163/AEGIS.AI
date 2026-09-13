'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Route to stage index mapping
const getStageFromPath = (path: string): number => {
  if (path === '/upload') return 1;
  if (path === '/analysis') return 2;
  if (path === '/attack-path') return 3;
  if (path === '/forecast') return 5; // Step 4 & 5
  if (path === '/explainability') return 6;
  if (path === '/blockchain') return 7;
  if (path === '/threat-intelligence') return 8;
  if (path === '/dashboard') return 9;
  return 1;
};

// Subtle ambient particle starfield & network nodes in background
const AmbientCyberScene: React.FC<{ stage: number }> = ({ stage }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  // Generate deterministic particles & connections
  const { positions, colors, linePositions } = useMemo(() => {
    const count = 180;
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);

    const cyanColor = new THREE.Color('#00f0ff');
    const redColor = new THREE.Color('#ef4444');
    const amberColor = new THREE.Color('#f59e0b');
    const emeraldColor = new THREE.Color('#10b981');
    const blueColor = new THREE.Color('#1e40af');

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = (Math.random() - 0.5) * 35;
      const z = (Math.random() - 0.5) * 30 - 5;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Color variation based on spatial cluster
      let c = cyanColor;
      if (x < -10) c = redColor;
      else if (x > 10) c = emeraldColor;
      else if (Math.random() > 0.7) c = amberColor;
      else if (Math.random() > 0.5) c = blueColor;

      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }

    // Connect close nodes with thin cyber lines
    const lineCoords: number[] = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 7) {
          lineCoords.push(
            pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2],
            pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]
          );
        }
      }
    }

    return {
      positions: pos,
      colors: cols,
      linePositions: new Float32Array(lineCoords),
    };
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.02;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y += delta * 0.02;
      linesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
    }
  });

  return (
    <>
      <color attach="background" args={['#060a10']} />
      <fog attach="fog" args={['#060a10', 10, 45]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={0.6} color="#00f0ff" />
      <pointLight position={[0, 0, 5]} intensity={1.2} color="#00f0ff" distance={30} />
      {stage >= 5 && (
        <pointLight position={[-15, 5, 2]} intensity={0.8} color="#ef4444" distance={25} />
      )}

      {/* Node Points */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.28}
          vertexColors
          transparent
          opacity={0.75}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Network Connections */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePositions.length / 3}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </>
  );
};

export const CyberEnvironment: React.FC = () => {
  const pathname = usePathname();
  const stage = getStageFromPath(pathname);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="fixed inset-0 bg-[#060a10] soc-grid-bg pointer-events-none z-0" />;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      <Canvas
        camera={{ position: [0, 0, 22], fov: 48, near: 0.1, far: 80 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
      >
        <AmbientCyberScene stage={stage} />
      </Canvas>
      {/* Subtle overlay grid & radial vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#060a10]/40 via-transparent to-[#060a10]/80 pointer-events-none" />
      <div className="absolute inset-0 soc-grid-bg opacity-30 pointer-events-none" />
    </div>
  );
};
