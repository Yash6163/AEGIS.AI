'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NetworkConnectionsProps {
  activeSection?: number;
  mouseParallax?: { x: number; y: number };
}

export const NetworkConnections: React.FC<NetworkConnectionsProps> = ({
  activeSection = 1,
  mouseParallax = { x: 0, y: 0 },
}) => {
  const lineRef = useRef<THREE.LineSegments>(null);

  // Define structured node points for clean network topology
  const points = useMemo(() => {
    const rawNodes = [
      // Cluster 1 (Perimeter DMZ)
      new THREE.Vector3(-14, 2, 4),
      new THREE.Vector3(-11, 4, 3),
      new THREE.Vector3(-10, 0, 5),
      new THREE.Vector3(-13, -2, 2),
      new THREE.Vector3(-8, 3, 2),
      // Central AI Core Hub
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2.5, -1),
      new THREE.Vector3(0, -2.5, 1),
      // Cluster 2 (Core Enterprise)
      new THREE.Vector3(-3, -3, -5),
      new THREE.Vector3(3, -2, -6),
      new THREE.Vector3(0, -4, -4),
      new THREE.Vector3(4, 1, -5),
      new THREE.Vector3(-4, 2, -4),
      // Cluster 3 (Vault & Domain Controller)
      new THREE.Vector3(12, 4, -2),
      new THREE.Vector3(15, 2, -3),
      new THREE.Vector3(11, 1, -1),
      new THREE.Vector3(14, 5, 0),
      // Background Ingress
      new THREE.Vector3(-18, 6, -8),
      new THREE.Vector3(18, -4, -10),
      new THREE.Vector3(0, 8, -12),
      new THREE.Vector3(8, -6, -8),
    ];

    const pairs: THREE.Vector3[] = [];

    // Connect within DMZ
    pairs.push(rawNodes[0], rawNodes[1]);
    pairs.push(rawNodes[1], rawNodes[2]);
    pairs.push(rawNodes[2], rawNodes[3]);
    pairs.push(rawNodes[0], rawNodes[3]);
    pairs.push(rawNodes[1], rawNodes[4]);

    // Connect DMZ to AI Core
    pairs.push(rawNodes[4], rawNodes[5]);
    pairs.push(rawNodes[2], rawNodes[5]);

    // Connect AI Core Hub
    pairs.push(rawNodes[5], rawNodes[6]);
    pairs.push(rawNodes[5], rawNodes[7]);
    pairs.push(rawNodes[6], rawNodes[7]);

    // Connect AI Core to Enterprise Cluster
    pairs.push(rawNodes[5], rawNodes[8]);
    pairs.push(rawNodes[5], rawNodes[9]);
    pairs.push(rawNodes[5], rawNodes[11]);
    pairs.push(rawNodes[8], rawNodes[9]);
    pairs.push(rawNodes[9], rawNodes[10]);
    pairs.push(rawNodes[8], rawNodes[12]);
    pairs.push(rawNodes[11], rawNodes[12]);

    // Connect Core to Active Directory Vault
    pairs.push(rawNodes[9], rawNodes[13]);
    pairs.push(rawNodes[11], rawNodes[14]);
    pairs.push(rawNodes[13], rawNodes[14]);
    pairs.push(rawNodes[14], rawNodes[15]);
    pairs.push(rawNodes[13], rawNodes[16]);

    // Long trunk backhaul links
    pairs.push(rawNodes[0], rawNodes[17]);
    pairs.push(rawNodes[9], rawNodes[18]);
    pairs.push(rawNodes[6], rawNodes[19]);
    pairs.push(rawNodes[7], rawNodes[20]);

    return pairs;
  }, []);

  // Construct LineSegments buffer geometry
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);

    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [points]);

  // Subtle breathing pulse and parallax tilt
  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const time = clock.getElapsedTime();

    // Subtle parallax response
    lineRef.current.rotation.y = mouseParallax.x * 0.08 + Math.sin(time * 0.1) * 0.02;
    lineRef.current.rotation.x = -mouseParallax.y * 0.08 + Math.cos(time * 0.1) * 0.02;

    // Opacity modulation depending on scroll section
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    if (mat) {
      const baseOpacity = activeSection >= 2 ? 0.45 : 0.25;
      mat.opacity = baseOpacity + Math.sin(time * 1.5) * 0.08;
    }
  });

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        color="#00f0ff"
        transparent
        opacity={0.3}
        linewidth={1}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
};
