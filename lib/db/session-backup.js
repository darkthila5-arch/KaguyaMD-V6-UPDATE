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

// Backup folder sesi WhatsApp (disimpan lokal saja).

import fs from 'fs'
import path from 'path'

const SRC = 'database/session'
const DEST = 'database/backup-session'
const KEEP = 3
const EVERY_MS = 6 * 3600_000

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

export function backupSessionNow() {
    if (!fs.existsSync(path.join(SRC, 'creds.json'))) return null // belum login: tidak ada yang dibackup
    const target = path.join(DEST, stamp())
    try {
        fs.mkdirSync(DEST, { recursive: true })
        fs.cpSync(SRC, target, { recursive: true })

        // putar: simpan KEEP salinan terbaru saja
        const all = fs.readdirSync(DEST).sort()
        for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
            fs.rmSync(path.join(DEST, old), { recursive: true, force: true })
        }
        return target
    } catch (e) {
        console.log(`[ BACKUP ] gagal backup sesi: ${e.message}`)
        return null
    }
}

let timer = null
/** Jalankan sekali sekarang lalu tiap 6 jam. Aman dipanggil berulang (tidak menumpuk timer). */
export function startSessionBackup() {
    if (timer) return
    backupSessionNow()
    timer = setInterval(backupSessionNow, EVERY_MS)
    timer.unref?.()
}

/**
 * Clean session: hapus sesi enkripsi yang rusak/menumpuk (penyebab "Bad MAC") TANPA logout.
 * Yang dihapus: session-*, sender-key-*, sender-key-memory-* (file .json di folder session).
 * creds.json, pre-key, app-state, dan folder jadibot TIDAK disentuh. Sesi dibuat ulang otomatis
 * saat ada pesan masuk (beberapa pesan pertama bisa tertunda).
 * Dipakai oleh command .clearsession (owner) dan `npm run clean-session` (bot dalam keadaan mati).
 */
const CLEANABLE = /^(session-|sender-key-|sender-key-memory-).*\.json$/

export function cleanSessionFiles(dir = SRC) {
    const root = path.resolve(dir)
    if (!fs.existsSync(root)) return { found: false, files: 0, bytes: 0, failed: 0 }

    let files = 0, bytes = 0, failed = 0
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || !CLEANABLE.test(entry.name)) continue
        const file = path.join(root, entry.name)
        try {
            const size = fs.statSync(file).size
            fs.rmSync(file, { force: true })
            files++
            bytes += size
        } catch {
            failed++
        }
    }
    return { found: true, files, bytes, failed }
}
