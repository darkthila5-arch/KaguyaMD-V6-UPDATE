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

// Logika donasi.

import { saveDB } from '../core/system.js'
import { storeReply, sendThumb } from './merchant.js'
import { toPN } from '../engine/plugins.js'
import {
    cfg, gwReady, ACTIVE, STATUS, rp, tagOf, wib, quick, pick, row, copyBtn,
    sendBtn, sockFor, allocTotal, createGatewayInvoice, registerKind, notifyOwners, notifyChannel, pollNow, merchantDB
} from './merchant.js'

export const MIN_NOMINAL = 1000
export const NOTE_MAX = 100
export const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]

// "10000", "10.000", "Rp 10.000", "10k", "10rb", "1jt", "1,5jt"
export function parseNominal(raw) {
    const s = String(raw || '').toLowerCase().replace(/rp|\s/g, '')
    const m = s.match(/^(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta)?$/)
    if (!m) return null
    if (m[2]) {
        const v = Math.round(Number(m[1].replace(',', '.')) * (['jt', 'juta'].includes(m[2]) ? 1_000_000 : 1000))
        return Number.isFinite(v) ? v : null
    }
    const v = Number(m[1].replace(/[.,]/g, ''))
    return Number.isInteger(v) ? v : null
}

export const homeBtn = (p) => quick('🏠 Menu Toko', `${p}store`)
export const donations = () => Object.values(merchantDB().donations)

// ───────── jenis pembayaran: donasi ─────────
export async function onPaid(don, tx) {
    don.status = 'done'
    don.paidAt = Date.now()
    don.paidVia = 'gopay-auto'
    if (tx?.id) don.txId = tx.id
    saveDB(global.db)

    const p = '.'
    const total = donations().filter(x => x.status === 'done' && x.buyer === don.buyer).reduce((a, x) => a + x.total, 0)
    await sendBtn(sockFor(don.chat), don.chat, {
        text:
            `💝 *DONASI DITERIMA*\n\n` +
            `Terima kasih @${tagOf(don.buyer)}, donasi ${rp(don.total)} sudah masuk! 🙏\n` +
            (don.note ? `\n💬 "${don.note}"\n` : '') +
            `\nTotal donasimu: ${rp(total)}`,
        mentions: [don.buyer],
        buttons: [quick('💝 Donasi Lagi', `${p}donasi`), quick('🏆 Daftar Donatur', `${p}donatur`)]
    })

    await notifyOwners({
        text:
            `💝 *DONASI MASUK*\n\n` +
            `💳 ${rp(don.total)}\n` +
            `👤 ${don.name || '-'} (@${tagOf(don.buyer)})\n` +
            `🧾 ${don.id}\n` +
            `🕐 ${wib(don.paidAt)} WIB` +
            (don.note ? `\n💬 ${don.note}` : ''),
        mentions: [don.buyer],
        buttons: [quick('📊 Omset', `${p}omset`), quick('🏆 Daftar Donatur', `${p}donatur`)]
    })

    // saluran WhatsApp (opsional, config.js → merchantGw.donateChannel). Nomor donatur sengaja tidak ditampilkan karena saluran bersifat publik.
    await notifyChannel(
        `💝 *DONASI MASUK*\n\n` +
        `💳 ${rp(don.total)}\n` +
        `👤 ${don.name || 'Donatur'}\n` +
        `🧾 ${don.id}\n` +
        `🕐 ${wib(don.paidAt)} WIB` +
        (don.note ? `\n💬 ${don.note}` : '') +
        `\n\nTerima kasih atas dukungannya! 🙏`
    )
}

registerKind('donate', {
    items: () => (global.db ? donations() : []),
    onPaid,
    onExpire: (don) => sendBtn(sockFor(don.chat), don.chat, {
        text: `⌛ Donasi *${don.id}* (${rp(don.total)}) kedaluwarsa karena belum dibayar.\nKalau sudah terlanjur membayar, tunggu sebentar, sistem masih mengecek.`,
        buttons: [quick('🔁 Buat Lagi', `.donasi ${don.price}`), quick('🔄 Cek Pembayaran', `.cekdonasi ${don.id}`)]
    })
})

// ───────── perintah ─────────


