// SOC Lite — tipos y utilidades compartidas (Fase 1-5 del roadmap SmartOps)

export type SocCaseType = 'url' | 'email' | 'file' | 'event'
export type SocSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SocStatus = 'open' | 'reviewing' | 'closed' | 'false_positive'

interface SocWorkerRef {
  id: number
  name: string
  color: string
}

// Fila real de soc_cases (Fase 5 — ver database/soc_lite_schema.sql)
export interface SocCaseRecord {
  id: number
  title: string
  case_type: SocCaseType
  status: SocStatus
  severity: SocSeverity
  description?: string
  reported_by_id?: number
  assigned_to_id?: number
  reported_by?: SocWorkerRef
  assigned_to?: SocWorkerRef
  created_at: string
  updated_at: string
  closed_at?: string
}

export interface SocUrlAnalysisRecord {
  id: number
  case_id: number
  url: string
  domain?: string
  uses_https: boolean
  has_ip_address: boolean
  url_length?: number
  suspicious_keywords: string[]
  risk_score: number
  severity: SocSeverity
  recommendation?: string
  created_at: string
}

export interface SocEmailAnalysisRecord {
  id: number
  case_id: number
  sender?: string
  subject?: string
  body_excerpt?: string
  extracted_links: string[]
  suspicious_keywords: string[]
  has_attachments: boolean
  attachment_names: string[]
  risk_score: number
  severity: SocSeverity
  recommendation?: string
  created_at: string
}

export interface SocFileAnalysisRecord {
  id: number
  case_id: number
  file_name: string
  file_extension?: string
  file_size?: number
  mime_type?: string
  sha256_hash?: string
  storage_path?: string
  risk_score: number
  severity: SocSeverity
  recommendation?: string
  created_at: string
}

export interface SocSecurityEventRecord {
  id: number
  case_id: number
  event_type: string
  affected_area?: string
  affected_system?: string
  affected_asset_id?: number
  affected_asset?: { id: number; name: string }
  source?: string
  details?: string
  risk_score: number
  severity: SocSeverity
  created_at: string
}

export interface SocStats {
  openCases: number
  criticalCases: number
  urlsAnalyzed: number
  emailsReviewed: number
  filesReviewed: number
  securityEvents: number
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

// Punto medio de cada banda de severidad — usado como risk_score para eventos
// de seguridad, donde la severidad la fija la persona que registra el evento
// (no hay un análisis automático como en URL/correo/archivo).
export const SEVERITY_MIDPOINT: Record<SocSeverity, number> = {
  low: 15, medium: 45, high: 70, critical: 90,
}

export const SECURITY_EVENT_TYPES = [
  'Acceso fuera de horario a sala técnica',
  'Cámara CCTV offline',
  'Fallo en control de accesos',
  'Rack abierto',
  'Dispositivo sin comunicación',
  'Intento de acceso no autorizado',
  'Proveedor accede fuera de ventana autorizada',
  'Múltiples fallos de PIN',
  'Firewall alert simulada',
  'Switch offline',
  'Sensor manipulado',
  'SAI en batería',
  'Temperatura crítica en sala técnica',
  'Otro',
]

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

export function parseAttachmentNames(raw: string): string[] {
  return raw.split(/[,;\n]/).map(a => a.trim()).filter(Boolean)
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

  const attachmentList = parseAttachmentNames(input.attachmentNames)
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

// ─── Triage de archivos — solo metadatos, nunca ejecuta ni sube      ───
// ─── el archivo a ningún sitio. El hash se calcula en el navegador   ───
// ─── con Web Crypto API.                                             ───

export interface FileAnalysisInput {
  fileName: string
  fileSize: number
  mimeType: string
}

export interface FileAnalysisResult {
  score: number
  severity: SocSeverity
  reasons: string[]
  extension: string
  recommendation: string
}

const HIGH_RISK_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.ps1', '.jar', '.msi', '.hta', '.lnk']
const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.iso']
const MACRO_OFFICE_EXTENSIONS = ['.docm', '.xlsm', '.pptm']

const SUSPICIOUS_FILE_NAME_WORDS = [
  'factura', 'urgente', 'password', 'contraseña', 'contrasena', 'nomina', 'nómina', 'pago',
  'login', 'update', 'seguridad', 'cuenta', 'banco', 'transferencia', 'recibo', 'pendiente', 'aviso',
]

const FILE_RECOMMENDATIONS: Record<SocSeverity, string> = {
  low: 'No se detectan señales evidentes, pero valida siempre el remitente antes de abrir.',
  medium: 'Revisar con precaución. Valida el remitente y revisa en un entorno controlado si es posible.',
  high: 'No abrir el archivo. Valida el remitente por un canal alternativo y escala a tu responsable.',
  critical: 'No abrir ni descargar en equipos corporativos. Escala de inmediato y mantén evidencias.',
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx === -1 ? '' : fileName.slice(idx).toLowerCase()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function analyzeFile(input: FileAnalysisInput): FileAnalysisResult {
  const reasons: string[] = []
  let score = 0

  const nameLower = input.fileName.toLowerCase()
  const extension = getExtension(nameLower)

  if (HIGH_RISK_EXTENSIONS.includes(extension)) {
    reasons.push(`Extensión de alto riesgo: ${extension} (puede ejecutar código).`)
    score += 45
  } else if (MACRO_OFFICE_EXTENSIONS.includes(extension)) {
    reasons.push(`Documento de Office con macros habilitadas: ${extension}.`)
    score += 35
  } else if (ARCHIVE_EXTENSIONS.includes(extension)) {
    reasons.push(`Archivo comprimido: ${extension} (puede ocultar contenido malicioso).`)
    score += 20
  }

  const doubleExtMatch = nameLower.match(/\.(pdf|docx?|xlsx?|jpe?g|png|txt)(\.[a-z0-9]{2,4})$/)
  if (doubleExtMatch) {
    reasons.push(`Doble extensión sospechosa (".${doubleExtMatch[1]}${doubleExtMatch[2]}") — técnica habitual para disfrazar ejecutables.`)
    score += 30
  }

  const foundWords = SUSPICIOUS_FILE_NAME_WORDS.filter(w => nameLower.includes(w))
  if (foundWords.length > 0) {
    reasons.push(`Nombre con palabras habituales en phishing: ${foundWords.join(', ')}.`)
    score += Math.min(foundWords.length * 6, 24)
  }

  score = Math.min(100, score)
  const severity = severityFromScore(score)

  return {
    score,
    severity,
    reasons,
    extension: extension || '(sin extensión)',
    recommendation: FILE_RECOMMENDATIONS[severity],
  }
}

export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
