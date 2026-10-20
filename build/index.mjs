// Régénère index.json, l'index lu par GospelBox, à partir des recueils de songbooks/ et de leurs
// métadonnées (build/catalog.json). Usage : node build/index.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const meta = JSON.parse(readFileSync('build/catalog.json', 'utf8'))
const previous = (() => {
  try {
    return Object.fromEntries(JSON.parse(readFileSync('index.json', 'utf8')).songbooks.map((s) => [s.id, s]))
  } catch {
    return {}
  }
})()
const today = new Date().toISOString().slice(0, 10)

const songbooks = readdirSync('songbooks')
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const id = f.replace(/\.json$/, '')
    const raw = readFileSync(`songbooks/${f}`, 'utf8')
    const book = JSON.parse(raw)
    if (!meta[id]) throw new Error(`Métadonnées manquantes pour ${id} dans build/catalog.json`)
    const entry = { id, name: book.name, ...meta[id], songs: book.songs.length, file: `songbooks/${f}` }
    // La date ne change que si le recueil a changé.
    const old = previous[id]
    const same = old && old.songs === entry.songs && old.size === raw.length
    return { ...entry, size: raw.length, updated: same ? old.updated : today }
  })

writeFileSync('index.json', JSON.stringify({ version: 1, songbooks }, null, 2) + '\n')
console.log(songbooks.map((s) => `${s.id} : ${s.songs} chants`).join('\n'))
