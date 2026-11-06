/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Creator      : YannRzy Tech
 * Recode       : (Your Name)
 *
 * Developer Channels:
 * • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
 *
 * Info Update Kaguya Channels:
 * • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
 *
 * Copyright © YannRzy Tech 2026
 * All Rights Reserved.
 */

// Helper file: zip, upload, dan tools media.

import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn, spawnSync } from 'child_process'
import { createRequire } from 'module'
import zlib from 'zlib'
import axios from 'axios'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'

const require = createRequire(import.meta.url)

// ╔══════════════ [ file.js ] ══════════════╗

// ───────── zip ─────────
const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[n] = c >>> 0
    }
    return table
})()

// hitung CRC32 untuk ZIP
export function crc32(buffer) {
    let crc = 0xffffffff
    for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
    const year = Math.max(date.getFullYear(), 1980)
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    }
}

function localHeader(entry) {
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x0800, 6)
    header.writeUInt16LE(entry.method, 8)
    header.writeUInt16LE(entry.time, 10)
    header.writeUInt16LE(entry.date, 12)
    header.writeUInt32LE(entry.crc, 14)
    header.writeUInt32LE(entry.packed.length, 18)
    header.writeUInt32LE(entry.size, 22)
    header.writeUInt16LE(entry.name.length, 26)
    header.writeUInt16LE(0, 28)
    return Buffer.concat([header, entry.name])
}

function centralHeader(entry, offset) {
    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(entry.method, 10)
    header.writeUInt16LE(entry.time, 12)
    header.writeUInt16LE(entry.date, 14)
    header.writeUInt32LE(entry.crc, 16)
    header.writeUInt32LE(entry.packed.length, 20)
    header.writeUInt32LE(entry.size, 24)
    header.writeUInt16LE(entry.name.length, 28)
    header.writeUInt32LE(offset, 42)
    return Buffer.concat([header, entry.name])
}

function prepare({ name, data, date = new Date() }) {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')
    const deflated = zlib.deflateRawSync(raw, { level: 9 })
    const useDeflate = deflated.length < raw.length
    const stamp = dosDateTime(date)

    return {
        name: Buffer.from(name, 'utf8'),
        size: raw.length,
        crc: crc32(raw),
        method: useDeflate ? 8 : 0,
        packed: useDeflate ? deflated : raw,
        time: stamp.time,
        date: stamp.date
    }
}

// buat file ZIP dari daftar file (tanpa library)
export function createZip(files) {
    const entries = files.map(prepare)
    const chunks = []
    const central = []
    let offset = 0

    for (const entry of entries) {
        const local = localHeader(entry)
        central.push(centralHeader(entry, offset))
        chunks.push(local, entry.packed)
        offset += local.length + entry.packed.length
    }

    const centralBuffer = Buffer.concat(central)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(entries.length, 8)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(centralBuffer.length, 12)
    end.writeUInt32LE(offset, 16)

    return Buffer.concat([...chunks, centralBuffer, end])
}


// ───────── uploader ─────────
const EXT_MIME = {
    html: 'text/html',
    htm: 'text/html',
    txt: 'text/plain',
    json: 'application/json',
    css: 'text/css',
    js: 'application/javascript',
    csv: 'text/csv',
    svg: 'image/svg+xml'
}

function extOf(fileName) {
    return fileName?.split('.').pop()?.toLowerCase()
}

// unggah file ke hosting sementara, balikan URL
export async function uploadFile(buffer) {
    try {
        let { ext, mime } = (await fileTypeFromBuffer(buffer)) || { ext: 'bin', mime: 'application/octet-stream' }
        const form = new FormData()
        form.append('files[]', buffer, { filename: `myfiles.${ext}`, contentType: mime })
        form.append('expiry', '-1')

        const { data } = await axios.post('https://qu.ax/upload.php', form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        })
        return data.files[0].url
    } catch (error) {
        console.log(error)
    }
}

// ───────── configWriter ─────────
const CONFIG_PATH = './config.js'
const IDENT = /^[A-Za-z_$][\w$]*$/

const read = () => fs.readFileSync(CONFIG_PATH, 'utf-8')
const write = (content) => fs.writeFileSync(CONFIG_PATH, content, 'utf-8')
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isPrimitive = (v) => v === null || typeof v !== 'object'

function formatJs(value, indent = '') {
    const next = indent + '    '

    if (Array.isArray(value)) {
        if (!value.length) return '[]'
        if (value.every(isPrimitive)) return `[${value.map(v => JSON.stringify(v)).join(', ')}]`
        return `[\n${value.map(v => next + formatJs(v, next)).join(',\n')}\n${indent}]`
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
        if (!entries.length) return '{}'
        const body = entries.map(([k, v]) => `${next}${IDENT.test(k) ? k : JSON.stringify(k)}: ${formatJs(v, next)}`)
        return `{\n${body.join(',\n')}\n${indent}}`
    }

    return JSON.stringify(value)
}

function findBlock(content, key) {
    const head = new RegExp(`global\\.${escapeRegex(key)}\\s*=\\s*`).exec(content)
    if (!head) return null

    const start = head.index + head[0].length
    const open = content[start]
    if (open !== '[' && open !== '{') return null

    let depth = 0
    let quote = null

    for (let i = start; i < content.length; i++) {
        const c = content[i]
        const n = content[i + 1]

        if (quote) {
            if (c === '\\') i++
            else if (c === quote) quote = null
            continue
        }

        if (c === '"' || c === "'" || c === '`') {
            quote = c
            continue
        }

        if (c === '/' && n === '/') {
            i = content.indexOf('\n', i)
            if (i === -1) return null
            continue
        }

        if (c === '/' && n === '*') {
            const end = content.indexOf('*/', i + 2)
            if (end === -1) return null
            i = end + 1
            continue
        }

        if (c === '[' || c === '{') depth++
        else if (c === ']' || c === '}') {
            depth--
            if (depth === 0) return { start, end: i + 1 }
        }
    }

    return null
}

function setValue(content, { key, value }) {
    if (!isPrimitive(value)) return setBlock(content, { key, value })

    const regex = new RegExp(`(global\\.${escapeRegex(key)}\\s*=\\s*)(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s;/]+)`)
    if (regex.test(content)) return content.replace(regex, (_, head) => head + JSON.stringify(value))

    return `${content.trimEnd()}\nglobal.${key} = ${JSON.stringify(value)}\n`
}

function setBlock(content, { key, value }) {
    const block = findBlock(content, key)
    if (!block) return null
    return content.slice(0, block.start) + formatJs(value) + content.slice(block.end)
}

function setNested(content, { path, value }) {
    const segments = path.split('.')
    const root = findBlock(content, segments[0])
    if (!root || segments.length < 2) return null

    const field = segments[segments.length - 1]
    const regex = new RegExp(`((?:^|[\\s,{])${escapeRegex(field)}:\\s*)"(?:[^"\\\\]|\\\\.)*"`)
    const section = content.slice(root.start, root.end)
    if (!regex.test(section)) return null

    const updated = section.replace(regex, (_, head) => head + JSON.stringify(value))
    return content.slice(0, root.start) + updated + content.slice(root.end)
}

const TRANSFORMS = { value: setValue, block: setBlock, nested: setNested }

// ubah isi config.js lewat chat (nilai/blok/nested)
export function applyConfigChanges(changes) {
    let content = read()
    const failed = []

    for (const change of changes) {
        const next = TRANSFORMS[change.op]?.(content, change) ?? null
        if (next === null) failed.push(change)
        else content = next
    }

    if (failed.length < changes.length) write(content)
    return { ok: failed.length === 0, failed }
}

// ubah satu nilai di config.js
export const updateConfigValue = (key, value) => applyConfigChanges([{ op: 'value', key, value }]).ok
// ubah satu blok di config.js
export const updateConfigBlock = (key, value) => applyConfigChanges([{ op: 'block', key, value }]).ok


// ───────── tools (helper media & data) ─────────
// Ambil media dari pesan itu sendiri atau pesan yang di-reply (reply diutamakan).
export function pickMedia(m) {
    const q = m.quoted
    if (q?.isMedia && q.download) return { mtype: q.mtype, mime: q.mimetype || '', download: q.download, node: q }
    if (m.isMedia && m.download) return { mtype: m.mtype, mime: m.msg?.mimetype || '', download: m.download, node: m.msg }
    return null
}

// Ambil gambar saja: gambar yang dikirim langsung diutamakan, lalu gambar yang di-reply.
export function pickImage(m) {
    if (m.mtype === 'imageMessage' && m.download) return { mtype: m.mtype, mime: m.msg?.mimetype || 'image/jpeg', download: m.download, node: m.msg }
    if (m.quoted?.mtype === 'imageMessage' && m.quoted.download) return { mtype: m.quoted.mtype, mime: m.quoted.mimetype || 'image/jpeg', download: m.quoted.download, node: m.quoted }
    return null
}

// beri reaksi emoji pada pesan
export async function reactTo(sock, m, emoji) {
    try {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    } catch (e) {}
}

// tabel mime untuk konversi ke file
export const TOFILE_MIME = {
    js: 'application/javascript',
    mjs: 'application/javascript',
    cjs: 'application/javascript',
    ts: 'application/typescript',
    json: 'application/json',
    yml: 'text/yaml',
    yaml: 'text/yaml',
    env: 'text/plain',
    txt: 'text/plain',
    md: 'text/markdown',
    log: 'text/plain',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    xml: 'application/xml',
    sql: 'application/sql',
    db: 'application/octet-stream',
    sqlite: 'application/octet-stream',
    sqlite3: 'application/octet-stream',
    bin: 'application/octet-stream',
    dat: 'application/octet-stream',
    pdf: 'application/pdf'
}

// daftar kode bahasa (terjemahan)
export const KODE_BAHASA = `
af          Afrikaans
ak          Akan
sq          Albanian
am          Amharic
ar          Arabic
hy          Armenian
az          Azerbaijani
eu          Basque
be          Belarusian
bem         Bemba
bn          Bengali
bh          Bihari
xx-bork     Bork, bork, bork!
bs          Bosnian
br          Breton
bg          Bulgarian
km          Cambodian
ca          Catalan
chr         Cherokee
ny          Chichewa
zh-CN       Chinese (Simplified)
zh-TW       Chinese (Traditional)
co          Corsican
hr          Croatian
cs          Czech
da          Danish
nl          Dutch
xx-elmer    Elmer Fudd
en          English
eo          Esperanto
et          Estonian
ee          Ewe
fo          Faroese
tl          Filipino
fi          Finnish
fr          French
fy          Frisian
gaa         Ga
gl          Galician
ka          Georgian
de          German
el          Greek
gn          Guarani
gu          Gujarati
xx-hacker   Hacker
ht          Haitian Creole
ha          Hausa
haw         Hawaiian
iw          Hebrew
hi          Hindi
hu          Hungarian
is          Icelandic
ig          Igbo
id          Indonesian
ia          Interlingua
ga          Irish
it          Italian
ja          Japanese
jw          Javanese
kn          Kannada
kk          Kazakh
rw          Kinyarwanda
rn          Kirundi
xx-klingon  Klingon
kg          Kongo
ko          Korean
kri         Krio (Sierra Leone)
ku          Kurdish
ckb         Kurdish (Soranî)
ky          Kyrgyz
lo          Laothian
la          Latin
lv          Latvian
ln          Lingala
lt          Lithuanian
loz         Lozi
lg          Luganda
ach         Luo
mk          Macedonian
mg          Malagasy
ms          Malay
ml          Malayalam
mt          Maltese
mi          Maori
mr          Marathi
mfe         Mauritian Creole
mo          Moldavian
mn          Mongolian
sr-ME       Montenegrin
ne          Nepali
pcm         Nigerian Pidgin
nso         Northern Sotho
no          Norwegian
nn          Norwegian (Nynorsk)
oc          Occitan
or          Oriya
om          Oromo
ps          Pashto
fa          Persian
xx-pirate   Pirate
pl          Polish
pt-BR       Portuguese (Brazil)
pt-PT       Portuguese (Portugal)
pa          Punjabi
qu          Quechua
ro          Romanian
rm          Romansh
nyn         Runyakitara
ru          Russian
gd          Scots Gaelic
sr          Serbian
sh          Serbo-Croatian
st          Sesotho
tn          Setswana
crs         Seychellois Creole
sn          Shona
sd          Sindhi
si          Sinhalese
sk          Slovak
sl          Slovenian
so          Somali
es          Spanish
es-419      Spanish (Latin American)
su          Sundanese
sw          Swahili
sv          Swedish
tg          Tajik
ta          Tamil
tt          Tatar
te          Telugu
th          Thai
ti          Tigrinya
to          Tonga
lua         Tshiluba
tum         Tumbuka
tr          Turkish
tk          Turkmen
tw          Twi
ug          Uighur
uk          Ukrainian
ur          Urdu
uz          Uzbek
vi          Vietnamese
cy          Welsh
wo          Wolof
xh          Xhosa
yi          Yiddish
yo          Yoruba
zu          Zulu
`


// ═══════════════════════════════════════════════════════════════════════════
//  DOKUMEN (plugins/dokumen) — helper dokumen, digabung di sini:
//  ffm, du(docutil), pool, kit, pdfdoc, numwords, uitext, io(blurFit), dokumenMulti
//  Butuh paket: pdf-lib, jszip, sharp, @napi-rs/canvas  |  program: ffmpeg (opsional)
// ═══════════════════════════════════════════════════════════════════════════

// ambil media dari pesan / reply -> { buffer, info:{mimetype,fileName}, type } (null kalau tidak ada / tipe tidak cocok)
async function dokGetMedia(sock, m, types) {
    const p = pickMedia(m)
    if (!p || (types && !types.includes(p.mtype))) return null
    const buffer = await p.download()
    if (!buffer || !buffer.length) return null
    return { buffer, info: { mimetype: p.mime || p.node?.mimetype || '', fileName: p.node?.fileName || '' }, type: p.mtype }
}

export const ffm = (() => {

// Jalankan ffmpeg pada buffer masukan -> buffer keluaran. buildArgs(inFile, outFile) -> array argumen
async function run(buffer, outExt, buildArgs, timeoutMs = 90000) {
  const id = `ffm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const input = path.join(os.tmpdir(), `${id}.in`)
  const output = path.join(os.tmpdir(), `${id}.${outExt}`)
  try {
    fs.writeFileSync(input, buffer)
    await new Promise((resolve, reject) => {
      const p = spawn('ffmpeg', ['-y', ...buildArgs(input, output)], { stdio: ['ignore', 'ignore', 'pipe'] })
      let err = ''
      p.stderr.on('data', (d) => { err = (err + d).slice(-600) })
      const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('timeout')) }, timeoutMs)
      p.on('error', (e) => { clearTimeout(t); reject(e.code === 'ENOENT' ? new Error('nff') : e) })
      p.on('close', (c) => { clearTimeout(t); c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err.trim().split('\n').slice(-3).join(' | ')}`)) })
    })
    return fs.readFileSync(output)
  } finally {
    for (const f of [input, output]) fs.rmSync(f, { force: true })
  }
}
const explain = (e) => (e.message === 'nff' ? 'ffmpeg belum terpasang di server (sudo apt install ffmpeg).' : e.message === 'timeout' ? 'Proses terlalu lama.' : 'Gagal memproses media.')

// Beberapa buffer masukan -> satu keluaran. buildArgs(inputs[], out) -> argumen ffmpeg
async function runMulti(buffers, outExt, buildArgs, timeoutMs = 120000) {
  const id = `ffm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const inputs = buffers.map((_, i) => path.join(os.tmpdir(), `${id}.in${i}`))
  const output = path.join(os.tmpdir(), `${id}.${outExt}`)
  try {
    buffers.forEach((b, i) => fs.writeFileSync(inputs[i], b))
    await new Promise((resolve, reject) => {
      const p = spawn('ffmpeg', ['-y', ...buildArgs(inputs, output)], { stdio: ['ignore', 'ignore', 'pipe'] })
      let err = ''
      p.stderr.on('data', (d) => { err = (err + d).slice(-600) })
      const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('timeout')) }, timeoutMs)
      p.on('error', (e) => { clearTimeout(t); reject(e.code === 'ENOENT' ? new Error('nff') : e) })
      p.on('close', (c) => { clearTimeout(t); c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err.trim().split('\n').slice(-3).join(' | ')}`)) })
    })
    return fs.readFileSync(output)
  } finally {
    for (const f of [...inputs, output]) fs.rmSync(f, { force: true })
  }
}

// Durasi media (detik, dibulatkan) lewat ffprobe. 0 kalau gagal.
async function duration(buffer) {
  const f = path.join(os.tmpdir(), `ffp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.in`)
  try {
    fs.writeFileSync(f, buffer)
    return await new Promise((resolve) => {
      const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f])
      let out = ''
      p.stdout.on('data', (d) => (out += d))
      p.on('error', () => resolve(0))
      p.on('close', () => resolve(Math.round(parseFloat(out)) || 0))
    })
  } finally {
    fs.rmSync(f, { force: true })
  }
}

return { run, runMulti, explain, duration }

})()

export const du = (() => {
  const getMedia = dokGetMedia
// lib/docutil.js — helper dokumen: cari program eksternal, folder sementara, deteksi jenis file, ambil dokumen dari pesan


const found = new Map()
function which(cmd) {
  if (found.has(cmd)) return found.get(cmd)
  let ok = false
  try {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' })
    ok = r.status === 0
  } catch {}
  found.set(cmd, ok)
  return ok
}

// jalankan program; -> { code, out, err }
function exec(cmd, args, { timeout = 120000, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env } })
    let out = Buffer.alloc(0)
    let err = ''
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })) }, timeout)
    p.stdout.on('data', (d) => { if (out.length < 20 * 1024 * 1024) out = Buffer.concat([out, d]) })
    p.stderr.on('data', (d) => { if (err.length < 8000) err += d })
    p.on('error', (e) => { clearTimeout(t); reject(e) })
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }) })
  })
}

async function withTmp(fn) {
  const __base = path.join(process.cwd(), 'database', 'tmp')
  fs.mkdirSync(__base, { recursive: true })
  const dir = fs.mkdtempSync(path.join(__base, 'vx-'))
  try {
    return await fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// deteksi jenis dari isi file
function sniff(b) {
  if (!b || b.length < 4) return { ext: 'bin', mime: 'application/octet-stream', kind: 'unknown', label: 'Tidak dikenali' }
  const h = b.subarray(0, 16)
  const s = (from, str) => h.subarray(from, from + str.length).toString('latin1') === str
  if (s(0, '%PDF')) return { ext: 'pdf', mime: 'application/pdf', kind: 'pdf', label: 'Dokumen PDF' }
  if (s(0, '\x89PNG')) return { ext: 'png', mime: 'image/png', kind: 'image', label: 'Gambar PNG' }
  if (h[0] === 0xff && h[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg', kind: 'image', label: 'Gambar JPEG' }
  if (s(0, 'GIF8')) return { ext: 'gif', mime: 'image/gif', kind: 'image', label: 'Gambar GIF' }
  if (s(0, 'RIFF') && b.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', mime: 'image/webp', kind: 'image', label: 'Gambar WebP' }
  if (s(0, 'RIFF') && b.subarray(8, 12).toString('latin1') === 'WAVE') return { ext: 'wav', mime: 'audio/wav', kind: 'audio', label: 'Audio WAV' }
  if (s(0, 'BM')) return { ext: 'bmp', mime: 'image/bmp', kind: 'image', label: 'Gambar BMP' }
  if (s(0, 'ID3') || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) return { ext: 'mp3', mime: 'audio/mpeg', kind: 'audio', label: 'Audio MP3' }
  if (s(0, 'OggS')) return { ext: 'ogg', mime: 'audio/ogg', kind: 'audio', label: 'Audio OGG' }
  if (s(0, 'fLaC')) return { ext: 'flac', mime: 'audio/flac', kind: 'audio', label: 'Audio FLAC' }
  if (s(4, 'ftyp')) return { ext: /M4A/.test(b.subarray(8, 12).toString('latin1')) ? 'm4a' : 'mp4', mime: /M4A/.test(b.subarray(8, 12).toString('latin1')) ? 'audio/mp4' : 'video/mp4', kind: /M4A/.test(b.subarray(8, 12).toString('latin1')) ? 'audio' : 'video', label: 'Video/Audio MP4' }
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return { ext: 'webm', mime: 'video/webm', kind: 'video', label: 'Video WebM/MKV' }
  if (s(0, 'PK\x03\x04')) {
    const head = b.subarray(0, 4000).toString('latin1')
    if (head.includes('word/')) return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'office', label: 'Word (DOCX)' }
    if (head.includes('xl/')) return { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'office', label: 'Excel (XLSX)' }
    if (head.includes('ppt/')) return { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'office', label: 'PowerPoint (PPTX)' }
    return { ext: 'zip', mime: 'application/zip', kind: 'zip', label: 'Arsip ZIP' }
  }
  if (s(0, 'Rar!')) return { ext: 'rar', mime: 'application/vnd.rar', kind: 'archive', label: 'Arsip RAR' }
  if (s(0, '7z')) return { ext: '7z', mime: 'application/x-7z-compressed', kind: 'archive', label: 'Arsip 7z' }
  if (h[0] === 0x1f && h[1] === 0x8b) return { ext: 'gz', mime: 'application/gzip', kind: 'archive', label: 'Arsip GZIP' }
  if (s(0, 'SQLite')) return { ext: 'db', mime: 'application/vnd.sqlite3', kind: 'data', label: 'Database SQLite' }
  const text = b.subarray(0, 2000)
  if (!text.includes(0)) {
    const t = text.toString('utf8').trimStart()
    if (/^[{[]/.test(t)) return { ext: 'json', mime: 'application/json', kind: 'text', label: 'Teks JSON' }
    if (/^<(!doctype html|html)/i.test(t)) return { ext: 'html', mime: 'text/html', kind: 'text', label: 'Halaman HTML' }
    if (/^<\?xml|^<[a-z]/i.test(t)) return { ext: 'xml', mime: 'application/xml', kind: 'text', label: 'Teks XML' }
    return { ext: 'txt', mime: 'text/plain', kind: 'text', label: 'Teks biasa' }
  }
  return { ext: 'bin', mime: 'application/octet-stream', kind: 'unknown', label: 'Biner / tidak dikenali' }
}

const safeName = (n, fallback = 'file') => String(n || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || fallback

// Ambil file apa pun (dokumen/gambar/video/audio/stiker) dari pesan atau reply -> { buffer, name, mime, sniff }
async function getFile(sock, msg) {
  const m = await getMedia(sock, msg, ['documentMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'])
  if (!m) return null
  if (m.buffer.length > 80 * 1024 * 1024) throw Object.assign(new Error('file besar'), { userMessage: 'File terlalu besar (maks 80 MB).' })
  const sn = sniff(m.buffer)
  const mime = m.info?.mimetype || sn.mime
  const name = safeName(m.info?.fileName || `file.${sn.ext}`)
  return { buffer: m.buffer, name, mime, sniff: sn, type: m.type }
}

// "1-3,5,8-" -> [1,2,3,5,8,...] (1-based), dibatasi 1..total
function parseRange(spec, total) {
  const out = []
  const s = String(spec || '').replace(/\s+/g, '')
  if (!s || /^(semua|all)$/i.test(s)) return Array.from({ length: total }, (_, i) => i + 1)
  for (const part of s.split(',')) {
    const m = part.match(/^(\d+)(?:-(\d*))?$/)
    if (!m) throw Object.assign(new Error('range'), { userMessage: `Rentang halaman "${part}" tidak valid. Contoh: 1-3,5` })
    const a = Number(m[1])
    const b = m[2] === undefined ? a : m[2] === '' ? total : Number(m[2])
    if (a < 1 || a > total || b < a || b > total) throw Object.assign(new Error('range'), { userMessage: `Halaman di luar jangkauan (dokumen punya ${total} halaman).` })
    for (let i = a; i <= b; i++) out.push(i)
  }
  return out
}

return { which, exec, withTmp, sniff, safeName, getFile, parseRange }

})()

const __pool = (() => {
// lib/pool.js — "keranjang" media per pengguna: kumpulkan beberapa gambar/PDF/video/audio, lalu olah sekaligus

const userOf = (s) => String(s || '').split('@')[0].split(':')[0]

const MAX_ITEMS = 20
const MAX_BYTES = 80 * 1024 * 1024
const TTL = 60 * 60 * 1000
const pools = new Map()

function sweep() {
  const now = Date.now()
  for (const [k, v] of pools) if (now - v.at > TTL) pools.delete(k)
}
const key = (sender) => userOf(sender)

const pool = {
  list(sender) {
    sweep()
    return pools.get(key(sender))?.items || []
  },
  add(sender, item) {
    sweep()
    const k = key(sender)
    const p = pools.get(k) || { items: [], at: Date.now() }
    if (p.items.length >= MAX_ITEMS) throw Object.assign(new Error('penuh'), { userMessage: `Keranjang penuh (maks ${MAX_ITEMS} file). Olah dulu atau kosongkan dengan .kumpul reset` })
    if (p.items.reduce((s, i) => s + i.buffer.length, 0) + item.buffer.length > MAX_BYTES) throw Object.assign(new Error('besar'), { userMessage: 'Total ukuran keranjang melebihi 80 MB.' })
    p.items.push(item)
    p.at = Date.now()
    pools.set(k, p)
    return p.items.length
  },
  remove(sender, n) {
    const p = pools.get(key(sender))
    if (!p || n < 1 || n > p.items.length) return false
    p.items.splice(n - 1, 1)
    return true
  },
  clear(sender) {
    pools.delete(key(sender))
  }
}

return { pool, MAX_ITEMS }

})()
export const pool = __pool.pool

export const kit = (() => {
  const getMedia = dokGetMedia
// lib/kit.js — helper bersama untuk paket fitur baru (editor gambar, efek audio, editor video, dll)


const MB = 1024 * 1024
const LIMITS = { image: 15 * MB, audio: 30 * MB, video: 60 * MB }

// ---------- antrian: ffmpeg/sharp berat dijalankan maksimal N sekaligus ----------
let running = 0
const waiting = []
async function queue(fn, max = 2) {
  if (running >= max) await new Promise((r) => waiting.push(r))
  running++
  try {
    return await fn()
  } finally {
    running--
    const next = waiting.shift()
    if (next) next()
  }
}

// ---------- ambil media dari pesan / reply ----------
const IMG_TYPES = ['imageMessage', 'stickerMessage', 'documentMessage']
async function getImage(sock, msg) {
  const m = await getMedia(sock, msg, IMG_TYPES)
  if (!m) return null
  const mime = String(m.info?.mimetype || '')
  if (m.type === 'documentMessage' && !/^image\//i.test(mime)) return null
  if (m.buffer.length > LIMITS.image) throw new Error(`Gambar terlalu besar (maks ${LIMITS.image / MB} MB).`)
  return m
}
async function getAudio(sock, msg) {
  const m = await getMedia(sock, msg, ['audioMessage', 'videoMessage', 'documentMessage'])
  if (!m) return null
  const mime = String(m.info?.mimetype || '')
  if (m.type === 'documentMessage' && !/^(audio|video)\//i.test(mime)) return null
  if (m.buffer.length > LIMITS.audio * 2) throw new Error(`File terlalu besar (maks ${LIMITS.audio * 2 / MB} MB).`)
  return m
}
async function getVideo(sock, msg) {
  const m = await getMedia(sock, msg, ['videoMessage', 'documentMessage'])
  if (!m) return null
  const mime = String(m.info?.mimetype || '')
  if (m.type === 'documentMessage' && !/^video\//i.test(mime)) return null
  if (m.buffer.length > LIMITS.video) throw new Error(`Video terlalu besar (maks ${LIMITS.video / MB} MB).`)
  return m
}

// ---------- ffprobe ----------
function probe(buffer) {
  const fs = require('fs')
  const os = require('os')
  const path = require('path')
  const { spawn } = require('child_process')
  const f = path.join(os.tmpdir(), `kit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.in`)
  fs.writeFileSync(f, buffer)
  return new Promise((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', f])
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('error', () => resolve(null))
    p.on('close', () => {
      fs.rmSync(f, { force: true })
      try {
        const j = JSON.parse(out)
        const v = (j.streams || []).find((s) => s.codec_type === 'video')
        const a = (j.streams || []).find((s) => s.codec_type === 'audio')
        const fr = v?.avg_frame_rate && v.avg_frame_rate.includes('/') ? v.avg_frame_rate.split('/').map(Number) : null
        resolve({
          duration: parseFloat(j.format?.duration) || parseFloat(v?.duration) || parseFloat(a?.duration) || 0,
          bitrate: parseInt(j.format?.bit_rate, 10) || 0,
          size: parseInt(j.format?.size, 10) || buffer.length,
          format: j.format?.format_long_name || j.format?.format_name || '',
          video: v ? { codec: v.codec_name, width: v.width, height: v.height, fps: fr && fr[1] ? Math.round((fr[0] / fr[1]) * 100) / 100 : 0 } : null,
          audio: a ? { codec: a.codec_name, rate: parseInt(a.sample_rate, 10) || 44100, channels: a.channels, bitrate: parseInt(a.bit_rate, 10) || 0 } : null
        })
      } catch {
        resolve(null)
      }
    })
  })
}

// "1:30" / "90" / "1:02:03.5" / "1m30s" -> detik (null kalau tidak valid)
function parseTime(s) {
  s = String(s || '').trim().toLowerCase()
  if (!s) return null
  let m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s?)?$/)
  if (m && /[hms]/.test(s)) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)
  m = s.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/)
  if (m) return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
  m = s.match(/^(\d+(?:[.,]\d+)?)$/)
  return m ? Number(m[1].replace(',', '.')) : null
}
const fmtTime = (sec) => {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
const fmtSize = (b) => (b >= MB ? `${(b / MB).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const numArg = (v, def, lo, hi) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? clamp(n, lo, hi) : def
}

// ---------- kirim ----------
const sendImage = (sock, from, msg, image, caption = '') => sock.sendMessage(from, { image, caption }, { quoted: msg })
const sendVideo = (sock, from, msg, video, caption = '', gif = false) => sock.sendMessage(from, { video, caption, ...(gif ? { gifPlayback: true } : {}) }, { quoted: msg })
const sendAudio = (sock, from, msg, audio, ptt = false) =>
  sock.sendMessage(from, ptt ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg' }, { quoted: msg })

// pesan kesalahan ramah
const explain = (err) => (err && ['nff', 'timeout'].includes(err.message) ? ffm.explain(err) : err && /terlalu besar/.test(err.message) ? err.message : 'Gagal memproses file. Pastikan formatnya benar.')

// teks setelah nama perintah (selalu utuh, termasuk baris baru)
const rest = (body) => String(body || '').replace(/^\S+[ \t]*/, '')


return { MB, LIMITS, queue, getImage, getAudio, getVideo, probe, parseTime, fmtTime, fmtSize, clamp, numArg, sendImage, sendVideo, sendAudio, explain, rest, ffm }

})()

export const pdfdoc = (() => {
// lib/pdfdoc.js — penulis dokumen PDF sederhana (pdf-lib): teks berbungkus, perataan, tabel, ganti halaman otomatis

const MAP = { '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '…': '...', '•': '-', '×': 'x', '→': '->', '₹': 'Rp', ' ': ' ' }
// huruf standar PDF hanya mendukung Latin-1: ganti karakter lain agar tidak error
const safe = (t) => String(t ?? '').replace(/[“”‘’–—…•×→ ]/g, (c) => MAP[c]).replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '')

async function create() {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
  const doc = await PDFDocument.create()
  const F = { r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique), bi: await doc.embedFont(StandardFonts.HelveticaBoldOblique) }
  return { doc, F, rgb }
}
const hex = (rgb, h) => { const n = parseInt(h.replace('#', ''), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) }

function wrap(font, size, maxW, text) {
  const lines = []
  for (const para of safe(text).split('\n')) {
    let cur = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = cur ? `${cur} ${word}` : word
      if (font.widthOfTextAtSize(t, size) <= maxW) cur = t
      else {
        if (cur) lines.push(cur)
        cur = word
        while (font.widthOfTextAtSize(cur, size) > maxW && cur.length > 1) {
          let k = cur.length - 1
          while (k > 1 && font.widthOfTextAtSize(cur.slice(0, k), size) > maxW) k--
          lines.push(cur.slice(0, k))
          cur = cur.slice(k)
        }
      }
    }
    lines.push(cur)
  }
  return lines
}

class Pen {
  constructor(ctx, { w = 595.28, h = 841.89, left = 60, right = 60, top = 60, bottom = 60 } = {}) {
    Object.assign(this, ctx, { W: w, H: h, left, right, top, bottom })
    this.newPage()
  }
  newPage() {
    this.page = this.doc.addPage([this.W, this.H])
    this.y = this.H - this.top
    return this.page
  }
  get width() { return this.W - this.left - this.right }
  need(h) { if (this.y - h < this.bottom) this.newPage() }
  gap(n = 8) { this.y -= n }
  // teks berbungkus; align: left|center|right; kembalikan tinggi yang dipakai
  text(str, { size = 11, font = 'r', color = '#111111', align = 'left', x = this.left, width = this.width, lh = 1.4, after = 0 } = {}) {
    const f = this.F[font]
    const lines = wrap(f, size, width, str)
    for (const ln of lines) {
      this.need(size * lh)
      const tw = f.widthOfTextAtSize(ln, size)
      const px = align === 'center' ? x + (width - tw) / 2 : align === 'right' ? x + width - tw : x
      this.page.drawText(ln, { x: px, y: this.y - size, size, font: f, color: hex(this.rgb, color) })
      this.y -= size * lh
    }
    this.y -= after
    return lines.length
  }
  line(color = '#cccccc', t = 0.8, gapAfter = 8) {
    this.page.drawLine({ start: { x: this.left, y: this.y }, end: { x: this.W - this.right, y: this.y }, thickness: t, color: hex(this.rgb, color) })
    this.y -= gapAfter
  }
  rect(x, y, w, h, color, opts = {}) { this.page.drawRectangle({ x, y, width: w, height: h, color: color ? hex(this.rgb, color) : undefined, borderColor: opts.border ? hex(this.rgb, opts.border) : undefined, borderWidth: opts.bw || 0 }) }
  // baris bertabel: cols = [{ w, text, align, font, color }]
  row(cols, { size = 10, pad = 6, bg, minH = 0, border } = {}) {
    const cells = cols.map((c) => ({ ...c, lines: wrap(this.F[c.font || 'r'], size, c.w - pad * 2, c.text) }))
    const h = Math.max(minH, ...cells.map((c) => c.lines.length * size * 1.35 + pad * 2))
    this.need(h)
    let x = this.left
    const top = this.y
    for (const c of cells) {
      if (bg) this.rect(x, top - h, c.w, h, bg)
      if (border) this.rect(x, top - h, c.w, h, null, { border, bw: 0.6 })
      let ty = top - pad
      for (const ln of c.lines) {
        const f = this.F[c.font || 'r']
        const tw = f.widthOfTextAtSize(ln, size)
        const px = c.align === 'right' ? x + c.w - pad - tw : c.align === 'center' ? x + (c.w - tw) / 2 : x + pad
        this.page.drawText(ln, { x: px, y: ty - size, size, font: f, color: hex(this.rgb, c.color || '#111111') })
        ty -= size * 1.35
      }
      x += c.w
    }
    this.y = top - h
    return h
  }
  async save() { return Buffer.from(await this.doc.save()) }
}

return { create, Pen, safe, wrap, hex }

})()

export const numwords = (() => {
// lib/numwords.js — angka -> kata bahasa Indonesia
const S = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
function say(n) {
  n = Math.floor(n)
  if (n < 12) return S[n]
  if (n < 20) return `${say(n - 10)} belas`
  if (n < 100) return `${S[Math.floor(n / 10)]} puluh${n % 10 ? ` ${S[n % 10]}` : ''}`
  if (n < 200) return `seratus${n - 100 ? ` ${say(n - 100)}` : ''}`
  if (n < 1000) return `${S[Math.floor(n / 100)]} ratus${n % 100 ? ` ${say(n % 100)}` : ''}`
  if (n < 2000) return `seribu${n - 1000 ? ` ${say(n - 1000)}` : ''}`
  if (n < 1e6) return `${say(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${say(n % 1000)}` : ''}`
  for (const [v, w] of [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta']]) if (n >= v) return `${say(Math.floor(n / v))} ${w}${n % v ? ` ${say(n % v)}` : ''}`
  return ''
}
const terbilang = (n) => (Math.floor(n) === 0 ? 'nol' : say(Math.abs(Math.floor(n))))
return { terbilang }

})()

export const uitext = (() => {
// lib/uitext.js — helper teks bergaya panel (sama dengan tampilan .menu) + parser angka/uang
const line = '──────────────────────'

// panel('JUDUL', [{ head: '📊 *INFO*', lines: ['A : 1'], bullet: '➥', plain: false }], { intro, tip })
function panel(title, sections = [], { intro, tip } = {}) {
  const out = [`> ―――《 ❝ ${title} ❞ 》―――`]
  if (intro) out.push(...[].concat(intro).map((l) => `> ${l}`))
  for (const s of sections.filter((x) => x && x.lines && x.lines.length)) {
    out.push('')
    if (s.head) out.push(`> [ ${s.head} ]`)
    for (const l of s.lines) out.push(s.plain ? `> ${l}` : `> ${s.bullet || '➥'} ${l}`)
  }
  if (tip) out.push('', `> ${line}`, `> ${tip}`)
  return out.join('\n')
}

const rp = (n) => `Rp${Math.round(n).toLocaleString('id-ID')}`
const num = (n, d = 2) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: d })

// "500rb", "1,5jt", "2.5jt", "1.500.000", "Rp2m" -> angka (null kalau tidak valid)
const UNIT = { k: 1e3, rb: 1e3, ribu: 1e3, jt: 1e6, juta: 1e6, m: 1e9, miliar: 1e9, t: 1e12, triliun: 1e12 }
function parseMoney(raw) {
  let s = String(raw ?? '').toLowerCase().replace(/rp\.?/g, '').replace(/\s+/g, '')
  const m = s.match(/^([\d.,]+)(k|rb|ribu|jt|juta|m|miliar|t|triliun)?$/)
  if (!m) return null
  let n = m[1]
  if (/^\d{1,3}(\.\d{3})+$/.test(n)) n = n.replace(/\./g, '') // 1.500.000 (pemisah ribuan)
  else if (/^\d{1,3}(,\d{3})+$/.test(n)) n = n.replace(/,/g, '')
  else n = n.replace(',', '.')
  const v = Number(n) * (UNIT[m[2]] || 1)
  return Number.isFinite(v) && v >= 0 ? v : null
}

// angka biasa dengan koma/titik desimal
const parseNum = (raw) => {
  const v = Number(String(raw ?? '').replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

return { line, panel, rp, num, parseMoney, parseNum }

})()

export const io = {
    // gambar di tengah dengan latar blur versi dirinya sendiri (ukuran W x H)
    async blurFit(b, W, H) {
        const sharp = require('sharp')
        const n = await sharp(b).rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true }).toBuffer()
        const bg = await sharp(n).resize(W, H, { fit: 'cover' }).blur(40).modulate({ brightness: 0.75 }).toBuffer()
        const fg = await sharp(n).resize(W, H, { fit: 'inside' }).toBuffer()
        const fm = await sharp(fg).metadata()
        return sharp(bg).composite([{ input: fg, left: Math.floor((W - fm.width) / 2), top: Math.floor((H - fm.height) / 2) }]).jpeg({ quality: 92 }).toBuffer()
    }
}

// pabrik plugin multi-perintah -> handler Kaguya
// specs: { perintah: { desc, usage, example, needs: 'image'|'audio'|'video'|'file'|'pdf', args, optional, heavy, run(c, media) -> hasil } }
// hasil: string | { text } | { image, caption } | { images, caption } | { document, mimetype, fileName, caption } | { documents: [{buffer,name,mime,caption}] } | { audio, ptt } | { video, caption, gif }
export function dokumenMulti({ name, specs, alias = {} }) {
    const NEED = { image: 'gambar/stiker', audio: 'audio/VN/video', video: 'video', file: 'file/dokumen', pdf: 'file PDF' }
    const getPdf = async (sock, msg) => {
        const f = await du.getFile(sock, msg)
        if (f && f.sniff.kind !== 'pdf') throw Object.assign(new Error('bukan pdf'), { userMessage: 'File itu bukan PDF.' })
        return f
    }
    const GET = { image: kit.getImage, audio: kit.getAudio, video: kit.getVideo, file: du.getFile, pdf: getPdf }

    const handler = async (m, ctx) => {
        const { sock, text = '', prefix, command, reply, sender, isOwner, isAdmin } = ctx
        const key = specs[command] ? command : alias[command]
        const spec = specs[key]
        if (!spec) return
        const c = {
            sock, msg: m, from: m.chat, command, prefix, reply, sender, isOwner, isAdmin, isGroup: m.isGroup,
            react: e => reactTo(sock, m, e), text, body: `${prefix}${command} ${text}`,
            args: String(text).trim().split(/\s+/).filter(Boolean), config: {}
        }
        let media = null
        if (spec.needs) {
            try { media = await GET[spec.needs](sock, m) } catch (err) { return reply(`❌ ${err.userMessage || kit.explain(err)}`) }
            if (!media) return reply(`Kirim atau reply ${NEED[spec.needs]} dengan caption ${prefix}${command}${spec.usage ? ` ${spec.usage}` : ''}\n\n${spec.desc}${spec.example ? `\nContoh: ${prefix}${command} ${spec.example}` : ''}`)
        } else if (spec.args && !text.trim() && !spec.optional) {
            return reply(`${spec.desc}\n\nCara pakai: ${prefix}${command} ${spec.usage || ''}${spec.example ? `\nContoh: ${prefix}${command} ${spec.example}` : ''}`)
        }
        if (spec.heavy) await c.react('⏳')
        let res
        try {
            res = await (spec.heavy ? kit.queue(() => spec.run(c, media)) : spec.run(c, media))
        } catch (err) {
            console.log(`[${name.toUpperCase()}] ${command}:`, err.message)
            return reply(`❌ ${err.userMessage || kit.explain(err)}`)
        }
        if (res == null) return
        if (typeof res === 'string') return reply(res)
        const q = { quoted: m }
        const to = m.chat
        const pause = () => new Promise(r => setTimeout(r, 700))
        if (res.text) return reply(res.text)
        if (res.images) {
            for (let i = 0; i < res.images.length; i++) {
                await sock.sendMessage(to, { image: res.images[i], caption: res.captions ? res.captions[i] : res.caption || '' }, q)
                if (res.images.length > 1) await pause()
            }
            return
        }
        if (res.documents) {
            for (const d of res.documents) {
                await sock.sendMessage(to, { document: d.buffer, mimetype: d.mime, fileName: d.name, caption: d.caption || '' }, q)
                if (res.documents.length > 1) await pause()
            }
            return
        }
        if (res.image) return sock.sendMessage(to, { image: res.image, caption: res.caption || '' }, q)
        if (res.document) return sock.sendMessage(to, { document: res.document, mimetype: res.mimetype, fileName: res.fileName, caption: res.caption || '' }, q)
        if (res.audio) return kit.sendAudio(sock, to, m, res.audio, !!res.ptt)
        if (res.video) return kit.sendVideo(sock, to, m, res.video, res.caption || '', !!res.gif)
    }
    handler.command = [...Object.keys(specs), ...Object.keys(alias)]
    handler.help = Object.keys(specs)
    handler.tags = ['convert']
    return handler
}
