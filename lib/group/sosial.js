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

// Helper fitur grup: poll, giveaway, XP chat, absen, dan captcha.

import { saveDB, sleep } from '../core/system.js'
import { isChatBanned } from '../core/data.js'
import { memberId } from '../platform/wa.js'
import { toPN, ensureUser, persist } from '../engine/plugins.js'

export const store = () => {
    if (!global.db.sosial) global.db.sosial = {}
    return global.db.sosial
}
export const save = () => { try { saveDB(global.db) } catch {} }

// ───────── data fitur grup: tersimpan PER GRUP di global.db.groups[jid] ─────────
//   groups[jid].poll      polling aktif / terakhir grup ini
//   groups[jid].giveaway  giveaway aktif / terakhir grup ini
//   groups[jid].xp        { on, users }                      XP chat grup ini
//   groups[jid].absen     { [nomor]: { streak, total, ... } } absen grup ini
//   groups[jid].captcha   { on, mode, timeout, pending }      captcha grup ini
// Data lama (global.db.sosial.poll / giveaway / xp / absen / captcha) dipindahkan otomatis ke grupnya masing-masing.
const LEGACY_GROUP_KEYS = ['poll', 'giveaway', 'xp', 'absen', 'captcha']
const migratedDbs = new WeakSet()

function migrateLegacyGroupData() {
    const s = global.db.sosial
    if (!s) return false
    const groups = (global.db.groups ||= {})
    let changed = false
    for (const k of LEGACY_GROUP_KEYS) {
        const tbl = s[k]
        if (!tbl) continue
        for (const [jid, v] of Object.entries(tbl)) {
            if (!v) continue
            if (k === 'captcha' && jid === '__pending') {
                // antrean verifikasi captcha dulu satu daftar bersama -> dipecah ke grup asalnya
                for (const p of Object.values(v)) {
                    if (!p?.group || !p?.key) continue
                    const c = ((groups[p.group] ||= {}).captcha ||= {})
                    ;(c.pending ||= {})[p.key] = p
                }
                continue
            }
            const g = (groups[jid] ||= {})
            if (k === 'captcha') g.captcha = { ...v, ...(g.captcha || {}) }
            else if (!(k in g)) g[k] = v
        }
        delete s[k]
        changed = true
    }
    return changed
}

const readyGroups = () => {
    const db = global.db
    if (db && !migratedDbs.has(db)) {
        migratedDbs.add(db)
        if (migrateLegacyGroupData()) save()
    }
}

/** Blok data satu grup (dibuat kalau belum ada). */
export const groupData = (jid) => {
    readyGroups()
    const groups = (global.db.groups ||= {})
    return (groups[jid] ||= {})
}

/** Blok data satu grup TANPA membuatnya (untuk jalur pasif yang jalan di setiap pesan). */
export const peekGroup = (jid) => {
    readyGroups()
    return global.db.groups?.[jid] || null
}

/** Semua grup yang punya data `key`: [[jid, blokGrup], ...] (untuk pemeriksa waktu / sweeper). */
export const groupsWith = (key) => {
    readyGroups()
    return Object.entries(global.db.groups || {}).filter(([, g]) => g && g[key])
}

export const num = (jid) => String(jid || '').split('@')[0].split(':')[0]
export const rupiah = (n) => Number(n || 0).toLocaleString('id-ID')

// "30s" "10m" "2h" "1d" -> ms (null kalau tidak valid)
export function parseDuration(str) {
    const m = String(str || '').trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d|detik|menit|jam|hari)$/)
    if (!m) return null
    const n = Number(m[1])
    const unit = { s: 1e3, detik: 1e3, m: 6e4, menit: 6e4, h: 36e5, jam: 36e5, d: 864e5, hari: 864e5 }[m[2]]
    return n * unit
}
export function formatDuration(ms) {
    ms = Math.max(0, ms)
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, mi = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60
    return [d && `${d}hr`, h && `${h}j`, mi && `${mi}m`, (!d && !h && s) && `${s}dtk`].filter(Boolean).join(' ') || '0d'
}

// tanggal WIB (UTC+7) sebagai 'YYYY-MM-DD'
export const wibDate = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10)
export const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

// kunci user konsisten (nomor telepon kalau bisa)
export async function userKey(sock, m) { return toPN(sock, m.sender) }

// tambah uang RPG ke user
export async function addMoney(sock, jid, pushName, amount) {
    const pn = await toPN(sock, jid)
    const u = ensureUser({ sender: pn, pushName: pushName || num(pn) })
    u.money = (Number(u.money) || 0) + amount
    persist()
    return u.money
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// simpan sock terakhir supaya timer / sweeper bisa mengirim pesan
export const rememberSock = (sock) => { if (sock) global.__sosialSock = sock }
export const getSock = () => global.__sosialSock

// ───────── Tahap 2: RPG ─────────
// data game (tower, peta, saham) di global.db.sosial.game
export const gameStore = () => {
    const s = store()
    if (!s.game) s.game = {}
    for (const k of ['tower', 'map', 'stock']) if (!s.game[k]) s.game[k] = {}
    return s.game
}

// user RPG (sama dengan yang dipakai .me / .inventory)
export async function rpgUser(sock, m) {
    const pn = await toPN(sock, m.sender)
    return { pn, user: ensureUser({ sender: pn, pushName: m.pushName || num(pn) }) }
}
export { persist }

// kekuatan tempur dari data RPG yang sudah ada (level, pedang, armor)
export function combatStats(u) {
    const lvl = Math.max(1, Number(u.level) || 1)
    const sword = Math.min(Number(u.sword) || 0, 1) * 15 + Math.min(Number(u.goldsword) || 0, 1) * 30
    const armor = Math.min(Number(u.armor) || 0, 1) * 8
    return { atk: 10 + lvl * 2 + sword, def: 2 + Math.floor(lvl / 2) + armor }
}

// simulasi duel otomatis. Mengembalikan { win, hpLeft, rounds }
export function simulateFight(playerHp, p, monster) {
    let hp = playerHp, mhp = monster.hp, rounds = 0
    const hit = (atk, def) => Math.max(1, Math.round((atk - def * 0.5) * (0.8 + Math.random() * 0.4)))
    while (hp > 0 && mhp > 0 && rounds < 60) {
        rounds++
        mhp -= hit(p.atk, monster.def || 0)
        if (mhp <= 0) break
        hp -= hit(monster.atk, p.def)
    }
    return { win: mhp <= 0 && hp > 0, hpLeft: Math.max(0, hp), rounds }
}

// minggu ISO sebagai kunci, mis. '2026-W43' (zona WIB)
export function weekKey(t = Date.now()) {
    const d = new Date(t + 7 * 36e5)
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const day = dt.getUTCDay() || 7
    dt.setUTCDate(dt.getUTCDate() + 4 - day)
    const y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
    return `${dt.getUTCFullYear()}-W${String(Math.ceil(((dt - y0) / 864e5 + 1) / 7)).padStart(2, '0')}`
}

// ───────── JPM: broadcast grup, auto broadcast, status grup, push kontak ─────────
// Dipakai plugins/jpm/* dan plugins/pushkontak/*. Pengaturan delay disimpan di global.db.sosial.jpm,
// job berulang (auto JPM / auto SWGC) disimpan di global.__jpmJobs supaya tetap utuh saat plugin di-reload.
export const JPM_DEFAULTS = { delayJpm: 3000, delayJpmTag: 3000, delayAutoSwgc: 60000, delayPushKontak: 2000 }
export const JPM_MIN_INTERVAL = 5000

export const jpmCfg = () => ({ ...JPM_DEFAULTS, ...(store().jpm || {}) })
export const jpmSetCfg = (key, value) => {
    const s = store()
    if (!s.jpm) s.jpm = {}
    s.jpm[key] = value
    save()
}

export const jpmJobs = () => (global.__jpmJobs ||= { autoJpm: null, autoJpmTag: null, autoSwgc: null, pushRunning: false })

// "60000" (ms) / "30s" / "5m" / "1h" -> ms (null kalau bukan interval)
export function parseInterval(raw) {
    const mt = String(raw || '').toLowerCase().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/)
    if (!mt) return null
    return Math.round(parseFloat(mt[1]) * { ms: 1, s: 1e3, m: 6e4, h: 36e5 }[mt[2] || 'ms'])
}

// pisahkan interval (kata pertama) dari isi pesan: "5m halo" -> { interval: 300000, teks: 'halo' }
export function splitInterval(text, fallbackMs = 60000) {
    const t = String(text || '').trim()
    const first = t.split(/\s+/)[0] || ''
    const ms = parseInterval(first)
    return ms === null ? { interval: fallbackMs, teks: t } : { interval: ms, teks: t.slice(first.length).trim() }
}

// semua grup tempat bot berada, kecuali grup yang di-banchat
// blacklist JPM (blacklistjpm) dan blacklist khusus auto JPM (blautojpm) disimpan di global.db.sosial.jpm
export const jpmBlacklist = (auto = false) => [...(store().jpm?.[auto ? 'blAuto' : 'blacklist'] || [])]
export const jpmSetBlacklist = (auto, list) => jpmSetCfg(auto ? 'blAuto' : 'blacklist', [...new Set(list)])

// opsi { auto: true } -> grup di blacklist auto JPM juga dilewati
export async function jpmGroups(sock, { auto = false } = {}) {
    const all = await sock.groupFetchAllParticipating()
    const skip = new Set([...jpmBlacklist(false), ...(auto ? jpmBlacklist(true) : [])])
    return Object.values(all).filter(g => !isChatBanned(g.id) && !skip.has(g.id))
}

// daftar mention + teks @nomor untuk semua member grup
export function tagList(meta) {
    const mentions = (meta.participants || []).map(p => p.id)
    return { mentions, text: mentions.map(id => `@${memberId(id)}`).join(' ') }
}

// media dari pesan yang di-reply (atau dari pesan perintah sendiri). kinds: jenis yang diterima.
const MEDIA_KIND = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', documentMessage: 'document', documentWithCaptionMessage: 'document' }
export async function getMedia(m, kinds = ['image', 'video']) {
    const node = m.quoted?.isMedia ? m.quoted : (m.isMedia ? m : null)
    if (!node || typeof node.download !== 'function') return null
    const kind = MEDIA_KIND[node.mtype]
    if (!kind || !kinds.includes(kind)) return null
    const info = node === m ? (m.msg || {}) : node
    const buffer = await node.download()
    if (!buffer) return null
    return { kind, buffer, mime: info.mimetype || '', fileName: info.fileName || 'file', ptt: !!info.ptt, caption: info.caption || '' }
}

// isi sendMessage dari media + caption (+ mentions)
export function mediaContent(media, caption = '', mentions) {
    const c = { [media.kind]: media.buffer }
    if (caption && media.kind !== 'audio') c.caption = caption
    if (media.kind !== 'image') c.mimetype = media.mime
    if (media.kind === 'audio') c.ptt = media.ptt
    if (media.kind === 'document') c.fileName = media.fileName
    if (mentions) c.mentions = mentions
    return c
}

// kirim ke tiap target berurutan dengan jeda. send(target) harus melempar error kalau gagal.
// flag global.__jpmRunning / __jpmStop dipakai plugin stopjpm untuk menghentikan JPM yang sedang jalan
export async function jpmLoop(targets, delay, send, isStopped = () => false) {
    let ok = 0
    let fail = 0
    global.__jpmRunning = true
    try {
        for (const t of targets) {
            if (isStopped() || global.__jpmStop) break
            try { await send(t); ok++ } catch (e) { fail++; console.error('[JPM]', e?.message || e) }
            await sleep(delay)
        }
    } finally {
        global.__jpmRunning = false
        global.__jpmStop = false
    }
    return { ok, fail }
}

// job berulang bernama `name`. tick(isStopped) tidak akan menumpuk kalau putaran sebelumnya belum selesai.
export function jpmStartJob(name, ms, tick) {
    const jobs = jpmJobs()
    jpmStopJob(name)
    let busy = false
    const job = { ms, startedAt: Date.now(), timer: null }
    job.timer = setInterval(async () => {
        if (busy) return
        busy = true
        try { await tick(() => jobs[name] !== job) } catch (e) { console.error(`[JPM:${name}]`, e?.message || e) } finally { busy = false }
    }, ms)
    jobs[name] = job
    return job
}
export function jpmStopJob(name) {
    const jobs = jpmJobs()
    const job = jobs[name]
    if (!job) return false
    clearInterval(job.timer)
    jobs[name] = null
    return true
}

// status grup WhatsApp (sama seperti plugins/group/swgc.js): teks berwarna, gambar, video, atau voice note
const STATUS_COLORS = [0x1E88E5, 0x25D366, 0xFFD600, 0xFF9800, 0xE53935, 0x8E24AA, 0x9E9E9E, 0x000000, 0x00BCD4]
export async function sendGroupStatus(sock, jid, { text = '', media = null, name, emoji = '✨' } = {}) {
    const { randomBytes } = await import('crypto')
    const contextInfo = {
        expiration: 86400,
        disappearingMode: { initiator: 0 },
        featureEligibilities: { cannotBeRanked: false, canBeReshared: true, canReceiveMultiReact: true },
        statusSourceType: 4,
        statusAttributions: [{ type: 10 }],
        isGroupStatus: true,
        statusAudienceMetadata: { audienceType: 2, listName: name || global.namebot || 'Bot', listEmoji: emoji }
    }
    const opts = { messageId: randomBytes(16).toString('hex').toUpperCase(), additionalNodes: [{ tag: 'meta', attrs: { is_group_status: 'true' } }] }
    const messageContextInfo = { messageSecret: randomBytes(32) }

    if (media) {
        const { generateWAMessageContent } = await import('@whiskeysockets/baileys')
        let payload, key
        if (media.kind === 'image') { payload = { image: media.buffer, caption: text }; key = 'imageMessage' }
        else if (media.kind === 'video') { payload = { video: media.buffer, caption: text }; key = 'videoMessage' }
        else if (media.kind === 'audio') { payload = { audio: await toVoiceNote(media.buffer), ptt: true, mimetype: 'audio/ogg; codecs=opus' }; key = 'audioMessage' }
        else throw new Error('Jenis media tidak didukung untuk status grup')
        const content = await generateWAMessageContent(payload, { upload: sock.waUploadToServer })
        const node = content[key]
        node.contextInfo = { ...(node.contextInfo || {}), ...contextInfo }
        return sock.relayMessage(jid, { [key]: node, messageContextInfo }, opts)
    }

    const color = STATUS_COLORS[Math.floor(Math.random() * STATUS_COLORS.length)]
    return sock.relayMessage(jid, {
        extendedTextMessage: {
            text,
            textArgb: 0xFFFFFFFF,
            backgroundArgb: (0xFF000000 | color) >>> 0,
            font: 7,
            contextInfo
        },
        messageContextInfo
    }, opts)
}

async function toVoiceNote(buffer) {
    const { PassThrough } = await import('stream')
    const ffmpeg = (mod => mod.default ?? mod)(await import('fluent-ffmpeg'))
    return new Promise((resolve, reject) => {
        const input = new PassThrough()
        const output = new PassThrough()
        const chunks = []
        input.end(buffer)
        ffmpeg(input).noVideo().audioCodec('libopus').format('ogg')
            .outputOptions(['-hide_banner', '-loglevel error'])
            .on('error', reject)
            .on('end', () => resolve(Buffer.concat(chunks)))
            .pipe(output)
        output.on('data', c => chunks.push(c))
    })
}

// nomor PN (@s.whatsapp.net) semua member grup, tanpa akun bot sendiri
export async function memberJids(sock, meta) {
    const me = memberId(sock.user?.id)
    const out = []
    for (const p of meta.participants || []) {
        const jid = await toPN(sock, p.phoneNumber || p.id)
        if (jid && jid.endsWith('@s.whatsapp.net') && memberId(jid) !== me && !out.includes(jid)) out.push(jid)
    }
    return out
}

// ───────── Push kontak: kode unik & file VCF (dipakai plugins/pushkontak/*) ─────────
// kode acak (A-Z, 0-9) untuk ditempel di akhir pesan push supaya tiap pesan berbeda
export const pushKode = (n = 6) => Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('')

// daftar JID -> isi file .vcf. nameOf(jid, index) opsional; default nama "WA[XX] nomor"
export function buildVcf(jids, nameOf) {
    return jids.map((jid, i) => {
        const nomor = String(jid).split('@')[0].split(':')[0]
        const nama = nameOf ? nameOf(jid, i) : `WA[${pushKode(2)}] ${nomor}`
        return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${nama}`, `TEL;type=CELL;type=VOICE;waid=${nomor}:+${nomor}`, 'END:VCARD', ''].join('\n')
    }).join('')
}

// kirim file .vcf (dokumen) ke `to`. Mengembalikan true kalau terkirim.
export async function sendVcf(sock, to, jids, { fileName, caption = '', nameOf, quoted } = {}) {
    if (!jids.length) return false
    const safe = String(fileName || `kontak_${jids.length}`).replace(/[\\/:*?"<>|]+/g, '_')
    await sock.sendMessage(to, {
        document: Buffer.from(buildVcf(jids, nameOf), 'utf8'),
        fileName: safe.endsWith('.vcf') ? safe : `${safe}.vcf`,
        mimetype: 'text/vcard',
        caption
    }, quoted ? { quoted } : undefined)
    return true
}
