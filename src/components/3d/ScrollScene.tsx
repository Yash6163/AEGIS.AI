'use client';

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { NetworkNodes } from './NetworkNodes';
import { NetworkConnections } from './NetworkConnections';
import { DataParticles } from './DataParticles';
import { AICore } from './AICore';
import { AttackPath } from './AttackPath';
import { BlockchainVisualization } from './BlockchainVisualization';

interface ScrollSceneProps {
  scrollProgress: number; // 0 to 1
  mouseParallax: { x: number; y: number };
  activeSection: number;
}

export const ScrollScene: React.FC<ScrollSceneProps> = ({
  scrollProgress,
  mouseParallax,
  activeSection,
}) => {
  const { camera } = useThree();

  // Target camera positions corresponding to the 7 sections
  const cameraTarget = useRef(new THREE.Vector3(0, 0, 20));
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    // Determine base camera position from scroll progress (0 to 1)
    // Map across 7 distinct waypoints
    let targetX = 0;
    let targetY = 0;
    let targetZ = 20;
    let lookX = 0;
    let lookY = 0;
    let lookZ = 0;

    if (activeSection === 1) {
      // Hero: Wide overview
      targetX = 0; targetY = 0; targetZ = 20;
    } else if (activeSection === 2) {
      // Data Ingestion: Drift towards perimeter ingress
      targetX = -7; targetY = 1.5; targetZ = 16;
      lookX = -4; lookY = 0;
    } else if (activeSection === 3) {
      // AI Analysis: Zoom deep into AI Core
      targetX = 0; targetY = 0.5; targetZ = 7.5;
      lookX = 0; lookY = 0;
    } else if (activeSection === 4) {
      // Future State Prediction: Arc perspective
      targetX = 4; targetY = 2; targetZ = 12;
      lookX = 1; lookY = 0;
    } else if (activeSection === 5) {
      // Attack Progression: Framing kill-chain
      targetX = -1; targetY = -0.5; targetZ = 14;
      lookX = 2; lookY = 0;
    } else if (activeSection === 6) {
      // Blockchain Evidence: Focus on cryptographic ledger blocks
      targetX = 0; targetY = -2.5; targetZ = 8.5;
      lookX = 0; lookY = -2;
    } else {
      // Dashboard Reveal: Recess to ambient cyber backdrop
      targetX = 0; targetY = 0; targetZ = 24;
      lookX = 0; lookY = 0;
    }

    // Apply smooth mouse parallax offset to camera
    const parallaxOffsetX = mouseParallax.x * 1.5;
    const parallaxOffsetY = mouseParallax.y * 1.0;

    cameraTarget.current.set(targetX + parallaxOffsetX, targetY + parallaxOffsetY, targetZ);
    lookAtTarget.current.set(lookX + parallaxOffsetX * 0.3, lookY + parallaxOffsetY * 0.3, lookZ);

    // Smooth lerp camera movement
    camera.position.lerp(cameraTarget.current, 0.04);
    camera.lookAt(lookAtTarget.current);
  });

  return (
    <>
      {/* Deep Cyber Fog and Ambient Lighting */}
      <color attach="background" args={['#060a10']} />
      <fog attach="fog" args={['#060a10', 12, 38]} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} color="#00f0ff" />
      <pointLight position={[0, 0, 0]} intensity={1.5} color="#00f0ff" distance={20} />
      <pointLight position={[-12, 4, 4]} intensity={0.6} color="#ef4444" distance={15} />

      {/* 3D Visual Layers */}
      <NetworkNodes
        count={240}
        highlightThreat={activeSection >= 4}
        activeSection={activeSection}
        mouseParallax={mouseParallax}
      />

      <NetworkConnections
        activeSection={activeSection}
        mouseParallax={mouseParallax}
      />

      <DataParticles
        count={160}
        activeSection={activeSection}
        mouseParallax={mouseParallax}
      />

      <AICore
        activeSection={activeSection}
        mouseParallax={mouseParallax}
      />

      <AttackPath
        activeSection={activeSection}
        mouseParallax={mouseParallax}
      />

      <BlockchainVisualization
        activeSection={activeSection}
        mouseParallax={mouseParallax}
      />
    </>
  );
};
