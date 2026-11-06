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

// Logika toko untuk daftar produk dan pembelian.

import { saveDB } from '../core/system.js'
import { storeReply, sendThumb } from './merchant.js'
import { listRentals } from '../core/data.js'
import { cfg, gwReady, merchantDB, ACTIVE, rp, quick, pick, row, sendBtn, storeDB, available, stockLabel } from './merchant.js'
import { CATS, catKey, catOf, deliveryLabel, productsOf, seedProducts, autoSeed } from './catalog.js'

export const PICKER_MAX = 10
export const homeBtn = (p) => quick('🏠 Menu Toko', `${p}store`)
export const ownerNumber = () => String((global.owners || [])[0] || '').replace(/\D/g, '')

// ───────── tampilan ─────────
export function menuView(p, isOwner) {
    const c = cfg()
    const all = Object.values(storeDB().products)
    const catRows = Object.entries(CATS)
        .map(([key, cat]) => ({ key, cat, n: productsOf(key).length }))
        .filter(x => x.n > 0)
        .map(x => row(`${x.cat.emoji} ${x.cat.name}`.slice(0, 24), `${p}kategori ${x.key}`, `${x.n} produk • ${x.cat.desc}`.slice(0, 72)))

    // WhatsApp membatasi 10 baris per daftar pilihan, jadi dibagi dua tombol:
    // kategori (maks 7 baris) dan layanan + order saya + owner (maks 9 baris).
    const catSections = [{ title: 'Kategori Produk', rows: [...catRows, row('Cari Produk', `${p}caritoko`, 'Cari produk dengan kata kunci')] }]
    const moreSections = [
        {
            title: 'Layanan',
            rows: [
                row('Sewa Bot', `${p}sewa`, 'Paket sewa bot untuk grup'),
                row('Donasi', `${p}donasi`, 'Donasi lewat QRIS GoPay')
            ]
        },
        {
            title: 'Order Saya',
            rows: [
                row('🧾 Cek Order', `${p}cekorder`, 'Cek status pembayaran'),
                row('📜 Riwayat', `${p}riwayatorder`, 'Riwayat pembelianmu'),
                row('🚫 Batalkan Order', `${p}batalbayar`, 'Batalkan order yang belum dibayar')
            ]
        }
    ]
    if (isOwner) {
        moreSections.push({
            title: 'Owner',
            rows: [
                row('📊 Omset', `${p}omset`, 'Rekap penjualan, sewa, dan donasi'),
                row('📋 Menunggu Bayar', `${p}orderaktif`, 'Order yang belum dibayar'),
                row('🩺 Cek Gateway', `${p}merchantcek`, 'Token, login GoBiz, transaksi terbaru'),
                row('📈 Status Toko', `${p}tokostat`, 'Ringkasan otomatisasi toko, sewa, dan gateway'),
                row('📖 Panduan Owner', `${p}tokopanduan`, 'Cara kelola produk & pengiriman otomatis')
            ]
        })
    }

    const lines = Object.entries(CATS)
        .map(([key, cat]) => ({ cat, n: productsOf(key).length }))
        .filter(x => x.n > 0)
        .map(x => `┃ ${x.cat.emoji} ${x.cat.name} (${x.n})`)

    const buttons = [pick('Pilih Kategori', catSections), pick('Menu Lainnya', moreSections)]
    const wa = ownerNumber()
    buttons.push(wa ? { type: 'url', text: '💬 Chat Owner', url: `https://wa.me/${wa}` } : quick('Semua Produk', `${p}order`))

    return {
        text:
            `\n` +
            `╭─▣「 *${c.storeName.toUpperCase()}* 」▣─╮\n` +
            (lines.length ? lines.join('\n') + '\n' : '┃ Katalog masih kosong\n') +
            `┃ Sewa Bot\n┃ Donasi\n` +
            `╰─────────────➤\n\n` +
            `Bayar QRIS GoPay\n⚡ Konfirmasi otomatis\n📦 Produk langsung dikirim\n\n` +
            `_${all.length} produk tersedia. Pilih kategori lewat tombol di bawah._`,
        buttons
    }
}

export function categoryView(p, key) {
    const cat = CATS[key]
    const list = productsOf(key)
    const ready = list.filter(pr => available(pr) > 0)
    const text =
        `${cat.emoji} *${cat.name.toUpperCase()}*\n_${cat.desc}_\n\n` +
        list.map(pr =>
            `${cat.emoji} *${pr.name}*\n   💰 ${rp(pr.price)}  |  📦 ${stockLabel(pr)}\n   🚚 ${deliveryLabel(pr)}`
        ).join('\n\n') +
        `\n\nTap *Pilih Produk* untuk membeli.` +
        (ready.length > PICKER_MAX ? `\nProduk lainnya: ${p}order <kode>` : '')
    const buttons = []
    if (ready.length) {
        buttons.push(pick('Pilih Produk', [{
            title: `${cat.emoji} ${cat.name}`.slice(0, 24),
            rows: ready.slice(0, PICKER_MAX).map(pr => row(pr.name.slice(0, 24), `${p}order ${pr.code}`, `${rp(pr.price)} • stok ${stockLabel(pr)}`))
        }]))
    }
    buttons.push(homeBtn(p))
    return { text, buttons }
}

export const GUIDE = (p) =>
    `📖 *PANDUAN OWNER TOKO*\n\n` +
    `*Tambah produk*\n${p}addproduk kode|nama|harga|deskripsi\n\n` +
    `*Atur kategori*\n${p}setkat kode|script/web/jasa/lain\n\n` +
    `*Pengiriman otomatis (script, source code, dll)*\n${p}setkirim kode|link atau teks\nIsi ini dikirim ke setiap pembeli begitu lunas. Hapus dengan ${p}setkirim kode|-\n\n` +
    `*Item berbeda per pembeli (akun, key)*\n${p}addstok kode item  (satu item per baris)\n\n` +
    `*Link demo*\n${p}setdemo kode|https://...  (hapus dengan -)\n\n` +
    `*Ubah / hapus*\n${p}editproduk kode|nama/harga/deskripsi|nilai\n${p}delproduk kode\n\n` +
    `*Katalog contoh*\n${p}isitoko  → tambahkan produk contoh yang belum ada\n\n` +
    `*Pantau*\n${p}tokostat  |  ${p}omset  |  ${p}orderaktif  |  ${p}merchantcek\n\n` +
    `*Sewa bot*\nPaket diatur di config.js (global.sewaPlans). Bayar QRIS GoPay otomatis aktif begitu lunas. Kelola: ${p}pesanansewa, ${p}listsewa, ${p}addsewa, ${p}delsewa\n\n` +
    `Produk tanpa .setkirim dan tanpa stok diproses manual: owner dikabari saat pembayaran masuk.`

// ───────── perintah ─────────


