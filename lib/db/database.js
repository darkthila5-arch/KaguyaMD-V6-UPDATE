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

// Database utama bot (SQLite, otomatis JSON kalau SQLite tidak ada).

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { createRequire } from 'module'
import { isDeepStrictEqual } from 'util'

export const DB_DIR = './database'
export const DB_SUB = {
    logs: path.join(DB_DIR, 'logs'),
    runtime: path.join(DB_DIR, 'runtime'),
    media: path.join(DB_DIR, 'media'),
    backup: path.join(DB_DIR, 'backup-lama'),
    tmp: path.join(DB_DIR, 'tmp'),
    cache: path.join(DB_DIR, 'cache')
}

// ───────── pindahkan folder lama di root proyek ke dalam database/ (sekali jalan, saat start) ─────────
// Semua folder yang dibuat bot saat berjalan sekarang ada di database/. Folder lama (mis. session, tmp, temp)
// dipindah otomatis supaya login WhatsApp dan data lama tidak hilang.
function moveDirInto(from, to) {
    try {
        if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) return
        fs.mkdirSync(path.dirname(to), { recursive: true })
        if (!fs.existsSync(to)) {
            try { fs.renameSync(from, to); return } catch {}
        }
        fs.cpSync(from, to, { recursive: true, force: false })
        fs.rmSync(from, { recursive: true, force: true })
    } catch (e) { console.log(`[ INFO ] Gagal memindahkan folder ${from} ke ${to}: ${e.message}`) }
}

function migrateLegacyFolders() {
    const D = (...p) => path.join(DB_DIR, ...p)
    moveDirInto('session', D('session'))
    moveDirInto('backup-session', D('backup-session'))
    moveDirInto('backup-db', D('backup-db'))
    moveDirInto('.file-backups', D('file-backups'))
    moveDirInto('.update-backups', D('update-backups'))
    moveDirInto(path.join('data', 'cache'), D('cache'))
    moveDirInto(path.join('assets', 'fonts', 'kalender'), D('assets', 'fonts', 'kalender'))
    moveDirInto(path.join('temp', 'clan_logo'), D('media', 'clan_logo'))
    moveDirInto('.yt-tmp', D('tmp', 'yt'))
    moveDirInto(path.join('storage', 'tmp'), D('tmp'))
    moveDirInto('tmp', D('tmp'))
    moveDirInto('temp', D('tmp'))
    // hapus folder induk yang kosong
    for (const d of ['storage', path.join('assets', 'fonts'), 'assets', 'data']) {
        try { if (fs.existsSync(d) && !fs.readdirSync(d).length) fs.rmdirSync(d) } catch {}
    }
}
try { migrateLegacyFolders() } catch {}

// ───────── daftar file ─────────
export const DB_FILES = {
    bot: { file: 'bot.json', space: 2, desc: 'Inti bot: user, grup, premium, ban, owner, promosi, jadwal, afk, reminder, statistik, aktivitas' },
    rpg: { file: 'rpg.json', space: 2, desc: 'Semua data RPG: user rpg, game (rpg, guild, bank, market, party, uno, gaple), dungeon, pasangan, badge, clan, turnamen' },
    store: { file: 'store.json', space: 2, desc: 'Semua data toko: produk, order, donasi, sewa, sociabuzz, panel (penjualan panel, server, penjual, pembeli, aksi, peran, zanpanel), ledger (riwayat transaksi, pelanggan, donatur, uang masuk, rekap harian, arsip produk & sewa, log perubahan)' },
    tools: { file: 'tools.json', space: 2, desc: 'Utilitas: asisten harian, anime list, tebak, musik, sesi AI, peran panel' }
}

// key global.db -> file. Key yang tidak terdaftar masuk ke bot.json.
const ROUTE = {
    // rpg
    rpgData: 'rpg', dungeon: 'rpg', fun: 'rpg', kaguyaX: 'rpg',
    // toko
    store: 'store', merchant: 'store', sewa: 'store', sociabuzz: 'store', ledger: 'store', panel: 'store',
    // utilitas
    asisten: 'tools', animelist: 'tools', tebak: 'tools', musik: 'tools', musikuser: 'tools',
    aiSession: 'tools', panelRole: 'tools', ai: 'tools', userCreds: 'tools', nokosTraffic: 'tools',
    gemini: 'tools', geminiIds: 'tools', bota: 'tools', botaIds: 'tools', rstc: 'tools'
}
export const fileOf = (key) => ROUTE[key] || 'bot'
const pathOf = (name) => path.join(DB_DIR, DB_FILES[name].file)

// isi awal tiap file (supaya struktur langsung terlihat lengkap)
export const DEFAULTS = {
    bot: { users: {}, groups: {}, promosi: {}, autosw: {}, owners: [], premium: {}, banUsers: {}, reminders: [] },
    rpg: { rpgData: { users: {}, chats: {}, settings: {}, simulator: {} }, dungeon: { users: {}, world: null } },
    store: {
        store: { products: {}, orders: {}, seq: 0 },
        merchant: { seq: 0, donations: {}, seen: {} },
        sewa: { rentals: {}, orders: {}, seq: 0 },
        sociabuzz: { trx: {} },
        panel: { seq: 0, sales: {}, servers: {}, sellers: {}, customers: {}, actions: [], roleLog: [], zan: {} },
        ledger: {
            seq: 0,
            totals: { transaksi: 0, lunas: 0, omset: 0, byKind: {} },
            daily: {},
            transactions: {},
            index: {},
            customers: {},
            donors: {},
            incoming: {},
            products: {},
            rentals: {},
            events: []
        }
    },
    tools: { asisten: {}, animelist: { users: {} }, tebak: {}, musik: { tracks: [], manual: [] }, musikuser: { fav: {}, plays: {}, last: {} }, aiSession: {}, panelRole: { reseller: [], admin: [], pt: [], owner: [] }, nokosTraffic: { countries: {} }, gemini: {}, geminiIds: [], bota: {}, botaIds: [], rstc: {} }
}

// ───────── tulis JSON: debounce + atomic + non-blocking ─────────
const writers = new Map()
const hashOf = (s) => crypto.createHash('md5').update(s).digest('hex')

async function flushOne(file) {
    const w = writers.get(file)
    if (!w) return
    w.timer = null
    w.first = 0
    if (w.writing) { w.dirty = true; return }
    w.writing = true
    try {
        const json = JSON.stringify(w.data, null, w.space || undefined)
        const h = hashOf(json)
        if (h === w.hash) return // tidak ada perubahan, tidak perlu menulis disk
        const tmp = `${file}.tmp`
        try {
            await fs.promises.writeFile(tmp, json)
            await fs.promises.rename(tmp, file)
        } catch (e) {
            if (e.code !== 'EACCES' && e.code !== 'EPERM') throw e
            await fs.promises.writeFile(file, json)
        }
        w.hash = h
    } catch (e) {
        console.error(`Gagal save ${file}:`, e.message)
    } finally {
        w.writing = false
        if (w.dirty) { w.dirty = false; flushOne(file) }
    }
}

// tunda & gabungkan tulis JSON agar hemat disk
export function scheduleJsonWrite(file, data, { delay = 800, maxWait = 4000, space = 0 } = {}) {
    let w = writers.get(file)
    if (!w) {
        w = { timer: null, first: 0, data, space, hash: '', writing: false, dirty: false }
        writers.set(file, w)
    }
    w.data = data
    w.space = space
    const now = Date.now()
    if (!w.first) w.first = now
    clearTimeout(w.timer)
    const wait = Math.max(0, Math.min(delay, w.first + maxWait - now))
    w.timer = setTimeout(() => flushOne(file), wait)
}

// tulis semua yang tertunda sekarang (saat bot mati)
export function flushAllSync() {
    if (pendingDb) flushSqlite()
    if (backend === 'sqlite' && S) { try { S.db.exec('PRAGMA wal_checkpoint(TRUNCATE)') } catch {} }
    for (const [file, w] of writers) {
        if (!w.timer && !w.dirty && !w.writing) continue
        clearTimeout(w.timer)
        w.timer = null
        try {
            const json = JSON.stringify(w.data, null, w.space || undefined)
            const h = hashOf(json)
            if (h !== w.hash) {
                const tmp = `${file}.sync.tmp`
                fs.writeFileSync(tmp, json)
                fs.renameSync(tmp, file)
                w.hash = h
            }
            w.dirty = false
        } catch {}
    }
}

// ═══════════════════════════════════════════════════════════
// PENYIMPANAN SQLITE
// Data tetap hidup di memori (global.db); yang berganti hanya tempat simpannya: satu file database/kaguya.db.
// Tiap file logis (bot / rpg / store / tools) dipecah jadi baris di tabel kv(f, p, t, v):
//   f = nama file logis, p = path JSON (mis. ["users","628xxx@s.whatsapp.net"]), t = 'o' (objek) / 'v' (nilai), v = JSON
// Satu baris per user (blok users[jid]) dan satu baris per entri tabel besar (mis. ledger.transactions[id]).
// ═══════════════════════════════════════════════════════════
export const SQLITE_FILE = path.join(DB_DIR, 'kaguya.db')
const _require = createRequire(import.meta.url)

let backend = null // 'sqlite' | 'json' (diputuskan di loadDB)
let S = null // { engine, db, up, del, hashes }
let pendingDb = null
let sqTimer = null
let sqFirst = 0
let sqErrLog = 0

export const usingSqlite = () => backend === 'sqlite'
const forcedJson = () => String(global.dbEngine || '').toLowerCase() === 'json'

function findEngine() {
    if (forcedJson()) return null
    // node:sqlite masih "experimental" di Node 22: sembunyikan peringatannya saja
    const emit = process.emitWarning
    process.emitWarning = (w, ...a) => (/sqlite/i.test(String(w?.message || w)) ? undefined : emit.call(process, w, ...a))
    try {
        const { DatabaseSync } = _require('node:sqlite')
        return { name: 'node:sqlite', open: (f) => new DatabaseSync(f) }
    } catch {} finally { process.emitWarning = emit }
    try {
        const Database = _require('better-sqlite3')
        return { name: 'better-sqlite3', open: (f) => new Database(f) }
    } catch {}
    return null
}

function openSqlite() {
    if (S) return S
    const engine = findEngine()
    if (!engine) {
        // file SQLite sudah ada tapi tidak bisa dibuka: jangan diam-diam mulai dari data kosong
        if (fs.existsSync(SQLITE_FILE)) {
            throw new Error(`${SQLITE_FILE} sudah ada, tetapi mesin SQLite tidak tersedia${forcedJson() ? ' (global.dbEngine = "json")' : ''}. Pakai Node.js 22.13+ atau jalankan: npm i better-sqlite3 (atau pindahkan file itu kalau memang mau kembali ke JSON).`)
        }
        return null
    }
    let db
    try {
        db = engine.open(SQLITE_FILE)
        db.exec('PRAGMA journal_mode = WAL')
        db.exec('PRAGMA synchronous = NORMAL')
        db.exec('PRAGMA busy_timeout = 5000')
        db.exec('CREATE TABLE IF NOT EXISTS kv (f TEXT NOT NULL, p TEXT NOT NULL, t TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (f, p)) WITHOUT ROWID')
    } catch (e) {
        throw new Error(`Gagal membuka ${SQLITE_FILE}: ${e.message}. File tidak diubah. Pulihkan dari backup (.restoredb) atau pindahkan file itu lalu jalankan ulang.`)
    }
    S = {
        engine: engine.name,
        db,
        hashes: new Map(),
        up: db.prepare('INSERT INTO kv (f, p, t, v) VALUES (?, ?, ?, ?) ON CONFLICT (f, p) DO UPDATE SET t = excluded.t, v = excluded.v'),
        del: db.prepare('DELETE FROM kv WHERE f = ? AND p = ?')
    }
    return S
}

const rowKey = (f, p) => `${f}\u0000${p}`
// blok user (users[jid]) tetap satu baris; bagian lain dipecah sampai kedalaman 3
const splitDepth = (p) => (p[0] === 'users' ? 2 : 3)
const isSplittable = (v) => {
    if (!isPlain(v) || typeof v.toJSON === 'function') return false
    const proto = Object.getPrototypeOf(v)
    return proto === Object.prototype || proto === null
}

function flatten(f, node, p, out) {
    if (node === undefined || typeof node === 'function') return
    if (isSplittable(node) && p.length < splitDepth(p)) {
        if (p.length) { const ps = JSON.stringify(p); out.set(rowKey(f, ps), { f, p: ps, t: 'o', v: '' }) }
        for (const [k, v] of Object.entries(node)) flatten(f, v, [...p, k], out)
        return
    }
    const v = JSON.stringify(node)
    if (v === undefined) return
    const ps = JSON.stringify(p)
    out.set(rowKey(f, ps), { f, p: ps, t: 'v', v })
}

const ownVal = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)

function buildTree(list) {
    const items = []
    for (const r of list) {
        let p
        try { p = JSON.parse(r.p) } catch { continue }
        if (Array.isArray(p) && p.length) items.push({ p, r })
    }
    items.sort((a, b) => a.p.length - b.p.length) // induk (penanda 'o') selalu lebih dulu dari anaknya
    const root = {}
    for (const { p, r } of items) {
        let cur = root
        for (let i = 0; i < p.length - 1 && cur; i++) cur = ownVal(cur, p[i])
        if (!isPlain(cur)) continue
        let val
        if (r.t === 'o') val = {}
        else { try { val = JSON.parse(r.v) } catch { continue } }
        Object.defineProperty(cur, p[p.length - 1], { value: val, writable: true, enumerable: true, configurable: true })
    }
    return root
}

/** Baca semua baris -> { bot: {...}, rpg: {...}, ... }. Null kalau tabel masih kosong. */
function sqliteLoadAll() {
    const rows = S.db.prepare('SELECT f, p, t, v FROM kv').all()
    S.hashes.clear()
    if (!rows.length) return null
    const byFile = {}
    for (const r of rows) {
        S.hashes.set(rowKey(r.f, r.p), hashOf(r.t + r.v))
        ;(byFile[r.f] ||= []).push(r)
    }
    const out = {}
    for (const [f, list] of Object.entries(byFile)) out[f] = buildTree(list)
    return out
}

/** Tulis perbedaan memori -> SQLite dalam satu transaksi. Melempar error kalau gagal (data lama tetap utuh). */
function sqliteFlushNow(db) {
    const rows = new Map()
    for (const name of Object.keys(DB_FILES)) {
        const { _meta, ...j } = snapshot(name, db)
        flatten(name, j, [], rows)
    }
    const ups = []
    for (const [key, r] of rows) {
        const h = hashOf(r.t + r.v)
        if (S.hashes.get(key) !== h) ups.push([key, r, h])
    }
    const dels = []
    for (const key of S.hashes.keys()) if (!rows.has(key)) dels.push(key)
    if (!ups.length && !dels.length) return

    S.db.exec('BEGIN IMMEDIATE')
    try {
        for (const [, r] of ups) S.up.run(r.f, r.p, r.t, r.v)
        for (const key of dels) { const i = key.indexOf('\u0000'); S.del.run(key.slice(0, i), key.slice(i + 1)) }
        S.db.exec('COMMIT')
    } catch (e) {
        try { S.db.exec('ROLLBACK') } catch {}
        throw e
    }
    for (const [key, , h] of ups) S.hashes.set(key, h)
    for (const key of dels) S.hashes.delete(key)
}

function scheduleSqlite(db, { delay = 800, maxWait = 4000 } = {}) {
    pendingDb = db
    const now = Date.now()
    if (!sqFirst) sqFirst = now
    clearTimeout(sqTimer)
    sqTimer = setTimeout(flushSqlite, Math.max(0, Math.min(delay, sqFirst + maxWait - now)))
}

function flushSqlite() {
    clearTimeout(sqTimer)
    sqTimer = null
    sqFirst = 0
    const db = pendingDb
    pendingDb = null
    if (!db || backend !== 'sqlite') return
    try {
        sqliteFlushNow(db)
    } catch (e) {
        const now = Date.now()
        if (now - sqErrLog > 60_000) { sqErrLog = now; console.error('[ DB ] gagal menyimpan ke SQLite (dicoba lagi sebentar lagi):', e.message) }
        scheduleSqlite(db, { delay: 5000, maxWait: 5000 })
    }
}

/** Cocokkan isi SQLite (dibaca ulang dari disk) dengan isi memori. */
function sqliteMatches(db) {
    const back = sqliteLoadAll() || {}
    for (const name of Object.keys(DB_FILES)) {
        const { _meta, ...want } = snapshot(name, db)
        if (!isDeepStrictEqual(JSON.parse(JSON.stringify(want)), back[name] || {})) return false
    }
    return true
}

/** JSON lama -> SQLite: tulis, verifikasi, baru arsipkan file JSON-nya. */
function migrateJsonToSqlite(db) {
    sqliteFlushNow(db)
    if (!sqliteMatches(db)) throw new Error('hasil verifikasi tidak sama dengan data asli')
    const stamp = Date.now()
    let moved = 0
    for (const name of Object.keys(DB_FILES)) {
        const f = pathOf(name)
        if (!fs.existsSync(f)) continue
        try {
            fs.mkdirSync(DB_SUB.backup, { recursive: true })
            fs.renameSync(f, path.join(DB_SUB.backup, `${path.basename(f)}.sebelum-sqlite-${stamp}`))
            moved++
        } catch (e) { console.error(`[ DB ] gagal mengarsipkan ${f}:`, e.message) }
    }
    return moved
}

/** Isi 4 file logis sebagai teks JSON (untuk backup yang portabel). */
export function dbJsonFiles(db = global.db) {
    return Object.entries(DB_FILES).map(([name, { file, space }]) => ({
        name, file, json: JSON.stringify(snapshot(name, db), null, space || undefined)
    }))
}

/** Ukuran data di disk: satu entri kaguya.db (SQLite) atau satu entri per file JSON. */
export function dbDiskSizes() {
    const size = (f) => { try { return fs.statSync(f).size } catch { return 0 } }
    if (backend === 'sqlite') return [{ name: 'sqlite', file: path.basename(SQLITE_FILE), size: size(SQLITE_FILE) + size(`${SQLITE_FILE}-wal`) }]
    return Object.entries(DB_FILES).map(([name, { file }]) => ({ name, file, size: size(path.join(DB_DIR, file)) }))
}

// ───────── simpan ─────────
const hooks = new Set() // dipanggil setelah ada perubahan (dipakai ledger toko)
export const onDbChange = (fn) => hooks.add(fn)
let hookTimer = null

const metaOf = (name) => ({ file: DB_FILES[name].file, fungsi: DB_FILES[name].desc, updated: new Date().toISOString() })

// ───────── hanya user terdaftar yang disimpan ─────────
// Aturan: data user (rpgData.users) hanya ditulis ke disk kalau sudah .daftar (registered === true).
// User yang belum daftar tetap bisa memakai bot (datanya hidup di memori), tapi tidak masuk database.
// Matikan lewat config.js: global.hanyaTerdaftar = false
const onlyRegistered = () => global.hanyaTerdaftar !== false
const isRegisteredUser = (u) => !!u && typeof u === 'object' && u.registered === true

function registeredOnly(users) {
    const out = {}
    for (const [jid, u] of Object.entries(users || {})) if (isRegisteredUser(u)) out[jid] = u
    return out
}

// nilai yang benar-benar ditulis ke disk untuk satu key global.db
function persistValue(key, value) {
    if (key === 'rpgData' && onlyRegistered() && value && typeof value === 'object' && value.users && typeof value.users === 'object') {
        return { ...value, users: registeredOnly(value.users) }
    }
    return value
}

// ───────── susunan per user ─────────
// Di memori (global.db) struktur lama dipertahankan supaya semua plugin tetap jalan. Di DISK, data tiap
// user dikumpulkan jadi satu blok per user di bagian "users" tiap file, tidak bercampur dengan user lain:
//
//   "users": {
//     "628xxx@s.whatsapp.net": {
//       "name": "...", "level": 5, "premium": false, ...     <- data utama user (flat)
//       "extra": { "dungeon": {...}, "anime": {...} }          <- tabel lain milik user itu
//     },
//     "628yyy@s.whatsapp.net": { ... }
//   }
//
//   base   : tabel utama user (isinya jadi field flat di blok user)
//   tables : tabel lain yang kuncinya id user -> masuk ke users[id].extra[nama]
// File lama (tanpa "users" di level atas) tetap terbaca, lalu otomatis disimpan ulang dalam susunan baru.
const USER_LAYOUT = {
    bot: { base: ['users'], tables: { premium: ['premium'], ban: ['banUsers'], afk: ['afk'] } },
    rpg: { base: ['rpgData', 'users'], tables: { dungeon: ['dungeon', 'users'], rpg_kaguya: ['rpgData', 'bridge', 'game', 'rpg'] } },
    tools: {
        base: null,
        tables: {
            anime: ['animelist', 'users'],
            musik_fav: ['musikuser', 'fav'],
            musik_terakhir: ['musikuser', 'last'],
            asisten: ['asisten'],
            gemini: ['gemini'],
            bota: ['bota']
        }
    },
    store: {
        base: null,
        tables: {
            pelanggan: ['ledger', 'customers'], donatur: ['ledger', 'donors'],
            pembeli_panel: ['panel', 'customers'], penjual_panel: ['panel', 'sellers']
        }
    }
}

// kunci berupa nomor saja ('628xxx') digabung ke blok jid yang sama ('628xxx@s.whatsapp.net')
const rowId = (id) => (/^\d{5,}$/.test(id) ? `${id}@s.whatsapp.net` : id)
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const getPath = (o, p) => p.reduce((a, k) => (a == null ? undefined : a[k]), o)

// salin rantai objek di sepanjang path (data asli di memori tidak boleh berubah)
function withoutPath(obj, p) {
    const out = { ...obj }
    if (p.length === 1) { delete out[p[0]]; return out }
    if (isPlain(out[p[0]])) out[p[0]] = withoutPath(out[p[0]], p.slice(1))
    return out
}

function withPath(obj, p, value) {
    const out = { ...obj }
    if (p.length === 1) { out[p[0]] = value; return out }
    out[p[0]] = withPath(isPlain(out[p[0]]) ? out[p[0]] : {}, p.slice(1), value)
    return out
}

// memori -> disk
function toDiskLayout(name, snap) {
    const L = USER_LAYOUT[name]
    if (!L) return snap

    let rest = snap
    const rows = {}
    const row = (id) => (rows[id] ||= {})

    const base = L.base ? getPath(snap, L.base) : null
    if (L.base && isPlain(base) && Object.values(base).every(isPlain)) {
        for (const [id, u] of Object.entries(base)) Object.assign(row(id), u)
        rest = withoutPath(rest, L.base)
    }

    for (const [field, path] of Object.entries(L.tables)) {
        const tbl = getPath(snap, path)
        if (!isPlain(tbl)) continue
        // kunci yang sudah berbentuk jid diproses dulu; sisanya digabung ke jid yang sama kalau tidak bentrok
        const entries = Object.entries(tbl).sort(([a], [b]) => (rowId(a) === a ? 0 : 1) - (rowId(b) === b ? 0 : 1))
        for (const [id, v] of entries) {
            let rid = rowId(id)
            if (rid !== id && rows[rid]?.extra && field in rows[rid].extra) rid = id
            const r = row(rid)
            ;(r.extra ||= {})[field] = v
            if (rid !== id) (r.extra.kunci ||= {})[field] = id // simpan kunci asli supaya bisa dikembalikan persis
        }
        rest = withoutPath(rest, path)
    }

    const { _meta, ...others } = rest
    return { _meta, users: rows, ...others }
}

// disk -> memori
function fromDiskLayout(name, j) {
    const L = USER_LAYOUT[name]
    if (!L || !isPlain(j.users)) return j

    const rows = j.users
    let rest = { ...j }
    delete rest.users

    if (L.base) {
        const baseTbl = { ...(getPath(rest, L.base) || {}) }
        for (const [id, r] of Object.entries(rows)) {
            if (!isPlain(r)) continue
            const { extra, ...u } = r
            if (Object.keys(u).length) baseTbl[id] = u
        }
        rest = withPath(rest, L.base, baseTbl)
    }

    for (const [field, path] of Object.entries(L.tables)) {
        const tbl = { ...(getPath(rest, path) || {}) }
        let n = 0
        for (const [id, r] of Object.entries(rows)) {
            if (isPlain(r) && isPlain(r.extra) && field in r.extra) { tbl[r.extra.kunci?.[field] ?? id] = r.extra[field]; n++ }
        }
        if (n) rest = withPath(rest, path, tbl)
    }
    return rest
}

// isi satu file = semua key global.db yang diarahkan ke file itu
function snapshot(name, db) {
    const out = { _meta: metaOf(name) }
    for (const k of Object.keys(db)) if (fileOf(k) === name) out[k] = persistValue(k, db[k])
    return toDiskLayout(name, out)
}

function writeAll(db) {
    if (backend === 'sqlite') return scheduleSqlite(db)
    for (const name of Object.keys(DB_FILES)) {
        scheduleJsonWrite(pathOf(name), { toJSON: () => snapshot(name, db) }, { space: DB_FILES[name].space })
    }
}

export function saveDB(db) {
    writeAll(db)
    if (hookTimer || !hooks.size) return
    hookTimer = setTimeout(() => {
        hookTimer = null
        let changed = false
        for (const fn of hooks) { try { if (fn(db)) changed = true } catch (e) { console.error('[db] hook gagal:', e?.message || e) } }
        if (changed) writeAll(db)
    }, 150)
    hookTimer.unref?.()
}

// ───────── folder ─────────
function dirWritable(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true })
        const probe = path.join(dir, `.w${process.pid}`)
        fs.writeFileSync(probe, '1')
        fs.unlinkSync(probe)
        return true
    } catch {
        return false
    }
}

export function ensureWritableDir(dir = DB_DIR) {
    if (dirWritable(dir)) return true
    try { fs.chmodSync(dir, 0o777) } catch {}
    if (dirWritable(dir)) { console.log(`[ INFO ] Permission folder ${dir} diperbaiki (chmod).`); return true }
    try {
        const backup = `${dir}.old-${Date.now()}`
        fs.renameSync(dir, backup)
        fs.mkdirSync(dir, { recursive: true })
        for (const f of fs.readdirSync(backup)) { try { fs.cpSync(path.join(backup, f), path.join(dir, f), { recursive: true }) } catch {} }
        if (dirWritable(dir)) { console.log(`[ INFO ] Folder ${dir} dibuat ulang. Isi lama ada di ${backup}`); return true }
    } catch {}
    console.error(`[ ERROR ] Folder ${dir} tidak bisa ditulis. Ubah permission-nya lewat panel (chmod 777) atau hapus lalu buat ulang folder tersebut.`)
    return false
}

export function ensureDbDirs() {
    ensureWritableDir(DB_DIR)
    for (const d of Object.values(DB_SUB)) { try { fs.mkdirSync(d, { recursive: true }) } catch {} }
}

// ───────── baca ─────────
function readJson(file) {
    if (!fs.existsSync(file)) return null
    try {
        const raw = fs.readFileSync(file, 'utf8')
        return raw.trim() ? JSON.parse(raw) : {}
    } catch (e) {
        // jangan sampai file rusak tertimpa file kosong: amankan dulu
        const bad = `${file}.rusak-${Date.now()}`
        try { fs.renameSync(file, bad); console.error(`[ DB ] ${file} rusak (${e.message}). Disalin ke ${bad}`) } catch {}
        return null
    }
}

// pindahkan file lama ke database/backup-lama/
function archive(file) {
    try {
        fs.mkdirSync(DB_SUB.backup, { recursive: true })
        let dest = path.join(DB_SUB.backup, path.basename(file))
        if (fs.existsSync(dest)) dest = `${dest}.${Date.now()}`
        fs.renameSync(file, dest)
    } catch (e) { console.error(`[ DB ] gagal mengarsipkan ${file}:`, e.message) }
}

// file versi lama -> key di global.db
const LEGACY = [
    ['asisten.json', 'asisten'], ['activity.json', 'activity'], ['tebak.json', 'tebak'],
    ['animelist.json', 'animelist'], ['musik.json', 'musik'], ['musikuser.json', 'musikuser'],
    ['ai-session.json', 'aiSession'], ['panelrole.json', 'panelRole']
]

function migrateLegacy(data, freshFiles) {
    let moved = 0
    const put = (key, value, replaceEmpty = true) => {
        const fresh = freshFiles.has(fileOf(key))
        if (data[key] === undefined || (replaceEmpty && fresh)) data[key] = value
    }

    // db.json lama (satu file besar) -> pecah ke file per fungsi
    const oldDb = path.join(DB_DIR, 'db.json')
    const old = readJson(oldDb)
    if (old && typeof old === 'object') {
        for (const [k, v] of Object.entries(old)) put(k, v)
        archive(oldDb); moved++
    }

    for (const [f, key] of LEGACY) {
        const full = path.join(DB_DIR, f)
        const j = readJson(full)
        if (j === null) continue
        put(key, j)
        archive(full); moved++
    }

    // plugin dungeon lama menulis user.json & dungeon.json di folder utama
    const dg = (data.dungeon && typeof data.dungeon === 'object') ? data.dungeon : { users: {}, world: null }
    let dgTouched = false
    for (const [f, field] of [['user.json', 'users'], ['dungeon.json', 'world']]) {
        const full = path.join('.', f)
        const j = readJson(full)
        if (j === null) continue
        if (!dg[field] || !Object.keys(dg[field]).length) dg[field] = j
        archive(full); moved++; dgTouched = true
    }
    if (dgTouched) data.dungeon = dg

    // file lain di folder database yang dipindah ke subfolder rapi
    const relocate = [
        ['command.log', DB_SUB.logs], ['restart.json', DB_SUB.runtime],
        ['livenet-spotifylive-tunnel-url.txt', DB_SUB.runtime], ['livenet-pinlive-tunnel-url.txt', DB_SUB.runtime],
        ['livenet-ytlive-tunnel-url.txt', DB_SUB.runtime], ['intro', DB_SUB.media]
    ]
    for (const [name, dir] of relocate) {
        const from = path.join(DB_DIR, name)
        const to = path.join(dir, name)
        try { if (fs.existsSync(from) && !fs.existsSync(to)) { fs.mkdirSync(dir, { recursive: true }); fs.renameSync(from, to) } } catch {}
    }
    // foto intro grup: perbarui path yang tersimpan di data grup
    for (const g of Object.values(data.groups || {})) {
        const img = g?.intro?.image
        if (typeof img === 'string' && /database[\\/]intro[\\/]/.test(img)) g.intro.image = img.replace(/database([\\/])intro/, 'database$1media$1intro')
    }
    return moved
}

const clone = (o) => JSON.parse(JSON.stringify(o))

/**
 * Database lama bisa berisi user yang belum daftar. Supaya tidak hilang diam-diam saat aturan "hanya yang terdaftar"
 * mulai berlaku, mereka dikeluarkan dari data aktif dan DISALIN dulu ke database/backup-lama/user-belum-daftar-<waktu>.json.
 */
function archiveUnregistered(data) {
    if (!onlyRegistered()) return 0
    const users = data.rpgData?.users
    if (!users || typeof users !== 'object') return 0

    const dropped = {}
    for (const [jid, u] of Object.entries(users)) {
        if (isRegisteredUser(u)) continue
        dropped[jid] = u
        delete users[jid]
    }
    const n = Object.keys(dropped).length
    if (!n) return 0

    try {
        fs.mkdirSync(DB_SUB.backup, { recursive: true })
        const dest = path.join(DB_SUB.backup, `user-belum-daftar-${Date.now()}.json`)
        fs.writeFileSync(dest, JSON.stringify(dropped))
        console.log(`[ DB ] ${n} user belum terdaftar tidak ikut disimpan lagi. Arsipnya: ${dest}`)
    } catch (e) {
        console.error('[ DB ] gagal mengarsipkan user belum terdaftar:', e.message)
    }
    return n
}

/** Baca semua file database, gabungkan jadi satu objek, migrasikan file lama kalau ada. */
export function loadDB() {
    ensureDbDirs()
    // SQLite kalau tersedia (error fatal dilempar ke initDatabase); kalau tabelnya masih kosong, baca JSON lama dulu
    backend = 'json'
    let fromSql = null
    if (openSqlite()) { backend = 'sqlite'; fromSql = sqliteLoadAll() }
    loadDB.needsMigration = backend === 'sqlite' && !fromSql
    const data = {}
    const freshFiles = new Set()
    for (const name of Object.keys(DB_FILES)) {
        const j = fromSql ? fromSql[name] : readJson(pathOf(name))
        if (!j) continue
        if (j._meta?.fresh) freshFiles.add(name)
        delete j._meta
        for (const [k, v] of Object.entries(fromDiskLayout(name, j))) data[k] = v
    }
    const moved = migrateLegacy(data, freshFiles)
    loadDB.archivedUnregistered = archiveUnregistered(data)
    // lengkapi struktur awal tanpa menimpa data yang ada
    for (const name of Object.keys(DEFAULTS)) {
        for (const [k, v] of Object.entries(DEFAULTS[name])) if (data[k] === undefined) data[k] = clone(v)
    }
    loadDB.migrated = moved
    return data
}

/** Siapkan global.db (Proxy: assign key -> otomatis tersimpan). */
export function initDatabase() {
    let data
    try {
        data = loadDB()
    } catch (e) {
        console.error(`[ DB ] ${e.message}`)
        process.exit(1)
    }
    global.db = new Proxy(data, {
        set(target, property, value) {
            target[property] = value
            saveDB(target)
            return true
        }
    })

    if (backend === 'sqlite') {
        if (loadDB.needsMigration) {
            try {
                const moved = migrateJsonToSqlite(data)
                console.log(`[ DB ] Database dipindah ke SQLite (${S.engine}): ${SQLITE_FILE}${moved ? `. ${moved} file JSON lama diarsipkan ke ${DB_SUB.backup}` : ''}`)
            } catch (e) {
                // aman: file JSON belum disentuh, pakai JSON seperti sebelumnya
                console.error(`[ DB ] Migrasi ke SQLite gagal (${e.message}). Tetap memakai JSON.`)
                try { S.db.exec('DELETE FROM kv') } catch {}
                S.hashes.clear()
                backend = 'json'
            }
        } else {
            console.log(`[ DB ] SQLite (${S.engine}): ${S.hashes.size} baris dimuat dari ${SQLITE_FILE}`)
        }
    }
    saveDB(data) // tulis struktur baru (dan hasil migrasi) langsung
}

/**
 * Baca file json lama di folder ./data (versi sebelum semua data dipindah ke database/), lalu arsipkan ke
 * database/backup-lama/. Mengembalikan isinya, atau `fallback` kalau file tidak ada.
 */
export function legacyJson(file, fallback = null) {
    const full = path.join('.', 'data', file)
    const j = readJson(full)
    if (j === null) return fallback
    archive(full)
    return j
}

/**
 * Data satu fitur yang hidup di global.db[key] (tersimpan otomatis ke file database sesuai ROUTE).
 *   const { data, save } = liveDoc('rstc', {}, 'rstc.json', transformLama?)
 * `data` selalu menunjuk ke data database terbaru (aman walau database belum siap / dimuat ulang).
 * Kalau ada file lama ./data/<legacyFile>, isinya dipindahkan sekali ke database lalu file lamanya diarsipkan.
 */
export function liveDoc(key, fallback = {}, legacyFile = null, transform = null) {
    let migrated = false
    const target = () => {
        if (!global.db) return fallback
        if (global.db[key] === undefined) global.db[key] = clone(fallback)
        if (!migrated && legacyFile) {
            migrated = true
            let old = legacyJson(legacyFile, null)
            if (old && typeof old === 'object') {
                if (transform) old = transform(old)
                Object.assign(global.db[key], old)
                saveDB(global.db)
            }
        }
        return global.db[key]
    }
    const data = new Proxy(Array.isArray(fallback) ? [] : {}, {
        get: (_, p) => { const o = target(); const v = Reflect.get(o, p); return typeof v === 'function' ? v.bind(o) : v },
        set: (_, p, v) => { const ok = Reflect.set(target(), p, v); if (global.db) saveDB(global.db); return ok },
        has: (_, p) => p in target(),
        deleteProperty: (_, p) => { const ok = Reflect.deleteProperty(target(), p); if (global.db) saveDB(global.db); return ok },
        ownKeys: () => Reflect.ownKeys(target()),
        getOwnPropertyDescriptor: (_, p) => { const d = Reflect.getOwnPropertyDescriptor(target(), p); return d ? { ...d, configurable: true } : undefined }
    })
    return { data, save: () => { if (global.db) saveDB(global.db) } }
}

/**
 * Penyimpanan kecil per fitur di dalam global.db (pengganti file json sendiri).
 *   const s = docStore('tebak', {})   s.get() -> objek   s.save() -> simpan
 * Aman dipanggil sebelum database siap: nilai dibaca ulang tiap get().
 */
export function docStore(key, fallback = {}) {
    const get = () => {
        if (!global.db) return fallback
        if (global.db[key] === undefined) global.db[key] = fallback
        return global.db[key]
    }
    return {
        get,
        set: (v) => { if (global.db) global.db[key] = v; return v },
        save: () => { if (global.db) saveDB(global.db) },
        flush: () => { if (global.db) saveDB(global.db) }
    }
}


// ═══════════════════════════════════════════════════════════
// RPG KAGUYA — katalog & logika bersama (shop, buy, sell, inv, cook, craft, quest, claimquest)
// Data user tetap di rpgDb[jid] (database/rpg.json -> rpgData.bridge.game.rpg), yang sudah
// tersambung ke akun user Kaguya (coin = money, bank = bank, exp = exp, level = level, hp = health).
// ═══════════════════════════════════════════════════════════

// kunci hari (YYYYMMDD) untuk reset quest harian
const todayKey = () => {
    const d = new Date()
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// ── katalog toko (shop / buy) ──
export const SHOP = {
    weapon: {
        title: 'Weapon ⚔️',
        items: { 'pedang kayu': 500, 'belati baja': 1000, 'busur elven': 1200 }
    },
    armor: {
        title: 'Armor 🛡️',
        items: { 'tameng kayu': 600, 'armor kulit': 900 }
    },
    potion: {
        title: 'Potion 🧪',
        items: { ramuan: 150, elixirlife: 750 }
    },
    material: {
        title: 'Material 🧱',
        items: { tulang: 80, kulit: 80, daging: 60 }
    },
    key: {
        title: 'Key Item 🔑',
        items: { kunci: 300 }
    },
    mystic: {
        title: 'Mystic ✨',
        items: { scrollclass: 500, stonebless: 350, essencexp: 400, spiritcore: 1000 }
    },
    mount: {
        title: 'Pet & Mount 🐾',
        items: { kuda: 2000 }
    }
}
export const SHOP_ALIAS = { weapon: 'weapon', senjata: 'weapon', armor: 'armor', potion: 'potion', ramuan: 'potion', material: 'material', bahan: 'material', key: 'key', keyitem: 'key', kunci: 'key', mystic: 'mystic', mount: 'mount', pet: 'mount', petmount: 'mount' }

export const priceOf = (name) => {
    for (const cat of Object.values(SHOP)) if (cat.items[name] !== undefined) return cat.items[name]
    return undefined
}

// item toko dengan efek khusus (bukan masuk inventory); sisanya masuk inv
export function applyPurchase(u, item) {
    switch (item) {
        case 'scrollclass': u.class = null; return 'Class-mu direset. Pilih class baru dengan *class*.'
        case 'stonebless': u.buff = 'atk+10%'; return 'Buff *atk+10%* aktif.'
        case 'essencexp': return { exp: 500, text: '+500 EXP.' }
        case 'spiritcore': u.spirit = 'phoenix'; return 'Roh *phoenix* menyertaimu.'
        case 'elixirlife': u.death = false; return 'Status kematian dihapus.'
        default: u.inv.push(item); return ''
    }
}

// harga jual ke sistem (tidak ada di tabel = 100)
export const SELL_PRICE = {
    daging: 40, kulit: 40, tulang: 40, gandum: 30, apel: 30,
    armor: 250, ramuan: 60, kunci: 120, fragmen: 50
}
export const sellPrice = (item) => {
    const k = String(item).toLowerCase()
    if (SELL_PRICE[k] !== undefined) return SELL_PRICE[k]
    if (k.startsWith('masakan:')) return 150
    const shop = priceOf(k)
    if (shop !== undefined) return Math.max(10, Math.floor(shop * 0.4))
    return 100
}

// ── resep masak ──
// bahan 'ikan' cocok dengan semua item berawalan "ikan " (hasil .fish); 'air' selalu tersedia
export const RECIPES = {
    supikan: { need: [{ match: 'ikan', prefix: true }], free: ['air'], label: 'ikan + air' },
    nasiherba: { need: [{ match: 'gandum' }, { match: 'herba' }], free: [], label: 'nasi (gandum hasil .farm) + herba' }
}

// ── quest harian (berganti tiap hari) ──
const QUEST_POOL = [
    { item: 'daging', jumlah: 2, coin: 300, exp: 200 },
    { item: 'kulit', jumlah: 2, coin: 320, exp: 200 },
    { item: 'tulang', jumlah: 2, coin: 340, exp: 220 }
]
export const questToday = () => QUEST_POOL[todayKey() % QUEST_POOL.length]

/**
 * Dipakai oleh .quest dan .claimquest: tampilkan progres misi harian; kalau bahan sudah lengkap,
 * misi langsung diselesaikan & hadiah diklaim (seperti versi Kaguya).
 */
export async function questRun(A) {
    const { initRpgUser, sender, pushname, rpgDb, reply, saveRpg, giveExp } = A
    initRpgUser(sender, pushname)
    const u = rpgDb[sender]
    const q = (u.quest = u.quest && typeof u.quest === 'object' ? u.quest : { dailyDone: false })
    const today = todayKey()
    if (q.day !== today) { q.day = today; q.dailyDone = false }

    const misi = questToday()
    const count = u.inv.filter(i => i === misi.item).length

    if (q.dailyDone) return reply('📜 Kamu sudah menyelesaikan quest harian hari ini!\nDatang lagi besok.')

    if (count < misi.jumlah) {
        return reply(`📜 *Misi Harian:*\n🎯 Kumpulkan ${misi.jumlah} *${misi.item}*\n🎁 Hadiah: ${misi.coin} koin & ${misi.exp} exp\n\nProgress: ${count}/${misi.jumlah}\nDapatkan lewat *hunt*, lalu *claimquest* saat sudah lengkap.`)
    }

    let sisa = misi.jumlah
    u.inv = u.inv.filter(i => {
        if (i === misi.item && sisa > 0) { sisa--; return false }
        return true
    })
    u.coin += misi.coin
    q.dailyDone = true
    saveRpg()
    await giveExp(misi.exp)
    return reply(`🎉 *Quest Harian Selesai!*\n+${misi.coin} 💰\n+${misi.exp} ⭐ EXP\n\nBesok akan ada misi baru!`)
}

// ── helper inventory (array string) ──
export const invCount = (u, name) => u.inv.filter(i => String(i).toLowerCase() === String(name).toLowerCase()).length
export function invTake(u, name, n = 1) {
    let left = n
    u.inv = u.inv.filter(i => {
        if (left > 0 && String(i).toLowerCase() === String(name).toLowerCase()) { left--; return false }
        return true
    })
    return n - left
}
export function invSummary(u) {
    const map = new Map()
    for (const i of u.inv) map.set(i, (map.get(i) || 0) + 1)
    // dukung format lama [{nama, jumlah}]
    if (Array.isArray(u.inventory)) for (const it of u.inventory) if (it?.nama) map.set(it.nama, (map.get(it.nama) || 0) + (Number(it.jumlah) || 1))
    return [...map.entries()]
}
