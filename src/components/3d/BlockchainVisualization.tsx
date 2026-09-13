'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BlockchainVisualizationProps {
  activeSection?: number;
  mouseParallax?: { x: number; y: number };
}

export const BlockchainVisualization: React.FC<BlockchainVisualizationProps> = ({
  activeSection = 1,
  mouseParallax = { x: 0, y: 0 },
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const block1Ref = useRef<THREE.Mesh>(null);
  const block2Ref = useRef<THREE.Mesh>(null);
  const block3Ref = useRef<THREE.Mesh>(null);

  const isVisible = activeSection >= 6;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();

    // Fade and scale transition
    const targetScale = isVisible ? 1 : 0.001;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);

    // Parallax tilt
    groupRef.current.position.x = mouseParallax.x * 0.4;
    groupRef.current.position.y = -2 + mouseParallax.y * 0.4;

    // Subtle individual block rotation
    if (block1Ref.current) {
      block1Ref.current.rotation.y = time * 0.4;
      block1Ref.current.rotation.x = time * 0.2;
    }
    if (block2Ref.current) {
      block2Ref.current.rotation.y = -time * 0.35;
      block2Ref.current.rotation.z = time * 0.15;
    }
    if (block3Ref.current) {
      block3Ref.current.rotation.y = time * 0.45;
      block3Ref.current.rotation.x = -time * 0.25;
    }
  });

  return (
    <group ref={groupRef} position={[0, -2, 2]}>
      {/* Block #1 (Previous State Seal) */}
      <group position={[-3.2, 0, 0]}>
        <mesh ref={block1Ref}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial
            color="#00f0ff"
            wireframe
            emissive="#00f0ff"
            emissiveIntensity={0.4}
            transparent
            opacity={0.7}
          />
        </mesh>
        <mesh>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshBasicMaterial color="#0e2a47" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Cryptographic Link #1 */}
      <mesh position={[-1.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
      </mesh>

      {/* Block #2 (Active Prediction Block - EVT-0941) */}
      <group position={[0, 0, 0]}>
        <mesh ref={block2Ref}>
          <boxGeometry args={[1.6, 1.6, 1.6]} />
          <meshStandardMaterial
            color="#10b981"
            wireframe
            emissive="#10b981"
            emissiveIntensity={0.6}
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh>
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshBasicMaterial color="#064e3b" transparent opacity={0.7} />
        </mesh>
        {/* Verification Glow Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.3, 1.4, 32]} />
          <meshBasicMaterial
            color="#10b981"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Cryptographic Link #2 */}
      <mesh position={[1.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
      </mesh>

      {/* Block #3 (Pending Consensus Quorum) */}
      <group position={[3.2, 0, 0]}>
        <mesh ref={block3Ref}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial
            color="#f59e0b"
            wireframe
            emissive="#f59e0b"
            emissiveIntensity={0.4}
            transparent
            opacity={0.7}
          />
        </mesh>
        <mesh>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshBasicMaterial color="#451a03" transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  );
};
