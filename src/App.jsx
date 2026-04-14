import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars, KeyboardControls, useKeyboardControls, Environment, ContactShadows, MeshReflectorMaterial, Float, Text, Sparkles } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { forwardRef, useMemo, useRef, useState, useEffect, memo } from 'react'
import * as THREE from 'three'

// 1. Define Keyboard Map
const controlMap = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
  { name: 'boost', keys: ['Shift'] },
]

const Car = forwardRef(({ started, onHit }, ref) => {
  const rbRef = useRef()
  const meshRef = useRef()
  const [, getKeys] = useKeyboardControls()
  
  // Expose rbRef as ref
  useEffect(() => {
    if (ref) ref.current = rbRef.current
  }, [ref])
  
  // Physics & Feel State
  const currentSpeed = useRef(0)
  const shakeFactor = useRef(0)
  const introTime = useRef(0)
  
  const MAX_SPEED = 26
  const BOOST_SPEED = 55
  const ACCEL = 20
  const FRICTION = 0.982
  const TURN_BASE = 4.2

  const { vec, quat, camTarget, targetPos, introPos } = useMemo(() => ({
    vec: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    camTarget: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    introPos: new THREE.Vector3(30, 30, 60)
  }), [])

  useFrame((state, delta) => {
    if (!rbRef.current || !started) return
    const { forward: moveF, backward: moveB, left, right, boost } = getKeys()
    
    // 0. Cinematic Intro Logic (first 2.5 seconds)
    if (introTime.current < 2.5) {
      introTime.current += delta
      const t = introTime.current / 2.5
      // Smoothly transition from cinematic high point to car
      state.camera.position.lerp(targetPos.set(0, 5, 12).applyQuaternion(quat).add(vec), 0.05)
      state.camera.lookAt(vec)
      return
    }

    // 1. Boost & Acceleration Logic
    const speedLimit = boost ? BOOST_SPEED : MAX_SPEED
    const currentAccel = boost ? ACCEL * 3 : ACCEL

    if (moveF) {
      currentSpeed.current += currentAccel * delta
    } else if (moveB) {
      currentSpeed.current -= currentAccel * delta
    } else {
      currentSpeed.current *= FRICTION
      if (Math.abs(currentSpeed.current) < 0.1) currentSpeed.current = 0
    }

    currentSpeed.current = THREE.MathUtils.clamp(currentSpeed.current, -8, speedLimit)

    // 2. Physics & Motion
    const rbRot = rbRef.current.rotation()
    const rbPos = rbRef.current.translation()
    quat.set(rbRot.x, rbRot.y, rbRot.z, rbRot.w)
    vec.set(rbPos.x, rbPos.y, rbPos.z)

    camTarget.set(0, 0, -1).applyQuaternion(quat)
    const currentVel = rbRef.current.linvel()

    rbRef.current.setLinvel({ 
      x: camTarget.x * currentSpeed.current, 
      y: currentVel.y, 
      z: camTarget.z * currentSpeed.current 
    }, true)

    // Turning & Body Tilt
    const turnFactor = (Math.abs(currentSpeed.current) / MAX_SPEED) * TURN_BASE
    let angVelY = 0
    if (left) angVelY = turnFactor
    if (right) angVelY = -turnFactor
    rbRef.current.setAngvel({ x: 0, y: angVelY, z: 0 }, true)

    if (meshRef.current) {
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, -angVelY * 0.18, 0.1)
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, (moveF ? 0.04 : moveB ? -0.04 : 0), 0.1)
    }

    // 3. Cinematic Camera (Follow + Shake + Dynamic FOV)
    const speedFactor = Math.abs(currentSpeed.current) / MAX_SPEED
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, 48 + speedFactor * 18, 0.08)
    state.camera.updateProjectionMatrix()

    shakeFactor.current = THREE.MathUtils.lerp(shakeFactor.current, (boost ? 0.2 : 0), 0.1)
    
    targetPos.set(0, 5, 12).applyQuaternion(quat).add(vec)
    
    // Apply Shake Offset
    if (shakeFactor.current > 0.01) {
      targetPos.x += (Math.random() - 0.5) * shakeFactor.current
      targetPos.y += (Math.random() - 0.5) * shakeFactor.current
      targetPos.z += (Math.random() - 0.5) * shakeFactor.current
    }

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
      onCollisionEnter={() => { 
        shakeFactor.current = 0.8 
        if (typeof onHit === 'function') onHit()
      }}
    >
      <CuboidCollider args={[0.75, 0.3, 1.25]} />
      <group ref={meshRef}>
        {/* Boost Particles */}
        <group position={[0, -0.2, 1.2]}>
          <Sparkles count={40} scale={2} size={4} speed={0.4} color="#ffbe0b" />
        </group>
        {/* Car Body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.6, 2.5]} />
          <meshPhysicalMaterial 
            color="#d90429" 
            roughness={0.1} 
            metalness={0.9} 
            clearcoat={1} 
            clearcoatRoughness={0.1}
            envMapIntensity={2.5}
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
})

const BrandingPlaza = () => {
  const skills = ["React", "Three.js", "Python", "Node.js", "AWS", "TensorFlow"]
  
  return (
    <group position={[0, 0, -20]}>
      {/* Name and Role */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Text
          position={[0, 7.5, 0]}
          fontSize={4.5}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/outfit/v6/QGYsz_vl9817uRcfAjkW6C8.woff"
        >
          SAI VIDWAN
          <meshPhysicalMaterial color="#fff" metalness={0.9} roughness={0.1} emissive="#fff" emissiveIntensity={0.2} />
        </Text>
      </Float>
      
      <Text
        position={[0, 4.2, 0]}
        fontSize={1.2}
        color="#3a86ff"
        anchorX="center"
        font="https://fonts.gstatic.com/s/outfit/v6/QGYsz_vl9817uRcfAjkW6C8.woff"
      >
        AI ENGINEER | FULL STACK DEVELOPER
      </Text>
      
      {/* Skill Panels */}
      <group position={[0, 2.5, 0]}>
        {skills.map((skill, i) => (
          <Text
            key={i}
            position={[(i - (skills.length - 1) / 2) * 3.5, 0, 0]}
            fontSize={0.6}
            color="#fff"
            font="https://fonts.gstatic.com/s/outfit/v6/QGYsz_vl9817uRcfAjkW6C8.woff"
          >
            {skill}
          </Text>
        ))}
      </group>

      <Text
        position={[0, 1.2, 0]}
        fontSize={0.6}
        color="#666"
        anchorX="center"
        font="https://fonts.gstatic.com/s/outfit/v6/QGYsz_vl9817uRcfAjkW6C8.woff"
      >
        EXPLORE THE GALLERY BELOW
      </Text>
      
      {/* Animated Path Waypoints */}
      {[0, 10, 20, 30, 40, 50].map((z) => (
        <Float key={z} speed={3} rotationIntensity={0} floatIntensity={0.5}>
          <mesh position={[0, 0.5, z - 10]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.5, 1, 4]} />
            <meshBasicMaterial color="#3a86ff" transparent opacity={0.3} />
          </mesh>
        </Float>
      ))}
    </group>
  )
}

const FollowingLight = ({ targetRef }) => {
  const lightRef = useRef()
  
  useFrame(() => {
    if (lightRef.current && targetRef.current) {
      const rb = targetRef.current
      const pos = rb.translation()
      
      // Follow the car with light position
      lightRef.current.position.set(pos.x + 15, pos.y + 40, pos.z + 15)
      // Target the car
      lightRef.current.target.position.set(pos.x, pos.y, pos.z)
      lightRef.current.target.updateMatrixWorld()
    }
  })

  return (
    <directionalLight
      ref={lightRef}
      intensity={1.5}
      castShadow
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.0001}
    >
      <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 0.5, 100]} />
    </directionalLight>
  )
}

const PROJECT_DATA = [
  { name: "Neural Vision", desc: "Advanced computer vision system using TensorFlow and React for real-time object detection and spatial analysis.", link: "https://github.com/vidwansai66" },
  { name: "Cloud Architect", desc: "High-scale distributed system infrastructure design with focus on low-latency data pipelines.", link: "https://github.com/vidwansai66" },
  { name: "Predictive Analytics", desc: "ML-driven dashboard for financial forecasting and risk assessment with interactive D3.js visualizations.", link: "https://github.com/vidwansai66" },
  { name: "Agentic AI Framework", desc: "Autonomous AI agent system built with LangChain and Python for complex task automation.", link: "https://github.com/vidwansai66" },
  { name: "About Me", desc: "Vidwan Sai is an AI Engineer and Full Stack Developer dedicated to merging machine intelligence with creative front-end design.", link: "https://github.com/vidwansai66" },
  { name: "Tech Stack", desc: "Expertise in React, Three.js, Node.js, Python, TensorFlow, and AWS Cloud Architecture.", link: "https://github.com/vidwansai66" },
  { name: "Collaboration", desc: "Always open for high-impact engineering roles and deep-tech collaborations.", link: "https://github.com/vidwansai66" },
  { name: "Consulting", desc: "Strategic advice on AI integration, technical architecture, and visual performance optimization.", link: "https://github.com/vidwansai66" },
]

const SingleObstacle = ({ data, position, scale, rotation, initialColor, onHit }) => {
  const [color, setColor] = useState(initialColor)
  const materialRef = useRef()
  const groupRef = useRef()

  const { scaleVec } = useMemo(() => ({ scaleVec: new THREE.Vector3(1, 1, 1) }), [])

  useFrame((state) => {
    if (materialRef.current) {
      const t = state.clock.getElapsedTime()
      materialRef.current.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.3
    }
    if (groupRef.current) {
      // Lerp back to original scale using pre-allocated vector
      groupRef.current.scale.lerp(scaleVec, 0.1)
    }
  })

  const handleCollision = () => {
    setColor('#ffffff')
    if (groupRef.current) groupRef.current.scale.set(1.4, 1.4, 1.4)
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
      <group ref={groupRef}>
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
            envMapIntensity={2}
          />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.1, 0.05, 1.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Glow ring base */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} />
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
          color="#202020"
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
      const isAbout = item.name.includes("About") || item.name.includes("Skills")
      const isContact = item.name.includes("Contact") || item.name.includes("Services")
      
      const side = isAbout ? -1 : isContact ? 1 : (i % 2 === 0 ? -1.5 : 1.5)
      const zPos = (i * 35) - 150
      
      let color = "#3a86ff"
      if (isAbout) color = "#8338ec"
      if (isContact) color = "#ffbe0b"

      return {
        id: i,
        data: item,
        position: [side * 18, 3, zPos],
        scale: [7, 7, 7],
        color: color,
        rotation: [0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]
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

const MemoRoad = memo(Road)
const MemoObstacles = memo(Obstacles)

const Overlay = ({ activeItem, onClose }) => {
  if (!activeItem) return null

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '90%',
      maxWidth: '450px',
      background: 'rgba(20, 20, 20, 0.7)',
      backdropFilter: 'blur(30px) saturate(180%)',
      boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
      borderRadius: '32px',
      border: `1px solid rgba(255, 255, 255, 0.1)`,
      color: 'white',
      padding: '40px',
      zIndex: 1000,
      fontFamily: '"Outfit", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      textAlign: 'center',
      animation: 'popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    }}>
      <div>
        <div style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '2px', color: activeItem.color, marginBottom: '8px', fontWeight: '800' }}>Project Spotlight</div>
        <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#fff' }}>{activeItem.name}</h2>
      </div>
      <p style={{ margin: 0, fontSize: '17px', lineHeight: '1.7', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '400' }}>{activeItem.desc}</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <a href={activeItem.link} target="_blank" rel="noreferrer" style={{ 
          background: activeItem.color, 
          color: 'white', 
          textDecoration: 'none', 
          padding: '14px 28px', 
          borderRadius: '16px', 
          fontWeight: '700', 
          fontSize: '15px', 
          boxShadow: `0 12px 24px ${activeItem.color}44`,
          transition: 'transform 0.2s ease'
        }}>View Experience →</a>
        <button onClick={onClose} style={{ 
          background: 'rgba(255, 255, 255, 0.05)', 
          color: 'white', 
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '14px 28px', 
          borderRadius: '16px', 
          fontWeight: '700', 
          fontSize: '15px',
          cursor: 'pointer'
        }}>Dismiss</button>
      </div>
      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: translate(-50%, -40%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function App() {
  const [activeItem, setActiveItem] = useState(null)
  const [started, setStarted] = useState(false)
  const carRbRef = useRef()

  return (
    <KeyboardControls map={controlMap}>
      <div style={{ width: '100vw', height: '100vh', background: '#020202', position: 'relative', overflow: 'hidden', color: 'white' }}>
        
        {/* Canvas is first in DOM to allow UI elements to overlay properly */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: !started ? 'none' : 'auto' }}>
          <Canvas 
            shadows 
            camera={{ position: [30, 30, 60], fov: 45 }} 
            dpr={[1, 1.2]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <color attach="background" args={['#020202']} />
            
            <Sky sunPosition={[100, 10, 100]} distance={450000} inclination={0} azimuth={0.25} />
            <Environment preset="city" />
            <fog attach="fog" args={['#020202', 40, 300]} />
            
            <ambientLight intensity={0.3} />
            <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#444444" />
            <FollowingLight targetRef={carRbRef} />

            <ContactShadows resolution={256} scale={150} blur={2} opacity={0.4} far={10} color="#000" position={[0, -0.45, 0]} />

            <Physics gravity={[0, -9.81, 0]} paused={!started}>
              <RigidBody type="fixed" colliders={false} position={[0, -0.25, 0]}>
                <CuboidCollider args={[200, 0.25, 200]} />
              </RigidBody>
              
              <BrandingPlaza />
              <MemoRoad />
              <Car started={started} ref={carRbRef} onHit={() => { /* additional vibration if needed */ }} />
              <MemoObstacles onHit={setActiveItem} />
            </Physics>

            <EffectComposer disableNormalPass>
              <Bloom luminanceThreshold={1} mipmapBlur intensity={0.7} radius={0.4} />
              <ToneMapping mode={THREE.ACESFilmicToneMapping} />
              <Vignette eskil={false} offset={0.1} darkness={1.2} />
            </EffectComposer>
          </Canvas>
        </div>

        {/* Start Overlay - Handlers ensure pointerEvents: auto */}
        {!started && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #111 0%, #000 100%)',
            textAlign: 'center',
            padding: '20px',
            animation: 'fadeIn 1s ease-out',
            pointerEvents: 'auto'
          }}>
            <div style={{ 
              textTransform: 'uppercase', 
              fontSize: '14px', 
              letterSpacing: '5px', 
              color: '#3a86ff', 
              marginBottom: '20px',
              animation: 'slideDown 0.8s ease-out'
            }}>Interactive Experience</div>
            
            <h1 style={{ 
              fontSize: 'clamp(50px, 10vw, 100px)', 
              fontWeight: '900', 
              margin: 0, 
              letterSpacing: '-5px', 
              lineHeight: 0.9,
              background: 'linear-gradient(to bottom, #fff, #444)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.1))'
            }}>SAI VIDWAN</h1>
            
            <p style={{ 
              fontSize: '20px', 
              color: '#aaa', 
              maxWidth: '600px', 
              lineHeight: '1.6', 
              marginTop: '30px',
              fontFamily: '"Outfit", sans-serif'
            }}>AI Engineer & Full Stack Developer making the web more dynamic, one experience at a time.</p>
            
            <div style={{ marginTop: '50px', display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
              <button 
                onClick={() => {
                  console.log("ENTER GALLERY clicked")
                  setStarted(true)
                }}
                style={{
                  background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)',
                  color: 'black',
                  border: 'none',
                  padding: '22px 64px',
                  borderRadius: '100px',
                  fontSize: '20px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 20px 60px rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  letterSpacing: '1px'
                }}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.05) translateY(-5px)'; e.target.style.boxShadow = '0 30px 80px rgba(255, 255, 255, 0.3)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1) translateY(0)'; e.target.style.boxShadow = '0 20px 60px rgba(255, 255, 255, 0.2)'; }}
              >
                ENTER GALLERY
              </button>
              
              <div style={{ display: 'flex', gap: '40px', color: '#444', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px' }}>
                <div>[WASD] DRIVE</div>
                <div>[SHIFT] BOOST</div>
                <div>[SPACE] BRAKE</div>
              </div>
            </div>
          </div>
        )}

        <Overlay activeItem={activeItem} onClose={() => setActiveItem(null)} />
      </div>
    </KeyboardControls>
  )
}

export default App
