'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NetworkNodesProps {
  count?: number;
  highlightThreat?: boolean;
  activeSection?: number;
  mouseParallax?: { x: number; y: number };
}

export const NetworkNodes: React.FC<NetworkNodesProps> = ({
  count = 250,
  highlightThreat = false,
  activeSection = 1,
  mouseParallax = { x: 0, y: 0 },
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate deterministic node positions in clusters (Subnet zones: Perimeter, Core, Cloud, AD)
  const nodeData = useMemo(() => {
    const data = [];
    const seedRandom = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    let s = 42;
    for (let i = 0; i < count; i++) {
      // Create 4 main topological clusters
      const cluster = i % 4;
      let cx = 0, cy = 0, cz = 0;

      if (cluster === 0) {
        // DMZ Perimeter (left forward)
        cx = -12; cy = 2; cz = 4;
      } else if (cluster === 1) {
        // Core Enterprise (center deep)
        cx = 0; cy = -2; cz = -6;
      } else if (cluster === 2) {
        // Active Directory / Vault (right high)
        cx = 14; cy = 4; cz = -2;
      } else {
        // Cloud Ingress (spread background)
        cx = (seedRandom(s++) - 0.5) * 30;
        cy = (seedRandom(s++) - 0.5) * 20;
        cz = (seedRandom(s++) - 0.5) * 25 - 10;
      }

      const spread = 7;
      const x = cx + (seedRandom(s++) - 0.5) * spread;
      const y = cy + (seedRandom(s++) - 0.5) * spread;
      const z = cz + (seedRandom(s++) - 0.5) * spread;

      const scale = 0.12 + seedRandom(s++) * 0.18;
      const speed = 0.2 + seedRandom(s++) * 0.5;
      const phase = seedRandom(s++) * Math.PI * 2;
      const isThreatNode = i === 12 || i === 24 || i === 45; // specific attack path nodes

      data.push({ x, y, z, baseScale: scale, speed, phase, isThreatNode, cluster });
    }
    return data;
  }, [count]);

  // Node base colors
  const colorCyan = useMemo(() => new THREE.Color('#00f0ff'), []);
  const colorBlue = useMemo(() => new THREE.Color('#1e40af'), []);
  const colorRed = useMemo(() => new THREE.Color('#ef4444'), []);
  const colorAmber = useMemo(() => new THREE.Color('#f59e0b'), []);
  const colorMuted = useMemo(() => new THREE.Color('#0e2a47'), []);

  // Initialize instance matrices and colors
  useEffect(() => {
    if (!meshRef.current) return;

    for (let i = 0; i < count; i++) {
      const { x, y, z, baseScale, isThreatNode } = nodeData[i];
      dummy.position.set(x, y, z);
      dummy.scale.set(baseScale, baseScale, baseScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color assignment
      if (highlightThreat && isThreatNode) {
        meshRef.current.setColorAt(i, colorRed);
      } else if (i % 5 === 0) {
        meshRef.current.setColorAt(i, colorCyan);
      } else if (i % 3 === 0) {
        meshRef.current.setColorAt(i, colorAmber);
      } else {
        meshRef.current.setColorAt(i, colorMuted);
      }
    }

    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, nodeData, highlightThreat, dummy, colorCyan, colorBlue, colorRed, colorAmber, colorMuted]);

  // Subtle pulsing animation in frame loop
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const { x, y, z, baseScale, speed, phase, isThreatNode } = nodeData[i];

      // Subtle float displacement
      const floatY = y + Math.sin(time * speed + phase) * 0.2;
      const floatX = x + Math.cos(time * speed * 0.8 + phase) * 0.15;

      // Parallax reaction based on layer depth
      const depthFactor = 0.5 + Math.abs(z) * 0.05;
      const px = floatX + mouseParallax.x * depthFactor * 0.8;
      const py = floatY + mouseParallax.y * depthFactor * 0.8;

      dummy.position.set(px, py, z);

      // Pulse scaling
      let scaleMult = 1 + Math.sin(time * 2 + phase) * 0.15;
      if (highlightThreat && isThreatNode) {
        scaleMult = 1.6 + Math.sin(time * 5) * 0.4; // Rapid alert pulse
      }

      const finalScale = baseScale * scaleMult;
      dummy.scale.set(finalScale, finalScale, finalScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        roughness={0.2}
        metalness={0.8}
        emissive="#00f0ff"
        emissiveIntensity={0.3}
      />
    </instancedMesh>
  );
};
