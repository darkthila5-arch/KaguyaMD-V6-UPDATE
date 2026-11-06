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

// Kirim notifikasi promo Telegram berkala ke user yang sudah /start.

import fs from 'node:fs'
import path from 'node:path'

const FILE = path.join(process.cwd(), 'database', 'tg-subscribers.json')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let cache = null
let timer = null

const flush = () => {
    timer = null
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true })
        const tmp = FILE + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify({ _meta: { desc: 'Penerima notifikasi Telegram (user yang pernah /start)' }, plan: cache.plan, round: cache.round, users: cache.users }, null, 2))
        fs.renameSync(tmp, FILE)
    } catch (e) { console.error('[ TG-PROMO ] gagal simpan:', e?.message || e) }
}
const save = () => { if (!timer) timer = setTimeout(flush, 500) }
process.on('exit', () => { if (timer) { clearTimeout(timer); flush() } })

const load = () => {
    if (cache) return cache
    cache = { plan: null, round: 0, users: {} }
    try {
        const j = JSON.parse(fs.readFileSync(FILE, 'utf8'))
        if (j?.users && typeof j.users === 'object') cache.users = j.users
        cache.plan = j?.plan && typeof j.plan === 'object' ? j.plan : null
        cache.round = Number(j?.round) || 0
    } catch {}
    return cache
}

/** Catat user yang /start (chat pribadi saja). Mengaktifkan lagi kalau sebelumnya /stop. */
export function addSubscriber(from, chat) {
    if (!from?.id || chat?.type !== 'private' || from.is_bot) return false
    const d = load()
    const id = String(chat.id)
    const cur = d.users[id]
    d.users[id] = {
        id, name: [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || '', username: from.username || '',
        since: cur?.since || Date.now(), active: true
    }
    save()
    return !cur || cur.active === false
}

/** User mematikan notifikasi (/stop). */
export function removeSubscriber(chatId) {
    const d = load()
    const cur = d.users[String(chatId)]
    if (!cur || cur.active === false) return false
    cur.active = false
    cur.stoppedAt = Date.now()
    save()
    return true
}

export const countSubscribers = () => Object.values(load().users).filter(u => u.active !== false).length

/** Masukkan user lama yang pernah chat pribadi (tercatat di database bot) tapi belum ada di daftar. */
function backfill() {
    try {
        const d = load()
        let n = 0
        for (const jid of Object.keys(global.db?.users || {})) {
            const m = /^(\d+)@telegram$/.exec(jid)
            if (!m || d.users[m[1]]) continue
            d.users[m[1]] = { id: m[1], name: global.db.users[jid]?.name || '', username: '', since: Date.now(), active: true, source: 'riwayat' }
            n++
        }
        if (n) save()
        return n
    } catch { return 0 }
}

const DEFAULT_TEXTS = [
    '👋 Halo! Bot ini siap bantu kamu kapan saja.\n\nKetik /menu untuk melihat semua fitur, atau mau punya panel sendiri? Beli *Panel Pterodactyl* langsung di sini lewat /belipanel.',
    '🛒 *Butuh panel buat jalanin bot / script?*\n\nPilih paket, bayar, dan panel langsung jadi. Buka /belipanel sekarang untuk lihat produk & harga.',
    '✨ Sudah coba fitur bot kami hari ini?\n\nKetik /menu untuk lihat semuanya, atau beli panel di /belipanel.'
]

const TZ_OFFSET_H = 7 // WIB (tanpa DST)
const dayKey = (ts, off) => new Date(ts + off * 3600_000).toISOString().slice(0, 10)
const dayStart = (ts, off) => Date.parse(dayKey(ts, off) + 'T00:00:00Z') - off * 3600_000 // 00.00 lokal dalam ms UTC
const rnd = (a, b) => a + Math.random() * (b - a)

/**
 * Susun jam kirim acak untuk satu hari (dalam jam desimal lokal).
 * Tiap kiriman berjarak >= gap jam dari sebelumnya, semuanya di dalam [from, to].
 * Kalau sisa hari tidak muat `n` kiriman, jumlahnya dikurangi.
 */
export function planTimes(n, gap, from, to) {
    const times = []
    let lo = from
    for (let i = 0; i < n; i++) {
        const left = n - 1 - i
        const hi = to - gap * left
        if (hi < lo) break // tidak muat lagi
        const t = rnd(lo, hi)
        times.push(t)
        lo = t + gap
    }
    return times
}

/**
 * Jalankan penjadwal. Mengembalikan { stop }.
 *   call(method, params) : pemanggil API Telegram (sudah terikat token)
 *   prefix()             : prefix bot, supaya tombol memanggil command yang benar
 */
export function startPromo({ call, prefix = () => '.', cfg = {}, say = () => {} }) {
    const c = { enabled: true, perDay: 2, minGapHours: 6, windowStart: 8, windowEnd: 22, texts: DEFAULT_TEXTS, buttons: true, ...cfg }
    if (c.enabled === false) { say('info', 'Notifikasi Telegram berkala nonaktif (global.telegram.promo.enabled = false).'); return { stop() {} } }

    const perDay = Math.max(1, Math.min(24, Math.floor(Number(c.perDay) || 2)))
    const winA = Math.min(23, Math.max(0, Number(c.windowStart) || 0))
    const winB = Math.min(24, Math.max(winA + 0.5, Number(c.windowEnd) || 22))
    // jarak minimal dipaksa muat di dalam jendela waktu
    const gap = Math.max(0, Math.min(Number(c.minGapHours) || 0, perDay > 1 ? (winB - winA) / (perDay - 1) : 0))
    const texts = (Array.isArray(c.texts) && c.texts.length ? c.texts : DEFAULT_TEXTS).map(String)
    let stopped = false
    let tick = null
    let running = false

    const markup = () => {
        if (c.buttons === false) return undefined
        const p = prefix()
        return { inline_keyboard: [[{ text: '🛒 Beli Panel', callback_data: `${p}belipanel` }, { text: '📋 Menu', callback_data: `${p}menu` }]] }
    }

    // rencana hari ini: { day, slots: [{ at, done }] }. Dibuat sekali per hari, disimpan, dan tidak berubah saat restart.
    function ensurePlan() {
        const d = load()
        const now = Date.now()
        const day = dayKey(now, TZ_OFFSET_H)
        if (d.plan?.day === day) return d.plan
        const base = dayStart(now, TZ_OFFSET_H)
        const nowH = (now - base) / 3600_000
        // hari berjalan: jangan jadwalkan di jam yang sudah lewat (sisakan 5 menit)
        const from = Math.max(winA, nowH + 5 / 60)
        // kalau sisa hari tidak muat semua kiriman (mis. bot baru dipasang sore), kurangi jumlahnya
        let hours = []
        for (let k = perDay; k >= 1 && !hours.length; k--) { const t = planTimes(k, gap, from, winB); if (t.length === k) hours = t }
        const slots = hours.map(h => ({ at: Math.round(base + h * 3600_000), done: false }))
        d.plan = { day, slots }
        save()
        say('info', `Jadwal notifikasi ${day}: ${slots.length ? slots.map(x => new Date(x.at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })).join(', ') + ' WIB' : '(tidak ada, sisa hari terlalu pendek)'}`)
        return d.plan
    }

    async function broadcast() {
        if (running || stopped) return
        running = true
        const d = load()
        try {
            backfill()
            const targets = Object.values(d.users).filter(u => u.active !== false)
            if (!targets.length) return
            const text = texts[d.round++ % texts.length] + '\n\n_Matikan notifikasi: /stop_'
            let ok = 0, gone = 0
            for (const u of targets) {
                if (stopped) break
                try {
                    const base = { chat_id: u.id, text, disable_web_page_preview: true, reply_markup: markup() }
                    try { await call('sendMessage', { ...base, parse_mode: 'Markdown' }) } catch (e) {
                        // teks custom dengan format Markdown rusak -> kirim sebagai teks biasa
                        if (e?.code === 400 && /parse entities/i.test(e.message || '')) await call('sendMessage', base)
                        else throw e
                    }
                    ok++
                } catch (e) {
                    // diblokir / akun hilang / chat tidak ada -> keluarkan dari daftar
                    if (e?.code === 403 || (e?.code === 400 && /chat not found|user is deactivated|PEER_ID_INVALID/i.test(e.message || ''))) {
                        u.active = false; u.blockedAt = Date.now(); gone++
                    } else {
                        say('warn', `Notifikasi ke ${u.id} gagal: ${e?.message || e}`)
                    }
                }
                await sleep(60)
            }
            save()
            say('ok', `Notifikasi terkirim ke ${ok} user${gone ? `, ${gone} dikeluarkan (memblokir bot)` : ''}`)
        } finally { running = false }
    }

    const LATE_MS = 60 * 60_000 // restart terlambat <= 1 jam masih dikirim, lebih dari itu dilewati
    const schedule = () => {
        if (stopped) return
        const plan = ensurePlan()
        const now = Date.now()
        // slot yang terlewat jauh dianggap lewat
        for (const sl of plan.slots) if (!sl.done && now - sl.at > LATE_MS) sl.done = true
        const next = plan.slots.find(sl => !sl.done)
        const wait = next
            ? Math.max(1000, next.at - now)
            : Math.max(30_000, dayStart(now, TZ_OFFSET_H) + 24 * 3600_000 + 30_000 - now) // tunggu hari berikutnya
        tick = setTimeout(async () => {
            if (next && !next.done) {
                next.done = true // tandai dulu supaya tidak terkirim dobel kalau proses berulang
                save()
                await broadcast().catch(e => say('error', `promo: ${e.message}`))
            }
            schedule()
        }, Math.min(wait, 2 ** 31 - 1))
    }
    ensurePlan()
    schedule()
    say('ok', `Notifikasi Telegram aktif: ${perDay}x/hari, jam acak ${winA}.00-${winB}.00 WIB, jarak min ${gap} jam, ${countSubscribers()} penerima`)

    return { stop() { stopped = true; if (tick) clearTimeout(tick) } }
}
