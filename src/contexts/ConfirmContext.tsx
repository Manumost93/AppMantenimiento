import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<Required<ConfirmOptions>>({
    title: 'Confirmar acción',
    message: '¿Estás seguro?',
    confirmLabel: 'Confirmar',
    danger: true,
  })
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((input) => {
    const options: Required<ConfirmOptions> = typeof input === 'string'
      ? { title: 'Confirmar', message: input, confirmLabel: 'Eliminar', danger: true }
      : {
          title: input.title ?? 'Confirmar acción',
          message: input.message ?? '¿Estás seguro?',
          confirmLabel: input.confirmLabel ?? 'Eliminar',
          danger: input.danger ?? true,
        }
    setOpts(options)
    setOpen(true)
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve
    })
  }, [])

  function handleConfirm() {
    setOpen(false)
    resolveRef.current?.(true)
  }

  function handleCancel() {
    setOpen(false)
    resolveRef.current?.(false)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={open}
        title={opts.title}
        message={opts.message}
        confirmLabel={opts.confirmLabel}
        danger={opts.danger}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
