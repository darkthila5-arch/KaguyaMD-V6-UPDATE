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

// Logika toko untuk sewa bot.

import QRCode from 'qrcode'
import { saveDB } from '../core/system.js'
import { storeReply, sendThumb } from './merchant.js'
import { updateConfigValue } from '../core/file.js'
import {
    parseDuration,
    formatDate,
    formatRemaining,
    userOf,
    sewaData,
    getRental,
    isGroupRented,
    activateRental,
    removeRental,
    listRentals
} from '../core/data.js'
import { toPN } from '../engine/plugins.js'
import { getMeta, waError } from '../platform/wa.js'
import {
    gwReady, rp as mrp, quick, pick, row, copyBtn, sendBtn, sockFor, allocTotal,
    createGatewayInvoice, registerKind, notifyOwners, pollNow, cfg as merchantCfg
} from './merchant.js'

export const ORDER_TTL_MIN = 15
export const UNIQUE_MAX = 99
export const LATE_PROOF_HOURS = 24
export const PER_PAGE = 12
export const GROUP_LINK = /chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
export const GROUP_JID = /^[\d-]+@g\.us$/

// ───────── QRIS ─────────
export function crc16(str) {
    let crc = 0xffff
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8
        for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}
export const qrisText = () => String(global.qrisStatic || '').replace(/[\r\n]+/g, '').trim()
export const qrisReady = () => {
    const q = qrisText()
    return q.startsWith('000201') && q.length >= 8 && q.slice(0, -4).endsWith('6304') && crc16(q.slice(0, -4)) === q.slice(-4).toUpperCase()
}

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

export const merchantOf = () => { try { return parseTLV(qrisText()).find(x => x.tag === '59')?.value || '-' } catch { return '-' } }

// ───────── helper ─────────
export const rp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`
export const tagOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
export const ACTIVE = new Set(['pending', 'waiting'])
export const STATUS = {
    pending: '⏳ Menunggu pembayaran', waiting: '🕐 Menunggu konfirmasi owner', done: '✅ Selesai',
    rejected: '❌ Ditolak', cancelled: '🚫 Dibatalkan', expired: '⌛ Kedaluwarsa'
}
export const plans = () => (Array.isArray(global.sewaPlans) ? global.sewaPlans : []).filter(p => p?.id && Number.isFinite(Number(p.harga)))
export const durLabel = (plan) => (plan.hari === null ? 'Permanen' : plan.nama || `${plan.hari} hari`)
export const ownerJids = () => (global.owners || []).map(n => `${String(n).replace(/\D/g, '')}@s.whatsapp.net`)
export const isImage = (msg) => !!msg?.isMedia && msg.mtype === 'imageMessage'
export const normId = (raw) => { const d = String(raw || '').replace(/\D/g, ''); return d ? `SWA-${d.padStart(4, '0')}` : null }

export function expireOrders() {
    const d = sewaData()
    let changed = false
    for (const o of Object.values(d.orders)) {
        if (o.status === 'pending' && Date.now() - o.createdAt > ORDER_TTL_MIN * 60_000) { o.status = 'expired'; changed = true }
    }
    if (changed) saveDB(global.db)
}

export const rentalLine = (r) =>
    `*${r.name || '(tanpa nama)'}*\n   ${r.until === null ? '♾️ permanen' : `${r.until > Date.now() ? '⏳' : '⌛'} ${formatRemaining(r.until)} (s/d ${formatDate(r.until)})`}\n   ${r.jid}`

export async function groupName(sock, jid) {
    return (await getMeta(sock, jid).catch(() => null))?.subject || ''
}

export async function isMember(sock, jid) {
    try { await sock.groupMetadata(jid); return true } catch { return false }
}

// ───────── aktivasi sewa (dipakai .accsewa dan pembayaran otomatis) ─────────
export async function finalizeSewa(order, sock, p = '.') {
    // bot belum ada di grup tujuan (order dari private chat / sudah keluar) -> gabung lewat link
    let joinNote = ''
    if (!(await isMember(sock, order.group))) {
        if (!order.code) return { ok: false, error: `Bot tidak ada di grup ${order.groupName || order.group} dan order ini tidak punya link. Masukkan bot manual lalu ACC lagi.` }
        try {
            await sock.groupAcceptInvite(order.code)
            joinNote = '\n🤝 Bot sudah bergabung ke grup.'
        } catch (e) {
            return { ok: false, error: `Gagal bergabung ke grup (${waError(e)}).\nMinta pembeli kirim link baru, atau masukkan bot manual lalu ACC lagi.` }
        }
    }

    const { rental, extended } = activateRental(order.group, order.days === null ? null : order.days * 864e5, { name: order.groupName, by: order.buyer, plan: order.planName })
    order.status = 'done'
    order.doneAt = Date.now()
    saveDB(global.db)

    const until = rental.until === null ? 'permanen' : `sampai ${formatDate(rental.until)}`
    await sendThumb(sock, order.group, {
        text: `✅ *SEWA BOT ${extended ? 'DIPERPANJANG' : 'AKTIF'}*\n\n🤖 Paket: ${order.planName}\n📅 Berlaku: ${until}\n\nTerima kasih sudah menyewa! Ketik *${p}menu* untuk mulai. 🙏`
    }).catch(() => null)
    await sendBtn(sockFor(order.buyer) || sock, order.buyer, {
        text: `✅ *PEMBAYARAN DITERIMA*\n\n🧾 ${order.id}\n ${order.planName}\n👥 ${order.groupName || order.group}\n📅 Berlaku ${until}\n\nTerima kasih! 🙏`,
        buttons: [quick('Sewa Lagi', `${p}sewa`), quick('📜 Riwayat', `${p}riwayatorder`), quick('🏠 Menu Toko', `${p}store`)]
    })
    return { ok: true, extended, until, joinNote }
}

// pembayaran QRIS otomatis (gateway GoBiz): dipanggil poller di lib/store/merchant.js begitu uang masuk
export async function onSewaPaid(order, tx) {
    const sock = global.sock
    if (!sock) throw new Error('Socket WhatsApp belum siap.')
    order.paidVia = 'gopay-auto'
    if (tx?.id) order.txId = tx.id

    const r = await finalizeSewa(order, sock)
    if (!r.ok) {
        order.status = 'waiting'
        order.note = 'lunas otomatis, aktivasi gagal'
        saveDB(global.db)
        await sendBtn(sockFor(order.buyer), order.buyer, {
            text: `✅ *PEMBAYARAN DITERIMA*\n\n🧾 ${order.id}\n🤖 ${order.planName}\n👥 ${order.groupName || order.group}\n\nPembayaranmu sudah masuk, tapi sewa belum bisa diaktifkan otomatis. Owner akan memprosesnya. Mohon tunggu ya 🙏`
        })
        await notifyOwners({
            text: `⚠️ *SEWA LUNAS, aktivasi gagal*\n\n🧾 ${order.id}\n🤖 ${order.planName}\n👥 ${order.groupName || order.group}\n💳 ${mrp(order.total)}\n👤 @${tagOf(order.buyer)}\n\n${r.error}\n\nSelesaikan dengan .accsewa ${order.id}`,
            mentions: [order.buyer],
            buttons: [quick('📋 Menunggu Bayar', '.orderaktif')]
        })
        return
    }

    await notifyOwners({
        text: `💰 *UANG MASUK — SEWA BOT*\n\n🧾 ${order.id}\n🤖 ${order.planName}\n👥 ${order.groupName || order.group}\n💳 ${mrp(order.total)}\n👤 @${tagOf(order.buyer)}\n📅 Berlaku ${r.until}${r.extended ? ' (perpanjangan)' : ''}${r.joinNote}`,
        mentions: [order.buyer],
        buttons: [quick('📊 Omset', '.omset'), quick('📋 Menunggu Bayar', '.orderaktif')]
    })
}

registerKind('sewa', {
    items: () => (global.db ? Object.values(sewaData().orders) : []),
    onPaid: onSewaPaid,
    onExpire: (order) => sendBtn(sockFor(order.buyer), order.buyer, {
        text: `⌛ Order sewa *${order.id}* (${order.planName}) kedaluwarsa karena belum dibayar.\n\nKalau sudah terlanjur membayar, tunggu sebentar, sistem masih mengecek.`,
        buttons: [quick('🔁 Pesan Ulang', '.sewa'), quick('🔄 Cek Pembayaran', `.cekbayarsewa ${order.id}`)]
    })
})

// ───────── plugin ─────────


