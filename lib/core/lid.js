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

// Ubah LID WhatsApp jadi nomor HP (JID) otomatis.

const PN = 's.whatsapp.net'
const LID = 'lid'

const serverOf = (jid) => String(jid || '').split('@')[1] || ''
export const isLid = (jid) => serverOf(jid) === LID
export const isPn = (jid) => serverOf(jid) === PN

// buang suffix device (":12") supaya kunci cache konsisten
export function cleanJid(jid) {
    if (!jid || typeof jid !== 'string') return jid
    const [user, server] = jid.split('@')
    if (!server) return jid
    return `${user.split(':')[0]}@${server}`
}

export const lidEnabled = () => global.autoLidToJid !== false

// ───────── cache dua arah (dibatasi supaya RAM tidak membengkak) ─────────
const MAX = 5000
const lidToPn = new Map()
const pnToLid = new Map()

function put(map, k, v) {
    if (map.size >= MAX) map.delete(map.keys().next().value)
    map.set(k, v)
}

export function rememberPair(lid, pn) {
    lid = cleanJid(lid)
    pn = cleanJid(pn)
    if (!isLid(lid) || !isPn(pn)) return false
    put(lidToPn, lid, pn)
    put(pnToLid, pn, lid)
    return true
}

export const clearLidCache = () => { lidToPn.clear(); pnToLid.clear() }

// ───────── konversi sinkron (cache + alt) ─────────
/** LID -> JID nomor. Bukan LID -> dikembalikan apa adanya. Gagal -> dikembalikan apa adanya. */
export function toJidSync(jid, alt) {
    if (!lidEnabled() || !jid) return jid
    jid = cleanJid(jid)
    if (!isLid(jid)) return jid
    if (alt && isPn(alt)) { rememberPair(jid, alt); return cleanJid(alt) }
    return lidToPn.get(jid) || jid
}

/** JID nomor -> LID kalau pernah diketahui (berguna untuk mention di grup mode LID). */
export function toLidSync(jid) {
    jid = cleanJid(jid)
    if (!jid || isLid(jid)) return jid
    return pnToLid.get(jid) || jid
}

// ───────── konversi async (tanya Baileys) ─────────
export async function toJid(sock, jid, alt) {
    if (!lidEnabled() || !jid) return jid
    const quick = toJidSync(jid, alt)
    if (!isLid(quick)) return quick
    try {
        const pn = await sock?.signalRepository?.lidMapping?.getPNForLID(quick)
        if (pn) { rememberPair(quick, pn); return cleanJid(pn) }
    } catch { /* abaikan, pakai LID apa adanya */ }
    return quick
}

export async function toLid(sock, jid) {
    jid = cleanJid(jid)
    if (!jid || isLid(jid)) return jid
    const hit = pnToLid.get(jid)
    if (hit) return hit
    try {
        const lid = await sock?.signalRepository?.lidMapping?.getLIDForPN(jid)
        if (lid) { rememberPair(lid, jid); return cleanJid(lid) }
    } catch { /* abaikan */ }
    return jid
}

// ───────── bantu: ambil contextInfo dari pesan mentah (termasuk yang dibungkus ephemeral/viewOnce) ─────────
function contextOf(message, depth = 0) {
    if (!message || typeof message !== 'object' || depth > 4) return null
    for (const v of Object.values(message)) {
        if (!v || typeof v !== 'object') continue
        if (v.contextInfo) return v.contextInfo
        if (v.message) {
            const c = contextOf(v.message, depth + 1)
            if (c) return c
        }
    }
    return null
}

/**
 * Panggil SEBELUM serialize(): mengisi cache untuk semua LID di pesan ini (pengirim, chat,
 * mention, yang di-reply) supaya serialize() yang sinkron langsung bisa mengonversi.
 */
export async function warmLid(sock, raw) {
    if (!lidEnabled() || !raw?.key) return
    try {
        const k = raw.key
        // 1) pasangan gratis dari Baileys v7
        if (k.remoteJidAlt) rememberPair(k.remoteJid, k.remoteJidAlt)
        if (k.participantAlt) rememberPair(k.participant, k.participantAlt)

        // 2) kumpulkan LID yang masih belum diketahui
        const ctx = contextOf(raw.message)
        const todo = new Set()
        for (const j of [k.remoteJid, k.participant, ctx?.participant, ...(ctx?.mentionedJid || [])]) {
            const c = cleanJid(j)
            if (isLid(c) && !lidToPn.has(c)) todo.add(c)
        }
        if (!todo.size) return

        // 3) tanya lid-mapping Baileys (paralel, maksimal 20 per pesan)
        await Promise.all([...todo].slice(0, 20).map(j => toJid(sock, j)))

        // 4) masih ada yang kosong dan ini grup -> lengkapi dari metadata grup (sudah di-cache Baileys/bot)
        const left = [...todo].filter(j => !lidToPn.has(j))
        if (left.length && String(k.remoteJid || '').endsWith('@g.us')) {
            const meta = await sock?.groupMetadata?.(k.remoteJid).catch(() => null)
            for (const p of meta?.participants || []) {
                const lid = p.lid || (isLid(p.id) ? p.id : null)
                const pn = p.phoneNumber || p.jid || (isPn(p.id) ? p.id : null)
                if (lid && pn) rememberPair(lid, pn)
            }
        }
    } catch { /* jangan sampai pesan gagal diproses gara-gara konversi */ }
}

/** Pasang listener Baileys supaya cache terisi otomatis. Aman dipanggil di tiap socket baru. */
export function installLidListeners(sock) {
    try {
        sock.toJid = (jid, alt) => toJid(sock, jid, alt)
        sock.toLid = (jid) => toLid(sock, jid)
        sock.toJidSync = toJidSync
        sock.toLidSync = toLidSync

        // v7: pemetaan LID<->nomor baru ditemukan
        sock.ev.on('lid-mapping.update', (u) => {
            const list = Array.isArray(u) ? u : [u]
            for (const x of list) rememberPair(x?.lid, x?.pn || x?.jid)
        })
        // user membagikan nomor ke kita
        sock.ev.on('chats.phoneNumberShare', ({ lid, jid } = {}) => rememberPair(lid, jid))
        // kontak: sebagian versi mengisi id (LID) dan phoneNumber sekaligus
        sock.ev.on('contacts.upsert', (list) => {
            for (const c of list || []) rememberPair(c?.lid || c?.id, c?.phoneNumber || c?.jid || c?.id)
        })
        // grup: member punya id + phoneNumber
        sock.ev.on('groups.upsert', (list) => {
            for (const g of list || []) for (const p of g?.participants || []) rememberPair(p?.lid || p?.id, p?.phoneNumber || p?.jid || p?.id)
        })
    } catch { /* event tidak tersedia di versi ini: cache tetap terisi lewat warmLid */ }
    return sock
}

/**
 * Mention di grup mode LID: mention pakai JID nomor kadang tidak ter-highlight.
 * Pembungkus ini mengubah mentions (dan teks "@nomor") jadi LID, hanya kalau:
 *   - tujuan adalah grup dengan addressingMode 'lid', dan
 *   - pemetaan nomor -> LID sudah diketahui.
 * Plugin tidak perlu diubah. Kalau ada yang gagal, pesan dikirim apa adanya.
 * @param getMeta async (groupJid) => metadata grup (pakai cache bot supaya tidak menambah query)
 */
export function installMentionFix(sock, getMeta) {
    if (!sock?.sendMessage || sock.__mentionFix) return sock
    sock.__mentionFix = true
    const rawSend = sock.sendMessage.bind(sock)
    const digits = (j) => String(j).split('@')[0]

    sock.sendMessage = async (jid, content, ...rest) => {
        try {
            const list = content?.mentions
            const ctxList = content?.contextInfo?.mentionedJid
            if (lidEnabled() && typeof jid === 'string' && jid.endsWith('@g.us') && (Array.isArray(list) || Array.isArray(ctxList))) {
                const meta = await getMeta?.(jid)
                if (meta?.addressingMode === 'lid') {
                    const swaps = new Map() // digit nomor -> digit LID, untuk teks "@nomor"
                    const conv = (arr) => arr.map((j) => {
                        const lid = toLidSync(j)
                        if (lid !== cleanJid(j) && isLid(lid)) swaps.set(digits(j), digits(lid))
                        return lid
                    })
                    const next = { ...content }
                    if (Array.isArray(list)) next.mentions = conv(list)
                    if (Array.isArray(ctxList)) next.contextInfo = { ...content.contextInfo, mentionedJid: conv(ctxList) }
                    if (swaps.size) {
                        for (const key of ['text', 'caption']) {
                            if (typeof next[key] !== 'string') continue
                            for (const [pn, lid] of swaps) next[key] = next[key].split(`@${pn}`).join(`@${lid}`)
                        }
                    }
                    content = next
                }
            }
        } catch { /* kirim apa adanya */ }
        return rawSend(jid, content, ...rest)
    }
    return sock
}
