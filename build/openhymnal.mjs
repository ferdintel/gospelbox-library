// Convertit l'Open Hymnal Project (partitions ABC, domaine public) en recueil GospelBox.
// Usage : node build/openhymnal.mjs <dossier openhymnal/Complete> > songbooks/open-hymnal.json
//
// Dans une partition ABC, les paroles sont écrites syllabe par syllabe sous la mélodie :
//   w: 1.~A- bide with me; fast falls the ev- en- tide; The dark- ness
// une ligne « w: » par couplet et par portée. Les couplets suivants peuvent être écrits en clair
// après la partition (« W: 6.I need Thy presence… »). Le mètre (%OHMETRICAL 10 10 10 10) donne le
// nombre de syllabes par vers : il sert à recouper chaque couplet en vers.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { formatStanzas } from './lib/lyrics.mjs'

const root = process.argv[2]
if (!root) throw new Error('Indiquez le dossier openhymnal/Complete')

const METERS = { SM: [6, 6, 8, 6], CM: [8, 6, 8, 6], LM: [8, 8, 8, 8] }

/** « 10 10 10 10 », « C M D », « 8 7 8 7 D » → nombre de syllabes par vers, ou null. */
function meter(raw) {
  if (!raw) return null
  const t = raw.toUpperCase().replace(/WITH.*$/, '').replace(/\s+/g, ' ').trim()
  const named = t.replace(/ /g, '').match(/^(SM|CM|LM)(D?)$/)
  if (named) return named[2] ? [...METERS[named[1]], ...METERS[named[1]]] : METERS[named[1]]
  const m = t.match(/^((?:\d+\s*)+)(D)?$/)
  if (!m) return null
  const counts = m[1].trim().split(/\s+/).map(Number)
  return m[2] ? [...counts, ...counts] : counts
}

/** Découpe une ligne « w: » en syllabes : { text, join } (join : la syllabe suivante continue le mot). */
function syllables(line) {
  const out = []
  const body = line.replace(/^\s*\d+\.\s*~?/, '') // numéro du couplet
  for (const token of body.replace(/\\-/g, '\u2010').split(/\s+/)) {
    if (!token || token === '|' || token === '_' || token === '*') continue
    // « bide- », « A-bide », « Thou~art » : plusieurs syllabes ou mots sous une même note.
    const parts = token.split(/(?<=-)/)
    for (const part of parts) {
      const join = part.endsWith('-')
      const text = part.replace(/-$/, '').replace(/~/g, ' ').replace(/_/g, '').replace(/\u2010/g, '-')
      if (text) out.push({ text, join })
      else if (join && out.length) out[out.length - 1].join = true
    }
  }
  return out
}

/** Recompose les vers d'un couplet à partir de ses syllabes. */
function verseLines(sylls, counts) {
  const words = (list) => {
    let s = ''
    list.forEach((x, i) => (s += (i && !list[i - 1].join ? ' ' : '') + x.text))
    return s.replace(/\s+([,;:.!?])/g, '$1').trim()
  }
  const total = counts?.reduce((a, b) => a + b, 0)
  if (counts && total && sylls.length % total === 0) {
    const lines = []
    let i = 0
    while (i < sylls.length) {
      for (const n of counts) {
        lines.push(words(sylls.slice(i, i + n)))
        i += n
      }
    }
    return lines
  }
  // Mètre absent ou irrégulier : coupe après la ponctuation forte, ou tous les ~8 mots.
  const text = words(sylls)
  return text
    .split(/(?<=[;:.!?])\s+|(?<=,)\s+(?=[A-Z])/)
    .flatMap((l) => (l.split(' ').length > 12 ? l.match(/(\S+\s*){1,8}/g).map((x) => x.trim()) : [l]))
    .filter(Boolean)
}

/** « Lyte, Henry F. (1793-1847) » → « Henry F. Lyte (1793-1847) ». */
function person(raw) {
  if (!raw || /^none$/i.test(raw.trim())) return ''
  return raw
    .split(/\s*;\s*|\s+and\s+/)
    .map((p) => p.replace(/^([^,(]+),\s*([^(]+?)\s*(\(.*\))?$/, (_, last, first, dates) => `${first} ${last}${dates ? ' ' + dates : ''}`))
    .join(', ')
    .trim()
}

function convert(file) {
  const src = readFileSync(file, 'utf8')
  const head = (key) => src.match(new RegExp(`^%${key}\\s+(.+)$`, 'm'))?.[1]?.trim()
  const title = src.match(/^T:\s*(.+)$/m)?.[1]?.trim()
  if (!title) return null
  const counts = meter(head('OHMETRICAL'))

  // Paroles sous la partition : dans chaque suite de lignes « w: », la n-ième est le couplet n.
  const verses = []
  let index = 0
  let previousWasLyrics = false
  for (const line of src.split(/\r?\n/)) {
    const lyrics = /^w:/.test(line)
    if (lyrics) {
      if (!previousWasLyrics) index = 0
      ;(verses[index] ??= []).push(...syllables(line.slice(2)))
      index++
    }
    previousWasLyrics = lyrics
  }
  const stanzas = verses.filter((v) => v?.length).map((v) => verseLines(v, counts))

  // Couplets écrits après la partition.
  const extra = []
  let current = []
  for (const line of src.split(/\r?\n/)) {
    if (!/^W:/.test(line)) continue
    const text = line.slice(2).trim()
    if (!text) {
      if (current.length) extra.push(current)
      current = []
      continue
    }
    current.push(text.replace(/^\d+\.\s*/, ''))
  }
  if (current.length) extra.push(current)

  const all = [...stanzas, ...extra].filter((s) => s.length)
  if (!all.length) return null
  const lyrics = formatStanzas(all)
  return {
    title,
    author: person(head('OHAUTHOR')) + (head('OHTRANSLATOR') && !/^none$/i.test(head('OHTRANSLATOR')) ? ` (trad. ${person(head('OHTRANSLATOR'))})` : ''),
    composer: person(head('OHCOMPOSER')),
    copyright: 'Public domain',
    lyrics
  }
}

const songs = []
const seen = new Set()
for (const dir of readdirSync(root).sort()) {
  const path = join(root, dir)
  if (!statSync(path).isDirectory()) continue
  for (const f of readdirSync(path).filter((f) => f.endsWith('.abc')).sort()) {
    const song = convert(join(path, f))
    if (!song || seen.has(song.title.toLowerCase())) continue
    seen.add(song.title.toLowerCase())
    songs.push(song)
  }
}
songs.sort((a, b) => a.title.localeCompare(b.title, 'en'))
const book = {
  format: 'gospelbox-songbook',
  name: 'Open Hymnal',
  songs: songs.map((s, i) => ({ number: i + 1, ...s }))
}
process.stdout.write(JSON.stringify(book, null, 1) + '\n')
console.error(`${songs.length} cantiques`)
