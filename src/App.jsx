import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars, KeyboardControls, useKeyboardControls, Environment, ContactShadows, MeshReflectorMaterial, Float } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'

// 1. Define Keyboard Map
const controlMap = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
]

const Car = () => {
  const rbRef = useRef()
  const [, getKeys] = useKeyboardControls()
  
  // Physics Constants for "Feel"
  const currentSpeed = useRef(0)
  const MAX_SPEED = 22
  const REVERSE_MAX = 8
  const ACCEL = 18
  const FRICTION = 0.985
  const TURN_BASE = 3.5
  
  // 1. Pre-allocate vectors/quaternions to avoid GC pressure in useFrame
  const { vec, quat, forward, camTarget, targetPos } = useMemo(() => ({
    vec: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    forward: new THREE.Vector3(0, 0, -1),
    camTarget: new THREE.Vector3(),
    targetPos: new THREE.Vector3()
  }), [])

  useFrame((state, delta) => {
    if (!rbRef.current) return
    const { forward: moveF, backward: moveB, left, right } = getKeys()
    
    // 2. Momentum Logic
    if (moveF) {
      currentSpeed.current += ACCEL * delta
    } else if (moveB) {
      currentSpeed.current -= ACCEL * delta
    } else {
      currentSpeed.current *= FRICTION
      if (Math.abs(currentSpeed.current) < 0.1) currentSpeed.current = 0
    }

    currentSpeed.current = THREE.MathUtils.clamp(currentSpeed.current, -REVERSE_MAX, MAX_SPEED)

    // 3. Motion & Rotation (Ref-based, no new allocations)
    const rbRot = rbRef.current.rotation()
    const rbPos = rbRef.current.translation()
    
    quat.set(rbRot.x, rbRot.y, rbRot.z, rbRot.w)
    vec.set(rbPos.x, rbPos.y, rbPos.z)

    // Reuse forward vector and apply rotation
    camTarget.set(0, 0, -1).applyQuaternion(quat)
    const currentVel = rbRef.current.linvel()

    rbRef.current.setLinvel({ 
      x: camTarget.x * currentSpeed.current, 
      y: currentVel.y, 
      z: camTarget.z * currentSpeed.current 
    }, true)

    // Turning logic
    const turnFactor = (Math.abs(currentSpeed.current) / MAX_SPEED) * TURN_BASE
    let angVelY = 0
    if (left) angVelY = turnFactor
    if (right) angVelY = -turnFactor
    rbRef.current.setAngvel({ x: 0, y: angVelY, z: 0 }, true)

    // 4. Smooth Camera Lerp (No new allocations)
    targetPos.set(0, 5, 12).applyQuaternion(quat).add(vec)
    state.camera.position.lerp(targetPos, 0.1)
    state.camera.lookAt(vec)
  })

  return (
    <RigidBody 
      ref={rbRef} 
      type="dynamic" 
      colliders={false} 
      position={[0, 2, 0]}
      linearDamping={0.5}
      angularDamping={0.5}
      enabledRotations={[false, true, false]}
    >
      <CuboidCollider args={[0.75, 0.3, 1.25]} />
      <group>
        {/* Car Body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.6, 2.5]} />
          <meshPhysicalMaterial 
            color="#d90429" 
            roughness={0.1} 
            metalness={0.9} 
            clearcoat={1} 
            clearcoatRoughness={0.1}
            envMapIntensity={1.5}
          />
        </mesh>
        {/* Car Cabin */}
        <mesh position={[0, 0.4, -0.3]} castShadow>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
          <meshPhysicalMaterial 
            color="#2b2d42" 
            roughness={0.05} 
            metalness={0.6} 
            transmission={0.3} 
            thickness={0.5}
          />
        </mesh>
        {/* Headlights */}
        <mesh position={[0.5, 0, -1.25]}>
          <boxGeometry args={[0.3, 0.2, 0.1]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={5} />
        </mesh>
        <mesh position={[-0.5, 0, -1.25]}>
          <boxGeometry args={[0.3, 0.2, 0.1]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={5} />
        </mesh>
      </group>
    </RigidBody>
  )
}

const PROJECT_DATA = [
  { name: "Project Alpha", desc: "A cutting-edge WebGL experiment focusing on fluid dynamics and procedural generation.", link: "https://example.com" },
  { name: "Portfolio Hub", desc: "A modern, high-performance portfolio site built with React and Framer Motion.", link: "https://example.com" },
  { name: "Space Explorer", desc: "An interactive 3D solar system designed for educational purposes using R3F.", link: "https://example.com" },
  { name: "EcoTrack", desc: "Data visualization dashboard for monitoring environmental changes in real-time.", link: "https://example.com" },
  { name: "About Me", desc: "Passionate developer with 5+ years of experience in creative coding and 3D graphics.", link: "https://example.com" },
  { name: "Skills Matrix", desc: "Proficient in React, Three.js, Node.js, and advanced shader programming.", link: "https://example.com" },
  { name: "Contact Hub", desc: "Available for freelance opportunities and long-term remote collaborations.", link: "https://example.com" },
  { name: "Services", desc: "Custom 3D web applications, visual design, and performance optimization.", link: "https://example.com" },
]

const SingleObstacle = ({ data, position, scale, rotation, initialColor, onHit }) => {
  const [color, setColor] = useState(initialColor)
  const materialRef = useRef()

  useFrame((state) => {
    if (materialRef.current) {
      // Subtle emissive pulse
      const t = state.clock.getElapsedTime()
      materialRef.current.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.3
    }
  })

  const handleCollision = () => {
    setColor('#ffffff')
    setTimeout(() => setColor(initialColor), 200)
    onHit(data)
  }

  return (
    <RigidBody 
      type="fixed" 
      position={position} 
      rotation={rotation} 
      scale={scale}
      colliders={false}
      onCollisionEnter={handleCollision}
    >
      <CuboidCollider args={[0.5, 0.5, 0.5]} />
      <group>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial 
            ref={materialRef}
            color={color} 
            roughness={0.1} 
            metalness={0.8} 
            emissive={color}
            emissiveIntensity={0.5}
            clearcoat={0.5}
          />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.1, 0.05, 1.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
    </RigidBody>
  )
}

const Road = () => {
  return (
    <group position={[0, 0, 0]}>
      {/* Main Reflector Ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 400]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={40}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#151515"
          metalness={0.5}
        />
      </mesh>
      {/* Road Markers */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 400]} />
        <meshStandardMaterial color="#050505" opacity={0.8} transparent />
      </mesh>
      <gridHelper args={[2, 200, '#444444', '#222222']} rotation={[0, 0, 0]} position={[0, 0.02, 0]} />
    </group>
  )
}

const Obstacles = ({ onHit }) => {
  const districts = useMemo(() => {
    return PROJECT_DATA.map((item, i) => {
      const side = i % 2 === 0 ? -1 : 1
      const zPos = (i * 30) - 100
      
      let color = "#3a86ff"
      if (item.name.includes("About") || item.name.includes("Skills")) color = "#8338ec"
      if (item.name.includes("Contact") || item.name.includes("Services")) color = "#ffbe0b"

      return {
        id: i,
        data: item,
        position: [side * 15, 3, zPos],
        scale: [6, 6, 6],
        color: color,
        rotation: [0, side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]
      }
    })
  }, [])

  return districts.map((box) => (
    <SingleObstacle 
      key={box.id}
      data={{...box.data, color: box.color}}
      position={box.position}
      scale={box.scale}
      rotation={box.rotation}
      initialColor={box.color}
      onHit={onHit}
    />
  ))
}

const Overlay = ({ activeItem, onClose }) => {
  if (!activeItem) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '500px',
      background: 'rgba(15, 15, 15, 0.85)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
      borderRadius: '24px',
      border: `2px solid ${activeItem.color}`,
      color: 'white',
      padding: '30px',
      zIndex: 1000,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      pointerEvents: 'auto',
      animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: activeItem.color }}>{activeItem.name}</h2>
        <button onClick={onClose} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <p style={{ margin: 0, fontSize: '17px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>{activeItem.desc}</p>
      <div style={{ marginTop: '10px' }}>
        <a href={activeItem.link} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: activeItem.color, color: 'white', textDecoration: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: '600', fontSize: '15px', boxShadow: `0 10px 20px ${activeItem.color}33` }}>View Project Details →</a>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 40px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

function App() {
  const [activeItem, setActiveItem] = useState(null)

  return (
    <KeyboardControls map={controlMap}>
      <div style={{ width: '100vw', height: '100vh', background: '#050505', position: 'relative', overflow: 'hidden' }}>
        <Overlay activeItem={activeItem} onClose={() => setActiveItem(null)} />
        <Canvas shadows camera={{ position: [20, 20, 40], fov: 45 }} dpr={[1, 1.5]}>
          <color attach="background" args={['#050505']} />
          
          {/* Environment & Sky */}
          <Sky sunPosition={[100, 10, 100]} distance={450000} inclination={0} azimuth={0.25} />
          <Environment preset="city" />
          
          {/* Fog for Depth */}
          <fog attach="fog" args={['#050505', 20, 200]} />
          
          {/* Lights */}
          <ambientLight intensity={0.4} />
          <hemisphereLight intensity={0.6} color="#ffffff" groundColor="#000000" />
          <directionalLight 
            position={[10, 80, 50]} 
            intensity={2} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          >
            <orthographicCamera attach="shadow-camera" args={[-100, 100, 100, -100, 0.1, 500]} />
          </directionalLight>

          {/* Soft Shadows */}
          <ContactShadows 
            resolution={512} 
            scale={150} 
            blur={2} 
            opacity={0.5} 
            far={10} 
            color="#000000" 
            position={[0, -0.45, 0]}
          />

          <Physics gravity={[0, -9.81, 0]}>
            <RigidBody type="fixed" colliders={false} position={[0, -0.25, 0]}>
              <CuboidCollider args={[200, 0.25, 200]} />
            </RigidBody>
            
            <Road />
            <Car />
            <Obstacles onHit={setActiveItem} />
          </Physics>

          {/* Post Processing */}
          <EffectComposer disableNormalPass>
            <Bloom 
              luminanceThreshold={1} 
              mipmapBlur 
              intensity={0.5} 
              radius={0.4} 
            />
            <ToneMapping mode={THREE.ACESFilmicToneMapping} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </div>
    </KeyboardControls>
  )
}

export default App
