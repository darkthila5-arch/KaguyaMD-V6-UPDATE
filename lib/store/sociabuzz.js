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

// Logika toko untuk Sociabuzz.

import axios from 'axios'
import * as cheerio from 'cheerio'
import QRCode from 'qrcode'
import { saveDB } from '../core/system.js'

export const BASE_URL = 'https://sociabuzz.com'
export const UA = 'Mozilla/5.0 (Linux; Android 13; SM-A057F) AppleWebKit/537.36'
export const MAX_HISTORY = 200

export const username = () => String(global.sociabuzz?.username || 'azresenpai').trim()

export const METHODS = {
    qris:              { type_payment: 'qris',          source_payment: 'xendit',   group: 'qris',   min: 1000 },
    gopay:             { type_payment: 'ewallet_id',    source_payment: 'midtrans', group: 'ewallet', min: 1000 },
    ovo:               { type_payment: 'ewallet_id',    source_payment: 'xendit',   group: 'ewallet', min: 1000, need_phone: true },
    dana:              { type_payment: 'ewallet_id',    source_payment: 'xendit',   group: 'ewallet', min: 1000 },
    linkaja:           { type_payment: 'ewallet_id',    source_payment: 'xendit',   group: 'ewallet', min: 1000 },
    shopeepay_idr:     { type_payment: 'ewallet_id',    source_payment: '2c2p',     group: 'ewallet', min: 1000 },
    bca:               { type_payment: 'bank_transfer', source_payment: 'midtrans', group: 'bank',   min: 10000 },
    mandiri:           { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    bri:               { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    bni:               { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    bsi:               { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    cimb:              { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    permata:           { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    bjb:               { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    bnc:               { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    sahabat_sampoerna: { type_payment: 'bank_transfer', source_payment: 'xendit',   group: 'bank',   min: 10000 },
    indomaret:         { type_payment: 'retail_outlet', source_payment: 'xendit',   group: 'retail', min: 10000 },
    alfamart:          { type_payment: 'retail_outlet', source_payment: 'xendit',   group: 'retail', min: 10000 },
    alfamidi:          { type_payment: 'retail_outlet', source_payment: 'xendit',   group: 'retail', min: 10000 },
    alfaexpress:       { type_payment: 'retail_outlet', source_payment: 'xendit',   group: 'retail', min: 10000 },
    lawson:            { type_payment: 'retail_outlet', source_payment: 'xendit',   group: 'retail', min: 10000 },
    dandan:            { type_payment: 'retail_outlet', source_payment: 'xendit',   group: 'retail', min: 10000 }
}

export const GROUP_LABEL = { qris: '📱 QRIS', ewallet: '👛 E-Wallet', bank: '🏦 Transfer Bank', retail: '🏪 Retail' }

// ───────── helper ─────────
export const rp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`
export const cleanAmount = (v) => Number(String(v || '').replace(/[^\d]/g, ''))
export const quick = (text, id) => ({ type: 'reply', text, id })
export const copyBtn = (text, code) => ({ type: 'copy', text, code: String(code) })
export const urlBtn = (text, url) => ({ type: 'url', text, url })
export const trxId = () => 'TRX-' + Date.now() + String(Math.floor(Math.random() * 10000)).padStart(4, '0')

// "10000", "10.000", "10k", "10rb", "1jt", "1,5jt"
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

export const db = () => {
    const d = (global.db.sociabuzz ||= {})
    d.trx ||= {}
    return d
}

// ───────── sesi HTTP (cookie jar tiap transaksi, jadi tidak bentrok antar user) ─────────
export function createSession() {
    let jar = ''
    const setCookie = (name, value) => {
        const re = new RegExp('(^|;\\s*)' + name + '=[^;]*')
        jar = re.test(jar) ? jar.replace(re, '$1' + name + '=' + value) : (jar ? jar + '; ' : '') + name + '=' + value
    }
    const api = axios.create({ timeout: 20000, headers: { 'User-Agent': UA } })
    api.interceptors.response.use(r => {
        const sc = r.headers['set-cookie']
        if (sc) {
            for (const s of sc) {
                const [kv] = s.split(';')
                const [k, ...v] = kv.split('=')
                setCookie(k.trim(), v.join('='))
            }
        }
        return r
    })
    api.interceptors.request.use(c => {
        if (jar && String(c.url).includes('sociabuzz')) c.headers.Cookie = jar
        return c
    })
    const csrfFromJar = () => jar.match(/csrf_cookie_name=([^;]+)/)?.[1] || null
    return { api, setCookie, csrfFromJar }
}

// ───────── buat pembayaran ─────────
export async function createPayment(amount, name, message, method, extras = {}) {
    method = String(method || 'qris').toLowerCase()
    const pm = METHODS[method]
    if (!pm) throw new Error(`Metode ${method} tidak tersedia`)

    amount = cleanAmount(amount)
    if (!amount || amount < pm.min) throw new Error(`Minimal ${rp(pm.min)} untuk ${method}`)
    if (pm.need_phone && !extras.phone) throw new Error(`Metode ${method} butuh nomor HP`)

    const { api, setCookie, csrfFromJar } = createSession()
    const donateUrl = `${BASE_URL}/${username()}/donate`

    const home = await api.get(donateUrl, { headers: { Accept: 'text/html' } })
    const $ = cheerio.load(home.data)
    const csrf = $('input[name="sb_token_csrf"]').val()
    if (!csrf) throw new Error('Token CSRF Sociabuzz tidak ditemukan (username salah atau halaman berubah)')

    const body = {
        sb_token_csrf: csrf, currency: 'IDR', amount: String(amount), qty: '1',
        support_duration: '30', note: message || '', fullname: name || 'Donatur',
        email: extras.email || 'donatur' + Date.now() + '@gmail.com', is_agree: '1', years18: '1',
        is_vote: '0', is_voice: '0', is_mediashare: '0', is_gif: '0', is_sound: '0',
        is_voicy: '0', vote_id: '', ms_maxtime: '', start_from: '0',
        ms_starthour: '0', ms_startminute: '0', ms_startsecond: '0', spin_check: '0',
        prev_url: donateUrl, hide_email: '0', is_tiktok: '0', tiktok_duration: '0',
        is_instagram: '0', instagram_duration: '0', wishlist_id: '', quickpay: '0'
    }

    const sub = await api.post(donateUrl + '/get-form-queue', new URLSearchParams(body).toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: BASE_URL, Referer: donateUrl, 'X-Requested-With': 'XMLHttpRequest'
        }
    })
    if (sub.data.success !== 'true') throw new Error(sub.data.content?.form_alert || 'Pembuatan donasi gagal')

    const paymentUrl = sub.data.content.redirect
    const token = paymentUrl.split('/payment/x/')[1]?.split(/[?#]/)[0]
    if (!token) throw new Error('Token pembayaran tidak ditemukan')

    const pay = await api.get(paymentUrl, { headers: { Accept: 'text/html' } })
    let csrf2 = pay.data.match(/input.*name="sb_token_csrf".*value="([^"]+)"/)?.[1]
    setCookie('sociabuzz_sb_cookie_csrf', csrf2)

    await api.get(`${BASE_URL}/payment/pay/setting`, {
        params: {
            amount: String(amount), currency: 'IDR', base_amount: String(amount),
            base_currency: 'IDR', currency_def: 'IDR', convertion: 'IDR',
            country: 'Indonesia', feature: 'TRIBE', is_borne_fee: '1', risk: '',
            message: '', direct: '', service_fee: '1', token, country_account: ''
        }
    })

    const c = csrfFromJar()
    if (c) { setCookie('sociabuzz_sb_cookie_csrf', c); csrf2 = c }

    const sendBody = {
        sb_token_csrf: csrf2,
        order_id: token,
        final_currency: 'IDR',
        currency_def: 'IDR',
        payment_method: method,
        type_payment: pm.type_payment,
        source_payment: pm.source_payment,
        country: 'ID',
        country_pay: 'Indonesia'
    }
    if (extras.phone) sendBody.phone_number = extras.phone

    const res = await api.post(`${BASE_URL}/payment/send/create`, sendBody, {
        headers: {
            'Content-Type': 'application/json',
            Origin: BASE_URL, Referer: paymentUrl, 'X-Requested-With': 'XMLHttpRequest'
        }
    })
    if (!res.data?.status) throw new Error(JSON.stringify(res.data))

    const rd = res.data
    const d = rd.data || {}
    const total = cleanAmount(d.amount || d.total || amount)

    let expired = new Date(Date.now() + 3600000)
    if (d.countdown) {
        const t = new Date(d.countdown)
        if (!isNaN(t.getTime())) expired = t
    }

    const info = {
        method,
        group: pm.group,
        payment_method: rd.payment_method,
        type_payment: rd.type_payment,
        source_payment: rd.source_payment
    }
    if (d.qr_string) info.qr_string = d.qr_string
    if (d.account_number) info.account_number = d.account_number
    if (d.name) info.bank_name = d.name
    if (d.bank) info.bank = d.bank
    if (d.redirect_url) info.redirect_url = d.redirect_url
    if (d.payment_code) info.payment_code = d.payment_code

    return {
        id: trxId(),
        order_id: token,
        payment_url: paymentUrl,
        method,
        amount,
        total,
        fee: total - amount,
        created: new Date().toISOString(),
        expired: expired.toISOString(),
        payment: info
    }
}

// ───────── kirim pesan bertombol (fallback ke teks) ─────────
export async function sendBtn(sock, m, o) {
    try {
        await sock.sendButtons(m.chat, { footer: global.namebot || 'Kaguya MD', ...o }, { quoted: m })
    } catch {
        const text = `${o.text || ''}`.trim()
        await sock.sendMessage(m.chat, o.image ? { image: o.image, caption: text } : { text }, { quoted: m })
    }
}

export const wib = (iso) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })

export function buildText(trx, p) {
    const pi = trx.payment
    const lines = [
        `╭─▣「 *SOCIABUZZ ${trx.id}* 」▣─╮`,
        `┃ 💳 Metode : ${trx.method.toUpperCase()}`,
        `┃ 💰 Nominal : ${rp(trx.amount)}`,
        trx.fee > 0 ? `┃ 🧾 Biaya : ${rp(trx.fee)}` : null,
        `┃ 💵 *Total bayar : ${rp(trx.total)}*`,
        `┃ ⏳ Berlaku s/d : ${wib(trx.expired)} WIB`,
        `╰─────────────➤`
    ].filter(Boolean)

    let note = ''
    if (pi.group === 'qris') note = `\nScan QR di atas lewat e-wallet / m-banking dan bayar *tepat ${rp(trx.total)}*.`
    if (pi.group === 'bank' && pi.account_number) note = `\n🏦 Bank : ${pi.bank_name || pi.bank || trx.method.toUpperCase()}\n🔢 No. VA/Rekening : *${pi.account_number}*`
    if (pi.group === 'retail' && (pi.payment_code || pi.account_number)) note = `\n🏪 Kode bayar : *${pi.payment_code || pi.account_number}*\nBayar di kasir ${trx.method}.`
    if (pi.group === 'ewallet') note = pi.redirect_url ? `\nBuka link pembayaran di bawah lewat HP kamu.` : `\nCek notifikasi aplikasi ${trx.method.toUpperCase()} kamu untuk menyelesaikan pembayaran.`

    return lines.join('\n') + note
}

// ───────── perintah ─────────


