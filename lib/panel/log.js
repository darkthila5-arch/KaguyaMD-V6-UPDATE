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

// Catatan penjualan dan aktivitas panel.

import { saveDB } from '../core/system.js'

const MAX_LOG = 20000
const HIDE = /^(password|pass|apikey|api_key|token|secret|plta|pltc)$/i
const numOf = (jid) => String(jid || '').split('@')[0].split(':')[0]

export function panelDB() {
    const d = (global.db.panel ||= {})
    d.seq ||= 0
    d.sales ||= {}
    d.servers ||= {}
    d.sellers ||= {}
    d.customers ||= {}
    d.actions ||= []
    d.roleLog ||= []
    d.zan ||= {}
    return d
}

const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null || o[k] === '') delete o[k]; return o }
const push = (arr, item) => { arr.push(item); if (arr.length > MAX_LOG) arr.splice(0, arr.length - MAX_LOG) }
const save = () => { try { saveDB(global.db) } catch (e) { console.error('[ PANEL ] gagal simpan catatan:', e?.message || e) } }

/** Salin objek tanpa field rahasia, panjang dibatasi supaya database tidak membengkak. */
export function scrub(obj, depth = 0) {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === 'string') return obj.length > 500 ? obj.slice(0, 500) + '…' : obj
    if (typeof obj !== 'object') return obj
    if (depth > 4) return undefined
    if (Array.isArray(obj)) return obj.slice(0, 50).map(v => scrub(v, depth + 1))
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
        if (HIDE.test(k)) continue
        const s = scrub(v, depth + 1)
        if (s !== undefined) out[k] = s
    }
    return out
}

function touchSeller(d, a, kind) {
    const n = numOf(a.seller)
    if (!n) return
    const s = (d.sellers[n] ||= { jid: a.seller, role: a.sellerRole, sales: 0, admins: 0, failed: 0, firstAt: Date.now(), lastAt: 0, byPlan: {} })
    s.role = a.sellerRole || s.role
    s.lastAt = Date.now()
    if (kind === 'failed') s.failed++
    else if (a.type === 'admin') s.admins++
    else { s.sales++; s.byPlan[a.key] = (s.byPlan[a.key] || 0) + 1 }
}

function touchCustomer(d, a) {
    const n = a.buyerNum || numOf(a.buyer)
    if (!n) return
    const c = (d.customers[n] ||= { jid: a.buyer, orders: 0, admins: 0, firstAt: Date.now(), lastAt: 0, byPlan: {} })
    c.lastAt = Date.now()
    if (a.type === 'admin') c.admins++
    else { c.orders++; c.byPlan[a.key] = (c.byPlan[a.key] || 0) + 1 }
}

/**
 * Catat satu penjualan panel (paket atau akun admin).
 * info: { type: 'plan'|'admin', server, key, plan, seller, sellerRole, buyer, buyerNum, chat, username,
 *         user, srv, status: 'done'|'failed', stage, error, dm, price }
 */
export function recordSale(info) {
    const d = panelDB()
    const now = Date.now()
    const id = `PNL-${String(++d.seq).padStart(4, '0')}`
    const u = info.user || {}
    const s = info.srv || {}
    const status = info.status === 'done' ? 'done' : 'failed'
    const priceCfg = Number(info.plan?.price ?? global.panel?.plans?.[info.key]?.price) || 0
    const sale = clean({
        id, type: info.type || 'plan', server: info.server || 1, key: info.key,
        title: info.type === 'admin' ? 'Admin Panel' : `Panel ${String(info.key || '').toUpperCase()}`,
        plan: info.plan ? { ram: info.plan.ram, disk: info.plan.disk, cpu: info.plan.cpu } : undefined,
        seller: info.seller, sellerRole: info.sellerRole, buyer: info.buyer, buyerNum: info.buyerNum, chat: info.chat,
        username: info.username || u.username, userId: u.id, userUuid: u.uuid, email: u.email,
        serverId: s.id, serverUuid: s.uuid, price: info.price ?? priceCfg,
        status, stage: info.stage, error: info.error ? String(info.error).slice(0, 300) : undefined, dm: info.dm,
        createdAt: now, doneAt: status === 'done' ? now : undefined
    })
    d.sales[id] = sale
    touchSeller(d, sale, status)
    if (status === 'done') {
        touchCustomer(d, sale)
        if (s.id !== undefined) {
            d.servers[`${sale.server}:${s.id}`] = clean({
                server: sale.server, id: s.id, uuid: s.uuid, name: s.name || sale.username, userId: u.id, username: sale.username,
                key: sale.key, buyer: sale.buyer, seller: sale.seller, sale: id, status: 'active', createdAt: now,
                limits: s.limits ? { memory: s.limits.memory, disk: s.limits.disk, cpu: s.limits.cpu } : undefined
            })
        }
    }
    save()
    return id
}

/** Catat aksi kelola panel (listusr tidak dicatat; hapus/suspend/addsrv dicatat). */
export function recordAction(a) {
    const d = panelDB()
    const now = Date.now()
    push(d.actions, clean({
        at: now, action: a.action, server: a.server || 1, target: a.target, by: a.by, byRole: a.byRole || 'bot',
        ok: !!a.ok, error: a.error ? String(a.error).slice(0, 300) : undefined, data: a.data ? scrub(a.data) : undefined
    }))
    if (a.ok) {
        const key = `${a.server || 1}:${a.target}`
        const srv = d.servers[key]
        if (a.action === 'suspend' && srv) { srv.status = 'suspended'; srv.suspendedAt = now }
        else if (a.action === 'unsuspend' && srv) { srv.status = 'active'; delete srv.suspendedAt }
        else if (a.action === 'delsrv' && srv) { srv.status = 'deleted'; srv.deletedAt = now }
        else if (a.action === 'delusr') {
            for (const x of Object.values(d.servers)) {
                if (x.server === (a.server || 1) && String(x.userId) === String(a.target)) { x.userDeleted = true; x.userDeletedAt = now }
            }
        } else if (a.action === 'addsrv' && a.data?.id !== undefined) {
            d.servers[`${a.server || 1}:${a.data.id}`] = clean({
                server: a.server || 1, id: a.data.id, uuid: a.data.uuid, name: a.data.name, userId: a.data.userId,
                status: 'active', createdAt: now, manual: true, limits: a.data.limits
            })
        }
    }
    save()
}

/** Catat perubahan peran penjual panel. */
export function recordRole(r) {
    const d = panelDB()
    push(d.roleLog, clean({ at: Date.now(), action: r.action, role: r.role, number: r.number, by: r.by, byRole: r.byRole, ok: !!r.ok }))
    save()
}

const PAID_RE = /^(paid|settle|settlement|success|succeeded|completed?|done|lunas|berhasil|active|aktif)$/i

/**
 * Catat/perbarui order atau perpanjangan YannRzy Panel Pterodactyl.
 * info: { type: 'order'|'renew', invoice, productId, username, email, total, status, serverId, panelUrl,
 *         by, chat, raw }
 * Dipanggil berkali-kali untuk invoice yang sama: field baru digabung, perubahan status masuk `history`.
 */
export function recordZan(info) {
    if (!info?.invoice) return null
    const d = panelDB()
    const now = Date.now()
    const id = String(info.invoice)
    const status = info.status !== undefined ? String(info.status) : undefined
    let z = d.zan[id]
    if (!z) {
        z = d.zan[id] = { id, type: info.type || 'order', createdAt: now, history: [] }
        if (status) z.history.push({ at: now, status })
    }
    const prev = z.status
    Object.assign(z, clean({
        type: info.type || z.type, productId: info.productId, username: info.username, email: info.email,
        serverId: info.serverId, panelUrl: info.panelUrl, chat: info.chat, by: info.by,
        total: info.total !== undefined && info.total !== '' && Number.isFinite(Number(info.total)) ? Number(info.total) : undefined,
        status
    }))
    if (status) {
        z.paid = PAID_RE.test(status.trim())
        if (prev !== status) {
            if (prev !== undefined) z.history.push({ at: now, status })
            if (z.paid && !z.paidAt) z.paidAt = now
        }
    }
    if (info.raw) z.raw = scrub(info.raw)
    z.updatedAt = now
    save()
    return z
}

/**
 * Apakah orang ini pernah membeli lewat panel? (paket panel sukses, atau order YannRzy Panel Pterodactyl yang sudah dibayar)
 * Dipakai untuk menampilkan garansi: hanya untuk yang sudah pernah beli.
 * `ids`: satu atau beberapa nomor / jid (mis. nomor telepon dan jid asli pengirim).
 */
export function hasPurchased(...ids) {
    const nums = new Set(ids.flat().map(numOf).map(v => String(v || '').replace(/\D/g, '')).filter(Boolean))
    if (!nums.size) return false
    const d = panelDB()
    for (const n of nums) if ((d.customers[n]?.orders || 0) > 0) return true
    for (const s of Object.values(d.sales)) {
        if (s.status === 'done' && s.type !== 'admin' && nums.has(String(s.buyerNum || numOf(s.buyer)).replace(/\D/g, ''))) return true
    }
    for (const z of Object.values(d.zan)) {
        if (z.type === 'order' && z.paid && nums.has(numOf(z.by).replace(/\D/g, ''))) return true
    }
    return false
}

/** Ringkasan untuk laporan. */
export function panelSummary() {
    const d = panelDB()
    const sales = Object.values(d.sales)
    const done = sales.filter(s => s.status === 'done')
    const byPlan = {}
    for (const s of done) byPlan[s.title] = (byPlan[s.title] || 0) + 1
    const servers = Object.values(d.servers)
    return {
        total: sales.length, done: done.length, failed: sales.length - done.length,
        plans: done.filter(s => s.type !== 'admin').length, admins: done.filter(s => s.type === 'admin').length,
        omset: done.reduce((a, s) => a + (Number(s.price) || 0), 0),
        byPlan, sellers: Object.keys(d.sellers).length, customers: Object.keys(d.customers).length,
        servers: servers.length, active: servers.filter(s => s.status === 'active' && !s.userDeleted).length,
        suspended: servers.filter(s => s.status === 'suspended').length, deleted: servers.filter(s => s.status === 'deleted').length,
        zan: Object.keys(d.zan).length, zanPaid: Object.values(d.zan).filter(z => z.paid).length
    }
}
