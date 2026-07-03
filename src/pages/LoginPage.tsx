import { useState, useEffect } from 'react'
import { getWorkers, verifyPin, setWorkerPin, createAuditLog } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { TeamMember } from '@/types'
import { getInitials } from '@/lib/utils'

const PIN_LENGTH = 6

type Step = 'select' | 'pin' | 'set_pin' | 'confirm_pin'

function AppLogo() {
  return (
    <svg viewBox="0 0 80 80" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gearGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <g fill="url(#gearGrad)" opacity="0.9">
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <rect key={angle} x="37" y="4" width="6" height="10" rx="2"
            transform={`rotate(${angle} 40 40)`} />
        ))}
      </g>
      <circle cx="40" cy="40" r="24" fill="url(#gearGrad)" opacity="0.15" />
      <circle cx="40" cy="40" r="22" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5" />
      <circle cx="40" cy="40" r="14" fill="rgba(12,30,53,0.97)" />
      <g transform="translate(40,40) rotate(-40)">
        <rect x="-3" y="1" width="6" height="18" rx="2.5" fill="#93c5fd" />
        <circle cx="0" cy="-4" r="8" fill="#60a5fa" />
        <circle cx="0" cy="-4" r="4.5" fill="rgba(12,30,53,0.97)" />
        <rect x="-3" y="-9" width="6" height="3" rx="1.5" fill="#60a5fa" />
      </g>
    </svg>
  )
}

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
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    getWorkers()
      .then(data => setWorkers(data.filter(w => w.active)))
      .catch(() => setError('No se pudo conectar. Comprueba tu conexión.'))
      .finally(() => setLoading(false))
  }, [])

  function selectWorker(w: TeamMember) {
    setAnimating(true)
    setTimeout(() => {
      setSelected(w)
      setPin('')
      setConfirmPin('')
      setError('')
      setStep(w.pin_hash ? 'pin' : 'set_pin')
      setAnimating(false)
    }, 150)
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
        createAuditLog({ user_id: selected.id, user_name: selected.name, action: 'login_success', module: 'auth' })
        login(selected)
      } else {
        createAuditLog({ user_id: selected.id, user_name: selected.name, action: 'login_failed', module: 'auth', severity: 'warning' })
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
      createAuditLog({ user_id: selected.id, user_name: selected.name, action: 'pin_created', module: 'auth' })
      login(selected)
    } catch {
      setError('Error al guardar el PIN.')
    } finally {
      setVerifying(false)
    }
  }

  const currentPin = step === 'confirm_pin' ? confirmPin : pin

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0f2540 0%, #0c1e35 55%, #071525 100%)' }}
    >
      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(29,78,216,0.07) 0%, transparent 70%)' }} />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)' }} />

      {/* Logo & branding */}
      <div className="mb-7 flex flex-col items-center select-none">
        <div className="w-[72px] h-[72px] mb-4">
          <AppLogo />
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px w-7" style={{ background: 'linear-gradient(90deg, transparent, #3b82f6)' }} />
          <h1 className="text-white font-black text-2xl tracking-[0.18em]">IKEA</h1>
          <div className="h-px w-7" style={{ background: 'linear-gradient(90deg, #3b82f6, transparent)' }} />
        </div>
        <p className="text-blue-400 text-[10px] font-semibold tracking-[0.35em] uppercase">Mantenimiento</p>
      </div>

      {/* Main card */}
      <div className={`w-full max-w-sm transition-opacity duration-150 ${animating ? 'opacity-0' : 'opacity-100'}`}>

        {/* ── STEP: Selección ── */}
        {step === 'select' && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="px-5 py-3.5 flex items-center gap-2.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <p className="text-slate-400 text-xs font-medium tracking-widest uppercase">Selecciona tu perfil</p>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  <p className="text-slate-600 text-sm">Cargando equipo...</p>
                </div>
              ) : workers.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <p className="text-sm">No hay trabajadores configurados.</p>
                  <p className="text-xs mt-2 text-slate-600">Añade trabajadores en el panel de Supabase primero.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {workers.map(w => (
                    <button
                      key={w.id}
                      onClick={() => selectWorker(w)}
                      className="group rounded-xl p-4 flex flex-col items-center gap-2.5 transition-all duration-200 active:scale-95"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)'
                        ;(e.currentTarget as HTMLElement).style.border = '1px solid rgba(59,130,246,0.3)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                        ;(e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.07)'
                      }}
                    >
                      <div className="relative">
                        <div
                          className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: w.color, boxShadow: `0 4px 16px ${w.color}44` }}
                        >
                          {getInitials(w.name)}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2"
                          style={{ borderColor: '#0c1e35' }} />
                      </div>
                      <div className="text-center">
                        <p className="text-white text-sm font-semibold leading-tight">{w.name}</p>
                        <p className="text-slate-600 text-xs mt-0.5">{w.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-xl px-4 py-2.5 text-xs text-red-300 text-center"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: PIN ── */}
        {(step === 'pin' || step === 'set_pin' || step === 'confirm_pin') && selected && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="px-5 py-3.5 flex items-center gap-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <button
                onClick={() => { setStep('select'); setSelected(null); setError('') }}
                className="text-blue-500 hover:text-blue-300 transition-colors shrink-0"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                </svg>
              </button>
              <p className="text-slate-400 text-xs font-medium tracking-widest uppercase flex-1 text-center pr-5">
                {step === 'pin' && 'Introduce tu PIN'}
                {step === 'set_pin' && 'Crea tu PIN'}
                {step === 'confirm_pin' && 'Confirma tu PIN'}
              </p>
            </div>

            <div className="flex flex-col items-center px-5 py-6 gap-5">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
                  style={{
                    backgroundColor: selected.color,
                    boxShadow: `0 0 28px ${selected.color}50`,
                  }}
                >
                  {getInitials(selected.name)}
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold">{selected.name}</p>
                  <p className="text-slate-600 text-xs">{selected.role}</p>
                </div>
              </div>

              {/* PIN dots */}
              <div className="flex gap-3">
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <div
                    key={i}
                    className="w-3.5 h-3.5 rounded-full transition-all duration-150"
                    style={{
                      background: i < currentPin.length ? selected.color : 'rgba(255,255,255,0.1)',
                      transform: i < currentPin.length ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: i < currentPin.length ? `0 0 8px ${selected.color}80` : 'none',
                    }}
                  />
                ))}
              </div>

              {error && (
                <div className="w-full rounded-xl px-4 py-2.5 text-xs text-red-300 text-center"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              {verifying ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  Verificando...
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 w-full max-w-[210px]">
                  {['1','2','3','4','5','6','7','8','9','','0','del'].map((d, i) => (
                    <button
                      key={i}
                      onClick={() => d && handlePinKey(d)}
                      disabled={!d}
                      className={`h-14 rounded-xl font-semibold transition-all duration-100 active:scale-95 ${
                        d ? 'text-white' : 'invisible'
                      }`}
                      style={d ? {
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: d === 'del' ? '12px' : '18px',
                      } : {}}
                      onMouseEnter={e => {
                        if (d) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.18)'
                      }}
                      onMouseLeave={e => {
                        if (d) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                      }}
                    >
                      {d === 'del' ? (
                        <span className="flex items-center justify-center text-slate-400">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M7.22 3.22A.75.75 0 017.75 3h9A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17h-9a.75.75 0 01-.53-.22L1.97 11.53a.75.75 0 010-1.06l5.25-5.25zM7.19 12.5a.75.75 0 001.06 1.06l1.75-1.75 1.75 1.75a.75.75 0 001.06-1.06L12.06 10.75l1.75-1.75a.75.75 0 00-1.06-1.06L11 9.69 9.25 7.94a.75.75 0 00-1.06 1.06l1.75 1.75-1.75 1.75z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : d}
                    </button>
                  ))}
                </div>
              )}

              {step === 'set_pin' && (
                <p className="text-slate-700 text-xs text-center max-w-[200px] leading-relaxed">
                  Elige 6 dígitos que recuerdes fácilmente. Este PIN protege tu acceso a la app.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="absolute bottom-4 text-slate-800 text-[10px] tracking-widest uppercase select-none">
        Desarrollado por Manuel Honrado Vega
      </p>
    </div>
  )
}
