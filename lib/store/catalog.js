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

// Katalog toko: kategori dan produk.

import { saveDB } from '../core/system.js'
import { storeDB, activeOrdersOf, cfg } from './merchant.js'

// ───────── kategori ─────────
export const CATS = {
    script: { emoji: '🍓', name: 'Script Bot', desc: 'Script bot WhatsApp siap pakai' },
    web:    { emoji: '🍅', name: 'Source Code Website', desc: 'Source code website siap deploy' },
    jasa:   { emoji: '🍋', name: 'Jasa Custom', desc: 'Pembuatan & perbaikan sesuai request' },
    lain:   { emoji: '✨', name: 'Lainnya', desc: 'Produk lain' }
}

export const catKey = (pr) => (CATS[pr?.cat] ? pr.cat : 'lain')
export const catOf = (pr) => CATS[catKey(pr)]

/** Cara produk dikirim ke pembeli setelah lunas. */
export function deliveryLabel(pr) {
    if (Array.isArray(pr?.stock)) return '⚡ Otomatis (dari stok)'
    if (pr?.file || pr?.deliver) return '⚡ Otomatis (langsung dikirim)'
    return '👤 Diproses owner'
}

// ───────── produk contoh ─────────
// Harga hanya contoh awal, ubah dengan .editproduk. Isi pengiriman otomatis diatur dengan .setkirim.
export const DEFAULT_PRODUCTS = [
    { code: 'sc-kaguya', cat: 'script', name: 'Script Bot Kaguya MD', price: 150000, desc: 'Script bot WhatsApp multi device, fitur lengkap (RPG, download, sticker, AI, grup, store).' },
    { code: 'sc-selfbot', cat: 'script', name: 'Script Selfbot WhatsApp', price: 75000, desc: 'Script selfbot ringan untuk akun pribadi.' },
    { code: 'sc-rpg', cat: 'script', name: 'Script Bot RPG', price: 100000, desc: 'Script bot fokus fitur RPG, ekonomi, dan clan.' },
    { code: 'web-api', cat: 'web', name: 'Source Website REST API', price: 100000, desc: 'Source code website dokumentasi REST API (login, docs endpoint, profil, changelog).' },
    { code: 'web-toko', cat: 'web', name: 'Source Website Toko Digital', price: 85000, desc: 'Source code website toko produk digital dengan katalog dan checkout.' },
    { code: 'web-porto', cat: 'web', name: 'Source Website Portofolio', price: 50000, desc: 'Source code website portofolio satu halaman, responsif.' },
    { code: 'jasa-bot', cat: 'jasa', name: 'Jasa Pembuatan Bot', price: 200000, desc: 'Bot WhatsApp sesuai kebutuhanmu. Detail dibahas lewat chat setelah order.' },
    { code: 'jasa-web', cat: 'jasa', name: 'Jasa Pembuatan Website', price: 250000, desc: 'Website sesuai kebutuhanmu. Detail dibahas lewat chat setelah order.' },
    { code: 'jasa-recode', cat: 'jasa', name: 'Jasa Recode & Fix Script', price: 50000, desc: 'Perbaikan error, penyesuaian fitur, atau pindah base script.' }
]

/** Tambahkan produk contoh yang belum ada. Mengembalikan jumlah yang ditambahkan. */
export function seedProducts() {
    const d = storeDB()
    // Kalau katalog sudah diatur lewat config.js (global.storeProducts), config itulah sumber produknya:
    // produk contoh tidak ditambahkan lagi supaya produk yang sudah dihapus dari config tidak muncul kembali.
    if (hasConfigProducts()) {
        d.seeded = true
        applyConfigProducts(true)
        return 0
    }
    let n = 0
    for (const def of DEFAULT_PRODUCTS) {
        if (d.products[def.code]) continue
        d.products[def.code] = { stock: null, ...def, src: 'seed', createdAt: Date.now() }
        n++
    }
    d.seeded = true
    if (n) saveDB(global.db)
    applyConfigProducts(true)
    return n
}

/** Isi katalog contoh otomatis satu kali, hanya kalau katalog masih kosong. Lalu terapkan global.storeProducts dari config.js. */
export function autoSeed() {
    const d = storeDB()
    if (!d.seeded && !Object.keys(d.products).length) seedProducts()
    else d.seeded = true
    applyConfigProducts()
}

// ───────── produk dari config.js ─────────
// global.storeProducts = { kode: { name, price, desc, cat, demo, deliver, file } }
// file = nama file di lib/store/script/ yang dikirim otomatis sebagai dokumen setelah lunas
// Nilai di config.js menang atas data tersimpan (termasuk hasil .editproduk) setiap bot start / config berubah.
// Hanya field yang diisi yang diubah; stok tidak pernah disentuh untuk produk yang sudah ada.
const hasConfigProducts = () => !!global.storeProducts && typeof global.storeProducts === 'object' && Object.keys(global.storeProducts).length > 0
const DEFAULT_CODES = new Set(DEFAULT_PRODUCTS.map(x => x.code))
const CONFIG_FIELDS = ['name', 'price', 'desc', 'cat', 'demo', 'deliver', 'file']
const CONFIG_MIN_PRICE = 1000
let appliedSig = null

/** Terapkan global.storeProducts ke katalog. Mengembalikan jumlah produk yang diproses. */
export function applyConfigProducts(force = false) {
    const conf = global.storeProducts
    const sig = JSON.stringify(conf || {})
    if (!force && sig === appliedSig) return 0
    appliedSig = sig
    if (!conf || typeof conf !== 'object') return 0

    const d = storeDB()
    let n = 0
    for (const [codeRaw, def] of Object.entries(conf)) {
        const code = String(codeRaw).toLowerCase()
        if (!/^[a-z0-9-]+$/.test(code) || !def || typeof def !== 'object') {
            console.warn(`[STORE] global.storeProducts: kode "${codeRaw}" dilewati (kode harus huruf kecil/angka/-)`)
            continue
        }

        let pr = d.products[code]
        if (!pr) {
            // produk baru lewat config wajib punya nama dan harga
            if (!def.name || !(Number(def.price) >= CONFIG_MIN_PRICE)) {
                console.warn(`[STORE] global.storeProducts: produk baru "${code}" butuh name dan price (min ${CONFIG_MIN_PRICE})`)
                continue
            }
            pr = d.products[code] = { code, stock: Array.isArray(def.stock) ? [...def.stock] : null, src: 'config', createdAt: Date.now() }
        }

        for (const f of CONFIG_FIELDS) {
            const v = def[f]
            if (v === undefined || v === null || v === '') continue
            if (f === 'price') {
                const price = Math.round(Number(v))
                if (!Number.isFinite(price) || price < CONFIG_MIN_PRICE) {
                    console.warn(`[STORE] global.storeProducts: harga "${code}" tidak valid (min ${CONFIG_MIN_PRICE}), dilewati`)
                    continue
                }
                pr.price = price
            } else if (f === 'cat') {
                if (CATS[v]) pr.cat = v
                else console.warn(`[STORE] global.storeProducts: kategori "${v}" untuk "${code}" tidak ada (${Object.keys(CATS).join('/')})`)
            } else {
                pr[f] = String(v)
            }
        }
        n++
    }

    // Hapus produk bawaan/config yang sudah tidak ada di config.js (mis. sc-rpg).
    // Produk yang ditambah manual lewat .addproduk tidak disentuh, dan produk dengan order aktif ditahan dulu.
    let pruned = 0
    for (const [code, pr] of Object.entries(d.products)) {
        if (Object.prototype.hasOwnProperty.call(conf, code)) continue
        const managed = pr.src === 'config' || pr.src === 'seed' || (pr.src === undefined && DEFAULT_CODES.has(code))
        if (!managed) continue
        // Order 'pending' yang sudah lewat batas waktu bayar dianggap basi (poller gateway bisa saja tidak jalan,
        // jadi statusnya tidak pernah jadi expired dan produk tidak pernah terhapus). Tandai expired, jangan jadi penghalang.
        const c = cfg()
        const limit = (Number(c.ttlMin) + Number(c.graceMin)) * 60_000
        let live = 0
        for (const o of activeOrdersOf(code)) {
            if (o.createdAt && Date.now() - o.createdAt > limit) { o.status = 'expired'; continue }
            live++
        }
        if (live) {
            console.log(`[STORE] produk \"${code}\" sudah tidak ada di config.js tapi masih punya ${live} order aktif, ditahan dulu`)
            continue
        }
        delete d.products[code]
        pruned++
        console.log(`[STORE] produk "${code}" dihapus karena sudah tidak ada di global.storeProducts`)
    }
    if (n || pruned) saveDB(global.db)
    return n
}

export const productsOf = (key) => Object.values(storeDB().products).filter(pr => catKey(pr) === key)
