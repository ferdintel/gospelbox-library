// Mise en forme commune des paroles au format GospelBox : un bloc par diapositive, étiqueté.

/** Majuscule en début de vers, comme dans les recueils imprimés. */
export const capitalize = (line) => line.replace(/^(\P{L}*)(\p{Ll})/u, (_, pre, c) => pre + c.toUpperCase())

/**
 * Coupe un couplet en diapositives d'au plus maxLines vers, de préférence après une ponctuation
 * forte (. ; : ! ?), sinon après une virgule, pour ne pas couper une phrase en deux.
 */
export function chunk(lines, maxLines = 4) {
  if (lines.length <= maxLines) return [lines]
  const out = []
  let i = 0
  while (i < lines.length) {
    const rest = lines.length - i
    if (rest <= maxLines) {
      out.push(lines.slice(i))
      break
    }
    const window = lines.slice(i, i + maxLines)
    const after = (re) => {
      for (let k = window.length - 1; k >= 1; k--) if (re.test(window[k])) return k + 1
      return 0
    }
    let size = after(/[.;:!?»"”]\s*$/) || after(/,\s*$/) || maxLines
    if (rest - size === 1) size = Math.max(2, size - 1) // pas de vers isolé à la fin
    out.push(lines.slice(i, i + size))
    i += size
  }
  return out
}

/**
 * Couplets (listes de vers) → texte GospelBox. Un couplet de plus de 4 vers est réparti en
 * plusieurs diapositives, étiquetées 1.1, 1.2… Un refrain ({ label: 'R', lines }) s'écrit une
 * fois, puis se répète par son étiquette seule.
 */
export function formatStanzas(stanzas, { maxLines = 4 } = {}) {
  const out = []
  let n = 0
  const seen = new Set()
  for (const s of stanzas) {
    const lines = (Array.isArray(s) ? s : s.lines).map((l) => capitalize(l.trim())).filter(Boolean)
    if (!lines.length) continue
    const label = s.label ?? String(++n)
    if (s.label && seen.has(s.label)) {
      out.push(`[${s.label}]`)
      continue
    }
    seen.add(label)
    const parts = chunk(lines, maxLines)
    parts.forEach((part, i) => out.push(`[${parts.length > 1 ? `${label}.${i + 1}` : label}]\n${part.join('\n')}`))
  }
  return out.join('\n\n')
}
