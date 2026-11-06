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

// Data akses: premium, warn, mute, ban, owner tambahan, dan statistik.

import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { resolve as resolveCred } from './usercreds.js'

// ───────── dari file pecahan lain ─────────
import { isOwnerNumber, jidNumber, resolvePhone, saveDB, sleep } from './system.js'

// ═══════════════════════════════════════════════════════════════
// ───────── akses: premium, warn, mute, dan owner tambahan ─────────
// (dulunya lib/access.js)
//
// Semua disimpan di global.db (database/bot.json, rpg.json, store.json, tools.json):
//   db.premium            { [kunci]: { ids, label, until, added } }       until = ms, null = permanen
//   db.owners             ['628xxx', ...]                                 owner tambahan (di luar config.js)
//   db.groups[jid].warn   { limit, users: { [kunci]: { ids, label, count, reasons, last } } }
//   db.groups[jid].muted  { [kunci]: { ids, jid, at } }
//
// WhatsApp memakai dua jenis ID untuk satu orang (nomor @s.whatsapp.net dan @lid), jadi
// setiap orang disimpan sebagai daftar `ids` dan dicocokkan lewat irisan, bukan satu ID.
// ═══════════════════════════════════════════════════════════════

export const userOf = jidNumber
export const digits = (s) => String(s || '').replace(/\D/g, '')
export const memberIds = (p) => [p?.id, p?.lid, p?.phoneNumber, p?.jid].filter(Boolean).map(userOf)

// tandai database berubah lalu simpan
const touchDB = () => saveDB(global.db)
const hasKeys = (o) => !!o && Object.keys(o).length > 0

function findKey(tbl, ids) {
    if (!tbl) return null
    for (const [k, v] of Object.entries(tbl)) if (v?.ids?.some(i => ids.includes(i))) return k
    return null
}

// ───────── identitas ─────────

/** Semua ID (nomor + LID) yang diketahui untuk satu atau beberapa jid. */
export async function resolveIds(sock, jids, meta = null) {
    const ids = new Set()
    for (const raw of new Set([].concat(jids).filter(Boolean))) {
        const jid = String(raw).replace(/:\d+@/, '@')
        const u = userOf(jid)
        if (!u) continue
        ids.add(u)

        const p = meta?.participants?.find(x => memberIds(x).includes(u))
        if (p) { memberIds(p).forEach(i => ids.add(i)); continue }

        try {
            const map = sock?.signalRepository?.lidMapping
            if (jid.endsWith('@lid')) {
                const pn = await map?.getPNForLID?.(jid)
                if (pn) ids.add(userOf(pn))
            } else if (jid.endsWith('@s.whatsapp.net')) {
                const lid = await map?.getLIDForPN?.(jid)
                if (lid) ids.add(userOf(lid))
            }
        } catch {}
    }
    return [...ids]
}

/** Nomor telepon (angka saja) dari jid, atau null kalau tidak bisa diketahui. */
export async function phoneOf(sock, jid, meta = null) {
    if (!jid) return null
    const clean = String(jid).replace(/:\d+@/, '@')
    if (!clean.includes('@') || clean.endsWith('@s.whatsapp.net')) return digits(userOf(clean)) || null

    const u = userOf(clean)
    const p = meta?.participants?.find(x => memberIds(x).includes(u))
    if (p?.phoneNumber) return digits(userOf(p.phoneNumber)) || null
    if (p?.id && String(p.id).endsWith('@s.whatsapp.net')) return userOf(p.id)
    try {
        const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(clean)
        if (pn) return digits(userOf(pn)) || null
    } catch {}
    return null
}

/** Target dari mention, reply, atau nomor yang diketik. */
export function pickTargetJid(m, text = '') {
    const mention = m.mentionedJid?.[0]
    if (mention) return mention
    if (m.quoted?.sender) return m.quoted.sender
    const num = String(text).match(/\d{8,15}/)?.[0]
    return num ? `${num.replace(/^0/, '62')}@s.whatsapp.net` : null
}

// ───────── durasi ─────────
const DAY = 864e5
const DURATION_UNITS = { m: 6e4, menit: 6e4, h: 36e5, jam: 36e5, d: DAY, hari: DAY, w: 7 * DAY, minggu: 7 * DAY, mo: 30 * DAY, bulan: 30 * DAY, y: 365 * DAY, tahun: 365 * DAY }
const FOREVER_WORDS = ['perm', 'permanent', 'permanen', 'selamanya', 'forever', 'lifetime']

/** '30d' -> { ms: 2592000000 }, 'perm' -> { ms: null }, selain itu null. */
export function parseDuration(input) {
    const s = String(input || '').toLowerCase().trim()
    if (FOREVER_WORDS.includes(s)) return { ms: null }
    const m = s.match(/^(\d{1,4})(h|jam|m|menit|d|hari|w|minggu|mo|bulan|y|tahun)$/)
    if (!m || !Number(m[1])) return null
    return { ms: Number(m[1]) * DURATION_UNITS[m[2]] }
}

export function formatRemaining(until) {
    if (until === null || until === undefined) return 'permanen'
    const left = until - Date.now()
    if (left <= 0) return 'habis'
    const d = Math.floor(left / DAY)
    const h = Math.floor((left % DAY) / 36e5)
    const mnt = Math.floor((left % 36e5) / 6e4)
    if (d) return `${d} hari ${h} jam`
    if (h) return `${h} jam ${mnt} menit`
    return `${Math.max(1, mnt)} menit`
}

// format tanggal
export const formatDate = (ms) => new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })

// ───────── premium ─────────

/** Cari premium aktif untuk salah satu ids. Entri kedaluwarsa dibersihkan di sini. */
export function findPremium(ids) {
    const tbl = global.db?.premium
    if (!hasKeys(tbl)) return null

    const now = Date.now()
    let found = null
    let dirty = false
    for (const [k, v] of Object.entries(tbl)) {
        if (v.until !== null && v.until <= now) { delete tbl[k]; dirty = true; continue }
        if (!found && v.ids?.some(i => ids.includes(i))) found = [k, v]
    }
    if (dirty) touchDB()
    return found
}

// cek user premium
export async function isPremiumUser(sock, m, sender, meta = null) {
    if (!hasKeys(global.db?.premium)) return false // jalur cepat: belum ada premium sama sekali
    const ids = await resolveIds(sock, [sender, m.key?.participantAlt, m.key?.participantPn], meta)
    return !!findPremium(ids)
}

/** ms = null -> permanen. Kalau sudah premium, masa aktif diperpanjang. */
export function addPremium(ids, label, ms, jid = null) {
    const tbl = global.db.premium || (global.db.premium = {})
    const key = findKey(tbl, ids) || ids[0]
    const cur = tbl[key]
    const now = Date.now()

    let until
    if (ms === null) until = null
    else if (cur && cur.until === null) until = null // sudah permanen, tidak dipersingkat
    else until = Math.max(now, cur?.until || 0) + ms

    tbl[key] = { ids: [...new Set([...(cur?.ids || []), ...ids])], label: label || cur?.label || ids[0], jid: jid || cur?.jid, until, added: cur?.added || now, notified: {} } // notified direset tiap diperpanjang
    touchDB()
    return { entry: tbl[key], extended: !!cur }
}

// hapus premium
export function delPremium(ids) {
    const tbl = global.db?.premium
    const key = findKey(tbl, ids)
    if (!key) return false
    delete tbl[key]
    touchDB()
    return true
}

// daftar premium
export function listPremium() {
    findPremium([]) // bersihkan yang kedaluwarsa
    return Object.values(global.db?.premium || {}).sort((a, b) => (a.until ?? Infinity) - (b.until ?? Infinity))
}

// ───────── owner tambahan ─────────
export const dbOwners = () => (Array.isArray(global.db?.owners) ? global.db.owners : [])

// tambah owner lewat chat
export function addDbOwner(number) {
    const n = digits(number)
    if (!n || dbOwners().includes(n)) return false
    global.db.owners = [...dbOwners(), n] // assign ke proxy -> otomatis tersimpan
    return true
}

// hapus owner lewat chat
export function delDbOwner(number) {
    const n = digits(number)
    if (!dbOwners().includes(n)) return false
    global.db.owners = dbOwners().filter(x => x !== n)
    return true
}

// ───────── grup: data per grup ─────────
function groupData(jid, create = false) {
    const groups = global.db.groups || (global.db.groups = {})
    return groups[jid] || (create ? (groups[jid] = {}) : null)
}

// ───────── warn ─────────
export const DEFAULT_WARN_LIMIT = 3

// batas warn sebelum kick
export function warnLimit(jid) {
    return Number(groupData(jid)?.warn?.limit) || DEFAULT_WARN_LIMIT
}

// atur batas warn
export function setWarnLimit(jid, n) {
    const g = groupData(jid, true)
    g.warn = { users: {}, ...(g.warn || {}), limit: n }
    touchDB()
}

/** Tambah 1 warn. Mengembalikan { count, limit }. */
export function addWarn(jid, ids, reason = '', memberJid = '') {
    const g = groupData(jid, true)
    g.warn ||= { users: {} }
    g.warn.users ||= {}
    const users = g.warn.users
    const key = findKey(users, ids) || ids[0]
    const cur = users[key] || { ids: [], count: 0, reasons: [] }

    users[key] = {
        ids: [...new Set([...cur.ids, ...ids])],
        jid: memberJid || cur.jid,
        label: userOf(memberJid) || cur.label || ids[0],
        count: cur.count + 1,
        reasons: [...cur.reasons, String(reason).slice(0, 80)].slice(-10),
        last: Date.now()
    }
    touchDB()
    return { count: users[key].count, limit: warnLimit(jid) }
}

// lihat warn
export function getWarn(jid, ids) {
    const users = groupData(jid)?.warn?.users
    const key = findKey(users, ids)
    return key ? users[key] : null
}

/** Kurangi warn. Mengembalikan jumlah baru, atau null kalau orangnya tidak punya warn. */
export function removeWarn(jid, ids) {
    const users = groupData(jid)?.warn?.users
    const key = findKey(users, ids)
    if (!key) return null
    users[key].count -= 1
    users[key].reasons = users[key].reasons.slice(0, -1)
    const left = users[key].count
    if (left <= 0) delete users[key]
    touchDB()
    return Math.max(0, left)
}

// reset warn
export function resetWarn(jid, ids) {
    const users = groupData(jid)?.warn?.users
    if (!users) return false
    if (!ids) {
        const had = hasKeys(users)
        groupData(jid).warn.users = {}
        touchDB()
        return had
    }
    const key = findKey(users, ids)
    if (!key) return false
    delete users[key]
    touchDB()
    return true
}

// daftar warn
export const listWarn = (jid) => Object.values(groupData(jid)?.warn?.users || {}).sort((a, b) => b.count - a.count)

// ───────── mute ─────────
/** ms = null -> mute tanpa batas waktu. */
export function addMute(jid, ids, memberJid, ms = null) {
    const g = groupData(jid, true)
    g.muted ||= {}
    const key = findKey(g.muted, ids) || ids[0]
    const now = Date.now()
    g.muted[key] = { ids: [...new Set([...(g.muted[key]?.ids || []), ...ids])], jid: memberJid, at: now, until: ms === null ? null : now + ms }
    touchDB()
}

/** Buang mute yang masa berlakunya habis (dipanggil lewat hasMutes/isMutedIds/listMute). */
function pruneMutes(g) {
    const muted = g?.muted
    if (!muted) return
    const now = Date.now()
    let dirty = false
    for (const [k, v] of Object.entries(muted)) if (v.until && v.until <= now) { delete muted[k]; dirty = true }
    if (dirty) touchDB()
}

// hapus mute
export function delMute(jid, ids) {
    const muted = groupData(jid)?.muted
    const key = findKey(muted, ids)
    if (!key) return false
    delete muted[key]
    touchDB()
    return true
}

// hapus semua mute
export function clearMute(jid) {
    const g = groupData(jid)
    if (!hasKeys(g?.muted)) return 0
    const n = Object.keys(g.muted).length
    g.muted = {}
    touchDB()
    return n
}

// daftar mute
export const listMute = (jid) => { const g = groupData(jid); pruneMutes(g); return Object.values(g?.muted || {}) }
// cek apakah user sedang di-mute
export const isMutedIds = (muted, ids) => hasKeys(muted) && !!findKey(muted, ids)
// cek apakah ada mute aktif
export const hasMutes = (g) => { pruneMutes(g); return hasKeys(g?.muted) }

// ───────── banchat ─────────
export const isChatBanned = (jid) => !!global.db?.groups?.[jid]?.banned

// ban / unban chat
export function setChatBanned(jid, on, name = '') {
    const g = groupData(jid, true)
    if (on) {
        g.banned = true
        if (name) g.bannedName = name
    } else {
        delete g.banned
        delete g.bannedName
    }
    touchDB()
}

// ───────── grupbot (whitelist grup) ─────────
// Aktif kalau global.grupbot = true (config.js). Grup yang masuk daftar (global.db.groups[jid].allowed)
// bisa dipakai SEMUA member walau bot mode self; grup di luar daftar tidak dilayani selain owner.
export const isGroupbotOn = () => global.grupbot === true
export const isGroupAllowed = (jid) => !!global.db?.groups?.[jid]?.allowed

export function setGroupAllowed(jid, on, name = '', by = '') {
    const g = groupData(jid, true)
    if (on) {
        g.allowed = true
        g.allowedAt = Date.now()
        if (name) g.allowedName = name
        if (by) g.allowedBy = by
    } else {
        delete g.allowed
        delete g.allowedAt
        delete g.allowedName
        delete g.allowedBy
    }
    touchDB()
}

export const listAllowedGroups = () =>
    Object.entries(global.db?.groups || {}).filter(([, g]) => g?.allowed).map(([jid, g]) => ({ jid, name: g.allowedName || '', at: g.allowedAt || 0 }))

// daftar chat di-ban
export const listBannedChats = () =>
    Object.entries(global.db?.groups || {}).filter(([, g]) => g?.banned).map(([jid, g]) => ({ jid, name: g.bannedName || '' }))

// ───────── ban user ─────────
// global.db.banUsers: { <id>: { ids, label, jid, reason, at } } (pola sama dengan premium; ids = nomor + LID)
export async function isUserBanned(sock, m, sender, meta = null) {
    if (!hasKeys(global.db?.banUsers)) return false // jalur cepat: belum ada user yang di-ban
    const ids = await resolveIds(sock, [sender, m.key?.participantAlt, m.key?.participantPn], meta)
    return !!findKey(global.db.banUsers, ids)
}

// ban user
export function addBannedUser(ids, label, reason = '', jid = null) {
    const tbl = global.db.banUsers || (global.db.banUsers = {})
    const key = findKey(tbl, ids) || ids[0]
    const cur = tbl[key]
    tbl[key] = {
        ids: [...new Set([...(cur?.ids || []), ...ids])],
        label: label || cur?.label || ids[0],
        jid: jid || cur?.jid,
        reason: reason || cur?.reason || '',
        at: cur?.at || Date.now()
    }
    touchDB()
    return { entry: tbl[key], already: !!cur }
}

// unban user
export function delBannedUser(ids) {
    const tbl = global.db?.banUsers
    const key = findKey(tbl, ids)
    if (!key) return false
    delete tbl[key]
    touchDB()
    return true
}

// daftar user di-ban
export const listBannedUsers = () =>
    Object.entries(global.db?.banUsers || {}).map(([key, v]) => ({ key, ...v })).sort((a, b) => (a.at || 0) - (b.at || 0))

// ───────── pengingat premium hampir habis (H-3 dan H-1) ─────────
const REMIND_STAGES = [{ key: 'd1', before: 1 * DAY }, { key: 'd3', before: 3 * DAY }] // dicek dari yang paling dekat
let premiumTimer = null

async function remindPremiumOnce(getSock) {
    const sock = getSock()
    const tbl = global.db?.premium
    if (!sock?.user || !hasKeys(tbl)) return

    const now = Date.now()
    for (const e of Object.values(tbl)) {
        if (e.until === null || e.until <= now) continue
        const left = e.until - now
        const stage = REMIND_STAGES.find(s => left <= s.before)
        const flags = e.notified || {}
        if (!stage || flags[stage.key]) continue

        const to = e.jid || `${e.label}@s.whatsapp.net`
        const text = `⏰ *Premium hampir habis*\nSisa masa aktif: *${formatRemaining(e.until)}*\nBerakhir: ${formatDate(e.until)}\n\nHubungi owner untuk memperpanjang.`
        const sent = await sock.sendMessage(to, { text }).then(() => true).catch(() => false)
        if (sent) {
            // tahap yang lebih jauh ikut ditandai supaya tidak dikirim dobel
            e.notified = { ...flags, ...Object.fromEntries(REMIND_STAGES.filter(s => s.before >= stage.before).map(s => [s.key, true])) }
            touchDB()
            await sleep(3000) // jeda antar pesan, hindari kena limit
        }
    }
}

/** Jalankan pengingat tiap jam. Aman dipanggil berulang (tiap reconnect) - timer hanya satu. */
export function startPremiumReminder(getSock) {
    if (premiumTimer) return
    setTimeout(() => remindPremiumOnce(getSock).catch(() => {}), 30_000)
    premiumTimer = setInterval(() => remindPremiumOnce(getSock).catch(() => {}), 36e5)
    premiumTimer.unref?.()
}


// ───────── github (dipakai plugins/github/*) ─────────
// Token: milik user yang menjalankan perintah (.settoken), owner boleh pakai bawaan global.tokengh (config.js).
// User biasa tanpa token tetap bisa baca data publik (tanpa Authorization), tapi tidak bisa memakai token owner.
export const ghToken = () => resolveCred('github').token || ''
export const ghHeaders = (json = false) => {
    const h = { 'user-agent': 'Mozilla/5.0', Accept: 'application/vnd.github+json' }
    const t = ghToken()
    if (t) h.Authorization = `token ${t}`
    if (json) h['Content-Type'] = 'application/json'
    return h
}

export const ghGet = (url, opts = {}) => axios.get(url, { headers: ghHeaders(), timeout: 15000, ...opts })

export const ghErrMsg = (e) => e?.response?.data?.message || e?.message || 'Terjadi kesalahan'

export const ghNoToken = (prefix) =>
    `❌ *Token GitHub kamu belum diset!*\n\nBuka chat pribadi bot lalu ketik:\n*${prefix}settoken ghp_xxxx*\n\nBuat token di github.com/settings/tokens (centang scope repo).`

// kirim pesan dengan tombol; kalau gagal (mis. platform tidak mendukung) jatuh ke teks biasa
export async function ghSendButtons(sock, m, { text, footer, image, buttons }) {
    try {
        await sock.sendButtons(m.chat, { text, footer, image: image ? { url: image } : undefined, buttons }, { quoted: m })
    } catch {
        if (image) await sock.sendMessage(m.chat, { image: { url: image }, caption: text }, { quoted: m })
        else await sock.sendMessage(m.chat, { text }, { quoted: m })
    }
}


// ───────── statistik command (.topcmd) ─────────
// global.db.stats: { since, total, cmd: {nama: n}, users: {id: {n, name}}, days: {'YYYY-MM-DD': n} }
const wibDay = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10)

// catat statistik pemakaian command
export function recordCommand(command, sender, name = '') {
    if (!command) return
    const s = global.db.stats || (global.db.stats = { since: Date.now(), total: 0, cmd: {}, users: {}, days: {} })
    s.cmd ||= {}; s.users ||= {}; s.days ||= {}
    s.total = (s.total || 0) + 1
    s.cmd[command] = (s.cmd[command] || 0) + 1

    const key = userOf(sender)
    if (key) {
        const u = (s.users[key] ||= { n: 0, name: '' })
        u.n++
        if (name && name !== 'Unknown') u.name = name
    }

    const today = wibDay()
    s.days[today] = (s.days[today] || 0) + 1
    const days = Object.keys(s.days)
    if (days.length > 30) for (const d of days.sort().slice(0, days.length - 30)) delete s.days[d]
    touchDB()
}

// ambil statistik command
export function getStats() {
    const s = global.db?.stats || { since: Date.now(), total: 0, cmd: {}, users: {}, days: {} }
    const top = (obj, pick) => Object.entries(obj || {}).map(pick).sort((a, b) => b[1] - a[1])
    return {
        since: s.since,
        total: s.total || 0,
        today: s.days?.[wibDay()] || 0,
        commands: top(s.cmd, ([k, v]) => [k, v]),
        users: top(s.users, ([k, v]) => [v.name || `+${k}`, v.n])
    }
}

// reset statistik command
export function resetStats() {
    global.db.stats = { since: Date.now(), total: 0, cmd: {}, users: {}, days: {} }
}

// ───────── pengingat (.ingatkan) ─────────
// global.db.reminders: [{ id, chat, sender, text, due, at }]
const REMINDER_TICK = 15_000
let reminderTimer = null

// daftar pengingat
export const listReminders = () => (Array.isArray(global.db?.reminders) ? global.db.reminders : [])

// tambah pengingat
export function addReminder({ chat, sender, text, due }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    global.db.reminders = [...listReminders(), { id, chat, sender, text, due, at: Date.now() }] // assign ke proxy -> tersimpan
    return id
}

// hapus pengingat
export function delReminders(pred) {
    const all = listReminders()
    const keep = all.filter(r => !pred(r))
    if (keep.length !== all.length) global.db.reminders = keep
    return all.length - keep.length
}

async function remindOnce(getSock) {
    const sock = getSock?.()
    if (!sock) return
    const now = Date.now()
    for (const r of listReminders().filter(x => x.due <= now)) {
        try {
            const inGroup = String(r.chat).endsWith('@g.us')
            const late = now - r.due > 120_000
            await sock.sendMessage(r.chat, {
                text: `⏰ *PENGINGAT*\n\n${inGroup ? `@${userOf(r.sender)} ` : ''}${r.text}${late ? '\n\n_(terlambat, bot sempat offline)_' : ''}`,
                mentions: inGroup ? [r.sender] : []
            })
            delReminders(x => x.id === r.id)
        } catch {
            r.tries = (r.tries || 0) + 1 // koneksi putus: coba lagi di putaran berikutnya
            if (r.tries >= 20) delReminders(x => x.id === r.id)
        }
    }
}

// jalankan pengecek pengingat berkala
export function startReminders(getSock) {
    if (reminderTimer) return
    reminderTimer = setInterval(() => remindOnce(getSock).catch(() => {}), REMINDER_TICK)
    reminderTimer.unref?.()
}

// ───────── anti-call ─────────
// global.anticall: 'off' | 'tolak' (tolak telepon) | 'block' (tolak + blokir penelepon). Owner dikecualikan.
const callWarned = new Map()

// tangani panggilan masuk (tolak/peringatkan)
export async function onCall(sock, calls) {
    const mode = String(global.anticall || 'off').toLowerCase()
    if (mode !== 'tolak' && mode !== 'block') return

    for (const call of calls || []) {
        if (call.status !== 'offer') continue
        try {
            const caller = call.from || call.chatId
            const number = (await resolvePhone(sock, caller)) || jidNumber(caller)
            if (await isOwnerNumber(sock, number) || await isOwnerNumber(sock, jidNumber(caller))) continue

            await sock.rejectCall(call.id, call.from)

            const last = callWarned.get(caller) || 0
            if (Date.now() - last > 60_000) {
                callWarned.set(caller, Date.now())
                await sock.sendMessage(caller, {
                    text: mode === 'block'
                        ? '📵 Bot tidak menerima telepon. Kamu diblokir karena menelepon bot.'
                        : '📵 Bot tidak menerima telepon. Silakan kirim pesan teks saja ya.'
                }).catch(() => {})
            }
            if (mode === 'block') await sock.updateBlockStatus(caller, 'block')
        } catch (e) {
            console.error('[ANTICALL]', e?.message || e)
        }
    }
}


// ───────── sewa bot ─────────
// global.db.sewa = { rentals: { <jidGrup>: { jid, name, until, added, by, plan, notified, expiredNotice, left } }, orders, seq }
// until = null -> permanen. Gerbang pemakaian ada di handler.js (aktif kalau global.sewamode = true).
export const sewaData = () => {
    const d = (global.db.sewa ||= {})
    d.rentals ||= {}
    d.orders ||= {}
    d.seq ||= 0
    return d
}

// cek sewa satu grup
export const getRental = (jid) => global.db?.sewa?.rentals?.[jid] || null
// cek grup masih menyewa
export const isGroupRented = (jid) => {
    const r = getRental(jid)
    return !!r && (r.until === null || r.until > Date.now())
}
// daftar sewa
export const listRentals = () => Object.values(global.db?.sewa?.rentals || {})

/** ms = null -> permanen. Kalau sewa masih aktif, masa sewa diperpanjang dari sisa waktunya. */
export function activateRental(jid, ms, { name = '', by = '', plan = '' } = {}) {
    const d = sewaData()
    const cur = d.rentals[jid]
    const now = Date.now()
    const active = !!cur && (cur.until === null || cur.until > now)

    let until
    if (ms === null) until = null
    else if (active && cur.until === null) until = null // sudah permanen, tidak dipersingkat
    else until = (active ? cur.until : now) + ms

    d.rentals[jid] = {
        jid, name: name || cur?.name || '', until, added: now, firstAdded: cur?.firstAdded || now,
        by: by || cur?.by || '', plan: plan || cur?.plan || '', notified: {}, expiredNotice: false
    }
    touchDB()
    return { rental: d.rentals[jid], extended: active }
}

// hapus sewa grup
export function removeRental(jid) {
    const d = sewaData()
    if (!d.rentals[jid]) return false
    delete d.rentals[jid]
    touchDB()
    return true
}

const SEWA_TICK = 5 * 60_000
const SEWA_STAGES = [72, 24, 3] // jam sebelum habis
let sewaTimer = null

async function sewaOnce(getSock) {
    const sock = getSock?.()
    if (!sock || global.sewamode !== true) return
    const now = Date.now()

    for (const r of listRentals()) {
        if (r.until === null || r.left) continue
        const left = r.until - now

        if (left <= 0) {
            if (r.expiredNotice) continue
            r.expiredNotice = true
            touchDB()
            const leave = global.sewaAutoLeave !== false
            await sock.sendMessage(r.jid, {
                text: `⌛ *MASA SEWA BOT HABIS*\n\n${leave ? 'Bot akan keluar dari grup ini. ' : 'Bot tidak akan merespon lagi sampai sewa diperpanjang. '}Untuk memperpanjang, ketik *.sewa* lalu pilih paket.`
            }).catch(() => {})
            if (leave) {
                await sleep(3000)
                await sock.groupLeave(r.jid).catch(() => {})
                r.left = true
                touchDB()
            }
            continue
        }

        if (now - r.added < 36e5) continue // jangan kirim pengingat sesaat setelah sewa dibayar
        const crossed = SEWA_STAGES.filter(h => left <= h * 36e5)
        if (!crossed.length) continue
        const stage = Math.min(...crossed)
        r.notified ||= {}
        if (r.notified[stage]) continue
        for (const h of crossed) r.notified[h] = true
        touchDB()
        await sock.sendMessage(r.jid, {
            text: `⏰ *PENGINGAT SEWA BOT*\n\nMasa sewa bot di grup ini tinggal *${formatRemaining(r.until)}* (sampai ${formatDate(r.until)}).\nPerpanjang dengan *.sewa* sebelum habis ya.`
        }).catch(() => {})
    }
}

// pantau masa sewa & ingatkan/keluar grup
export function startSewaWatcher(getSock) {
    if (sewaTimer) return
    setTimeout(() => sewaOnce(getSock).catch(() => {}), 45_000)
    sewaTimer = setInterval(() => sewaOnce(getSock).catch(() => {}), SEWA_TICK)
    sewaTimer.unref?.()
}


// ╔══════════════ [ gaya.js ] ══════════════╗

// Gaya teks bersama untuk fitur anime & asisten harian.
// B() = tebal ala WhatsApp, cut() = potong teks aman untuk karakter multi-byte.
export const B = (t) => `*${String(t ?? '')}*`
export const plain = (t) => String(t ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim()
export const cut = (t, n) => {
    const a = Array.from(String(t ?? ''))
    return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('')
}


// ╔══════════════ [ asisten.js ] ══════════════╗

// helper asisten harian: simpan data per user, tanggal WIB, parse nominal & rupiah
export const asisten = (() => {
  // Helper bersama asisten harian: penyimpanan per-user (db/asisten.json), tanggal WIB, nominal, rupiah
  // data disimpan di global.db.asisten (database/tools.json); dibaca lazy karena database baru siap setelah start
  const D = () => (global.db.asisten ||= {})
  const save = () => saveDB(global.db)

  const get = (jid, key, fb) => (D()[jid] && D()[jid][key] !== undefined ? D()[jid][key] : fb)
  const set = (jid, key, val) => { (D()[jid] = D()[jid] || {})[key] = val; save(); return val }
  const all = () => D()

  const TZ = 'Asia/Jakarta'
  const dayKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const addDays = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const fmtTanggal = (k) => { const d = new Date(k + 'T00:00:00Z'); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }

  function parseTanggal(str) {
    if (!str) return null
    const s = String(str).trim().toLowerCase()
    if (s === 'hariini') return dayKey()
    if (s === 'besok') return addDays(dayKey(), 1)
    if (s === 'kemarin') return addDays(dayKey(), -1)
    let y, mo, d, m
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [, y, mo, d] = m
    else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [, d, mo, y] = m
    else return null
    y = +y; mo = +mo; d = +d
    const dt = new Date(Date.UTC(y, mo - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null
  }

  // 5jt, 500rb, 2,5jt, 1.500.000, 25k, 1m(iliar)
  function parseNominal(str) {
    if (str === undefined || str === null) return NaN
    let s = String(str).toLowerCase().replace(/rp\.?|\s/g, ''), mult = 1
    const suf = s.match(/(juta|jt|ribu|rb|k|miliar|m)$/)
    if (suf) { mult = { juta: 1e6, jt: 1e6, ribu: 1e3, rb: 1e3, k: 1e3, miliar: 1e9, m: 1e9 }[suf[1]]; s = s.slice(0, -suf[1].length) }
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); else s = s.replace(/,/g, '.')
    const n = parseFloat(s)
    return Number.isFinite(n) && /^[\d.]+$/.test(s) ? n * mult : NaN
  }
  const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID')
  const bar = (f, len = 10) => { const on = Math.round(Math.max(0, Math.min(1, f)) * len); return '█'.repeat(on) + '░'.repeat(len - on) }
  const quotedText = (m) => ((m.quoted && (m.quoted.text || m.quoted.caption)) || '').trim()
  const mentions = (m) => [...new Set([...(m.msg?.contextInfo?.mentionedJid || []), ...(m.mentionedJid || [])])]

  return { get, set, all, dayKey, addDays, fmtTanggal, parseTanggal, parseNominal, rupiah, bar, quotedText, mentions, BULAN, HARI }
})()

// ---- tampilan balasan (emoji) ----
export const emo = {
  sukses: '', gagal: '', warn: '', info: '', tunggu: '',
  tanya: '', bullet: '', cabang: '', ujung: '', panah: '', bintang: '', waktu: ''
}

export const judul = (teks, e = emo.sukses) => `${e} ${String(teks).toUpperCase()} ${e}`
export const sukses = (teks) => `${emo.sukses} ${teks}`
export const gagal = (teks) => `${emo.gagal} ${teks}`
export const peringatan = (teks) => `${emo.warn} ${teks}`
export const info = (teks) => `${emo.info} ${teks}`
export const tunggu = (teks = 'Tunggu sebentar ya...') => `${emo.tunggu} ${teks}`

export const contoh = (pakai) =>
  `${emo.info} Format salah\n\n${emo.tanya} Contoh:\n${pakai}\n\n${emo.bintang} Gunakan format yang benar`

// buat kartu teks berjudul
export function kartu(title, isi = [], penutup = '') {
  const ikon = [emo.info, emo.tanya, emo.waktu, emo.panah, emo.tunggu]
  const rows = isi
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([label, nilai], i) => `${ikon[i % ikon.length]} ${label} : ${nilai}`)
  const out = [judul(title), '', ...rows]
  if (penutup) out.push('', `${emo.bintang} ${penutup}`)
  return out.join('\n')
}

const GANTI = [
  [/⚠️|⚠/g, emo.warn],
  [/❌|✕|✖️|✖/g, emo.gagal],
  [/✅|✔️|✔|✓/g, emo.sukses],
  [/⛔|🚫/g, emo.gagal],
  [/☾/g, emo.sukses],
  [/┣/g, emo.cabang],
  [/┗/g, emo.ujung],
  [/➤|➜|▸/g, emo.panah],
  [/\[\s*!\s*\]|\[❗\]/g, emo.gagal]
]

// ubah teks jadi gaya imut
export function cute(teks) {
  if (typeof teks !== 'string' || !teks || teks.includes('⭕')) return teks
  let out = teks
  for (const [pola, ganti] of GANTI) out = out.replace(pola, ganti)
  return out.replace(/^([ \t]*)•[ \t]+/gm, `$1${emo.bullet} `)
}

// terapkan gaya imut ke isi pesan
export function cuteContent(content) {
  if (!content || typeof content !== 'object') return content
  for (const k of ['text', 'caption', 'footer', 'body']) {
    if (typeof content[k] === 'string') content[k] = cute(content[k])
  }
  return content
}
