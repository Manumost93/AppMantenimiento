import { useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { WarehouseSection } from '@/types'

const SECTION_COLORS = [
  '#2563EB', '#DC2626', '#059669', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5',
]

function colorFor(id: number) {
  return SECTION_COLORS[id % SECTION_COLORS.length]
}

interface Point { x: number; y: number }
interface Rect { pos_x: number; pos_y: number; width: number; height: number }

const MIN_SIZE = 0.03

interface Props {
  sections: WarehouseSection[]
  drawMode: boolean
  onDrawComplete: (rect: Rect) => void
  onSectionClick: (section: WarehouseSection) => void
  aspectRatio?: string
  emptyLabel?: string
}

export default function WarehouseFloorPlan({ sections, drawMode, onDrawComplete, onSectionClick, aspectRatio = '16 / 9', emptyLabel = 'Todavía no hay secciones dibujadas en el plano.' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null)

  const placed = sections.filter(s => s.pos_x != null && s.pos_y != null && s.width != null && s.height != null)

  function relativePoint(e: PointerEvent<HTMLDivElement>): Point {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!drawMode) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = relativePoint(e)
    setDragStart(p)
    setDragCurrent(p)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drawMode || !dragStart) return
    setDragCurrent(relativePoint(e))
  }

  function handlePointerUp() {
    if (!drawMode || !dragStart || !dragCurrent) return
    const pos_x = Math.min(dragStart.x, dragCurrent.x)
    const pos_y = Math.min(dragStart.y, dragCurrent.y)
    const width = Math.abs(dragCurrent.x - dragStart.x)
    const height = Math.abs(dragCurrent.y - dragStart.y)
    setDragStart(null)
    setDragCurrent(null)
    if (width < MIN_SIZE || height < MIN_SIZE) return
    onDrawComplete({ pos_x, pos_y, width, height })
  }

  const draggingRect = dragStart && dragCurrent ? {
    left: Math.min(dragStart.x, dragCurrent.x) * 100,
    top: Math.min(dragStart.y, dragCurrent.y) * 100,
    width: Math.abs(dragCurrent.x - dragStart.x) * 100,
    height: Math.abs(dragCurrent.y - dragStart.y) * 100,
  } : null

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full rounded-xl border-2 overflow-hidden select-none bg-gray-50 dark:bg-slate-900',
        drawMode ? 'border-blue-400 cursor-crosshair' : 'border-gray-200 dark:border-slate-700'
      )}
      style={{ aspectRatio, touchAction: drawMode ? 'none' : 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {placed.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => !drawMode && onSectionClick(s)}
          className="absolute flex items-center justify-center text-center px-1 text-xs font-medium text-white border border-white/40 hover:brightness-110 transition-[filter] overflow-hidden"
          style={{
            left: `${(s.pos_x ?? 0) * 100}%`,
            top: `${(s.pos_y ?? 0) * 100}%`,
            width: `${(s.width ?? 0) * 100}%`,
            height: `${(s.height ?? 0) * 100}%`,
            backgroundColor: colorFor(s.id),
          }}
        >
          <span className="truncate">{s.name}</span>
        </button>
      ))}

      {draggingRect && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-400/30 pointer-events-none"
          style={{ left: `${draggingRect.left}%`, top: `${draggingRect.top}%`, width: `${draggingRect.width}%`, height: `${draggingRect.height}%` }}
        />
      )}

      {placed.length === 0 && !drawMode && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500 px-4 text-center">
          {emptyLabel}
        </div>
      )}

      {drawMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full shadow pointer-events-none">
          Arrastra para dibujar el rectángulo de la sección
        </div>
      )}
    </div>
  )
}
