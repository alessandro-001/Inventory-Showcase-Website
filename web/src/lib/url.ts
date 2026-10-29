// Only https URLs may be stored/rendered as links or images (blocks javascript:, data:, http:).
export function safeUrl(u: unknown): string {
  try {
    const x = new URL(String(u ?? '').startsWith('//') ? 'https:' + u : String(u ?? ''))
    return x.protocol === 'https:' ? x.href : ''
  } catch { return '' }
}
