import { Suspense, useEffect, useRef } from 'react'
import { Canvas, extend, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'
import type { BuildingFloor, BuildingMarker } from '@/types'

extend({ OrbitControls })

// eslint-disable-next-line @typescript-eslint/no-namespace
declare module '@react-three/fiber' {
  interface ThreeElements {
    orbitControls: object
  }
}

export const FLOOR_HEIGHT = 3.2
export const FLOOR_SIZE = 12

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
      maxDistance={FLOOR_SIZE * 4}
      maxPolarAngle={Math.PI / 2.05}
    />
  )
}

function TexturedSurface({ url, size, dimmed }: { url: string; size: number; dimmed: boolean }) {
  const texture = useLoader(THREE.TextureLoader, url)
  return (
    <meshStandardMaterial
      map={texture}
      transparent
      opacity={dimmed ? 0.15 : 1}
      side={THREE.DoubleSide}
    />
  )
}

function PlaceholderSurface({ dimmed }: { size: number; dimmed: boolean }) {
  return (
    <meshStandardMaterial
      color="#cbd5e1"
      transparent
      opacity={dimmed ? 0.12 : 0.85}
      side={THREE.DoubleSide}
    />
  )
}

function Marker({ marker, color, onClick }: {
  marker: BuildingMarker
  color: MarkerColor
  onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const x = (marker.pos_x - 0.5) * FLOOR_SIZE
  const y = (marker.pos_y - 0.5) * FLOOR_SIZE
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

function FloorGroup({ floor, markers, dimmed, markerColor, onMarkerClick, onFloorClick }: {
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
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        {floor.plan_image_url ? (
          <Suspense fallback={<PlaceholderSurface size={FLOOR_SIZE} dimmed={dimmed} />}>
            <TexturedSurface url={floor.plan_image_url} size={FLOOR_SIZE} dimmed={dimmed} />
          </Suspense>
        ) : (
          <PlaceholderSurface size={FLOOR_SIZE} dimmed={dimmed} />
        )}
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
      {floors.map(floor => (
        <FloorGroup
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
  const camY = FLOOR_HEIGHT * floorCount * 0.6 + FLOOR_SIZE * 0.25

  return (
    <Canvas
      camera={{ position: [FLOOR_SIZE * 0.85, camY, FLOOR_SIZE * 0.85], fov: 50 }}
      gl={{ antialias: true }}
      style={{ background: 'transparent' }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
