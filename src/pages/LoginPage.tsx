import { useState, useEffect } from 'react'
import { getWorkers, verifyPin, setWorkerPin } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { TeamMember } from '@/types'
import { getInitials } from '@/lib/utils'

const PIN_LENGTH = 6

type Step = 'select' | 'pin' | 'set_pin' | 'confirm_pin'

export default function LoginPage() {
  const { login } = useAuth()
  const [workers, setWorkers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [step, setStep] = useState<Step>('select')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    getWorkers()
      .then(data => setWorkers(data.filter(w => w.active)))
      .catch(() => setError('No se pudo conectar. Comprueba tu conexión.'))
      .finally(() => setLoading(false))
  }, [])

  function selectWorker(w: TeamMember) {
    setSelected(w)
    setPin('')
    setConfirmPin('')
    setError('')
    setStep(w.pin_hash ? 'pin' : 'set_pin')
  }

  function handlePinKey(digit: string) {
    if (digit === 'del') {
      if (step === 'pin') setPin(p => p.slice(0, -1))
      if (step === 'set_pin') setPin(p => p.slice(0, -1))
      if (step === 'confirm_pin') setConfirmPin(p => p.slice(0, -1))
      return
    }
    if (step === 'pin' && pin.length < PIN_LENGTH) setPin(p => p + digit)
    if (step === 'set_pin' && pin.length < PIN_LENGTH) setPin(p => p + digit)
    if (step === 'confirm_pin' && confirmPin.length < PIN_LENGTH) setConfirmPin(p => p + digit)
  }

  useEffect(() => {
    if (step === 'pin' && pin.length === PIN_LENGTH) handleVerify()
    if (step === 'set_pin' && pin.length === PIN_LENGTH) setStep('confirm_pin')
    if (step === 'confirm_pin' && confirmPin.length === PIN_LENGTH) handleSetPin()
  }, [pin, confirmPin, step])

  async function handleVerify() {
    if (!selected || pin.length < PIN_LENGTH) return
    setVerifying(true)
    setError('')
    try {
      const ok = await verifyPin(selected.id, pin)
      if (ok) {
        login(selected)
      } else {
        setError('PIN incorrecto. Inténtalo de nuevo.')
        setPin('')
      }
    } catch {
      setError('Error de conexión.')
      setPin('')
    } finally {
      setVerifying(false)
    }
  }

  async function handleSetPin() {
    if (!selected) return
    if (pin !== confirmPin) {
      setError('Los PINs no coinciden. Vuelve a intentarlo.')
      setPin('')
      setConfirmPin('')
      setStep('set_pin')
      return
    }
    setVerifying(true)
    try {
      await setWorkerPin(selected.id, pin)
      login(selected)
    } catch {
      setError('Error al guardar el PIN.')
    } finally {
      setVerifying(false)
    }
  }

  const currentPin = step === 'confirm_pin' ? confirmPin : pin

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-bold text-2xl">IK</span>
        </div>
        <h1 className="text-white font-bold text-xl">IKEA Mantenimiento</h1>
        <p className="text-slate-400 text-sm mt-1">por Manuel Honrado Vega</p>
      </div>

      <div className="w-full max-w-sm">
        {/* STEP: Selección de trabajador */}
        {step === 'select' && (
          <div>
            <p className="text-slate-300 text-center text-sm mb-4">¿Quién eres?</p>
            {loading ? (
              <div className="text-center text-slate-400 py-8">Cargando equipo...</div>
            ) : workers.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <p>No hay trabajadores configurados.</p>
                <p className="text-xs mt-2">Añade trabajadores en el panel de Supabase primero.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {workers.map(w => (
                  <button
                    key={w.id}
                    onClick={() => selectWorker(w)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: w.color }}
                    >
                      {getInitials(w.name)}
                    </div>
                    <span className="text-white text-sm font-medium text-center leading-tight">{w.name}</span>
                    <span className="text-slate-400 text-xs text-center">{w.role}</span>
                  </button>
                ))}
              </div>
            )}
            {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}
          </div>
        )}

        {/* STEP: Introducir/crear PIN */}
        {(step === 'pin' || step === 'set_pin' || step === 'confirm_pin') && selected && (
          <div className="flex flex-col items-center">
            {/* Back */}
            <button
              onClick={() => { setStep('select'); setSelected(null); setError('') }}
              className="self-start text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1"
            >
              ← Volver
            </button>

            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mb-2"
              style={{ backgroundColor: selected.color }}
            >
              {getInitials(selected.name)}
            </div>
            <p className="text-white font-semibold mb-1">{selected.name}</p>
            <p className="text-slate-400 text-sm mb-6">
              {step === 'pin' && 'Introduce tu PIN de 6 dígitos'}
              {step === 'set_pin' && 'Crea tu PIN de 6 dígitos'}
              {step === 'confirm_pin' && 'Confirma tu PIN'}
            </p>

            {/* PIN dots */}
            <div className="flex gap-3 mb-6">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all ${
                    i < currentPin.length ? 'bg-blue-400 scale-110' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
            )}

            {/* Teclado numérico */}
            {verifying ? (
              <div className="text-slate-400 text-sm">Verificando...</div>
            ) : (
              <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
                {['1','2','3','4','5','6','7','8','9','','0','del'].map((d, i) => (
                  <button
                    key={i}
                    onClick={() => d && handlePinKey(d)}
                    disabled={!d}
                    className={`h-14 rounded-xl text-lg font-semibold transition-colors ${
                      d === 'del'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm'
                        : d
                          ? 'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-500'
                          : 'invisible'
                    }`}
                  >
                    {d === 'del' ? '⌫' : d}
                  </button>
                ))}
              </div>
            )}

            {step === 'set_pin' && (
              <p className="text-slate-500 text-xs text-center mt-4 max-w-[220px]">
                Elige 6 dígitos que recuerdes fácilmente. Este PIN protege tu acceso a la app.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
