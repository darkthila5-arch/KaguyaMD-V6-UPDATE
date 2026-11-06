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

// Tampilan fitur panel: animasi progres, kartu gambar, dan tombol.

import sharp from 'sharp'

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))
export const LINE = '─────────────────────'
const MOON = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const flat = (s) => String(s ?? '').normalize('NFKC').replace(/[^\x20-\x7E\u00A0-\u024F]/g, '').replace(/\s+/g, ' ').trim()
const bar = (p, w = 12) => {
    const n = Math.max(0, Math.min(w, Math.round(w * p)))
    return '█'.repeat(n) + '░'.repeat(w - n)
}

export const bold = (t) => `*${t}*`
export const mono = (lines) => '```\n' + lines.join('\n') + '\n```'
export const cut = (t, n) => {
    const a = Array.from(String(t ?? ''))
    return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('')
}

// ───────── animasi ─────────
// const a = await anim(sock, m, 'JUDUL', ['langkah 1', 'langkah 2'], 'sub judul')
// await a.step(1) -> langkah ke-1 selesai · await a.done(teks) · await a.fail(teks) · await a.remove()
export async function anim(sock, m, title, steps, sub = '') {
    const st = { i: 0, tick: 0, key: null, busy: false, dead: false, last: '' }

    const render = () => {
        const total = steps.length
        const lines = steps.map((s, k) => {
            if (k < st.i) return `✓ ${s}`
            if (k === st.i) return `${MOON[st.tick % MOON.length]} ${s}${'.'.repeat(1 + (st.tick % 3))}`
            return `· ${s}`
        })
        const p = st.i / total
        return [`☾ ${bold(title)}`, sub, LINE, ...lines, LINE, `${bar(p)} ${String(Math.round(p * 100)).padStart(3)}%`]
            .filter((x, k) => x !== '' || k > 1)
            .join('\n')
    }

    const push = async (text) => {
        if (st.dead || st.busy || text === st.last) return
        st.busy = true
        try {
            if (!st.key) {
                const r = await sock.sendMessage(m.chat, { text }, { quoted: m })
                st.key = r?.key
            } else {
                await sock.sendMessage(m.chat, { text, edit: st.key })
            }
            st.last = text
        } catch {} finally { st.busy = false }
    }

    const settle = async () => { while (st.busy) await sleep(80) }
    const finalText = async (text) => {
        try {
            if (st.key) await sock.sendMessage(m.chat, { text, edit: st.key })
            else await sock.sendMessage(m.chat, { text }, { quoted: m })
        } catch {
            await sock.sendMessage(m.chat, { text }, { quoted: m }).catch(() => {})
        }
    }

    await push(render())
    const timer = setInterval(() => { st.tick++; push(render()) }, 1200)
    timer.unref?.()
    const stop = () => { st.dead = true; clearInterval(timer) }

    return {
        async step(i) {
            st.i = Math.min(i === undefined ? st.i + 1 : i, steps.length)
            st.tick++
            await settle()
            await push(render())
            await sleep(350)
        },
        async done(text) {
            stop(); await settle()
            st.i = steps.length; st.dead = false
            await push(render()); await sleep(450)
            await finalText(text)
        },
        async fail(text) { stop(); await settle(); await finalText(text) },
        async remove() {
            stop(); await settle()
            try { if (st.key) await sock.sendMessage(m.chat, { delete: st.key }) } catch {}
        },
        stop
    }
}

// ───────── kartu gambar ─────────
const FONT = "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif"
const C = { bg1: '#1b1445', bg2: '#0c0a24', bg3: '#05040f', silver: '#d9defa', accent: '#ff8fc7', mint: '#6ee7d0', blue: '#8fa8ff', red: '#ff6b81', dim: '#9aa3d6' }

const defs = () => `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="0.6" stop-color="${C.bg2}"/><stop offset="1" stop-color="${C.bg3}"/></linearGradient>
  <linearGradient id="ttl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${C.accent}"/></linearGradient>
  <radialGradient id="moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="${C.silver}" stop-opacity="0.85"/><stop offset="1" stop-color="${C.silver}" stop-opacity="0"/></radialGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`

function stars(w, h, n = 60) {
    let seed = 977
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    let o = ''
    for (let i = 0; i < n; i++) o += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${(0.5 + rnd() * 1.5).toFixed(1)}" fill="${C.silver}" opacity="${(0.15 + rnd() * 0.55).toFixed(2)}"/>`
    return o
}

// bulan sabit + lingkaran cahaya (identitas visual kartu)
const moon = (cx, cy, r) => `<defs><mask id="cres"><rect x="${cx - r * 3}" y="${cy - r * 3}" width="${r * 6}" height="${r * 6}" fill="#fff"/><circle cx="${cx + r * 0.42}" cy="${cy - r * 0.18}" r="${r * 0.92}" fill="#000"/></mask></defs>
  <circle cx="${cx}" cy="${cy}" r="${r * 2.4}" fill="url(#moon)" opacity="0.3"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.silver}" mask="url(#cres)" filter="url(#glow)"/>`

const frame = (W, H) => `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="22" fill="none" stroke="${C.silver}" stroke-opacity="0.35" stroke-width="2"/>`

const meter = (x, y, w, label, value, p, color = C.mint) => `
  <text x="${x}" y="${y}" font-size="16" fill="${C.dim}" letter-spacing="2">${esc(label)}</text>
  <text x="${x + w}" y="${y}" font-size="19" fill="#fff" font-weight="bold" text-anchor="end">${esc(value)}</text>
  <rect x="${x}" y="${y + 10}" width="${w}" height="12" rx="6" fill="#ffffff" opacity="0.1"/>
  <rect x="${x}" y="${y + 10}" width="${Math.max(10, w * Math.max(0, Math.min(1, p)))}" height="12" rx="6" fill="${color}" filter="url(#glow)"/>`

const label = (x, y, t) => `<text x="${x}" y="${y}" font-size="15" fill="${C.dim}" letter-spacing="2">${esc(t)}</text>`

/** Kartu paket / struk. d: { store, title, plan, labels:{ram,disk,cpu}, username, status, ok, expired, garansi, line } */
export async function planCard(d) {
    const W = 1000, H = 540
    const ur = (v) => (v ? Math.min(1, v / 10240) : 1)
    const uc = (v) => (v ? Math.min(1, v / 300) : 1)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${defs()}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${stars(W, H)}${moon(W - 150, 130, 62)}${frame(W, H)}
  <text x="70" y="88" font-size="18" fill="${C.mint}" letter-spacing="5">${esc(flat(d.store).toUpperCase().slice(0, 30))}</text>
  <text x="70" y="150" font-size="54" fill="url(#ttl)" font-weight="bold" letter-spacing="3">${esc(d.title)}</text>
  <path d="M70 190 H${W - 330}" stroke="${C.silver}" stroke-opacity="0.35" stroke-width="1.5"/>
  ${meter(70, 250, 420, 'RAM', d.labels.ram, ur(d.plan.ram))}
  ${meter(70, 320, 420, 'DISK', d.labels.disk, ur(d.plan.disk), C.blue)}
  ${meter(70, 390, 420, 'CPU', d.labels.cpu, uc(d.plan.cpu), C.accent)}
  ${label(570, 250, 'AKUN')}<text x="570" y="284" font-size="28" fill="#fff" font-weight="bold">${esc(flat(d.username || '-').slice(0, 20))}</text>
  ${label(570, 326, 'STATUS')}<text x="570" y="360" font-size="26" fill="${d.ok === false ? C.red : C.mint}" font-weight="bold">${esc(d.status || 'AKTIF')}</text>
  ${label(570, 402, 'MASA AKTIF')}<text x="570" y="434" font-size="21" fill="#fff">${esc(d.expired || '-')}  /  garansi ${esc(d.garansi || '-')}</text>
  <text x="70" y="${H - 52}" font-size="15" fill="${C.dim}">${esc(flat(d.line || '').slice(0, 70))}</text>
</svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Kartu dasbor. d: { store, role, name, online, ms, users, servers, node, plans } */
export async function dashCard(d) {
    const W = 1000, H = 540
    const mem = d.node?.memory ? (d.node.memAlloc || 0) / d.node.memory : null
    const dsk = d.node?.disk ? (d.node.diskAlloc || 0) / d.node.disk : null
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${defs()}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${stars(W, H)}${moon(W / 2, 108, 52)}${frame(W, H)}
  <text x="${W / 2}" y="214" font-size="42" fill="url(#ttl)" font-weight="bold" text-anchor="middle" letter-spacing="6">${esc(flat(d.store).toUpperCase().slice(0, 24))}</text>
  <text x="${W / 2}" y="246" font-size="15" fill="${C.mint}" text-anchor="middle" letter-spacing="8">PTERODACTYL  DASHBOARD</text>
  <path d="M120 270 H${W - 120}" stroke="${C.silver}" stroke-opacity="0.3" stroke-width="1.5"/>
  ${label(90, 318, 'PENGGUNA')}<text x="90" y="348" font-size="26" fill="#fff" font-weight="bold">${esc(flat(d.name || '-').slice(0, 18))}</text>
  ${label(90, 384, 'PERAN')}<text x="90" y="414" font-size="24" fill="${C.accent}" font-weight="bold">${esc(d.role)}</text>
  ${label(400, 318, 'SERVER 1')}<text x="400" y="348" font-size="26" fill="${d.online ? C.mint : C.red}" font-weight="bold">${d.online ? 'ONLINE  ' + d.ms + ' ms' : 'OFFLINE'}</text>
  ${label(400, 384, 'USER  /  SERVER')}<text x="400" y="414" font-size="24" fill="#fff" font-weight="bold">${d.users ?? '-'}  /  ${d.servers ?? '-'}</text>
  ${mem !== null ? meter(660, 318, 260, 'KAPASITAS RAM', Math.round(mem * 100) + '%', mem, mem > 0.85 ? C.red : C.mint) : ''}
  ${dsk !== null ? meter(660, 384, 260, 'KAPASITAS DISK', Math.round(dsk * 100) + '%', dsk, dsk > 0.85 ? C.red : C.blue) : ''}
  <text x="${W / 2}" y="${H - 52}" font-size="15" fill="${C.dim}" text-anchor="middle">${esc(d.plans || '')}</text>
</svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
}

// ───────── tombol (format native flow, diterima sock.sendButtons) ─────────
const J = JSON.stringify
export const qr = (text, id) => ({ name: 'quick_reply', buttonParamsJson: J({ display_text: cut(text, 22), id }) })
export const copy = (text, value, id = 'copy_panel') => ({ name: 'cta_copy', buttonParamsJson: J({ display_text: cut(text, 30), id, copy_code: String(value) }) })
export const link = (text, url) => ({ name: 'cta_url', buttonParamsJson: J({ display_text: cut(text, 30), url, merchant_url: url }) })
export const select = (title, sections) => ({ name: 'single_select', buttonParamsJson: J({ title, sections }) })

/**
 * Kirim gambar + teks + tombol ke jid mana pun.
 * Urutan percobaan: tombol -> gambar + caption -> teks saja. Mengembalikan true kalau salah satu terkirim.
 */
export async function deliver(sock, jid, { image, body, footer, buttons = [], quoted }) {
    const q = quoted ? { quoted } : {}
    if (buttons.length) {
        try {
            await sock.sendButtons(jid, { text: body, footer, ...(image ? { image } : {}), buttons }, q)
            return true
        } catch (e) { console.error('[ PANEL ] tombol gagal:', e.message) }
    }
    try {
        if (image) await sock.sendMessage(jid, { image, caption: body }, q)
        else await sock.sendMessage(jid, { text: body }, q)
        return true
    } catch (e) { console.error('[ PANEL ] kirim gambar gagal:', e.message) }
    try {
        await sock.sendMessage(jid, { text: body }, q)
        return true
    } catch (e) {
        console.error('[ PANEL ] kirim teks gagal:', e.message)
        return false
    }
}
