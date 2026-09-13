'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AttackPathProps {
  activeSection?: number;
  mouseParallax?: { x: number; y: number };
}

export const AttackPath: React.FC<AttackPathProps> = ({
  activeSection = 1,
  mouseParallax = { x: 0, y: 0 },
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const pulseNodeRef = useRef<THREE.Mesh>(null);

  // Discrete stages in 3D topology:
  // 0: Recon (External WAN: -16, 5, 2)
  // 1: Initial Access (Edge Gateway: -12, 2, 4)
  // 2: Lateral Movement (SMB Target FileServer: -4, -1, 0)
  // 3: C2 Beaconing (Internal Relay: 4, 1, -5)
  // 4: Exfiltration (Domain Controller DC-01: 14, 4, -2)
  const waypoints = useMemo(() => {
    return [
      new THREE.Vector3(-16, 5, 2),
      new THREE.Vector3(-12, 2, 4),
      new THREE.Vector3(-4, -1, 0),
      new THREE.Vector3(4, 1, -5),
      new THREE.Vector3(14, 4, -2),
    ];
  }, []);

  // Generate smooth cubic spline curve through waypoints
  const curvePoints = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(waypoints);
    return curve.getPoints(60);
  }, [waypoints]);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    return geom;
  }, [curvePoints]);

  const isAttackVisible = activeSection >= 5;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (lineRef.current) {
      // Parallax rotation
      lineRef.current.rotation.y = mouseParallax.x * 0.05;
      lineRef.current.rotation.x = -mouseParallax.y * 0.05;

      const mat = lineRef.current.material as THREE.LineBasicMaterial;
      if (mat) {
        // Line glow intensifies in Section 5
        const targetOpacity = isAttackVisible ? 0.95 : 0.05;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.08);
      }
    }

    // Moving pulse beacon along attack path
    if (pulseNodeRef.current && isAttackVisible) {
      const progress = (time * 0.3) % 1;
      const curve = new THREE.CatmullRomCurve3(waypoints);
      const pt = curve.getPoint(progress);
      pulseNodeRef.current.position.copy(pt);
      const pulseScale = 0.3 + Math.sin(time * 8) * 0.1;
      pulseNodeRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }
  });

  return (
    <group>
      {/* Red Attack Progression Conduit Line */}
      <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: '#ef4444',
        transparent: true,
        opacity: 0.05,
        linewidth: 2,
        blending: THREE.AdditiveBlending,
      }))} ref={lineRef} />

      {/* Travelling Attack Pulse Packet */}
      {isAttackVisible && (
        <mesh ref={pulseNodeRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Waypoint Markers */}
      {isAttackVisible &&
        waypoints.map((wp, i) => (
          <group key={i} position={wp}>
            <mesh>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshBasicMaterial
                color={i === 4 ? '#ef4444' : '#f59e0b'}
                transparent
                opacity={0.9}
              />
            </mesh>
            <mesh scale={[1.4, 1.4, 1.4]}>
              <ringGeometry args={[0.3, 0.35, 24]} />
              <meshBasicMaterial
                color="#ef4444"
                transparent
                opacity={0.5}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
    </group>
  );
};
