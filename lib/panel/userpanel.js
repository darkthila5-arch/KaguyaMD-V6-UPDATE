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

// Panel Pterodactyl pribadi milik user.

import dns from 'node:dns/promises'
import net from 'node:net'
import * as C from './core.js'
import { getOwn } from '../core/usercreds.js'

const PRIVATE_V4 = [
    /^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^198\.1[89]\./, /^2(2[4-9]|[3-5]\d)\./
]
const isPrivateIp = (ip) => {
    if (net.isIPv4(ip)) return PRIVATE_V4.some(r => r.test(ip))
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase()
        if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true
        // IPv4 yang dibungkus IPv6 (::ffff:7f00:1, 64:ff9b::...) bisa dipakai menyelundupkan alamat internal
        return v.startsWith('::ffff:') || v.startsWith('64:ff9b:')
    }
    return true
}

/** Normalisasi + validasi domain panel. Mengembalikan { ok, domain, error }. Cegah SSRF ke jaringan internal. */
export async function checkDomain(raw) {
    let u
    try { u = new URL(String(raw || '').trim().replace(/\/+$/, '')) } catch { return { ok: false, error: 'Domain panel tidak valid. Contoh: https://panel.domainmu.com' } }
    if (u.protocol !== 'https:') return { ok: false, error: 'Domain panel harus diawali https://' }
    if (u.username || u.password) return { ok: false, error: 'Domain tidak boleh memuat username/password.' }
    const host = u.hostname.replace(/^\[|\]$/g, '')
    if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return { ok: false, error: 'Domain panel tidak boleh alamat lokal.' }
    if (net.isIPv6(host)) return { ok: false, error: 'Pakai nama domain, bukan alamat IPv6.' }
    if (net.isIP(host)) {
        if (isPrivateIp(host)) return { ok: false, error: 'Domain panel tidak boleh alamat IP internal.' }
    } else {
        try {
            const addrs = await dns.lookup(host, { all: true })
            if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) return { ok: false, error: 'Domain panel mengarah ke alamat internal, ditolak.' }
        } catch { return { ok: false, error: 'Domain panel tidak bisa ditemukan (DNS gagal).' } }
    }
    return { ok: true, domain: `${u.protocol}//${u.host}` }
}

/** Susun config panel (bentuk sama dengan C.cfg) dari data milik user. */
export function cfgFromOwn(own) {
    const base = C.cfg(1) // egg/location/docker bawaan; domain & key ditimpa
    const c = {
        ...base, n: 1, own: true, noRedirect: true,
        domain: String(own.domain || '').replace(/\/+$/, ''), plta: own.plta, pltc: own.pltc || '',
        node: Number(own.node) || base.node
    }
    c.ready = /^https:\/\//.test(c.domain) && !!c.plta
    c.readyClient = !!c.pltc
    return c
}

/**
 * Pilih panel untuk perintah kelola.
 *   - punya panel pribadi (.setpanel)  -> panel itu (server 1)
 *   - owner tanpa panel pribadi / server 2 -> config.js
 *   - user biasa tanpa panel pribadi   -> error
 * Hasil: { c } atau { error }
 */
export async function pickPanel({ sender, isOwner, prefix = '.' }, n = 1) {
    if (n === 2) return isOwner ? { c: C.cfg(2) } : { error: 'Server 2 khusus owner bot. Panel pribadimu dipakai tanpa angka 2 di belakang command.' }
    const own = getOwn(sender, 'panel')
    if (own) {
        const c = cfgFromOwn(own)
        const chk = await checkDomain(c.domain)
        if (!chk.ok) return { error: `${chk.error}\nPerbarui lewat ${prefix}setpanel.` }
        return { c }
    }
    if (isOwner) return { c: C.cfg(1) }
    return { error: `Panel pribadimu belum diatur.\nBuka chat pribadi bot lalu ketik:\n${prefix}setpanel <domain> <plta> [pltc]\n\nContoh: ${prefix}setpanel https://panel.domainmu.com ptla_xxx ptlc_xxx\n(PLTA = Application API key dari Admin > Application API)` }
}
