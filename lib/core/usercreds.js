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

// Simpan token pribadi tiap user (GitHub, Vercel, DigitalOcean, panel).

import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'

export const credCtx = new AsyncLocalStorage()

// service -> field utama (kalau kosong dianggap belum diset) + semua field yang boleh disimpan
export const SERVICES = {
    github: { main: 'token', fields: ['token'], label: 'GitHub' },
    vercel: { main: 'token', fields: ['token', 'teamId'], label: 'Vercel' },
    digitalocean: { main: 'token', fields: ['token'], label: 'DigitalOcean' },
    panel: { main: 'plta', fields: ['domain', 'plta', 'pltc', 'node'], label: 'Panel Pterodactyl' }
}

const numOf = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')

// ───────── penyimpanan: database/tokens.json ─────────
// Satu blok per user (kunci = nomor), isinya token tiap layanan:
//   { "_meta": {...}, "users": { "628111": { "github": { "token": "...", "updatedAt": 1 }, "vercel": {...} }, "628222": {...} } }
// Disimpan permanen: user cukup set sekali, tidak perlu set ulang setelah bot restart.
const FILE = path.join(process.cwd(), 'database', 'tokens.json')
let cache = null
let timer = null

const flush = () => {
    timer = null
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true })
        const tmp = FILE + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify({ _meta: { desc: 'Token pribadi tiap user (GitHub, Vercel, DigitalOcean, panel). RAHASIA, jangan dibagikan.', updatedAt: new Date().toISOString() }, users: cache }, null, 2), { mode: 0o600 })
        fs.renameSync(tmp, FILE)
    } catch (e) { console.error('[ USERCREDS ] gagal simpan:', e?.message || e) }
}
const save = () => { if (!timer) timer = setTimeout(flush, 300) }
process.on('exit', () => { if (timer) { clearTimeout(timer); flush() } })

const users = () => {
    if (cache) return cache
    cache = {}
    try {
        const j = JSON.parse(fs.readFileSync(FILE, 'utf8'))
        if (j?.users && typeof j.users === 'object') cache = j.users
    } catch {}
    // pindahan dari versi lama (disimpan di tools.json -> global.db.userCreds), sekali saja
    try {
        const old = global.db?.userCreds
        if (old && typeof old === 'object' && Object.keys(old).length) {
            for (const [n, v] of Object.entries(old)) cache[n] = { ...v, ...(cache[n] || {}) }
            delete global.db.userCreds
            save()
        }
    } catch {}
    return cache
}

/** Data milik satu user untuk satu service (atau null). */
export function getOwn(sender, service) {
    const n = numOf(sender)
    const rec = n ? users()[n]?.[service] : null
    const meta = SERVICES[service]
    return rec && meta && rec[meta.main] ? { ...rec } : null
}

/** Semua service yang sudah disimpan satu user: { github: {...}, ... } */
export function allOwn(sender) {
    const out = {}
    for (const svc of Object.keys(SERVICES)) { const v = getOwn(sender, svc); if (v) out[svc] = v }
    return out
}

/** Simpan / ganti token. Mengembalikan 'baru' (belum pernah ada) atau 'diganti' (menimpa yang lama), false kalau gagal. */
export function setOwn(sender, service, values) {
    const n = numOf(sender)
    const meta = SERVICES[service]
    if (!n || !meta) return false
    const all = users()
    const cur = (all[n] ||= {})
    const had = !!cur[service]?.[meta.main]
    const next = { ...(cur[service] || {}) }
    for (const f of meta.fields) if (values[f] !== undefined) next[f] = String(values[f]).trim()
    next.updatedAt = Date.now()
    cur[service] = next
    save()
    return had ? 'diganti' : 'baru'
}

/** Reset: hapus satu field, satu service, atau (service kosong) semua milik user. */
export function delOwn(sender, service, field) {
    const n = numOf(sender)
    const all = users()
    const rec = n ? all[n] : null
    if (!rec) return false
    if (!service) delete all[n]
    else {
        if (!rec[service]) return false
        if (field) delete rec[service][field]
        else delete rec[service]
        if (!Object.keys(rec).length) delete all[n]
    }
    save()
    return true
}

const fromConfig = (service) => {
    if (service === 'github') return { token: global.tokengh || '' }
    if (service === 'vercel') return { token: global.vercel?.token || '', teamId: global.vercel?.teamId || '' }
    if (service === 'digitalocean') return { token: global.digitalocean?.token || '' }
    if (service === 'panel') return { domain: global.panel?.domain || '', plta: global.panel?.plta || '', pltc: global.panel?.pltc || '' }
    return {}
}

/**
 * Kredensial yang berlaku untuk perintah yang sedang berjalan.
 * Hasil: { ...field, source: 'user' | 'config' | 'none' }
 *   user   -> token milik pengirim
 *   config -> bawaan config.js (hanya owner, atau pemanggilan internal tanpa konteks user)
 *   none   -> belum ada
 */
export function resolve(service) {
    const ctx = credCtx.getStore()
    if (!ctx?.sender) {
        const c = fromConfig(service)
        return { ...c, source: c[SERVICES[service].main] ? 'config' : 'none' }
    }
    const own = getOwn(ctx.sender, service)
    if (own) return { ...own, source: 'user' }
    if (ctx.isOwner) {
        const c = fromConfig(service)
        return { ...c, source: c[SERVICES[service].main] ? 'config' : 'none' }
    }
    return { source: 'none' }
}

export const mask = (v) => {
    const s = String(v || '')
    if (!s) return '(kosong)'
    return s.length <= 12 ? s.slice(0, 2) + '••••' : `${s.slice(0, 6)}••••${s.slice(-4)}`
}

/**
 * Pengaman untuk command set*: token jangan diketik di grup, dan pesan yang berisi token dihapus.
 * Mengembalikan true kalau boleh lanjut.
 */
export async function secretGuard(sock, m, reply, prefix = '.') {
    if (m.isGroup) {
        await reply(`⚠️ Jangan kirim token di grup. Buka *chat pribadi* dengan bot lalu ulangi perintahnya.`)
        return false
    }
    return true
}

export async function wipeMessage(sock, m) {
    try { await sock.sendMessage(m.chat, { delete: m.key }) } catch {}
}
