// Convertit « Hymns and Spiritual Songs » d'Isaac Watts (Project Gutenberg n° 13341, domaine public)
// en recueil GospelBox. Usage : node build/watts.mjs pg13341.txt > songbooks/watts-hymns.json
//
// Chaque cantique commence par « Hymn 1:1. », suivi d'un sous-titre, d'une référence biblique et
// des strophes numérotées (« 1 Behold the glories of the Lamb »). Les crochets marquent les strophes
// facultatives : ils sont retirés.

import { readFileSync } from 'node:fs'
import { formatStanzas } from './lib/lyrics.mjs'

const src = readFileSync(process.argv[2], 'utf8').replace(/\r\n?/g, '\n')
const body = src.slice(src.indexOf('\nHymn 1:1.'), src.indexOf('*** END'))
const parts = body.split(/\n(?=Hymn \d+:\d+\.)/).filter((p) => p.trim().startsWith('Hymn'))

const songs = []
for (const part of parts) {
  const [head, ...rest] = part.trim().split('\n')
  const ref = head.match(/^Hymn (\d+):(\d+)/)
  const stanzas = []
  for (const block of rest.join('\n').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length || !/^\d+\s/.test(lines[0])) continue
    lines[0] = lines[0].replace(/^\d+\s+/, '')
    stanzas.push(lines.map((l) => l.replace(/[[\]]/g, '').replace(/\s{2,}/g, ' ')))
  }
  if (!stanzas.length) continue
  const first = stanzas[0][0].replace(/[,;:.!?]+$/, '')
  songs.push({
    title: first,
    author: 'Isaac Watts (1674-1748)',
    copyright: `Public domain · Hymns and Spiritual Songs, livre ${ref[1]}, n° ${ref[2]}`,
    lyrics: formatStanzas(stanzas)
  })
}
const book = {
  format: 'gospelbox-songbook',
  name: 'Isaac Watts – Hymns and Spiritual Songs',
  songs: songs.map((s, i) => ({ number: i + 1, ...s }))
}
process.stdout.write(JSON.stringify(book, null, 1) + '\n')
console.error(`${songs.length} cantiques`)
