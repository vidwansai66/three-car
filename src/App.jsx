import { Canvas, useFrame } from '@react-three/fiber'
import { useState, useMemo, useRef, Suspense, memo, useEffect } from 'react'
import * as THREE from 'three'
import { Sky, KeyboardControls, useKeyboardControls, ContactShadows, Float, Text } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { forwardRef } from 'react'

// 1. Data Definitions
const PROJECT_DATA = [
  // PROJECTS (Start)
  { name: "Neural Vision", desc: "Advanced computer vision system using TensorFlow and React.", link: "https://github.com/vidwansai66", color: "#d90429", type: "project" },
  { name: "Agentic AI", desc: "Autonomous AI agent system built with LangChain and Python.", link: "https://github.com/vidwansai66", color: "#ffbe0b", type: "project" },
  
  // SKILLS (Mid)
  { name: "Expertise", desc: "React, Three.js, Node.js, Python, TensorFlow, and AWS Cloud Architecture.", link: "https://github.com/vidwansai66", color: "#3a86ff", type: "skill" },
  
  // ABOUT (Deep)
  { name: "Bio", desc: "Vidwan Sai is an AI Engineer and Full Stack Developer dedicated to merging machine intelligence with creative front-end design.", link: "https://github.com/vidwansai66", color: "#8338ec", type: "about" },
  
  // CONTACT (Final)
  { name: "Collaborate", desc: "Open for high-impact engineering roles and deep-tech collaborations. Reach out on GitHub.", link: "https://github.com/vidwansai66", color: "#fb5607", type: "contact" },
]

const CONTROL_MAP = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
  { name: 'boost', keys: ['Shift'] },
]

// 2. High-Performance Lite Components
const SingleObstacle = ({ data, position, onHit }) => {
  const meshRef = useRef()
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01
    }
  })

  return (
    <RigidBody type="fixed" position={position} colliders="cuboid" onCollisionEnter={() => onHit(data)}>
      <group ref={meshRef}>
        <mesh castShadow>
          <boxGeometry args={[4, 5, 4]} />
          <meshStandardMaterial color={data.color} roughness={0.7} metalness={0.2} emissive={data.color} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 4, 0]}>
          <octahedronGeometry args={[0.8]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} />
        </mesh>
      </group>
    </RigidBody>
  )
}

const RoadSegment = ({ start, end, width = 20 }) => {
  const { pos, rot, length } = useMemo(() => {
    const s = new THREE.Vector3(...start)
    const e = new THREE.Vector3(...end)
    const dir = new THREE.Vector3().subVectors(e, s)
    const len = dir.length()
    const center = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5)
    const angle = Math.atan2(dir.x, dir.z)
    return { pos: [center.x, 0, center.z], rot: [0, angle, 0], length: len }
  }, [start, end])

  return (
    <RigidBody type="fixed" position={pos} rotation={rot} colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length + 0.5]} />
        <meshStandardMaterial color="#222" roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, length]} />
        <meshStandardMaterial color="#ffd480" />
      </mesh>
    </RigidBody>
  )
}

const RoadSystem = ({ nodes }) => {
  return (
    <group>
      {nodes.map((node, i) => {
        if (i === nodes.length - 1) return null
        return <RoadSegment key={i} start={node} end={nodes[i+1]} />
      })}
    </group>
  )
}

const Car = forwardRef(({ started }, ref) => {
  const rbRef = useRef()
  const meshRef = useRef()
  const [, getKeys] = useKeyboardControls()
  
  const currentSpeed = useRef(0)
  const MAX_SPEED = 30
  const ACCEL = 25
  const FRICTION = 0.98

  const { vec, quat, targetPos } = useMemo(() => ({
    vec: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    targetPos: new THREE.Vector3()
  }), [])

  useEffect(() => {
    if (ref) ref.current = rbRef.current
  }, [ref])

  useFrame((state, delta) => {
    if (!rbRef.current || !started) return
    const { forward, backward, left, right, boost } = getKeys()
    
    // speed logic
    const speedLimit = boost ? MAX_SPEED * 1.8 : MAX_SPEED
    if (forward) currentSpeed.current += ACCEL * delta
    else if (backward) currentSpeed.current -= ACCEL * delta
    else currentSpeed.current *= FRICTION

    currentSpeed.current = THREE.MathUtils.clamp(currentSpeed.current, -8, speedLimit)

    // apply physics
    const rbRot = rbRef.current.rotation()
    const rbPos = rbRef.current.translation()
    quat.set(rbRot.x, rbRot.y, rbRot.z, rbRot.w)
    vec.set(0, 0, -1).applyQuaternion(quat)

    rbRef.current.setLinvel({
      x: vec.x * currentSpeed.current,
      y: rbRef.current.linvel().y,
      z: vec.z * currentSpeed.current
    }, true)

    // turn logic
    const turnFactor = (Math.abs(currentSpeed.current) / MAX_SPEED) * 2.5
    let angVelocity = 0
    if (left) angVelocity = turnFactor
    if (right) angVelocity = -turnFactor
    rbRef.current.setAngvel({ x: 0, y: angVelocity, z: 0 }, true)

    // Camera follow
    targetPos.set(0, 5, 12).applyQuaternion(quat).add(new THREE.Vector3(rbPos.x, rbPos.y, rbPos.z))
    state.camera.position.lerp(targetPos, 0.1)
    state.camera.lookAt(rbPos.x, rbPos.y, rbPos.z)
  })

  return (
    <RigidBody ref={rbRef} position={[0, 2, 0]} colliders="cuboid" linearDamping={0.5} angularDamping={0.5} enabledRotations={[false, true, false]}>
      <group ref={meshRef}>
        <mesh>
          <boxGeometry args={[1.5, 0.6, 2.5]} />
          <meshStandardMaterial color="#d90429" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.3, 0.2]}>
          <boxGeometry args={[1.2, 0.4, 1]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
    </RigidBody>
  )
})

const RiceGround = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
    <planeGeometry args={[2000, 2000]} />
    <meshStandardMaterial color="#fff9ae" roughness={1} />
  </mesh>
)

const CameraManager = ({ started }) => {
  useFrame((state) => {
    if (!started) return
    const t = state.clock.getElapsedTime()
    // Smooth cinematic pan
    state.camera.position.lerp(new THREE.Vector3(20, 20, 50), 0.05)
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

const Overlay = ({ activeItem, onClose }) => {
  if (!activeItem) return null
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '90%', maxWidth: '450px', background: 'rgba(20, 20, 20, 0.9)',
      padding: '40px', borderRadius: '24px', color: 'white', zIndex: 1000,
      textAlign: 'center', fontFamily: 'sans-serif', border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <h2 style={{ color: activeItem.color }}>{activeItem.name}</h2>
      <p style={{ opacity: 0.8, lineHeight: '1.6' }}>{activeItem.desc}</p>
      <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <a href={activeItem.link} target="_blank" rel="noreferrer" style={{ background: activeItem.color, color: 'white', padding: '12px 24px', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Explore -></a>
        <button onClick={onClose} style={{ background: '#333', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}

function App() {
  const [started, setStarted] = useState(false)
  const [activeItem, setActiveItem] = useState(null)

  const roadNodes = useMemo(() => [
    [0, 0, 50],
    [0, 0, -150],     // Projects Area
    [80, 0, -250],   // Skill Turn
    [80, 0, -450],   // About Area
    [-80, 0, -550],  // Final Turn
    [-80, 0, -750]   // Contact Area
  ], [])

  if (!started) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', color: 'white', textAlign: 'center', fontFamily: 'sans-serif', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle, #ffd48022 0%, #111 80%)', zIndex: 0 }} />
        <div style={{ zIndex: 1, animation: 'fadeIn 2s ease-out' }}>
          <h1 style={{ fontSize: '72px', margin: 0, letterSpacing: '-2px', fontWeight: '900' }}>SAI VIDWAN</h1>
          <p style={{ fontSize: '20px', letterSpacing: '4px', opacity: 0.6, marginBottom: '60px', textTransform: 'uppercase' }}>AI Engineer | Full Stack Developer</p>
          <button 
            onClick={() => setStarted(true)}
            style={{ 
              padding: '24px 80px', background: '#ffd480', color: '#111', border: 'none', borderRadius: '100px', 
              fontSize: '22px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 20px 40px -10px #ffd48044'
            }}
            onMouseOver={(e) => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 30px 60px -10px #ffd48066'; }}
            onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 20px 40px -10px #ffd48044'; }}
          >
            ENTER WORLD
          </button>
          <p style={{ marginTop: '40px', opacity: 0.4, fontSize: '14px' }}>[WASD] to Drive | [SHIFT] to Boost</p>
        </div>
      </div>
    )
  }

  return (
    <KeyboardControls map={CONTROL_MAP}>
      <div style={{ width: '100vw', height: '100vh', background: '#1c1c1c' }}>
        <Canvas dpr={1} camera={{ position: [0, 20, 40], fov: 45 }} gl={{ powerPreference: "high-performance" }}>
          <color attach="background" args={['#1c1c1c']} />
          <fog attach="fog" args={['#1c1c1c', 20, 150]} />
          
          <ambientLight intensity={1} color="#ffd480" />
          <directionalLight position={[50, 100, 50]} intensity={1.5} color="#fff9ae" />
          
          <Physics gravity={[0, -9.81, 0]}>
            <RoadSystem nodes={roadNodes} />
            <RiceGround />
            
            {PROJECT_DATA.map((item, i) => {
              let pos = [0, 2.5, 0]
              if (i < 2) pos = [(i % 2 === 0 ? -12 : 12), 2.5, -40 - i * 35]
              else if (i === 2) pos = [100, 2.5, -340]
              else if (i === 3) pos = [80, 2.5, -450]
              else pos = [-80, 2.5, -700]

              return (
                <SingleObstacle 
                  key={i}
                  data={item}
                  position={pos}
                  onHit={setActiveItem}
                />
              )
            })}

            <Car started={started} />
          </Physics>
        </Canvas>
        
        <Overlay activeItem={activeItem} onClose={() => setActiveItem(null)} />
      </div>
    </KeyboardControls>
  )
}

export default App
