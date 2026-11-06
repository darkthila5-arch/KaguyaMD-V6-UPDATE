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

// Logika toko untuk beli script dan produk.

import QRCode from 'qrcode'
import { saveDB } from '../core/system.js'
import { storeReply, sendThumb, scriptFile, sendScriptFile, sendBtn, quick, pick, row, copyBtn, notifyOwners } from './merchant.js'
import { toPN } from '../engine/plugins.js'
import { gwReady, gwUsable, createStoreOrder } from './merchant.js'
import { autoSeed } from './catalog.js'

export const QRIS_STATIC = global.qrisStatic || ''
export const STORE_NAME = global.merchantGw?.storeName || 'Toko Digital Store Iyan'
export const ORDER_TTL_MIN = 15          // order yang belum dibayar kedaluwarsa setelah ... menit
export const UNIQUE_MAX = 99             // kode unik 1..99 ditambahkan ke harga untuk mencocokkan mutasi
export const MIN_PRICE = 1000
export const HISTORY_LIMIT = 10
export const LATE_PROOF_HOURS = 24       // bukti bayar masih diterima untuk order kedaluwarsa dalam ... jam

// ───────── QRIS ─────────
export function crc16(str) {
    let crc = 0xffff
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8
        for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}

export const QRIS = QRIS_STATIC.replace(/[\r\n]+/g, '').trim()
export const crcValid = (q) => q.length >= 8 && q.slice(0, -4).endsWith('6304') && crc16(q.slice(0, -4)) === q.slice(-4).toUpperCase()
export const qrisReady = () => QRIS.startsWith('000201') && crcValid(QRIS)

export function parseTLV(qris) {
    const out = []
    let i = 0
    while (i < qris.length) {
        if (i + 4 > qris.length) throw new Error('Format QRIS rusak.')
        const tag = qris.slice(i, i + 2)
        const len = parseInt(qris.slice(i + 2, i + 4), 10)
        if (Number.isNaN(len) || len < 0 || i + 4 + len > qris.length) throw new Error(`Format QRIS rusak pada tag ${tag}.`)
        out.push({ tag, value: qris.slice(i + 4, i + 4 + len) })
        i += 4 + len
    }
    return out
}

export const tlv = (tag, value) => `${tag}${String(value.length).padStart(2, '0')}${value}`

export function toDynamic(staticQris, nominal) {
    const items = []
    for (const el of parseTLV(staticQris)) {
        if (['54', '55', '56', '57', '63'].includes(el.tag)) continue
        items.push(el.tag === '01' ? { tag: '01', value: '12' } : el)
    }
    if (!items.some(x => x.tag === '01')) items.splice(1, 0, { tag: '01', value: '12' })
    let at = items.findIndex(x => x.tag === '58')
    if (at < 0) at = items.length
    items.splice(at, 0, { tag: '54', value: String(nominal) })
    const body = items.map(x => tlv(x.tag, x.value)).join('') + '6304'
    return body + crc16(body)
}

// ───────── data & helper ─────────
export const getDB = () => {
    const d = (global.db.store ||= {})
    d.products ||= {}
    d.orders ||= {}
    d.seq ||= 0
    return d
}

export const rp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`
export const tagOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
export const ACTIVE = new Set(['pending', 'waiting'])
export const STATUS = {
    pending: '⏳ Menunggu pembayaran',
    waiting: '🕐 Menunggu konfirmasi owner',
    done: '✅ Selesai',
    rejected: '❌ Ditolak',
    cancelled: '🚫 Dibatalkan',
    expired: '⌛ Kedaluwarsa'
}

export const normId = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '')
    return digits ? `INV-${digits.padStart(4, '0')}` : null
}

export const ago = (ts) => {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
    if (s < 60) return `${s} detik lalu`
    if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
    return `${Math.floor(s / 86400)} hari lalu`
}

export const dayKey = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD

export function expireOrders() {
    const d = getDB()
    let changed = false
    for (const o of Object.values(d.orders)) {
        if (o.status === 'pending' && Date.now() - o.createdAt > ORDER_TTL_MIN * 60_000) {
            o.status = 'expired'
            changed = true
        }
    }
    if (changed) saveDB(global.db)
}

export const activeOrdersOf = (code) => Object.values(getDB().orders).filter(o => o.code === code && ACTIVE.has(o.status))

// stok tersedia = stok - order yang sedang berjalan (supaya tidak dijual dua kali); Infinity untuk produk manual
export const available = (p) => (Array.isArray(p.stock) ? Math.max(0, p.stock.length - activeOrdersOf(p.code).length) : Infinity)

export const stockLabel = (p, owner = false) => {
    if (!Array.isArray(p.stock)) return owner ? 'manual' : 'ready'
    const n = available(p)
    return n > 0 ? `${owner ? p.stock.length : n}` : 'habis'
}

export const ownerJids = () => (global.owners || []).map(n => `${String(n).replace(/\D/g, '')}@s.whatsapp.net`)

export const isImage = (msg) => !!msg?.isMedia && msg.mtype === 'imageMessage'

/**
 * Order toko mode manual: QRIS statis (global.qrisStatic) + kode unik, pembeli kirim bukti (.bukti), owner konfirmasi (.acc).
 * Dipakai kalau global.merchantGw kosong, atau url/token gateway error.
 */
export async function createManualStoreOrder({ sock, m, pr, buyer, p = '.', isOwner = false }) {
    const d = getDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!qrisReady()) {
        await send({ text: isOwner ? 'QRIS belum valid. Isi global.qrisStatic (atau perbaiki global.merchantGw) di config.js.' : 'Pembelian belum tersedia saat ini.' })
        return false
    }
    const usedTotals = new Set(Object.values(d.orders).filter(o => o.status === 'pending').map(o => o.total))
    const free = []
    for (let u = 1; u <= UNIQUE_MAX; u++) if (!usedTotals.has(pr.price + u)) free.push(u)
    if (!free.length) {
        await send({ text: 'Sedang ramai, coba lagi beberapa menit lagi ya.', buttons: [quick('🔁 Coba Lagi', `${p}beli ${pr.code}`)] })
        return false
    }
    const unique = free[Math.floor(Math.random() * free.length)]
    const total = pr.price + unique

    d.seq += 1
    const id = `INV-${String(d.seq).padStart(4, '0')}`
    d.orders[id] = {
        id, code: pr.code, name: pr.name, price: pr.price, unique, total,
        buyer, chat: m.chat, status: 'pending', createdAt: Date.now()
    }
    saveDB(global.db)

    const image = await QRCode.toBuffer(toDynamic(QRIS, total), { width: 600, margin: 3, errorCorrectionLevel: 'M' })
    await send({
        image,
        text:
            `╭─▣「 *INVOICE ${id}* 」▣─╮\n` +
            `┃ 🛍️ Produk     : ${pr.name}\n` +
            `┃ 💰 Harga      : ${rp(pr.price)}\n` +
            `┃ 🔢 Kode unik  : ${unique}\n` +
            `┃ 💳 *Total bayar : ${rp(total)}*\n` +
            `┃ ⏳ Berlaku    : ${ORDER_TTL_MIN} menit\n` +
            `╰─────────────➤\n\n` +
            `1. Scan QR di atas lewat e-wallet / m-banking (QRIS).\n` +
            `2. Bayar *tepat ${rp(total)}* (termasuk kode unik).\n` +
            `3. Kirim foto bukti bayar dengan caption *${p}bukti* (atau balas fotonya dengan *${p}bukti*).`,
        buttons: [
            quick('📸 Cara Kirim Bukti', `${p}bukti`),
            copyBtn('📋 Salin Nominal', total),
            quick('🚫 Batalkan Order', `${p}batalorder`)
        ]
    })
    return true
}

/** Satu pintu untuk .beli dan .order: gateway otomatis kalau siap, kalau tidak / error → manual. */
export async function startStoreOrder({ sock, m, pr, buyer, p = '.', isOwner = false }) {
    const manual = () => createManualStoreOrder({ sock, m, pr, buyer, p, isOwner })
    if (gwUsable()) return createStoreOrder({ sock, m, pr, buyer, p, isOwner, fallback: manual })
    return manual()
}

// ───────── plugin ─────────


