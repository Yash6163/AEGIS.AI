'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DataParticlesProps {
  count?: number;
  activeSection?: number;
  mouseParallax?: { x: number; y: number };
}

export const DataParticles: React.FC<DataParticlesProps> = ({
  count = 180,
  activeSection = 1,
  mouseParallax = { x: 0, y: 0 },
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-define circuit pathways for particles to travel along
  const paths = useMemo(() => {
    return [
      // Path 1: DMZ Ingress -> Core
      { start: new THREE.Vector3(-14, 2, 4), end: new THREE.Vector3(0, 0, 0) },
      // Path 2: Core -> Active Directory
      { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(12, 4, -2) },
      // Path 3: Perimeter -> Core Lower
      { start: new THREE.Vector3(-10, 0, 5), end: new THREE.Vector3(3, -2, -6) },
      // Path 4: Core -> Vault High
      { start: new THREE.Vector3(-3, -3, -5), end: new THREE.Vector3(14, 5, 0) },
      // Path 5: Cloud Ingress -> DMZ
      { start: new THREE.Vector3(-18, 6, -8), end: new THREE.Vector3(-11, 4, 3) },
      // Path 6: Core -> DC Node 15
      { start: new THREE.Vector3(4, 1, -5), end: new THREE.Vector3(15, 2, -3) },
    ];
  }, []);

  // Particle properties
  const particleData = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      const pathIndex = i % paths.length;
      const progress = (i / count);
      const speed = 0.15 + (i % 5) * 0.05;
      const scale = 0.08 + (i % 3) * 0.04;
      const jitterX = (Math.random() - 0.5) * 0.3;
      const jitterY = (Math.random() - 0.5) * 0.3;
      data.push({ pathIndex, progress, speed, scale, jitterX, jitterY });
    }
    return data;
  }, [count, paths]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Speed multiplier boosts when user reaches Data Ingestion (Section 2) or AI Analysis (Section 3)
    const speedBoost = activeSection >= 2 ? 1.8 : 1.0;

    for (let i = 0; i < count; i++) {
      const p = particleData[i];
      p.progress += delta * p.speed * speedBoost;
      if (p.progress > 1) p.progress = 0;

      const path = paths[p.pathIndex];
      // Lerp between start and end
      const pos = new THREE.Vector3().lerpVectors(path.start, path.end, p.progress);

      // Add gentle curve and jitter
      pos.y += Math.sin(p.progress * Math.PI) * 0.8 + p.jitterY;
      pos.x += p.jitterX + mouseParallax.x * 0.3;
      pos.y += mouseParallax.y * 0.3;

      dummy.position.copy(pos);
      dummy.scale.set(p.scale, p.scale, p.scale);
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
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial
        color="#00f0ff"
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};
