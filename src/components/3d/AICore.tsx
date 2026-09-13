'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AICoreProps {
  activeSection?: number;
  mouseParallax?: { x: number; y: number };
}

export const AICore: React.FC<AICoreProps> = ({
  activeSection = 1,
  mouseParallax = { x: 0, y: 0 },
}) => {
  const outerCageRef = useRef<THREE.Mesh>(null);
  const innerSphereRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    // Subtle parallax shift for the entire core group
    if (groupRef.current) {
      groupRef.current.position.x = mouseParallax.x * 0.5;
      groupRef.current.position.y = mouseParallax.y * 0.5;
    }

    // Outer geometric cage rotation
    if (outerCageRef.current) {
      outerCageRef.current.rotation.x = time * 0.2;
      outerCageRef.current.rotation.y = time * 0.3;

      // Pulse scaling when AI Analysis section is active
      const pulseBase = activeSection === 3 ? 1.35 : 1.0;
      const scale = pulseBase + Math.sin(time * 3) * 0.08;
      outerCageRef.current.scale.set(scale, scale, scale);
    }

    // Inner glowing sphere pulsing
    if (innerSphereRef.current) {
      const innerScale = 0.55 + Math.sin(time * 4) * 0.06;
      innerSphereRef.current.scale.set(innerScale, innerScale, innerScale);
    }

    // Concentric orbital rings rotation
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = time * 0.4;
      ring1Ref.current.rotation.x = time * 0.15;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -time * 0.35;
      ring2Ref.current.rotation.y = time * 0.25;
    }
  });

  const isAnalysisActive = activeSection === 3;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central Inner Pulsing Core */}
      <mesh ref={innerSphereRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={isAnalysisActive ? '#00f0ff' : '#0284c7'}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer Geometric Wireframe Cage (Icosahedron) */}
      <mesh ref={outerCageRef}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshStandardMaterial
          color="#00f0ff"
          wireframe
          transparent
          opacity={isAnalysisActive ? 0.9 : 0.5}
          emissive="#00f0ff"
          emissiveIntensity={isAnalysisActive ? 0.8 : 0.3}
        />
      </mesh>

      {/* Concentric Orbital Data Rings */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[2.4, 0.02, 16, 64]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.8, 0.02, 16, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
