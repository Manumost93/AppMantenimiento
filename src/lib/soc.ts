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

export const SEVERITY_LABEL_ES: Record<SocSeverity, string> = {
  low: 'bajo', medium: 'medio', high: 'alto', critical: 'crítico',
}

// Colores para el banner de resultado de los analizadores (URL/correo/archivo)
export const SEVERITY_BANNER: Record<SocSeverity, { bg: string; text: string }> = {
  low: { bg: 'bg-gray-50 dark:bg-slate-700/50', text: 'text-gray-700 dark:text-slate-200' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  high: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
  critical: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
}

const IMPERSONATED_BRANDS = [
  'microsoft', 'google', 'amazon', 'ikea', 'paypal', 'banco', 'santander', 'caixabank', 'correos',
]

function isBrandImpersonation(hostname: string): string | undefined {
  const registrableDomain = hostname.split('.').slice(-2).join('.')
  return IMPERSONATED_BRANDS.find(brand => hostname.includes(brand) && !registrableDomain.startsWith(brand + '.'))
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
    const impersonated = isBrandImpersonation(hostname)
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

// ─── Analizador de correos — estático y 100% local. No envía el     ───
// ─── contenido a ningún servicio externo ni lo almacena todavía.    ───

export interface EmailAnalysisInput {
  sender: string
  subject: string
  body: string
  hasAttachments: boolean
  attachmentNames: string
}

export interface EmailAnalysisResult {
  score: number
  severity: SocSeverity
  reasons: string[]
  links: string[]
  suspiciousAttachments: string[]
  recommendation: string
}

const URGENCY_WORDS = [
  'urgente', 'hoy mismo', 'inmediato', 'último aviso', 'ultimo aviso',
  'acción requerida', 'accion requerida', 'cuenta bloqueada', 'vencido', 'ahora mismo',
]

const SENSITIVE_REQUESTS = [
  'contraseña', 'contrasena', 'credenciales', 'pin', 'tarjeta', 'cuenta bancaria',
  'transferencia', 'pago', 'factura', 'datos personales', 'acceso',
]

const PRESSURE_PHRASES = [
  'bloqueo de cuenta', 'pérdida de acceso', 'perdida de acceso', 'pago urgente',
  'verificación inmediata', 'verificacion inmediata', 'premio', 'regalo',
]

const DANGEROUS_ATTACHMENT_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.ps1', '.jar', '.zip', '.rar', '.7z', '.iso', '.html', '.hta',
]

const EMAIL_RECOMMENDATIONS: Record<SocSeverity, string> = {
  low: 'Parece un correo legítimo, pero revisa igualmente antes de actuar sobre él.',
  medium: 'Revisar con precaución. No hagas clic en enlaces ni descargues adjuntos sin verificar al remitente.',
  high: 'No respondas ni interactúes. Verifica al remitente por un canal alternativo y reporta a tu responsable.',
  critical: 'No abras adjuntos ni enlaces. Repórtalo de inmediato a tu responsable y no respondas al remitente.',
}

function extractEmailAddress(raw: string): string | null {
  const m = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return m ? m[0].toLowerCase() : null
}

function extractLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? []
  return Array.from(new Set(matches))
}

export function analyzeEmail(input: EmailAnalysisInput): EmailAnalysisResult {
  const reasons: string[] = []
  let score = 0

  const combinedLower = `${input.subject} ${input.body}`.toLowerCase()

  const foundUrgency = URGENCY_WORDS.filter(w => combinedLower.includes(w))
  if (foundUrgency.length > 0) {
    reasons.push(`Lenguaje de urgencia: ${foundUrgency.join(', ')}.`)
    score += Math.min(foundUrgency.length * 6, 24)
  }

  const foundSensitive = SENSITIVE_REQUESTS.filter(w => combinedLower.includes(w))
  if (foundSensitive.length > 0) {
    reasons.push(`Solicita información sensible: ${foundSensitive.join(', ')}.`)
    score += Math.min(foundSensitive.length * 8, 32)
  }

  const foundPressure = PRESSURE_PHRASES.filter(w => combinedLower.includes(w))
  if (foundPressure.length > 0) {
    reasons.push(`Lenguaje de presión o amenaza: ${foundPressure.join(', ')}.`)
    score += Math.min(foundPressure.length * 10, 30)
  }

  const links = extractLinks(input.body)
  if (links.length > 0) {
    reasons.push(`Contiene ${links.length} enlace(s) en el cuerpo del correo.`)
    score += Math.min(links.length * 5, 15)

    for (const link of links) {
      try {
        const impersonated = isBrandImpersonation(new URL(link).hostname.toLowerCase())
        if (impersonated) {
          reasons.push(`Uno de los enlaces menciona "${impersonated}" pero no es su dominio oficial.`)
          score += 25
          break
        }
      } catch { /* enlace malformado dentro del cuerpo, se ignora */ }
    }
  }

  const senderAddress = extractEmailAddress(input.sender)
  if (!senderAddress) {
    if (input.sender.trim()) {
      reasons.push('El remitente no parece una dirección de correo válida.')
      score += 10
    }
  } else {
    const domain = senderAddress.split('@')[1]
    if (/\d{3,}/.test(domain)) {
      reasons.push(`El dominio del remitente contiene un número inusual de dígitos (${domain}).`)
      score += 15
    }
    const impersonatedSender = isBrandImpersonation(domain)
    if (impersonatedSender) {
      reasons.push(`El dominio del remitente menciona "${impersonatedSender}" pero no coincide con su dominio oficial.`)
      score += 25
    }
  }

  const attachmentList = input.attachmentNames
    .split(/[,;\n]/)
    .map(a => a.trim())
    .filter(Boolean)
  const suspiciousAttachments = attachmentList.filter(name =>
    DANGEROUS_ATTACHMENT_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext))
  )
  if (input.hasAttachments && suspiciousAttachments.length > 0) {
    reasons.push(`Adjunto(s) con extensión de riesgo: ${suspiciousAttachments.join(', ')}.`)
    score += Math.min(suspiciousAttachments.length * 20, 40)
  } else if (input.hasAttachments && attachmentList.length === 0) {
    reasons.push('Indica que tiene adjuntos pero no se han detallado los nombres — revísalos antes de abrirlos.')
    score += 5
  }

  score = Math.min(100, score)
  const severity = severityFromScore(score)

  return {
    score,
    severity,
    reasons,
    links,
    suspiciousAttachments,
    recommendation: EMAIL_RECOMMENDATIONS[severity],
  }
}
