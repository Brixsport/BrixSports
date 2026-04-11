'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface BasketballRimSceneProps {
  errorCode?: string;
}

// Professional NBA Basketball with realistic physics
function Basketball() {
  const ballRef = useRef<THREE.Mesh>(null);
  const [rimHit, setRimHit] = useState(false);
  const [bounced, setBounced] = useState(false);
  
  const velocity = useRef(new THREE.Vector3(0.14, 0.06, 0.02));
  const position = useRef(new THREE.Vector3(-5, 5.5, 0));
  const rotationSpeed = useRef(new THREE.Vector3(0.18, 0.08, 0.12));
  
  useEffect(() => {
    velocity.current.set(0.13, 0.055, (Math.random() - 0.5) * 0.04);
  }, []);

  useFrame(() => {
    if (!ballRef.current) return;
    const ball = ballRef.current;
    
    // NBA gravity feel
    velocity.current.y -= 0.007;
    position.current.add(velocity.current);
    
    // Backspin
    ball.rotation.x += rotationSpeed.current.x;
    ball.rotation.y += rotationSpeed.current.y;
    ball.rotation.z -= rotationSpeed.current.z;
    
    // NBA rim specs: 10ft (3.05m) height, 18in (0.46m) radius
    const rimHeight = 3.05;
    const rimRadius = 0.46;
    const ballRadius = 0.37;
    const rimX = 1.8;
    
    // Front rim collision - the classic \"rim out\"
    if (!rimHit && position.current.x > rimX - 0.3 && position.current.x < rimX + 0.2 && 
        position.current.y > rimHeight - 0.25 && position.current.y < rimHeight + 0.3) {
      
      const distFromRimCenter = Math.sqrt(
        (position.current.y - rimHeight) ** 2 + position.current.z ** 2
      );
      
      // Hit the front of the rim
      if (distFromRimCenter > rimRadius - ballRadius * 0.5 && 
          distFromRimCenter < rimRadius + ballRadius * 1.2) {
        
        setRimHit(true);
        setBounced(true);
        
        // Realistic rim physics - bounces away from basket
        velocity.current.x = -Math.abs(velocity.current.x) * 0.5 + (Math.random() - 0.5) * 0.08;
        velocity.current.y = Math.abs(velocity.current.y) * 0.5 + 0.02;
        velocity.current.z += (Math.random() - 0.5) * 0.12;
        rotationSpeed.current.multiplyScalar(1.3);
      }
    }
    
    // Backboard collision
    if (position.current.x > 2.4 && position.current.x < 2.7 && 
        position.current.y > 2.8 && position.current.y < 4.2) {
      velocity.current.x = -Math.abs(velocity.current.x) * 0.5;
      setBounced(true);
    }
    
    // Ground bounce with energy loss
    if (position.current.y < ballRadius) {
      position.current.y = ballRadius;
      velocity.current.y = -velocity.current.y * 0.7;
      velocity.current.x *= 0.85;
      velocity.current.z *= 0.85;
      rotationSpeed.current.multiplyScalar(0.82);
      setBounced(true);
    }
    
    // Stop when settled
    if (position.current.y <= ballRadius + 0.01 && velocity.current.length() < 0.012) {
      velocity.current.set(0, 0, 0);
      rotationSpeed.current.set(0, 0, 0);
    }
    
    ball.position.copy(position.current);
  });

  // Professional basketball texture with authentic channel pattern
  const ballTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // NBA orange with leather texture
    const gradient = ctx.createRadialGradient(512, 256, 0, 512, 256, 512);
    gradient.addColorStop(0, '#ff9a56');
    gradient.addColorStop(0.5, '#e67e22');
    gradient.addColorStop(1, '#d35400');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    
    // Leather grain texture
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#f39c12' : '#ba4a00';
      ctx.globalAlpha = 0.12;
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2);
    }
    ctx.globalAlpha = 1;
    
    // Black channel lines - authentic NBA pattern
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    
    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(1024, 256);
    ctx.stroke();
    
    // Vertical curve
    ctx.beginPath();
    ctx.arc(512, 256, 180, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    
    // Side channel curves
    [-320, -160, 160, 320].forEach(offset => {
      ctx.beginPath();
      ctx.ellipse(512 + offset, 256, 70, 210, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // End circles
    [80, 944].forEach(x => {
      ctx.beginPath();
      ctx.arc(x, 256, 35, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 16;
    return texture;
  }, []);

  // Leather bump map
  const bumpMap = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 3000; i++) {
      const v = Math.floor(Math.random() * 40 + 110);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <group>
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.37, 64, 64]} />
        <meshStandardMaterial 
          map={ballTexture}
          bumpMap={bumpMap}
          bumpScale={0.015}
          roughness={0.42}
          metalness={0.08}
        />
      </mesh>
      
      {/* Rim impact effect */}
      {rimHit && (
        <mesh position={[1.8, 3.05, 0]}>
          <ringGeometry args={[0.5, 0.58, 32]} />
          <meshBasicMaterial 
            color="#ff4500" 
            transparent 
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

// Professional NBA Basketball Hoop
function BasketballHoop() {
  const poleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2c3e50',
    roughness: 0.4,
    metalness: 0.8,
  }), []);

  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff6b35',
    roughness: 0.3,
    metalness: 0.6,
  }), []);

  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.65,
    thickness: 0.015,
    transparent: true,
    opacity: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    ior: 1.5,
  }), []);

  return (
    <group>
      {/* Main Support Pole - 6x6 inch square steel */}
      <mesh position={[4.5, 1.75, 0]} castShadow>
        <boxGeometry args={[0.18, 3.5, 0.18]} />
        <primitive object={poleMat} />
      </mesh>
      
      {/* Arm extension to backboard */}
      <mesh position={[3.5, 3.05, 0]} castShadow>
        <boxGeometry args={[2, 0.12, 0.08]} />
        <primitive object={poleMat} />
      </mesh>
      
      {/* Diagonal support brace */}
      <mesh position={[4, 2.3, 0]} rotation={[0, 0, -Math.PI / 5]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
        <primitive object={poleMat} />
      </mesh>

      {/* NBA Backboard - 72" x 42" (~1.83m x 1.07m) */}
      <group position={[2.5, 3.9, 0]}>
        {/* Glass pane */}
        <mesh castShadow>
          <boxGeometry args={[1.83, 1.07, 0.02]} />
          <primitive object={glassMat} />
        </mesh>
        
        {/* Metal frame */}
        <mesh position={[0, 0, -0.015]}>
          <boxGeometry args={[1.87, 1.11, 0.02]} />
          <meshStandardMaterial color={0x2c3e50} metalness={0.6} roughness={0.4} />
        </mesh>
        
        {/* Inner target square - 24\" x 18\" */}
        <mesh position={[-0.12, -0.18, 0.015]}>
          <boxGeometry args={[0.61, 0.46, 0.001]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
        
        {/* Target square border */}
        <mesh position={[-0.12, -0.18, 0.016]}>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(0.61, 0.46, 0.001)]} />
            <lineBasicMaterial color="#000000" linewidth={2} />
          </lineSegments>
        </mesh>
      </group>
      
      {/* NBA Rim - 18" diameter (0.46m radius), orange breakaway */}
      <group position={[1.8, 3.05, 0]}>
        {/* Main rim ring - 1 inch thick tube */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.46, 0.02, 12, 48]} />
          <primitive object={rimMat} />
        </mesh>
        
        {/* Rim mounting bracket */}
        <mesh position={[-0.12, 0, 0]}>
          <boxGeometry args={[0.2, 0.06, 0.12]} />
          <primitive object={rimMat} />
        </mesh>
        
        {/* Breakaway spring mechanism */}
        <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.12, 10]} />
          <meshStandardMaterial color={0x444444} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      
      {/* Professional Net - white nylon, 12 loops */}
      <group position={[1.8, 2.9, 0]}>
        {/* Net strands */}
        {[...Array(12)].map((_, i) => (
          <mesh 
            key={i} 
            rotation={[Math.PI / 7, (i * Math.PI) / 6, 0]}
            position={[0.23 - (i % 2) * 0.46 * 0.23, -0.22, 0]}
          >
            <cylinderGeometry args={[0.003, 0.002, 0.45, 4]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
        ))}
        {/* Net rings at different heights */}
        {[0.08, 0.18, 0.28, 0.38].map((y, i) => (
          <mesh key={`ring-${i}`} position={[0, -y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.38 - i * 0.07, 0.002, 4, 24]} />
            <meshStandardMaterial color="#eeeeee" transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Professional NBA Court
function CourtFloor() {
  const courtLines = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    
    // NBA court: 94ft x 50ft (~28.65m x 15.24m)
    // Polished maple wood floor
    const woodGradient = ctx.createLinearGradient(0, 0, 2048, 1024);
    woodGradient.addColorStop(0, '#e8c9a8');
    woodGradient.addColorStop(0.2, '#dcb896');
    woodGradient.addColorStop(0.4, '#e8c9a8');
    woodGradient.addColorStop(0.6, '#d4ac7d');
    woodGradient.addColorStop(0.8, '#e8c9a8');
    woodGradient.addColorStop(1, '#dcb896');
    ctx.fillStyle = woodGradient;
    ctx.fillRect(0, 0, 2048, 1024);
    
    // Wood plank grain
    ctx.strokeStyle = '#c49a6c';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    for (let x = 0; x < 2048; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    // Random grain variation
    for (let i = 0; i < 500; i++) {
      ctx.strokeStyle = '#b89060';
      ctx.globalAlpha = 0.1;
      const x = Math.random() * 2048;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 20, 1024);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    
    // NBA Court Lines - 2 inch width (~8px at this scale)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'square';
    
    // Baseline (bottom)
    ctx.beginPath();
    ctx.moveTo(80, 80);
    ctx.lineTo(80, 944);
    ctx.stroke();
    
    // Sidelines
    ctx.beginPath();
    ctx.moveTo(80, 80);
    ctx.lineTo(1200, 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(80, 944);
    ctx.lineTo(1200, 944);
    ctx.stroke();
    
    // Free throw lane (the paint) - 16ft wide, 19ft from baseline
    ctx.strokeRect(80, 368, 460, 288); // 16ft lane
    
    // Free throw circle - radius 6ft
    ctx.beginPath();
    ctx.arc(540, 512, 115, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    
    // Dashed line for free throw circle top
    ctx.beginPath();
    ctx.setLineDash([15, 12]);
    ctx.arc(540, 512, 115, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // NBA Three point line
    // 22ft from basket center in arc, straight lines in corners
    ctx.beginPath();
    ctx.moveTo(80, 280);
    ctx.lineTo(280, 280); // Corner straight line
    // Arc part
    ctx.arc(975, 512, 540, Math.PI * 0.88, -Math.PI * 0.88, true);
    ctx.lineTo(280, 744);
    ctx.lineTo(80, 744);
    ctx.stroke();
    
    // Center court line (partial)
    ctx.beginPath();
    ctx.moveTo(1200, 80);
    ctx.lineTo(1200, 944);
    ctx.stroke();
    
    // Center circle (partial)
    ctx.beginPath();
    ctx.arc(1200, 512, 115, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    
    // Restricted area arc under basket
    ctx.beginPath();
    ctx.arc(975, 512, 76, Math.PI / 2, -Math.PI / 2, true);
    ctx.stroke();
    
    // Lane space marks (hash marks)
    for (let y of [368, 512, 656]) {
      ctx.beginPath();
      ctx.moveTo(460, y - 4);
      ctx.lineTo(460, y + 4);
      ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    return texture;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, 0, 0]} receiveShadow>
      <planeGeometry args={[35, 20]} />
      <meshStandardMaterial 
        map={courtLines}
        roughness={0.35}
        metalness={0.05}
      />
    </mesh>
  );
}

// Professional Arena Lighting
function ArenaLights() {
  return (
    <>
      {/* Main overhead arena spots */}
      <spotLight
        position={[-6, 22, 8]}
        angle={Math.PI / 2.5}
        penumbra={0.35}
        intensity={1500}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        color="#fff8f0"
      />
      <spotLight
        position={[12, 22, -8]}
        angle={Math.PI / 2.5}
        penumbra={0.35}
        intensity={1500}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        color="#fff8f0"
      />
      
      {/* Rim spotlight for dramatic effect */}
      <spotLight
        position={[1.8, 12, 0]}
        angle={Math.PI / 8}
        penumbra={0.25}
        intensity={600}
        target-position={[1.8, 3, 0]}
        color="#ffccaa"
      />
      
      {/* Ambient arena fill */}
      <ambientLight intensity={0.4} color="#fff5e6" />
      
      {/* Warm bounce lights */}
      <pointLight position={[-12, 6, 12]} intensity={250} color="#ffddaa" />
      <pointLight position={[18, 6, -12]} intensity={250} color="#ffddaa" />
      <pointLight position={[0, 4, 10]} intensity={150} color="#ffffff" />
    </>
  );
}

// Professional Camera Angle
function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    // Dramatic low angle from behind the shooter
    camera.position.set(-5, 3.5, 9);
    camera.lookAt(1, 3.5, 0);
  }, [camera]);
  
  return null;
}

// Main Scene
function Scene() {
  return (
    <>
      <CameraController />
      <ArenaLights />
      
      <CourtFloor />
      <BasketballHoop />
      <Basketball />
      
      {/* Subtle arena atmosphere */}
      <Stars 
        radius={120} 
        depth={60} 
        count={300} 
        factor={3} 
        saturation={0.6}
        fade 
        speed={0.15}
      />
      
      {/* Atmospheric fog */}
      <fog attach="fog" args={['#2a2018', 12, 45]} />
    </>
  );
}

export default function BasketballRimScene({ errorCode }: BasketballRimSceneProps) {
  // Responsive FOV - wider on mobile for better view
  const [fov, setFov] = useState(48);
  
  useEffect(() => {
    const updateFov = () => {
      const isMobile = window.innerWidth < 768;
      setFov(isMobile ? 60 : 48);
    };
    updateFov();
    window.addEventListener('resize', updateFov);
    return () => window.removeEventListener('resize', updateFov);
  }, []);

  return (
    <div className="w-full h-full min-h-[300px] bg-gradient-to-b from-orange-950 via-amber-950 to-slate-950">
      <Canvas
        shadows
        camera={{ fov }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', touchAction: 'none' }}
        dpr={[1, 1.5]} // Responsive pixel ratio for performance
      >
        <Scene />
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minPolarAngle={Math.PI / 5}
          autoRotate
          autoRotateSpeed={0.15}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          enableDamping // Smooth touch interactions
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
