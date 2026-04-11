'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';

interface SoccerGoalSceneProps {
  errorCode?: string;
}

// Soccer Ball Component
function SoccerBall({ errorCode }: { errorCode?: string }) {
  const ballRef = useRef<THREE.Mesh>(null);
  const [hitPost, setHitPost] = useState(false);
  const [bounceCount, setBounceCount] = useState(0);
  
  // Ball physics state
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const position = useRef(new THREE.Vector3(-8, 2, 0));
  const rotationSpeed = useRef(new THREE.Vector3(0, 0, 0));
  
  useEffect(() => {
    // Initial kick toward the goal
    velocity.current.set(0.15, 0.08, 0.02);
    rotationSpeed.current.set(0.1, 0.05, 0.08);
  }, []);

  useFrame((state, delta) => {
    if (!ballRef.current) return;
    
    const ball = ballRef.current;
    
    // Apply gravity
    velocity.current.y -= 0.003;
    
    // Update position
    position.current.add(velocity.current);
    
    // Rotate ball
    ball.rotation.x += rotationSpeed.current.x;
    ball.rotation.y += rotationSpeed.current.y;
    ball.rotation.z += rotationSpeed.current.z;
    
    // Goalpost collision detection (post is at x=0, z=±3)
    const postZ = 3.6;
    const postX = 0;
    
    if (!hitPost && position.current.x > postX - 0.3 && position.current.x < postX + 0.3) {
      if (Math.abs(position.current.z - postZ) < 0.6 || Math.abs(position.current.z + postZ) < 0.6) {
        // HIT THE POST!
        setHitPost(true);
        setBounceCount(prev => prev + 1);
        
        // Bounce back with reduced velocity
        velocity.current.x = -velocity.current.x * 0.6;
        velocity.current.y = Math.abs(velocity.current.y) * 0.7 + 0.05;
        velocity.current.z += (Math.random() - 0.5) * 0.1;
        
        // Increase rotation on impact
        rotationSpeed.current.multiplyScalar(1.5);
      }
    }
    
    // Ground bounce
    if (position.current.y < 0.35) {
      position.current.y = 0.35;
      velocity.current.y = -velocity.current.y * 0.7;
      velocity.current.x *= 0.95; // Friction
      velocity.current.z *= 0.95;
      rotationSpeed.current.multiplyScalar(0.9);
      
      if (Math.abs(velocity.current.y) > 0.02) {
        setBounceCount(prev => prev + 1);
      }
    }
    
    // Stop if velocity is very low
    if (position.current.y <= 0.36 && velocity.current.length() < 0.01) {
      velocity.current.set(0, 0, 0);
      rotationSpeed.current.set(0, 0, 0);
    }
    
    ball.position.copy(position.current);
  });

  // Soccer ball texture pattern (simplified)
  const ballTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // White base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);
    
    // Black pentagons (simplified as circles)
    ctx.fillStyle = '#1a1a1a';
    const positions = [
      [256, 100], [150, 200], [362, 200],
      [150, 350], [362, 350], [256, 450]
    ];
    positions.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 50, 0, Math.PI * 2);
      ctx.fill();
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  return (
    <group>
      {/* The Ball */}
      <mesh ref={ballRef} castShadow receiveShadow>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial 
          map={ballTexture}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      
      {/* Impact flash effect */}
      {hitPost && (
        <mesh position={[0, position.current.y, position.current.z > 0 ? 3.6 : -3.6]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial 
            color="#ffaa00" 
            transparent 
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

// Goal Post Component
function GoalPost() {
  const postMaterial = useMemo(() => (
    <meshStandardMaterial 
      color="#ffffff" 
      roughness={0.2}
      metalness={0.1}
    />
  ), []);

  const netMaterial = useMemo(() => (
    <meshStandardMaterial 
      color="#dddddd" 
      transparent 
      opacity={0.3}
      wireframe
    />
  ), []);

  return (
    <group>
      {/* Left Post */}
      <mesh position={[0, 1.2, 3.66]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2.44, 16]} />
        {postMaterial}
      </mesh>
      
      {/* Right Post */}
      <mesh position={[0, 1.2, -3.66]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2.44, 16]} />
        {postMaterial}
      </mesh>
      
      {/* Crossbar */}
      <mesh position={[0, 2.44, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 7.32, 16]} rotation={[0, 0, Math.PI / 2]} />
        {postMaterial}
      </mesh>
      
      {/* Net (simplified as planes) */}
      <mesh position={[-1, 1.2, 0]} material={netMaterial}>
        <planeGeometry args={[2, 2.4]} />
      </mesh>
      <mesh position={[-1, 1.2, 3.66]} material={netMaterial} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7.32, 2.4]} />
      </mesh>
      <mesh position={[-1, 1.2, -3.66]} material={netMaterial} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7.32, 2.4]} />
      </mesh>
      
      {/* Top net */}
      <mesh position={[-1, 2.44, 0]} material={netMaterial} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 7.32]} />
      </mesh>
    </group>
  );
}

// Stadium Lights
function StadiumLights() {
  const lights = useMemo(() => {
    const positions = [
      [-15, 15, -15], [-15, 15, 15],
      [15, 15, -15], [15, 15, 15]
    ];
    return positions.map((pos, i) => (
      <group key={i} position={pos}>
        {/* Light pole */}
        <mesh>
          <cylinderGeometry args={[0.2, 0.3, 15, 8]} />
          <meshStandardMaterial color="#444444" />
        </mesh>
        {/* Light fixture */}
        <mesh position={[0, 7.5, 0]}>
          <boxGeometry args={[4, 1, 4]} />
          <meshStandardMaterial color="#666666" />
        </mesh>
        {/* Light glow */}
        <pointLight 
          position={[0, 6, 0]} 
          intensity={500} 
          distance={50}
          color="#ffffee"
        />
      </group>
    ));
  }, []);

  return <>{lights}</>;
}

// Grass Field
function GrassField() {
  const grassTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Base green
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, 512, 512);
    
    // Stripes
    ctx.fillStyle = '#36682f';
    for (let i = 0; i < 512; i += 64) {
      ctx.fillRect(i, 0, 32, 512);
    }
    
    // Noise/grass texture
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#3a7a32' : '#264d21';
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillRect(x, y, 2, 2);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    return texture;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial 
        map={grassTexture}
        roughness={0.8}
      />
    </mesh>
  );
}

// Scene Camera Controller
function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(-8, 4, 8);
    camera.lookAt(0, 1, 0);
  }, [camera]);
  
  return null;
}

// Main Scene
function Scene({ errorCode }: { errorCode?: string }) {
  return (
    <>
      <CameraController />
      
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight 
        position={[-10, 20, 10]} 
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      
      {/* Stadium Lights */}
      <StadiumLights />
      
      {/* Scene Components */}
      <GrassField />
      <GoalPost />
      <SoccerBall errorCode={errorCode} />
      
      {/* Stars for night effect */}
      <Stars 
        radius={100} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={1}
      />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#0f172a', 20, 60]} />
    </>
  );
}

// Main Component Export
export default function SoccerGoalScene({ errorCode }: SoccerGoalSceneProps) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-sky-900 via-sky-800 to-green-900">
      <Canvas
        shadows
        camera={{ fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene errorCode={errorCode} />
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 2 - 0.1}
          minPolarAngle={Math.PI / 4}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
