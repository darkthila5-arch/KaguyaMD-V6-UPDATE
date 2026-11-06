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

// Logika toko untuk order.

import { saveDB } from '../core/system.js'
import { storeReply, sendThumb } from './merchant.js'
import { toPN } from '../engine/plugins.js'
import {
    cfg, gwReady, gateway, scrub, ACTIVE, STATUS, rp, tagOf, wib, quick, pick, row,
    sendBtn, createStoreOrder, pollNow, merchantState, storeDB, merchantDB, available, stockLabel
} from './merchant.js'
import { catOf, deliveryLabel, autoSeed } from './catalog.js'

export const MIN_PRICE = 1000
export const PICKER_MAX = 10 // batas baris daftar pilihan WhatsApp
export const dayKey = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
export const homeBtn = (p) => quick('🏠 Menu Toko', `${p}store`)

// ───────── order terpadu: toko (INV), sewa bot (SWA), donasi (DON) ─────────
// Semuanya memakai satu gateway GoBiz dan satu poller (lib/store/merchant.js), jadi cek / batal / riwayat juga satu pintu.
export const KINDS = {
    INV: { get: () => storeDB().orders, emoji: (o) => catOf(storeDB().products[o.code]).emoji, label: (o) => o.name },
    SWA: { get: () => global.db?.sewa?.orders || {}, emoji: () => '🍡', label: (o) => `Sewa ${o.planName}` },
    DON: { get: () => merchantDB().donations, emoji: () => '🍥', label: () => 'Donasi' }
}
export const entriesOf = (buyer) =>
    Object.entries(KINDS).flatMap(([kind, k]) =>
        Object.values(k.get()).filter(o => !buyer || o.buyer === buyer).map(o => ({ kind, o, emoji: k.emoji(o), label: k.label(o) })))
export const findEntry = (id) => {
    const kind = String(id).slice(0, 3)
    const o = KINDS[kind]?.get()[id]
    return o ? { kind, o, emoji: KINDS[kind].emoji(o), label: KINDS[kind].label(o) } : null
}
// "12", "inv-12", "swa 3", "DON-0004" -> id lengkap (angka saja dianggap order toko)
export const parseOrderId = (raw) => {
    const m = String(raw || '').match(/(inv|swa|don)?[-\s]*(\d+)/i)
    return m ? `${(m[1] || 'INV').toUpperCase()}-${m[2].padStart(4, '0')}` : null
}

// ───────── tampilan ─────────
export function productPicker(p) {
    const list = Object.values(storeDB().products)
    const ready = list.filter(pr => available(pr) > 0)
    const text = list.length
        ? `🛍️ *KATALOG ${cfg().storeName.toUpperCase()}*\n\n` +
          list.map(pr => `${catOf(pr).emoji} *${pr.name}*\n   💰 ${rp(pr.price)}  |  📦 ${stockLabel(pr)}`).join('\n\n') +
          `\n\nTap *Pilih Produk* untuk membeli.` +
          (ready.length > PICKER_MAX ? `\nProduk lainnya: ${p}order <kode>` : '')
        : 'Katalog masih kosong.'
    const buttons = ready.length
        ? [pick('🛍️ Pilih Produk', [{
            title: 'Produk tersedia',
            rows: ready.slice(0, PICKER_MAX).map(pr => row(`${catOf(pr).emoji} ${pr.name}`.slice(0, 24), `${p}order ${pr.code}`, `${rp(pr.price)} • stok ${stockLabel(pr)}`))
        }]), homeBtn(p)]
        : [homeBtn(p)]
    return { text, buttons }
}

// ───────── perintah ─────────


