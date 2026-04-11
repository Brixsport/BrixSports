'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

interface SoccerGoalSceneProps {
  errorCode?: string;
}

// Professional FIFA Regulation Football
function SoccerBall({ errorCode }: { errorCode?: string }) {
  const ballRef = useRef<THREE.Mesh>(null);
  const [hitPost, setHitPost] = useState(false);
  
  // Professional ball physics
  const velocity = useRef(new THREE.Vector3(0.18, 0.1, 0.03));
  const position = useRef(new THREE.Vector3(-9, 2.5, 0));
  const rotationSpeed = useRef(new THREE.Vector3(0.15, 0.12, 0.08));
  
  useEffect(() => {
    velocity.current.set(0.16, 0.09, (Math.random() - 0.5) * 0.05);
    rotationSpeed.current.set(0.12, 0.1, 0.06);
  }, []);

  useFrame(() => {
    if (!ballRef.current) return;
    const ball = ballRef.current;
    
    // Realistic gravity
    velocity.current.y -= 0.0045;
    position.current.add(velocity.current);
    
    // Ball rotation (curve spin)
    ball.rotation.x += rotationSpeed.current.x;
    ball.rotation.y += rotationSpeed.current.y;
    ball.rotation.z += rotationSpeed.current.z;
    
    // FIFA goal dimensions: 7.32m x 2.44m
    const goalWidth = 7.32;
    const postZ = goalWidth / 2; // 3.66
    const goalHeight = 2.44;
    const postRadius = 0.12;
    const ballRadius = 0.365; // Size 5 ball: 22cm diameter
    
    // Post collision (left or right)
    if (!hitPost && position.current.x > -postRadius && position.current.x < postRadius) {
      const distToLeftPost = Math.abs(position.current.z - postZ);
      const distToRightPost = Math.abs(position.current.z + postZ);
      
      if ((distToLeftPost < (postRadius + ballRadius) || distToRightPost < (postRadius + ballRadius)) &&
          position.current.y < goalHeight + 0.1) {
        // HIT THE POST!
        setHitPost(true);
        
        // Realistic post bounce physics
        velocity.current.x = -velocity.current.x * 0.55;
        velocity.current.y = Math.abs(velocity.current.y) * 0.65 + 0.03;
        velocity.current.z += (Math.random() - 0.5) * 0.2;
        rotationSpeed.current.multiplyScalar(1.6);
      }
    }
    
    // Crossbar collision
    if (!hitPost && position.current.x > -postRadius && position.current.x < postRadius &&
        Math.abs(position.current.y - goalHeight) < (postRadius + ballRadius * 0.8) &&
        Math.abs(position.current.z) < postZ) {
      // HIT THE CROSSBAR!
      setHitPost(true);
      
      velocity.current.y = -Math.abs(velocity.current.y) * 0.5;
      velocity.current.x += (Math.random() - 0.5) * 0.15;
      rotationSpeed.current.multiplyScalar(1.4);
    }
    
    // Ground bounce with realistic friction
    if (position.current.y < ballRadius) {
      position.current.y = ballRadius;
      velocity.current.y = -velocity.current.y * 0.68;
      velocity.current.x *= 0.92; 
      velocity.current.z *= 0.92;
      rotationSpeed.current.multiplyScalar(0.88);
    }
    
    // Stop when settled
    if (position.current.y <= ballRadius + 0.01 && velocity.current.length() < 0.008) {
      velocity.current.set(0, 0, 0);
      rotationSpeed.current.set(0, 0, 0);
    }
    
    ball.position.copy(position.current);
  });

  // Professional football texture - authentic pentagon/hexagon pattern
  const ballTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // White leather base
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 1024, 512);
    
    // Add leather grain texture
    for (let i = 0; i < 5000; i++) {
      const gray = Math.floor(Math.random() * 30 + 220);
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2);
    }
    ctx.globalAlpha = 1;
    
    // Draw pentagons (black) - classic football pattern
    ctx.fillStyle = '#1a1a1a';
    const pentagons = [
      [512, 120], [220, 180], [804, 180],
      [180, 320], [844, 320], [512, 400]
    ];
    
    pentagons.forEach(([x, y]) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const px = x + 45 * Math.cos(angle);
        const py = y + 45 * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // Pentagon border
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Hexagon connections (subtle gray lines)
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 3;
    const hexCenters = [
      [366, 100], [658, 100],
      [280, 250], [744, 250],
      [366, 400], [658, 400],
      [130, 180], [894, 180],
      [130, 340], [894, 340]
    ];
    
    hexCenters.forEach(([x, y]) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const hx = x + 42 * Math.cos(angle);
        const hy = y + 42 * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    return texture;
  }, []);

  // Leather normal/bump map
  const leatherBump = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 4000; i++) {
      const v = Math.floor(Math.random() * 30 + 115);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Store goalHeight for impact effect
  const goalHeightRef = useRef(2.44);

  return (
    <group>
      <mesh ref={ballRef} castShadow receiveShadow>
        <sphereGeometry args={[0.365, 64, 64]} />
        <meshStandardMaterial 
          map={ballTexture}
          bumpMap={leatherBump}
          bumpScale={0.008}
          roughness={0.55}
          metalness={0.05}
        />
      </mesh>
      
      {/* Post impact effect */}
      {hitPost && (
        <mesh position={[0, Math.min(position.current.y, goalHeightRef.current), position.current.z > 0 ? 3.66 : -3.66]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial 
            color="#ff4500" 
            transparent 
            opacity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}

// Professional FIFA Regulation Goal
function GoalPost() {
  const postMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.15,
  }), []);

  const netMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xe8e8e8,
    transparent: true,
    opacity: 0.35,
    wireframe: true,
    side: THREE.DoubleSide,
  }), []);

  // FIFA regulation: 7.32m x 2.44m
  const goalWidth = 7.32;
  const goalHeight = 2.44;
  const goalDepth = 2.0;
  const postRadius = 0.12;

  return (
    <group>
      {/* Left Post */}
      <mesh position={[0, goalHeight / 2, goalWidth / 2]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, goalHeight, 24]} />
        <primitive object={postMat} />
      </mesh>
      
      {/* Right Post */}
      <mesh position={[0, goalHeight / 2, -goalWidth / 2]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, goalHeight, 24]} />
        <primitive object={postMat} />
      </mesh>
      
      {/* Crossbar */}
      <mesh position={[0, goalHeight, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, goalWidth + postRadius * 2, 24]} />
        <primitive object={postMat} />
      </mesh>

      {/* Ground support bar */}
      <mesh position={[-goalDepth, postRadius * 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[postRadius * 0.8, postRadius * 0.8, goalWidth, 16]} />
        <primitive object={postMat} />
      </mesh>

      {/* Diagonal side supports */}
      <mesh 
        position={[-goalDepth / 2, goalHeight / 2, goalWidth / 2]} 
        rotation={[0, 0, Math.atan2(goalHeight, goalDepth)]}
        castShadow
      >
        <cylinderGeometry args={[postRadius * 0.5, postRadius * 0.5, Math.sqrt(goalDepth ** 2 + goalHeight ** 2), 12]} />
        <primitive object={postMat} />
      </mesh>
      <mesh 
        position={[-goalDepth / 2, goalHeight / 2, -goalWidth / 2]} 
        rotation={[0, 0, Math.atan2(goalHeight, goalDepth)]}
        castShadow
      >
        <cylinderGeometry args={[postRadius * 0.5, postRadius * 0.5, Math.sqrt(goalDepth ** 2 + goalHeight ** 2), 12]} />
        <primitive object={postMat} />
      </mesh>
      
      {/* Back supports (bottom) */}
      <mesh position={[-goalDepth, postRadius, goalWidth / 2]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius * 0.5, postRadius * 0.5, goalDepth, 12]} />
        <primitive object={postMat} />
      </mesh>
      <mesh position={[-goalDepth, postRadius, -goalWidth / 2]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius * 0.5, postRadius * 0.5, goalDepth, 12]} />
        <primitive object={postMat} />
      </mesh>

      {/* Back supports (top) */}
      <mesh position={[-goalDepth, goalHeight, goalWidth / 2]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius * 0.4, postRadius * 0.4, goalDepth, 12]} />
        <primitive object={postMat} />
      </mesh>
      <mesh position={[-goalDepth, goalHeight, -goalWidth / 2]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius * 0.4, postRadius * 0.4, goalDepth, 12]} />
        <primitive object={postMat} />
      </mesh>

      {/* Back crossbar */}
      <mesh position={[-goalDepth, goalHeight, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[postRadius * 0.4, postRadius * 0.4, goalWidth, 12]} />
        <primitive object={postMat} />
      </mesh>
      
      {/* Professional Net with proper diamond pattern */}
      {/* Back wall net */}
      <mesh position={[-goalDepth, goalHeight / 2, 0]} material={netMat}>
        <planeGeometry args={[goalWidth, goalHeight, 20, 16]} />
      </mesh>
      
      {/* Top sloped net */}
      <mesh 
        position={[-goalDepth / 2, goalHeight, 0]} 
        rotation={[Math.PI / 2 - Math.atan2(goalHeight, goalDepth), 0, 0]}
        material={netMat}
      >
        <planeGeometry args={[goalWidth, Math.sqrt(goalDepth ** 2 + goalHeight ** 2), 20, 10]} />
      </mesh>
      
      {/* Side nets */}
      <mesh position={[-goalDepth / 2, goalHeight / 2, goalWidth / 2]} rotation={[0, Math.PI / 2, 0]} material={netMat}>
        <planeGeometry args={[goalDepth, goalHeight, 10, 16]} />
      </mesh>
      <mesh position={[-goalDepth / 2, goalHeight / 2, -goalWidth / 2]} rotation={[0, Math.PI / 2, 0]} material={netMat}>
        <planeGeometry args={[goalDepth, goalHeight, 10, 16]} />
      </mesh>

      {/* Bottom net */}
      <mesh position={[-goalDepth / 2, postRadius, 0]} rotation={[Math.PI / 2, 0, 0]} material={netMat}>
        <planeGeometry args={[goalWidth, goalDepth, 20, 10]} />
      </mesh>
    </group>
  );
}

// Professional Stadium Floodlights
function StadiumLights() {
  return (
    <>
      {/* Main stadium floodlight towers - positioned like real stadiums */}
      <group position={new THREE.Vector3(-25, 18, -20)}>
        {/* Tower structure */}
        <mesh position={new THREE.Vector3(0, 0, 0)}>
          <cylinderGeometry args={[0.4, 0.6, 20, 12]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Light bank */}
        <mesh position={[0, 10, 0]}>
          <boxGeometry args={[6, 2.5, 6]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        {/* Individual light clusters */}
        {[-2, 0, 2].map((x) =>
          [-2, 0, 2].map((z) => (
            <mesh key={`${x}-${z}`} position={new THREE.Vector3(x, 10, z)} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.4, 0.5, 0.8, 8]} />
              <meshStandardMaterial color="#ffffe0" emissive="#ffffe0" emissiveIntensity={0.3} />
            </mesh>
          ))
        )}
        {/* Main spotlight from this tower */}
        <spotLight
          position={[0, 11, 0]}
          angle={Math.PI / 5}
          penumbra={0.3}
          intensity={2500}
          castShadow
          shadow-mapSize={[2048, 2048]}
          color="#fff8f0"
        />
      </group>

      <group position={new THREE.Vector3(25, 18, 20)}>
        <mesh position={new THREE.Vector3(0, 0, 0)}>
          <cylinderGeometry args={[0.4, 0.6, 20, 12]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={new THREE.Vector3(0, 10, 0)}>
          <boxGeometry args={[6, 2.5, 6]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        {[-2, 0, 2].map((x) =>
          [-2, 0, 2].map((z) => (
            <mesh key={`2-${x}-${z}`} position={new THREE.Vector3(x, 10, z)} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.4, 0.5, 0.8, 8]} />
              <meshStandardMaterial color="#ffffe0" emissive="#ffffe0" emissiveIntensity={0.3} />
            </mesh>
          ))
        )}
        <spotLight
          position={[0, 11, 0]}
          angle={Math.PI / 5}
          penumbra={0.3}
          intensity={2500}
          castShadow
          shadow-mapSize={[2048, 2048]}
          color="#fff8f0"
        />
      </group>

      {/* Additional fill lights */}
      <spotLight position={[-10, 25, 0]} angle={Math.PI / 4} penumbra={0.4} intensity={1500} color="#fffaf0" />
      <spotLight position={[10, 25, 0]} angle={Math.PI / 4} penumbra={0.4} intensity={1500} color="#fffaf0" />
    </>
  );
}

// Professional Football Pitch
function GrassField() {
  const pitchTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    
    // UEFA/FIFA standard pitch: 105m x 68m
    // We'll draw a section around the goal
    
    // Professional grass with mowing stripes
    const stripeWidth = 128;
    for (let x = 0; x < 2048; x += stripeWidth) {
      const green1 = '#3d7a33';
      const green2 = '#2f6b28';
      ctx.fillStyle = (x / stripeWidth) % 2 === 0 ? green1 : green2;
      ctx.fillRect(x, 0, stripeWidth, 1024);
    }
    
    // Add grass blade texture
    for (let i = 0; i < 8000; i++) {
      const green = Math.random() > 0.5 ? '#4a8a40' : '#22551c';
      ctx.fillStyle = green;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(Math.random() * 2048, Math.random() * 1024, 3, 3);
    }
    ctx.globalAlpha = 1;
    
    // White pitch lines - 12cm width
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'square';
    
    // Goal line (left side)
    ctx.beginPath();
    ctx.moveTo(80, 100);
    ctx.lineTo(80, 924);
    ctx.stroke();
    
    // Sidelines
    ctx.beginPath();
    ctx.moveTo(80, 100);
    ctx.lineTo(1200, 100);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(80, 924);
    ctx.lineTo(1200, 924);
    ctx.stroke();
    
    // Goal area (5.5m from goal posts, 5.5m depth)
    const goalAreaWidth = 366; // ~5.5m proportion
    const goalAreaDepth = 110;
    ctx.strokeRect(80, 329, goalAreaDepth, goalAreaWidth);
    
    // Penalty area (16.5m from goal, 40.3m wide)
    const penAreaWidth = 732;
    const penAreaDepth = 330;
    ctx.strokeRect(80, 146, penAreaDepth, penAreaWidth);
    
    // Penalty spot (11m from goal)
    ctx.beginPath();
    ctx.arc(410, 512, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // Penalty arc
    ctx.beginPath();
    ctx.arc(410, 512, 183, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35);
    ctx.stroke();
    
    // Corner arc
    ctx.beginPath();
    ctx.arc(80, 100, 30, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(80, 924, 30, -Math.PI / 2, 0);
    ctx.stroke();
    
    // Center line (partial)
    ctx.beginPath();
    ctx.moveTo(1200, 100);
    ctx.lineTo(1200, 924);
    ctx.stroke();
    
    // Center circle arc
    ctx.beginPath();
    ctx.arc(1200, 512, 91, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    
    // Goal markings
    // Goal width: 7.32m
    const goalY = 512;
    const goalHalfWidth = 274; // ~4.16m
    ctx.beginPath();
    ctx.moveTo(80, goalY - goalHalfWidth);
    ctx.lineTo(80, goalY + goalHalfWidth);
    ctx.lineWidth = 12;
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, 0, 0]} receiveShadow>
      <planeGeometry args={[50, 40]} />
      <meshStandardMaterial 
        map={pitchTexture}
        roughness={0.7}
        metalness={0.02}
      />
    </mesh>
  );
}

// Professional Broadcast Camera Angle
function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    // Position like a broadcast camera behind the goal
    camera.position.set(-7, 3.5, 10);
    camera.lookAt(0, 2, 0);
  }, [camera]);
  
  return null;
}

// Main Scene
function Scene({ errorCode }: { errorCode?: string }) {
  return (
    <>
      <CameraController />
      
      {/* Ambient stadium atmosphere */}
      <ambientLight intensity={0.35} color="#e8f4f8" />
      
      {/* Professional stadium floodlights */}
      <StadiumLights />
      
      {/* Scene Components */}
      <GrassField />
      <GoalPost />
      <SoccerBall errorCode={errorCode} />
      
      {/* Night sky with stars */}
      <Stars 
        radius={150} 
        depth={60} 
        count={800} 
        factor={4} 
        saturation={0.3}
        fade 
        speed={0.2}
      />
      
      {/* Stadium atmosphere fog */}
      <fog attach="fog" args={['#1a2f3a', 25, 70]} />
    </>
  );
}

export default function SoccerGoalScene({ errorCode }: SoccerGoalSceneProps) {
  // Responsive FOV - wider on mobile for better view
  const [fov, setFov] = useState(52);
  
  useEffect(() => {
    const updateFov = () => {
      const isMobile = window.innerWidth < 768;
      setFov(isMobile ? 65 : 52);
    };
    updateFov();
    window.addEventListener('resize', updateFov);
    return () => window.removeEventListener('resize', updateFov);
  }, []);

  return (
    <div className="w-full h-full min-h-[300px] bg-gradient-to-b from-slate-900 via-blue-950 to-green-950">
      <Canvas
        shadows
        camera={{ fov }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', touchAction: 'none' }}
        dpr={[1, 1.5]} // Responsive pixel ratio for performance
      >
        <Scene errorCode={errorCode} />
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minPolarAngle={Math.PI / 5}
          autoRotate
          autoRotateSpeed={0.25}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          enableDamping // Smooth touch interactions
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
