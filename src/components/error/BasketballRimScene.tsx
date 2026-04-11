'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

interface BasketballRimSceneProps {
  errorCode?: string;
}

// Basketball Component
function Basketball() {
  const ballRef = useRef<THREE.Mesh>(null);
  const [rimHit, setRimHit] = useState(false);
  const [bounced, setBounced] = useState(false);
  
  // Physics state
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const position = useRef(new THREE.Vector3(-4, 6, 0));
  const rotationSpeed = useRef(new THREE.Vector3(0.15, 0.1, 0.05));
  
  useEffect(() => {
    // Initial shot arc toward the basket
    velocity.current.set(0.12, 0.05, 0);
  }, []);

  useFrame((state, delta) => {
    if (!ballRef.current) return;
    
    const ball = ballRef.current;
    
    // Apply gravity (stronger for basketball feel)
    velocity.current.y -= 0.006;
    
    // Update position
    position.current.add(velocity.current);
    
    // Rotate ball (backspin for basketball)
    ball.rotation.x += rotationSpeed.current.x;
    ball.rotation.y += rotationSpeed.current.y;
    ball.rotation.z -= rotationSpeed.current.z; // Backspin
    
    // Rim collision (rim is at x=2, y=3, z=0)
    const rimCenter = new THREE.Vector3(2, 3, 0);
    const ballToRim = position.current.clone().sub(rimCenter);
    const distToRimCenter = ballToRim.length();
    
    // Check if ball hits the rim (rim radius ~0.3, ball radius ~0.6)
    if (!rimHit && position.current.x > 1.5 && position.current.x < 2.5 && 
        position.current.y > 2.5 && position.current.y < 3.5 &&
        distToRimCenter < 1.0 && distToRimCenter > 0.3) {
      
      setRimHit(true);
      setBounced(true);
      
      // Calculate bounce direction (away from rim center)
      const bounceDir = position.current.clone().sub(rimCenter).normalize();
      bounceDir.y = Math.abs(bounceDir.y) + 0.3; // Add upward bounce
      
      velocity.current.copy(bounceDir).multiplyScalar(0.15);
      velocity.current.y = Math.abs(velocity.current.y) * 0.8;
      
      // Add randomness to make it look natural
      velocity.current.z += (Math.random() - 0.5) * 0.1;
      
      // Increase spin on rim hit
      rotationSpeed.current.multiplyScalar(1.8);
    }
    
    // Check if ball passes through rim (would be a made shot)
    if (!rimHit && position.current.x > 2 && position.current.y < 2.5 && 
        distToRimCenter < 0.35) {
      // Force it to rim out! Push it to the side
      velocity.current.x += 0.08;
      velocity.current.y = Math.abs(velocity.current.y) * 0.5;
      setRimHit(true);
    }
    
    // Backboard collision (at x=2.5, y=3.5)
    if (position.current.x > 2.4 && position.current.x < 2.6 && 
        position.current.y > 2 && position.current.y < 5) {
      velocity.current.x = -Math.abs(velocity.current.x) * 0.6;
      setBounced(true);
    }
    
    // Ground/floor bounce
    if (position.current.y < 0.6) {
      position.current.y = 0.6;
      velocity.current.y = -velocity.current.y * 0.7;
      velocity.current.x *= 0.9; // Friction
      velocity.current.z *= 0.9;
      rotationSpeed.current.multiplyScalar(0.8);
      
      if (Math.abs(velocity.current.y) > 0.05) {
        setBounced(true);
      }
    }
    
    // Stop if slow enough
    if (position.current.y <= 0.61 && velocity.current.length() < 0.02) {
      velocity.current.set(0, 0, 0);
      rotationSpeed.current.set(0, 0, 0);
    }
    
    ball.position.copy(position.current);
  });

  // Basketball texture
  const ballTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Orange base
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, '#ff8c42');
    gradient.addColorStop(1, '#d4651f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Basketball lines (black)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 8;
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.stroke();
    
    // Vertical curve (simplified as straight for texture)
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();
    
    // Curved lines on sides
    ctx.beginPath();
    ctx.ellipse(128, 256, 60, 200, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(384, 256, 60, 200, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  return (
    <group>
      {/* The Basketball */}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial 
          map={ballTexture}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
      
      {/* Rim hit effect */}
      {rimHit && !bounced && (
        <mesh position={[2, 3, 0]}>
          <ringGeometry args={[0.8, 1.0, 32]} />
          <meshBasicMaterial 
            color="#ff6600" 
            transparent 
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

// Basketball Hoop/Rim
function BasketballHoop() {
  const poleMaterial = (
    <meshStandardMaterial color="#444444" roughness={0.3} metalness={0.7} />
  );
  
  const rimMaterial = (
    <meshStandardMaterial color="#ff6600" roughness={0.4} metalness={0.3} />
  );
  
  const netMaterial = (
    <meshStandardMaterial 
      color="#ffffff" 
      transparent 
      opacity={0.4}
      wireframe
    />
  );

  return (
    <group>
      {/* Main pole */}
      <mesh position={[4, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 5, 16]} />
        {poleMaterial}
      </mesh>
      
      {/* Arm extending to rim */}
      <mesh position={[3, 3.5, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2, 12]} rotation={[0, 0, Math.PI / 2]} />
        {poleMaterial}
      </mesh>
      
      {/* Backboard */}
      <mesh position={[2.5, 3.8, 0]} castShadow>
        <boxGeometry args={[1.8, 1.2, 0.05]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      
      {/* Backboard target square */}
      <mesh position={[2.52, 3.5, 0]}>
        <boxGeometry args={[0.6, 0.45, 0.02]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
      </mesh>
      
      {/* Inner square */}
      <mesh position={[2.52, 3.5, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.025]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      
      {/* Rim (the ring) */}
      <mesh position={[2, 3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.35, 0.025, 8, 32]} />
        {rimMaterial}
      </mesh>
      
      {/* Net (simplified as cone) */}
      <mesh position={[2, 2.7, 0]} material={netMaterial}>
        <coneGeometry args={[0.35, 0.6, 16, 1, true]} />
      </mesh>
    </group>
  );
}

// Court Floor
function CourtFloor() {
  const courtTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Wood floor gradient
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#c4784a');
    gradient.addColorStop(0.5, '#b86d42');
    gradient.addColorStop(1, '#a8623b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Wood grain lines
    ctx.strokeStyle = '#9c5230';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 32) {
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    
    // Court lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.8;
    
    // Baseline
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(200, 256);
    ctx.stroke();
    
    // Three point arc (simplified)
    ctx.beginPath();
    ctx.arc(200, 256, 150, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    
    // Key area
    ctx.strokeRect(50, 206, 100, 100);
    
    // Free throw circle
    ctx.beginPath();
    ctx.arc(150, 256, 40, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial 
        map={courtTexture}
        roughness={0.6}
      />
    </mesh>
  );
}

// Arena Lights
function ArenaLights() {
  return (
    <>
      {/* Main overhead lights */}
      <spotLight
        position={[0, 15, 0]}
        angle={Math.PI / 4}
        penumbra={0.5}
        intensity={800}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      
      {/* Fill lights */}
      <pointLight position={[-10, 10, 10]} intensity={200} color="#ffaa44" />
      <pointLight position={[10, 10, -10]} intensity={200} color="#ffaa44" />
    </>
  );
}

// Scene Camera
function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(-6, 5, 10);
    camera.lookAt(2, 3, 0);
  }, [camera]);
  
  return null;
}

// Main Scene
function Scene() {
  return (
    <>
      <CameraController />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} color="#ffccaa" />
      <ArenaLights />
      
      {/* Scene Components */}
      <CourtFloor />
      <BasketballHoop />
      <Basketball />
      
      {/* Arena atmosphere */}
      <Stars 
        radius={80} 
        depth={30} 
        count={1000} 
        factor={2} 
        saturation={0.5}
        fade 
        speed={0.5}
      />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#1a0f0a', 15, 40]} />
    </>
  );
}

// Main Component
export default function BasketballRimScene({ errorCode }: BasketballRimSceneProps) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-orange-900/50 via-slate-900 to-slate-950">
      <Canvas
        shadows
        camera={{ fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 2 - 0.1}
          minPolarAngle={Math.PI / 3}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>
    </div>
  );
}
