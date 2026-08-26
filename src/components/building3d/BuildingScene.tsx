import { useRef } from 'react'
import { Canvas, extend, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { BuildingFloor, BuildingMarker } from '@/types'

extend({ OrbitControls })

// eslint-disable-next-line @typescript-eslint/no-namespace
declare module '@react-three/fiber' {
  interface ThreeElements {
    orbitControls: object
  }
}

export const FLOOR_HEIGHT = 3.2
// Nave rectangular alargada tipo "big box" (proporción aprox. de una tienda
// IKEA vista desde el aire) — no es el contorno exacto de Alcorcón, es una
// forma representativa que se puede afinar más adelante.
export const BUILDING_WIDTH = 16
export const BUILDING_DEPTH = 9
const IKEA_BLUE = '#0051BA'

export type MarkerColor = { fill: string; ring: string }

interface BuildingSceneProps {
  floors: BuildingFloor[]
  markers: BuildingMarker[]
  activeFloorId: number | null
  markerColor: (marker: BuildingMarker) => MarkerColor
  onMarkerClick: (marker: BuildingMarker) => void
  onFloorClick: (floorId: number, posX: number, posY: number) => void
}

function Controls() {
  const { camera, gl } = useThree()
  const ref = useRef<OrbitControls>(null)
  useFrame(() => ref.current?.update())
  return (
    <orbitControls
      ref={ref}
      args={[camera, gl.domElement]}
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={Math.max(BUILDING_WIDTH, BUILDING_DEPTH) * 4}
      maxPolarAngle={Math.PI / 2.05}
    />
  )
}

// El edificio se dibuja como UN único bloque (no una caja por planta) porque
// por fuera una nave real no muestra las divisiones de planta — solo el
// plano invisible de clics y los marcadores van por planta.
function BuildingVolume({ floors, dimmed }: { floors: BuildingFloor[]; dimmed: boolean }) {
  if (floors.length === 0) return null
  const orders = floors.map(f => f.floor_order)
  const bottomY = Math.min(...orders) * FLOOR_HEIGHT - FLOOR_HEIGHT * 0.5
  const topY = Math.max(...orders) * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.5
  const height = topY - bottomY
  const centerY = (topY + bottomY) / 2
  const roofThickness = 0.25

  return (
    <group>
      <mesh position={[0, centerY, 0]}>
        <boxGeometry args={[BUILDING_WIDTH, height, BUILDING_DEPTH]} />
        <meshStandardMaterial color={IKEA_BLUE} transparent opacity={dimmed ? 0.2 : 1} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, topY + roofThickness / 2, 0]}>
        <boxGeometry args={[BUILDING_WIDTH * 1.02, roofThickness, BUILDING_DEPTH * 1.02]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={dimmed ? 0.2 : 1} roughness={0.8} />
      </mesh>
    </group>
  )
}

function Marker({ marker, color, onClick }: {
  marker: BuildingMarker
  color: MarkerColor
  onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const x = (marker.pos_x - 0.5) * BUILDING_WIDTH
  const y = (marker.pos_y - 0.5) * BUILDING_DEPTH
  return (
    <group position={[x, y, 0.35]} onClick={onClick}>
      <mesh>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color.fill} emissive={color.fill} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
        <meshStandardMaterial color={color.ring} />
      </mesh>
    </group>
  )
}

function FloorInteractionLayer({ floor, markers, dimmed, markerColor, onMarkerClick, onFloorClick }: {
  floor: BuildingFloor
  markers: BuildingMarker[]
  dimmed: boolean
  markerColor: (marker: BuildingMarker) => MarkerColor
  onMarkerClick: (marker: BuildingMarker) => void
  onFloorClick: (posX: number, posY: number) => void
}) {
  function handleSurfaceClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    if (dimmed || !e.uv) return
    onFloorClick(e.uv.x, e.uv.y)
  }

  return (
    <group
      position={[0, floor.floor_order * FLOOR_HEIGHT, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh onClick={handleSurfaceClick} raycast={dimmed ? () => null : undefined}>
        <planeGeometry args={[BUILDING_WIDTH, BUILDING_DEPTH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {markers.map(m => (
        <Marker
          key={m.id}
          marker={m}
          color={markerColor(m)}
          onClick={e => { e.stopPropagation(); onMarkerClick(m) }}
        />
      ))}
    </group>
  )
}

function SceneContent({ floors, markers, activeFloorId, markerColor, onMarkerClick, onFloorClick }: BuildingSceneProps) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 6]} intensity={0.9} />
      <directionalLight position={[-8, 6, -6]} intensity={0.3} />
      <BuildingVolume floors={floors} dimmed={activeFloorId !== null} />
      {floors.map(floor => (
        <FloorInteractionLayer
          key={floor.id}
          floor={floor}
          markers={markers.filter(m => m.floor_id === floor.id)}
          dimmed={activeFloorId !== null && activeFloorId !== floor.id}
          markerColor={markerColor}
          onMarkerClick={onMarkerClick}
          onFloorClick={(x, y) => onFloorClick(floor.id, x, y)}
        />
      ))}
      <Controls />
    </>
  )
}

export default function BuildingScene(props: BuildingSceneProps) {
  const floorCount = Math.max(props.floors.length, 1)
  const camY = FLOOR_HEIGHT * floorCount * 0.6 + BUILDING_DEPTH * 0.4

  return (
    <Canvas
      camera={{ position: [BUILDING_WIDTH * 0.7, camY, BUILDING_DEPTH * 1.6], fov: 50 }}
      gl={{ antialias: true }}
      style={{ background: 'transparent' }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
