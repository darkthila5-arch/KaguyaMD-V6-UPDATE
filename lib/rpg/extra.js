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

// Fitur tambahan: badge, trial premium, saran ke owner, dan turnamen clan mingguan.

import { saveDB, getOwners, jidNumber } from '../core/system.js'
import { rpgStore, toPN } from '../engine/plugins.js'
import { giveReward, rewardText, fiturFmt as fmt } from '../engine/features.js'
import { resolveIds, findPremium, addPremium, phoneOf, userOf } from '../core/data.js'

// ───────────────────────── konfigurasi ─────────────────────────
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const merge = (a, b) => {
    const out = { ...a }
    for (const k of Object.keys(b || {})) out[k] = isObj(a?.[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k]
    return out
}

const DEFAULTS = {
    badge: { on: false },
    trial: { on: false, hari: 3 },
    saran: { on: false, cooldownDetik: 60, maksMenunggu: 3, maxPanjang: 500 },
    turnamen: {
        on: false,
        hariReset: 'minggu',
        jamReset: 21,                  // WIB
        minAnggota: 2,                 // clan dengan anggota lebih sedikit tidak ikut
        minSkor: 1,                    // skor minimal supaya masuk peringkat
        skorPerMenang: 100,            // tiap kemenangan war dalam periode
        skorPerExp: 1,                 // tiap exp clan yang naik dalam periode
        umumkanKe: 'semuaGrup',        // 'semuaGrup' | 'owner' | ['120363xxx@g.us']
        hadiah: [                      // PER ANGGOTA clan juara 1, 2, 3
            { money: 50000, exp: 3000, limit: 10 },
            { money: 30000, exp: 2000, limit: 5 },
            { money: 15000, exp: 1000, limit: 3 }
        ]
    }
}
export const X = () => merge(merge(DEFAULTS, global.extraFitur || {}), global.db?.fitur?.cfg?.extraFitur || {})   // + pengaturan dari command .setfitur

// ───────────────────────── util ─────────────────────────
const WIB = 7 * 36e5
const DAYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
const wib = (t = Date.now()) => new Date(t + WIB)
const dayKey = (t = Date.now()) => wib(t).toISOString().slice(0, 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const save = () => { try { saveDB(global.db) } catch { } }
const users = () => rpgStore().users
const prefixOf = () => (Array.isArray(global.prefix) ? global.prefix.find((p) => typeof p === 'string' && p) : '') || '.'

export function store() {
    const s = (global.db.kaguyaX ||= {})
    s.badges ||= {}      // jid -> { got: {id: ts}, cmd, streak, last, days, juara, saran }
    s.saran ||= { seq: 0, list: [] }
    s.trial ||= {}       // nomor -> { ids, jid, until, ended }
    s.turnamen ||= { boundary: 0, snap: {}, hist: [] }
    return s
}

const ownerJids = () => [...new Set(getOwners().map((n) => String(n).replace(/\D/g, '')).filter(Boolean))].map((n) => `${n}@s.whatsapp.net`)
const waSock = () => (global.sock && global.sock.platform !== 'telegram' ? global.sock : null)

// ═══════════════════════════════════════════════════════════
// 1. BADGE
// ═══════════════════════════════════════════════════════════
export const BADGES = [
    { id: 'pemula', e: '🌱', n: 'Pemula', d: 'Jalankan 10 command', cek: (c) => c.cmd >= 10, prog: (c) => [c.cmd, 10], hadiah: { limit: 1 } },
    { id: 'aktif', e: '⚡', n: 'Aktif', d: 'Jalankan 200 command', cek: (c) => c.cmd >= 200, prog: (c) => [c.cmd, 200], hadiah: { limit: 3 } },
    { id: 'maniak', e: '🔥', n: 'Maniak Bot', d: 'Jalankan 1.000 command', cek: (c) => c.cmd >= 1000, prog: (c) => [c.cmd, 1000], hadiah: { limit: 10 } },
    { id: 'rajin', e: '📆', n: 'Rajin', d: 'Aktif 7 hari berturut-turut', cek: (c) => c.streak >= 7, prog: (c) => [c.streak, 7], hadiah: { limit: 5 } },
    { id: 'setia', e: '💎', n: 'Setia', d: 'Aktif 30 hari berturut-turut', cek: (c) => c.streak >= 30, prog: (c) => [c.streak, 30], hadiah: { limit: 20 } },
    { id: 'petualang', e: '🧭', n: 'Petualang', d: 'Capai level 10', cek: (c) => c.level >= 10, prog: (c) => [c.level, 10], hadiah: { limit: 3 } },
    { id: 'veteran', e: '⚔️', n: 'Veteran', d: 'Capai level 25', cek: (c) => c.level >= 25, prog: (c) => [c.level, 25], hadiah: { limit: 5 } },
    { id: 'legenda', e: '👑', n: 'Legenda', d: 'Capai level 50', cek: (c) => c.level >= 50, prog: (c) => [c.level, 50], hadiah: { limit: 10 } },
    { id: 'kaya', e: '💰', n: 'Kaya', d: 'Punya 1.000.000 money', cek: (c) => c.money >= 1e6, prog: (c) => [c.money, 1e6], hadiah: { limit: 3 } },
    { id: 'sultan', e: '🏦', n: 'Sultan', d: 'Punya 100.000.000 money', cek: (c) => c.money >= 1e8, prog: (c) => [c.money, 1e8], hadiah: { limit: 10 } },
    { id: 'anakclan', e: '🛡️', n: 'Anak Clan', d: 'Bergabung ke sebuah clan', cek: (c) => c.clan, prog: (c) => [c.clan ? 1 : 0, 1], hadiah: { limit: 2 } },
    { id: 'juaraclan', e: '🏆', n: 'Juara Turnamen', d: 'Clanmu juara 1 turnamen mingguan', cek: (c) => c.juara >= 1, prog: (c) => [c.juara, 1], hadiah: { limit: 10 } },
    { id: 'premium', e: '🌟', n: 'Premium', d: 'Pernah jadi user premium', cek: (c) => c.premium, prog: (c) => [c.premium ? 1 : 0, 1], hadiah: { limit: 5 } },
    { id: 'suara', e: '📣', n: 'Penyumbang Saran', d: 'Kirim saran/request ke owner', cek: (c) => c.saran >= 1, prog: (c) => [c.saran, 1], hadiah: { limit: 3 } }
]

export function clanOf(jid) {
    const clans = rpgStore().bridge?.legacy?.clans || {}
    return Object.values(clans).find((c) => Array.isArray(c.members) && c.members.includes(jid)) || null
}

function isPremiumNow(jid) {
    try { return !!findPremium([jidNumber(jid)]) } catch { return false }
}

function badgeRec(jid) {
    const s = store()
    return (s.badges[jid] ||= { got: {}, cmd: 0, streak: 0, last: '', days: 0, juara: 0, saran: 0 })
}

function badgeCtx(jid) {
    const r = badgeRec(jid)
    const u = users()[jid] || {}
    return {
        cmd: r.cmd, streak: r.streak, juara: r.juara, saran: r.saran,
        level: Number(u.level) || 0, money: Number(u.money) || 0,
        clan: !!clanOf(jid), premium: !!r.premiumPernah || isPremiumNow(jid)
    }
}

/** Cek semua badge milik jid dan beri yang baru terbuka. Mengembalikan daftar badge baru. */
export function evalBadges(jid) {
    const r = badgeRec(jid)
    const c = badgeCtx(jid)
    if (c.premium) r.premiumPernah = true
    const baru = []
    for (const b of BADGES) {
        if (r.got[b.id]) continue
        let ok = false
        try { ok = !!b.cek(c) } catch { }
        if (!ok) continue
        r.got[b.id] = Date.now()
        const u = users()[jid]
        if (u && b.hadiah) giveReward(u, b.hadiah)
        baru.push(b)
    }
    return baru
}

/** Dipanggil handler.js setelah command berhasil. */
export async function trackBadge(sock, m, sender) {
    if (!X().badge.on) return
    const jid = await toPN(sock, sender)
    if (!jid || !users()[jid]) return
    const r = badgeRec(jid)
    r.cmd++
    const today = dayKey()
    if (r.last !== today) {
        r.streak = r.last === dayKey(Date.now() - 864e5) ? r.streak + 1 : 1
        r.last = today
        r.days++
    }
    const baru = evalBadges(jid)
    if (!baru.length) return
    save()
    const teks = baru.map((b) => `${b.e} *${b.n}* (${rewardText(b.hadiah)})`).join('\n')
    await m.reply(`🏅 *BADGE BARU TERBUKA!*\n\n${teks}\n\nLihat koleksimu dengan *${prefixOf()}badge*`).catch(() => null)
}

/** Deretan emoji badge untuk kartu profil. */
export function badgeLine(jid) {
    try {
        const got = store().badges[jid]?.got || {}
        const list = BADGES.filter((b) => got[b.id]).map((b) => b.e)
        return list.length ? list.join(' ') : '-'
    } catch { return '-' }
}

export function badgeDetail(jid) {
    evalBadges(jid)
    const r = badgeRec(jid)
    const c = badgeCtx(jid)
    const dapat = BADGES.filter((b) => r.got[b.id])
    const baris = BADGES.map((b) => {
        if (r.got[b.id]) return `✅ ${b.e} *${b.n}* — ${b.d}`
        const [a, t] = b.prog(c)
        return `🔒 ${b.e} ${b.n} — ${b.d} (${fmt(Math.min(a, t))}/${fmt(t)})`
    })
    return { dapat: dapat.length, total: BADGES.length, teks: baris.join('\n'), streak: r.streak, cmd: r.cmd }
}

// ═══════════════════════════════════════════════════════════
// 2. TRIAL PREMIUM
// ═══════════════════════════════════════════════════════════
export async function klaimTrial(sock, m, rawSender, meta = null) {
    const c = X().trial
    if (!c.on) return { ok: false, msg: 'Fitur trial premium sedang dimatikan.' }
    const ids = await resolveIds(sock, [rawSender, m.key?.participantAlt, m.key?.participantPn], meta)
    if (!ids.length) return { ok: false, msg: 'Nomormu tidak bisa dikenali, coba lagi di chat pribadi.' }

    if (findPremium(ids)) return { ok: false, msg: 'Kamu sudah premium, trial tidak diperlukan.' }
    const t = store().trial
    if (Object.values(t).some((e) => e.ids?.some((i) => ids.includes(i)))) {
        return { ok: false, msg: 'Trial premium hanya bisa diambil sekali per user.' }
    }

    const ms = Math.max(1, Number(c.hari) || 3) * 864e5
    const label = (await phoneOf(sock, rawSender, meta)) || userOf(rawSender)
    const jid = /^\d+$/.test(label) ? `${label}@s.whatsapp.net` : rawSender
    const { entry } = addPremium(ids, label, ms, jid)
    // pengingat bawaan H-3 / H-1: tahap H-3 dilewati supaya tidak langsung terkirim saat trial baru mulai
    entry.notified = Number(c.hari) <= 1 ? { d1: true, d3: true } : { d3: true }
    t[ids[0]] = { ids, jid, until: entry.until, ended: false, start: Date.now() }
    const pn = await toPN(sock, rawSender)
    if (users()[pn]) badgeRec(pn).premiumPernah = true
    save()
    return { ok: true, hari: Number(c.hari) || 3, until: entry.until }
}

export function trialStatus(ids) {
    const e = Object.values(store().trial).find((x) => x.ids?.some((i) => ids.includes(i)))
    return e || null
}

async function trialTick() {
    const sock = waSock()
    if (!sock?.user) return
    const now = Date.now()
    let dirty = false
    for (const e of Object.values(store().trial)) {
        if (e.ended || e.until > now) continue
        // kalau sudah diperpanjang jadi premium berbayar, tidak perlu pesan
        const masihPremium = (() => { try { return !!findPremium(e.ids) } catch { return false } })()
        e.ended = true
        dirty = true
        if (masihPremium) continue
        const teks = `⏰ *Trial premium berakhir*\n\nTerima kasih sudah mencoba fitur premium. Mau lanjut? Hubungi owner untuk perpanjang ya.\n\nBadge dan data RPG-mu tetap aman.`
        await sock.sendMessage(e.jid, { text: teks }).catch(() => null)
        await sleep(3000)
    }
    if (dirty) save()
}

// ═══════════════════════════════════════════════════════════
// 3. SARAN / REQUEST
// ═══════════════════════════════════════════════════════════
export const STATUS_SARAN = {
    menunggu: '🕐 Menunggu',
    diproses: '🛠️ Diproses',
    selesai: '✅ Selesai',
    ditolak: '❌ Ditolak'
}

export function saranKirim(jid, nama, teks) {
    const c = X().saran
    if (!c.on) return { ok: false, msg: 'Fitur saran sedang dimatikan.' }
    teks = String(teks || '').trim()
    if (teks.length < 5) return { ok: false, msg: 'Tulis sarannya minimal 5 karakter.' }
    if (teks.length > c.maxPanjang) return { ok: false, msg: `Saran terlalu panjang (maksimal ${c.maxPanjang} karakter).` }
    const s = store().saran
    const milik = s.list.filter((x) => x.jid === jid)
    const terakhir = milik.reduce((a, x) => Math.max(a, x.at), 0)
    const tunggu = terakhir + c.cooldownDetik * 1000 - Date.now()
    if (tunggu > 0) return { ok: false, msg: `Tunggu ${Math.ceil(tunggu / 1000)} detik lagi sebelum kirim saran berikutnya.` }
    if (milik.filter((x) => x.status === 'menunggu').length >= c.maksMenunggu) {
        return { ok: false, msg: `Kamu masih punya ${c.maksMenunggu} saran yang belum dibaca owner. Tunggu ada yang diproses dulu ya.` }
    }
    const item = { id: ++s.seq, jid, nama: nama || jidNumber(jid), teks, status: 'menunggu', catatan: '', at: Date.now(), upd: Date.now() }
    s.list.push(item)
    if (s.list.length > 500) s.list.splice(0, s.list.length - 500)
    badgeRec(jid).saran++
    evalBadges(jid)
    save()
    return { ok: true, item }
}

export async function saranNotifOwner(sock, item) {
    const teks = `📩 *SARAN BARU #${item.id}*\n\nDari: ${item.nama} (@${jidNumber(item.jid)})\n\n${item.teks}\n\nBalas dengan:\n*${prefixOf()}setsaran ${item.id} diproses|selesai|ditolak catatan*`
    for (const o of ownerJids()) await sock.sendMessage(o, { text: teks, mentions: [item.jid] }).catch(() => null)
}

export const saranMilik = (jid) => store().saran.list.filter((x) => x.jid === jid).slice(-8).reverse()
export const saranDaftar = (status) => store().saran.list.filter((x) => !status || x.status === status).slice(-15).reverse()

export function saranSet(id, status, catatan = '') {
    const s = store().saran
    const i = s.list.findIndex((x) => x.id === Number(id))
    if (i < 0) return { ok: false, msg: `Saran #${id} tidak ditemukan.` }
    if (status === 'hapus') {
        const [item] = s.list.splice(i, 1)
        save()
        return { ok: true, hapus: true, item }
    }
    if (!STATUS_SARAN[status]) return { ok: false, msg: `Status harus salah satu: ${Object.keys(STATUS_SARAN).join(', ')}, atau hapus.` }
    const item = s.list[i]
    item.status = status
    item.catatan = String(catatan || '').trim()
    item.upd = Date.now()
    save()
    return { ok: true, item }
}

// ═══════════════════════════════════════════════════════════
// 4. TURNAMEN CLAN MINGGUAN
// ═══════════════════════════════════════════════════════════
const clansAll = () => rpgStore().bridge?.legacy?.clans || {}

function lastBoundary(now = Date.now()) {
    const c = X().turnamen
    const dow = Math.max(0, DAYS.indexOf(String(c.hariReset).toLowerCase()))
    const w = wib(now)
    let ms = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), Number(c.jamReset) || 0) - WIB
    ms -= ((w.getUTCDay() - dow + 7) % 7) * 864e5
    if (ms > now) ms -= 7 * 864e5
    return ms
}

const snapshotClans = () => Object.fromEntries(Object.entries(clansAll()).map(([id, c]) => [id, { wins: Number(c.wins) || 0, exp: Number(c.exp) || 0 }]))

export function turnamenPeringkat() {
    const c = X().turnamen
    const snap = store().turnamen.snap || {}
    return Object.entries(clansAll())
        .filter(([, cl]) => Array.isArray(cl.members) && cl.members.length >= c.minAnggota)
        .map(([id, cl]) => {
            const b = snap[id] || { wins: 0, exp: 0 }
            const menang = Math.max(0, (Number(cl.wins) || 0) - b.wins)
            const exp = Math.max(0, (Number(cl.exp) || 0) - b.exp)
            return { id, nama: cl.name, emblem: cl.emblem || '🛡️', anggota: cl.members.length, menang, exp, skor: menang * c.skorPerMenang + exp * c.skorPerExp }
        })
        .filter((x) => x.skor >= Math.max(1, c.minSkor))
        .sort((a, b) => b.skor - a.skor)
}

export const turnamenInfo = () => ({ berikutnya: lastBoundary() + 7 * 864e5, mulai: store().turnamen.boundary || null, hist: store().turnamen.hist })

async function umumkan(teks, mentions = []) {
    const sock = waSock()
    if (!sock) return
    const spec = X().turnamen.umumkanKe
    let list = []
    if (spec === 'semuaGrup') list = Object.keys(global.db.groups || {}).filter((j) => j.endsWith('@g.us'))
    else if (Array.isArray(spec)) list = spec
    for (const jid of list.slice(0, 40)) {
        await sock.sendMessage(jid, { text: teks, mentions }).catch(() => null)
        await sleep(2500)
    }
    for (const o of ownerJids()) await sock.sendMessage(o, { text: teks, mentions }).catch(() => null)
}

/** Tutup periode kalau batas waktunya sudah lewat (atau force = true). */
export async function turnamenTick(force = false) {
    const c = X().turnamen
    if (!c.on || !global.db) return false
    const t = store().turnamen
    const b = lastBoundary()
    if (!t.boundary) {
        t.boundary = b
        t.snap = snapshotClans()
        save()
        return false
    }
    if (!force && t.boundary >= b) return false

    const rank = turnamenPeringkat().slice(0, c.hadiah.length)
    const nama = (global.namebot || 'BOT').toUpperCase()
    const baris = [`🏆 *${nama} TURNAMEN CLAN MINGGUAN* 🏆`, 'Periode berakhir, selamat untuk para juara!', '']
    const mentions = []
    if (!rank.length) baris.push('_Belum ada clan yang mencetak skor minggu ini._')
    rank.forEach((r, i) => {
        const cl = clansAll()[r.id]
        const hadiah = c.hadiah[i]
        for (const mem of cl.members) {
            const u = users()[mem]
            if (u) giveReward(u, hadiah)
            if (i === 0) { const rec = badgeRec(mem); rec.juara++; evalBadges(mem) }
        }
        if (i === 0) cl.juara = (Number(cl.juara) || 0) + 1
        mentions.push(cl.leader)
        baris.push(`${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${r.emblem} *${r.nama}* • skor ${fmt(r.skor)} (${r.menang} war menang, +${fmt(r.exp)} exp)`)
        baris.push(`   Ketua: @${jidNumber(cl.leader)} • hadiah tiap anggota: ${rewardText(hadiah)}`)
    })
    baris.push('', 'Periode baru dimulai. Menangkan war dan naikkan exp clan untuk masuk peringkat!')

    t.hist.unshift({ tgl: Date.now(), top: rank.map((r) => ({ nama: r.nama, skor: r.skor })) })
    t.hist.length = Math.min(t.hist.length, 8)
    t.boundary = force ? Math.max(b, t.boundary) : b
    t.snap = snapshotClans()
    save()
    await umumkan(baris.join('\n'), mentions)
    return true
}

// ═══════════════════════════════════════════════════════════
// pewaktu: turnamen + trial berakhir (satu timer saja)
// ═══════════════════════════════════════════════════════════
if (global.__kxTimer) clearInterval(global.__kxTimer)
global.__kxTimer = setInterval(async () => {
    try {
        if (!global.db) return
        await turnamenTick()
        await trialTick()
    } catch (e) { console.error('[KAGUYA-EXTRA tick]', e?.message || e) }
}, 60_000)
global.__kxTimer.unref?.()
