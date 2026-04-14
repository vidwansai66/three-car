import { Canvas, useFrame } from '@react-three/fiber'
import { useState, useMemo, useRef, Suspense, memo } from 'react'
import * as THREE from 'three'

// 1. Data Definitions
const PROJECT_DATA = [
  { name: "Neural Vision", desc: "Advanced computer vision system using TensorFlow and React.", link: "https://github.com/vidwansai66", color: "#d90429" },
  { name: "Cloud Architect", desc: "High-scale distributed infrastructure with focus on low-latency.", link: "https://github.com/vidwansai66", color: "#3a86ff" },
  { name: "Agentic AI", desc: "Autonomous AI agent system built with LangChain and Python.", link: "https://github.com/vidwansai66", color: "#ffbe0b" },
  { name: "About Me", desc: "Vidwan Sai is an AI Engineer dedicated to merging intelligence with design.", link: "https://github.com/vidwansai66", color: "#8338ec" },
  { name: "Tech Stack", desc: "Expertise in React, Python, TensorFlow, and AWS Cloud.", link: "https://github.com/vidwansai66", color: "#fb5607" },
]

// 2. High-Performance Lite Components
const SingleObstacle = ({ data, position, onHit }) => {
  return (
    <group position={position} onClick={() => onHit(data)}>
      <mesh castShadow>
        <boxGeometry args={[4, 5, 4]} />
        <meshStandardMaterial color={data.color} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Floating Indicator */}
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

const Road = () => (
  <group>
    {/* Plate Road */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[20, 1000]} />
      <meshStandardMaterial color="#e5e5e5" roughness={0.2} metalness={0.1} />
    </mesh>
    {/* Rice Ground */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[400, 1000]} />
      <meshStandardMaterial color="#fff9ae" roughness={1} />
    </mesh>
  </group>
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

  if (!started) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', color: 'white', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: '60px', margin: 0 }}>SAI VIDWAN</h1>
        <p style={{ opacity: 0.5, marginBottom: '50px' }}>AI ENGINEER | BIRIYANI WORLD PORTFOLIO</p>
        <button 
          onClick={() => setStarted(true)}
          style={{ padding: '25px 60px', background: '#ffd480', border: 'none', borderRadius: '100px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}
        >
          ENTER GALLERY
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1c1c1c' }}>
      <Canvas shadows camera={{ position: [50, 50, 100], fov: 45 }}>
        <ambientLight intensity={1.5} color="#ffd480" />
        <directionalLight position={[10, 50, 20]} intensity={1} castShadow />
        
        <CameraManager started={started} />
        <Road />
        
        {PROJECT_DATA.map((item, i) => (
          <SingleObstacle 
            key={i}
            data={item}
            position={[(i % 2 === 0 ? -1 : 1) * 30, 2.5, i * -40]}
            onHit={setActiveItem}
          />
        ))}

        <gridHelper args={[1000, 100, '#ffd480', '#333']} position={[0, 0.02, 0]} />
      </Canvas>
      
      <Overlay activeItem={activeItem} onClose={() => setActiveItem(null)} />
    </div>
  )
}

export default App
