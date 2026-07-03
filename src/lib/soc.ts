// SOC Lite — tipos y utilidades compartidas (Fase 1-2 del roadmap SmartOps)

export type SocCaseType = 'url' | 'email' | 'file' | 'event'
export type SocSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SocStatus = 'open' | 'reviewing' | 'closed' | 'false_positive'

export interface SocCase {
  id: number
  title: string
  type: SocCaseType
  severity: SocSeverity
  status: SocStatus
  date: string
  recommendation: string
  responsible: string
}

export const SEVERITY_META: Record<SocSeverity, { label: string; className: string }> = {
  low: { label: 'Bajo', className: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300' },
  medium: { label: 'Medio', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  high: { label: 'Alto', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Crítico', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export const STATUS_META: Record<SocStatus, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  reviewing: { label: 'En revisión', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  closed: { label: 'Cerrado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  false_positive: { label: 'Falso positivo', className: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400' },
}

export function severityFromScore(score: number): SocSeverity {
  if (score >= 81) return 'critical'
  if (score >= 61) return 'high'
  if (score >= 31) return 'medium'
  return 'low'
}

// ─── Analizador de URLs — estático y 100% local. No abre el enlace, ───
// ─── no hace fetch, no envía datos a ningún servicio externo.        ───

export interface UrlAnalysisResult {
  score: number
  severity: SocSeverity
  domain: string
  usesHttps: boolean
  reasons: string[]
  recommendation: string
}

const SUSPICIOUS_KEYWORDS = [
  'login', 'verify', 'urgent', 'password', 'account', 'token', 'reset', 'free',
  'premio', 'factura', 'pago', 'seguridad', 'actualizar', 'bloqueo', 'banco', 'acceso',
]

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd']

const IMPERSONATED_BRANDS = [
  'microsoft', 'google', 'amazon', 'ikea', 'paypal', 'banco', 'santander', 'caixabank', 'correos',
]

const URL_RECOMMENDATIONS: Record<SocSeverity, string> = {
  low: 'Parece seguro, revisar igualmente antes de abrir.',
  medium: 'Revisar con precaución. Valida el dominio por un canal alternativo antes de interactuar.',
  high: 'No abrir desde equipos corporativos. Reporta el enlace a tu responsable.',
  critical: 'No abrir bajo ningún concepto. Bloquea o escala de inmediato a tu responsable.',
}

export function analyzeUrl(rawUrl: string): UrlAnalysisResult {
  const input = rawUrl.trim()
  const reasons: string[] = []
  let score = 0

  let parsed: URL | null = null
  try {
    parsed = new URL(input)
  } catch {
    try {
      parsed = new URL('http://' + input)
      reasons.push('No se especifica protocolo (http/https).')
      score += 5
    } catch {
      parsed = null
    }
  }

  if (!parsed) {
    return {
      score: 0,
      severity: 'low',
      domain: '—',
      usesHttps: false,
      reasons: ['No se ha podido interpretar como una URL válida.'],
      recommendation: 'Revisa que el texto pegado sea una URL completa.',
    }
  }

  const hostname = parsed.hostname.toLowerCase()
  const usesHttps = parsed.protocol === 'https:'
  const fullUrlLower = input.toLowerCase()
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)

  if (!usesHttps) {
    reasons.push('No usa HTTPS (conexión sin cifrar).')
    score += 15
  }

  if (isIp) {
    reasons.push('Usa una dirección IP en lugar de un dominio.')
    score += 25
  }

  if (input.length > 120) {
    reasons.push('URL inusualmente larga.')
    score += 15
  } else if (input.length > 75) {
    reasons.push('URL más larga de lo habitual.')
    score += 8
  }

  const labels = hostname.split('.')
  if (!isIp && labels.length > 4) {
    reasons.push('Contiene muchos subdominios.')
    score += 10
  }

  if (input.includes('@')) {
    reasons.push('Contiene el carácter "@", una técnica habitual de phishing para ocultar el dominio real.')
    score += 15
  }

  if (hostname.includes('xn--')) {
    reasons.push('Dominio con codificación punycode (posible suplantación visual de caracteres).')
    score += 15
  }

  if ((hostname.match(/-/g) || []).length >= 4) {
    reasons.push('Dominio con un número inusual de guiones.')
    score += 8
  }

  const paramCount = Array.from(parsed.searchParams.keys()).length
  if (paramCount > 4) {
    reasons.push(`Tiene muchos parámetros en la URL (${paramCount}).`)
    score += 10
  }

  const foundKeywords = SUSPICIOUS_KEYWORDS.filter(k => fullUrlLower.includes(k))
  if (foundKeywords.length > 0) {
    reasons.push(`Contiene palabras habituales en phishing: ${foundKeywords.join(', ')}.`)
    score += Math.min(foundKeywords.length * 8, 32)
  }

  if (!isIp && SHORTENERS.some(s => hostname === s || hostname.endsWith('.' + s))) {
    reasons.push('Parece un acortador de enlaces (oculta el destino real).')
    score += 20
  }

  if (!isIp) {
    const registrableDomain = labels.slice(-2).join('.')
    const impersonated = IMPERSONATED_BRANDS.find(brand =>
      hostname.includes(brand) && !registrableDomain.startsWith(brand + '.')
    )
    if (impersonated) {
      reasons.push(`El dominio menciona "${impersonated}" pero no coincide con su dominio oficial — posible suplantación de marca.`)
      score += 30
    }
  }

  score = Math.min(100, score)
  const severity = severityFromScore(score)

  return {
    score,
    severity,
    domain: hostname,
    usesHttps,
    reasons,
    recommendation: URL_RECOMMENDATIONS[severity],
  }
}
