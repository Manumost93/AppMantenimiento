import { useMemo, useRef } from 'react'
import { Canvas, extend, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
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
const IKEA_BLUE = '#0051BA'
const ROOF_GREY = '#cbd5e1'

// Masa del edificio a partir de los planos arquitectónicos reales (planos de
// mayo 2015): la tienda IKEA Alcorcón se asienta sobre un podio de parking
// (Sótano -2 + Planta Baja/Parking -1) que ocupa casi toda la parcela, y
// encima un volumen más estrecho con la tienda (Planta Primera + Planta
// Segunda) y la cubierta. No son las coordenadas exactas de cada muro (eso
// necesitaría trazarlas a escala desde el PDF con más precisión), pero sí
// reflejan la proporción y el escalonado reales en vez de una caja lisa:
// esquina achaflanada donde está la rampa/marquesina de entrada, y el
// saliente de los muelles de carga en la parte trasera.
const PODIUM_POINTS: [number, number][] = [
  [-10, -6], [-10, 3], [-8, 6], [10, 6], [10, -6],
]
const STORE_POINTS: [number, number][] = [
  [-7, -4], [-7, 2.5], [-5.5, 4], [7, 4], [7, -4], [6, -4], [6, -7], [2, -7], [2, -4],
]

export const PODIUM_WIDTH = 20
export const PODIUM_DEPTH = 12
export const STORE_WIDTH = 14
export const STORE_DEPTH = 8

export type MarkerColor = { fill: string; ring: string }

interface BuildingSceneProps {
  floors: BuildingFloor[]
  markers: BuildingMarker[]
  activeFloorId: number | null
  markerColor: (marker: BuildingMarker) => MarkerColor
  onMarkerClick: (marker: BuildingMarker) => void
  onFloorClick: (floorId: number, posX: number, posY: number) => void
}

// Planta baja (parking, floor_order <= 0) usa el podio ancho; Planta Primera
// en adelante (floor_order > 0) usa el volumen más estrecho de la tienda.
function isPodiumFloor(floor: BuildingFloor) {
  return floor.floor_order <= 0
}

function shapeFromPoints(points: [number, number][]) {
  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1])
  shape.closePath()
  return shape
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
      maxDistance={Math.max(PODIUM_WIDTH, PODIUM_DEPTH) * 4}
      maxPolarAngle={Math.PI / 2.05}
    />
  )
}

function MassVolume({ points, bottomY, topY, color, dimmed }: {
  points: [number, number][]
  bottomY: number
  topY: number
  color: string
  dimmed: boolean
}) {
  const depth = topY - bottomY
  const geometry = useMemo(() => {
    if (depth <= 0) return null
    const geo = new THREE.ExtrudeGeometry(shapeFromPoints(points), { depth, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, depth])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} position={[0, bottomY, 0]} raycast={() => null}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={dimmed ? 0.1 : 0.38}
        depthWrite={false}
        side={THREE.DoubleSide}
        roughness={0.4}
        metalness={0.05}
      />
    </mesh>
  )
}

function RoofCap({ topY, dimmed }: { topY: number; dimmed: boolean }) {
  const thickness = 0.25
  const geometry = useMemo(() => {
    const scaled = STORE_POINTS.map(([x, y]) => [x * 1.04, y * 1.04] as [number, number])
    const geo = new THREE.ExtrudeGeometry(shapeFromPoints(scaled), { depth: thickness, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [])
  return (
    <mesh geometry={geometry} position={[0, topY, 0]} raycast={() => null}>
      <meshStandardMaterial color={ROOF_GREY} transparent opacity={dimmed ? 0.15 : 0.85} roughness={0.8} />
    </mesh>
  )
}

function BuildingMass({ floors, dimmed }: { floors: BuildingFloor[]; dimmed: boolean }) {
  if (floors.length === 0) return null
  const podiumFloors = floors.filter(isPodiumFloor)
  const storeFloors = floors.filter(f => !isPodiumFloor(f))

  const rangeFor = (fl: BuildingFloor[]) => {
    if (fl.length === 0) return null
    const orders = fl.map(f => f.floor_order)
    return {
      bottomY: Math.min(...orders) * FLOOR_HEIGHT - FLOOR_HEIGHT * 0.5,
      topY: Math.max(...orders) * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.5,
    }
  }

  const podiumRange = rangeFor(podiumFloors)
  const storeRange = rangeFor(storeFloors)
  const topY = storeRange?.topY ?? podiumRange?.topY ?? 0

  return (
    <group>
      {podiumRange && (
        <MassVolume points={PODIUM_POINTS} bottomY={podiumRange.bottomY} topY={podiumRange.topY} color={IKEA_BLUE} dimmed={dimmed} />
      )}
      {storeRange && (
        <MassVolume points={STORE_POINTS} bottomY={storeRange.bottomY} topY={storeRange.topY} color={IKEA_BLUE} dimmed={dimmed} />
      )}
      <RoofCap topY={topY} dimmed={dimmed} />
    </group>
  )
}

function Marker({ marker, width, depth, color, onClick }: {
  marker: BuildingMarker
  width: number
  depth: number
  color: MarkerColor
  onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const x = (marker.pos_x - 0.5) * width
  const y = (marker.pos_y - 0.5) * depth
  return (
    <group position={[x, y, 0.35]} onClick={onClick} renderOrder={10}>
      <mesh>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color.fill} emissive={color.fill} emissiveIntensity={0.5} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
        <meshStandardMaterial color={color.ring} depthTest={false} />
      </mesh>
    </group>
  )
}

// Contorno de la planta (líneas del borde) para que se vea dónde está cada
// nivel dentro de la carcasa translúcida, sin depender solo del relleno.
function FloorOutline({ width, depth, opacity }: { width: number; depth: number; opacity: number }) {
  const geometry = useMemo(() => {
    const hw = width / 2
    const hd = depth / 2
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-hw, -hd, 0.01),
      new THREE.Vector3(hw, -hd, 0.01),
      new THREE.Vector3(hw, hd, 0.01),
      new THREE.Vector3(-hw, hd, 0.01),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, depth])
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color="#ffffff" transparent opacity={opacity} />
    </lineLoop>
  )
}

function FloorInteractionLayer({ floor, markers, isActive, hasSelection, markerColor, onMarkerClick, onFloorClick }: {
  floor: BuildingFloor
  markers: BuildingMarker[]
  isActive: boolean
  hasSelection: boolean
  markerColor: (marker: BuildingMarker) => MarkerColor
  onMarkerClick: (marker: BuildingMarker) => void
  onFloorClick: (posX: number, posY: number) => void
}) {
  const width = isPodiumFloor(floor) ? PODIUM_WIDTH : STORE_WIDTH
  const depth = isPodiumFloor(floor) ? PODIUM_DEPTH : STORE_DEPTH
  const disableClick = hasSelection && !isActive
  const fillOpacity = isActive ? 0.4 : hasSelection ? 0.03 : 0.16
  const outlineOpacity = isActive ? 0.9 : hasSelection ? 0.06 : 0.4

  function handleSurfaceClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    if (disableClick || !e.uv) return
    onFloorClick(e.uv.x, e.uv.y)
  }

  return (
    <group
      position={[0, floor.floor_order * FLOOR_HEIGHT, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh onClick={handleSurfaceClick} raycast={disableClick ? () => null : undefined}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color="#bfdbfe" transparent opacity={fillOpacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <FloorOutline width={width} depth={depth} opacity={outlineOpacity} />
      {markers.map(m => (
        <Marker
          key={m.id}
          marker={m}
          width={width}
          depth={depth}
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
      <BuildingMass floors={floors} dimmed={activeFloorId !== null} />
      {floors.map(floor => (
        <FloorInteractionLayer
          key={floor.id}
          floor={floor}
          markers={markers.filter(m => m.floor_id === floor.id)}
          isActive={activeFloorId === floor.id}
          hasSelection={activeFloorId !== null}
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
  const camY = FLOOR_HEIGHT * floorCount * 0.6 + PODIUM_DEPTH * 0.4

  return (
    <Canvas
      camera={{ position: [PODIUM_WIDTH * 0.7, camY, PODIUM_DEPTH * 1.4], fov: 50 }}
      gl={{ antialias: true }}
      style={{ background: 'transparent' }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
