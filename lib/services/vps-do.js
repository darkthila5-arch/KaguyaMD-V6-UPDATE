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

// Helper fitur VPS DigitalOcean.

import axios from 'axios'
import crypto from 'crypto'
import * as C from '../panel/core.js'
import { resolve as resolveCred, credCtx } from '../core/usercreds.js'

const API = 'https://api.digitalocean.com/v2'

export const DO = () => global.digitalocean || {}
export const LINE = '─────────────────────'
export const B = (t) => `*${t}*`

// Paket VPS = command. Bisa ditambah/diubah lewat global.digitalocean.plans di config.js
const DEFAULT_PLANS = {
    vps1g1c: { size: 's-1vcpu-1gb', ram: '1GB', cpu: '1 vCPU' },
    vps2g1c: { size: 's-1vcpu-2gb', ram: '2GB', cpu: '1 vCPU' },
    vps2g2c: { size: 's-2vcpu-2gb', ram: '2GB', cpu: '2 vCPU' },
    vps4g2c: { size: 's-2vcpu-4gb', ram: '4GB', cpu: '2 vCPU' },
    vps8g4c: { size: 's-4vcpu-8gb', ram: '8GB', cpu: '4 vCPU' }
}
export const plans = () => (DO().plans && Object.keys(DO().plans).length ? DO().plans : DEFAULT_PLANS)

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/** Password acak aman (crypto, bukan Math.random) */
export function genPassword(length = 14) {
    const set = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
    const bytes = crypto.randomBytes(length)
    let out = ''
    for (let i = 0; i < length; i++) out += set[bytes[i] % set.length]
    return out
}

/**
 * Akses: owner bot, role Panel (reseller/admin/pt/owner), atau nomor di
 * global.digitalocean.sellers / ownerPanels.
 */
export async function hasAccess(m, ctx) {
    if (ctx.isOwner) return true
    const d = DO()
    const num = String(m.sender || '').split('@')[0].split(':')[0]
    if ([...(d.sellers || []), ...(d.ownerPanels || [])].map(String).includes(num)) return true
    try {
        const role = await C.roleOf(ctx.sock, m.sender, ctx.isOwner)
        return !!role
    } catch { return false }
}

/**
 * Cek token + akses. Return true kalau boleh lanjut (sudah membalas sendiri kalau tidak).
 * Token yang dipakai (urutan):
 *   1. token DigitalOcean milik pengirim (.setdo) -> siapa saja boleh
 *   2. owner bot tanpa token pribadi -> token bawaan config.js
 *   3. seller / role panel tanpa token pribadi -> token bawaan config.js (perilaku lama)
 * Selain itu pengguna diminta mengatur token sendiri.
 */
export async function guard(m, ctx) {
    if (resolveCred('digitalocean').token) return true
    if (DO().token && (await hasAccess(m, ctx))) {
        const st = credCtx.getStore()
        if (st) st.shared = true
        return true
    }
    await ctx.reply(`☾ ${B('TOKEN DIGITALOCEAN BELUM DISET')}\n${LINE}\nBuka chat pribadi bot lalu ketik:\n${ctx.prefix || '.'}setdo <token>\n\nBuat token (Read & Write) di cloud.digitalocean.com/account/api/tokens`)
    return false
}

const tokenNow = () => resolveCred('digitalocean').token || (credCtx.getStore()?.shared ? DO().token : '')

/** Panggil API DigitalOcean. Return { ok, data, status, error } (tidak pernah throw). */
export async function call(method, path, body) {
    try {
        const r = await axios({
            method, url: API + path, data: body, timeout: 30000,
            headers: { Authorization: `Bearer ${tokenNow()}`, 'Content-Type': 'application/json' },
            validateStatus: () => true
        })
        const ok = r.status >= 200 && r.status < 300
        return { ok, status: r.status, data: r.data, error: ok ? null : (r.data?.message || `HTTP ${r.status}`) }
    } catch (e) {
        return { ok: false, status: 0, data: null, error: e.message }
    }
}

export const publicIp = (d, v = 'v4') => d?.networks?.[v]?.find(n => n.type === 'public')?.ip_address || '-'

/** Template pesan error seragam (pengganti te() Rimuru) */
export function errText(prefix, command, r) {
    const hint = r?.status === 401 ? 'Token DigitalOcean salah / kadaluarsa.'
        : r?.status === 404 ? 'ID droplet tidak ditemukan.'
        : r?.status === 422 ? 'Permintaan ditolak DigitalOcean (cek region / paket / hostname).'
        : r?.status === 429 ? 'Terlalu banyak permintaan, coba lagi sebentar.'
        : 'Coba lagi nanti. Kalau terus berulang, hubungi owner.'
    return `☾ ${B('GAGAL')}\n${LINE}\nCommand : ${prefix}${command}\nAlasan  : ${r?.error || 'tidak diketahui'}\n\n${hint}`
}

export const fmtDate = (iso) =>
    new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'medium' }) + ' WIB'

export const validId = (s) => /^\d{4,15}$/.test(String(s || '').trim())
