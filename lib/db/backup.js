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

// Backup dan restore database.

import fs from 'fs'
import path from 'path'
import { DB_DIR, DB_FILES, DEFAULTS, SQLITE_FILE, fileOf, flushAllSync, saveDB, usingSqlite, dbJsonFiles, dbDiskSizes } from './database.js'
import { createZip } from '../core/file.js'

export const BACKUP_DIR = './database/backup-db'
export const BACKUP_MAX_MB = 90            // batas aman kirim dokumen WhatsApp
export const INTERVAL_MIN = 5              // menit
export const INTERVAL_MAX = 43200          // menit (30 hari)
export const KEEP_MAX = 50

// folder yang tidak ikut dibackup (arsip versi lama & file sementara)
const SKIP_ROOT = new Set(['backup-lama', 'runtime'])
// file SQLite tidak disalin mentah (bisa tidak konsisten saat bot jalan); backup berisi JSON hasil ekspor
const SQLITE_BASE = path.basename(SQLITE_FILE)
const isSqliteFile = (name) => name === SQLITE_BASE || name === `${SQLITE_BASE}-wal` || name === `${SQLITE_BASE}-shm`
const WIB = 7 * 36e5

export const wibStamp = (t = Date.now()) => new Date(t + WIB).toISOString().slice(0, 16).replace('T', ' ')

// ───────── pengaturan ─────────
const BASE = { on: false, intervalMenit: 60, kirimKe: 'owner', simpanLokal: true, maksLokal: 10 }

/** config.js (global.fitur.autoBackup) ditimpa pengaturan dari command (global.db.fitur.backupCfg). */
export function getBackupConfig() {
    return { ...BASE, ...(global.fitur?.autoBackup || {}), ...(global.db?.fitur?.backupCfg || {}) }
}

export function setBackupConfig(patch) {
    if (!global.db) throw new Error('Database belum siap')
    const fitur = (global.db.fitur ||= {})
    fitur.backupCfg = { ...(fitur.backupCfg || {}), ...patch }
    saveDB(global.db)
    return getBackupConfig()
}

export function resetBackupConfig() {
    if (global.db?.fitur?.backupCfg) {
        delete global.db.fitur.backupCfg
        saveDB(global.db)
    }
    return getBackupConfig()
}

export const lastBackupAt = () => Number(global.db?.fitur?.backupLast) || 0

export function markBackupNow() {
    if (!global.db) return
    const fitur = (global.db.fitur ||= {})
    fitur.backupLast = Date.now()
    saveDB(global.db)
}

// ───────── buat zip ─────────
function collect(dir, base = '') {
    const out = []
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!base && SKIP_ROOT.has(e.name)) continue
        if (!base && isSqliteFile(e.name)) continue
        if (e.name.endsWith('.tmp')) continue
        const rel = base ? `${base}/${e.name}` : e.name
        const full = path.join(dir, e.name)
        if (e.isDirectory()) out.push(...collect(full, rel))
        else if (e.isFile()) out.push({ name: `database/${rel}`, data: fs.readFileSync(full), date: fs.statSync(full).mtime })
    }
    return out
}

/** Zip isi folder database/ (data terbaru dipaksa tertulis ke disk dulu). Null kalau tidak ada yang dibackup. */
export function buildDbZip(prefix = 'database') {
    flushAllSync()
    const dir = path.join(process.cwd(), DB_DIR)
    if (!fs.existsSync(dir)) return null
    const files = collect(dir)
    // database SQLite: isi 4 file logis ditulis sebagai JSON (format sama dengan versi JSON, restore tetap sama)
    if (usingSqlite()) {
        for (const f of dbJsonFiles()) files.push({ name: `database/${f.file}`, data: Buffer.from(f.json), date: new Date() })
    }
    if (!files.length) return null

    const zip = createZip(files)
    const stamp = wibStamp().replace(' ', '_').replace(':', '-')
    const bot = String(global.namebot || 'bot').replace(/[^\w.-]+/g, '_')
    return {
        zip,
        files: files.length,
        mb: zip.length / 1048576,
        stamp,
        fileName: `${prefix}_${bot}_${stamp}.zip`
    }
}

// ───────── salinan lokal ─────────
export function listLocalBackups() {
    try {
        return fs.readdirSync(BACKUP_DIR)
            .filter((n) => n.endsWith('.zip'))
            .map((name) => {
                const st = fs.statSync(path.join(BACKUP_DIR, name))
                return { name, size: st.size, mtime: st.mtimeMs }
            })
            .sort((a, b) => b.mtime - a.mtime)
    } catch {
        return []
    }
}

/** Cari backup lokal lewat nomor urut (1 = terbaru) atau nama file persis. Tidak menerima path. */
export function resolveBackup(arg) {
    const list = listLocalBackups()
    const key = String(arg || '').trim()
    if (!key) return null
    if (/^\d+$/.test(key)) return list[Number(key) - 1] || null
    return list.find((b) => b.name === key) || null
}

export const backupPath = (name) => path.join(BACKUP_DIR, path.basename(name))

/** Simpan zip ke ./backup-db lalu buang yang paling lama kalau melebihi `keep`. */
export function saveLocalBackup(zip, fileName, keep = 10) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    fs.writeFileSync(backupPath(fileName), zip)

    const limit = Math.min(KEEP_MAX, Math.max(1, Number(keep) || 10))
    // salinan "pre-restore" tidak ikut dirotasi supaya tidak hilang sebelum sempat dipakai
    const rotatable = listLocalBackups().filter((b) => !b.name.startsWith('pre-restore_'))
    for (const old of rotatable.slice(limit)) {
        try { fs.unlinkSync(backupPath(old.name)) } catch {}
    }
    return backupPath(fileName)
}

export function deleteLocalBackup(name) {
    const b = resolveBackup(name)
    if (!b) return false
    fs.unlinkSync(backupPath(b.name))
    return true
}

// ───────── ukuran database ─────────
export function dbSizes() {
    return dbDiskSizes()
}

export const fmtSize = (bytes) => {
    const b = Number(bytes) || 0
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(2)} MB`
}

// ───────── restore ─────────
/**
 * Kembalikan database dari zip backup. Aman: zip divalidasi dulu sebelum apa pun diubah,
 * dan salinan "pre-restore" dari kondisi sekarang dibuat otomatis.
 * Data di memori (global.db) diganti langsung, lalu ditulis ke disk.
 */
export async function restoreFromZip(buf) {
    const AdmZip = (m => m.default ?? m)(await import('adm-zip'))
    const zip = new AdmZip(buf)
    const entries = zip.getEntries().filter((e) => !e.isDirectory)

    // 1. validasi & baca semua file JSON database
    const restored = {}
    for (const [name, { file }] of Object.entries(DB_FILES)) {
        const entry = entries.find((e) => e.entryName.replace(/\\/g, '/') === `database/${file}`)
        if (!entry) continue
        let json
        try { json = JSON.parse(entry.getData().toString('utf8') || '{}') } catch (e) {
            throw new Error(`${file} di dalam backup rusak (${e.message}). Tidak ada yang diubah.`)
        }
        if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error(`${file} di dalam backup tidak valid. Tidak ada yang diubah.`)
        delete json._meta
        restored[name] = json
    }
    if (!Object.keys(restored).length) throw new Error('File ini bukan backup database (tidak ada bot.json / rpg.json / store.json / tools.json).')
    if (!global.db) throw new Error('Database belum siap')

    // 2. simpan kondisi sekarang dulu, jaga-jaga
    const safety = buildDbZip('pre-restore')
    if (safety) saveLocalBackup(safety.zip, safety.fileName, KEEP_MAX)

    // 3. ganti data di memori untuk file yang ada di backup, sisanya dibiarkan
    const db = global.db
    // pengaturan backup yang sedang berlaku tetap dipakai (jangan ikut tertimpa isi backup lama)
    const keepCfg = db.fitur?.backupCfg
    const keepLast = db.fitur?.backupLast
    for (const key of Object.keys(db)) if (restored[fileOf(key)]) delete db[key]
    let keys = 0
    for (const [name, json] of Object.entries(restored)) {
        for (const [k, v] of Object.entries(json)) { db[k] = v; keys++ }
        // lengkapi struktur yang mungkin belum ada di backup lama
        for (const [k, v] of Object.entries(DEFAULTS[name] || {})) if (db[k] === undefined) db[k] = JSON.parse(JSON.stringify(v))
    }

    // 4. media (foto intro grup, dst.) dikembalikan juga; path dijaga supaya tidak keluar dari database/media
    let media = 0
    const mediaRoot = path.resolve(DB_DIR, 'media')
    for (const e of entries) {
        const rel = e.entryName.replace(/\\/g, '/')
        if (!rel.startsWith('database/media/')) continue
        const dest = path.resolve(DB_DIR, rel.slice('database/'.length))
        if (!dest.startsWith(mediaRoot + path.sep)) continue
        try {
            fs.mkdirSync(path.dirname(dest), { recursive: true })
            fs.writeFileSync(dest, e.getData())
            media++
        } catch {}
    }

    if (keepCfg || keepLast) {
        const fitur = (db.fitur && typeof db.fitur === 'object') ? db.fitur : (db.fitur = {})
        if (keepCfg) fitur.backupCfg = keepCfg
        if (keepLast) fitur.backupLast = keepLast
    }

    saveDB(db)
    flushAllSync()
    return { files: Object.keys(restored).map((n) => DB_FILES[n].file), keys, media, safetyName: safety?.fileName || null }
}
