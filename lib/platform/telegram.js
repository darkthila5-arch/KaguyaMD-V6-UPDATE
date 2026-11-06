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

// Bot Telegram: terima pesan, kirim balasan, dan sambungkan ke plugin.

import fs from 'fs'
import { cuteContent } from '../core/data.js'
import path from 'path'
import { addSubscriber, removeSubscriber, startPromo } from './tg-promo.js'

// batas panjang pesan Telegram
const MAX_TEXT = 4096
const SAFE_TEXT = 3800          // batas aman per bagian sebelum diubah ke HTML
const MAX_CAPTION = 1000        // batas caption Telegram 1024
const THREAD_TTL = 30 * 60_000

// ambil config global.telegram
const cfg = () => global.telegram || {}
// alamat API Telegram (bisa diganti lewat apiUrl)
const apiBase = () => String(cfg().apiUrl || 'https://api.telegram.org').replace(/\/+$/, '')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// buat JID user Telegram: <id>@telegram
export const userJid = (id) => `${id}@telegram`
// ubah chat Telegram jadi JID (private/grup)
export const chatJidOf = (chat) => chat?.type === 'private' ? userJid(chat.id) : `${chat?.id}@g.us`
// ambil ID angka dari JID
export const chatIdOf = (jid) => String(jid || '').split('@')[0]
// cek apakah JID berasal dari Telegram
export const isTelegramJid = (jid) => /@telegram$/.test(jid || '') || (/^-?\d+@g\.us$/.test(jid || '') && String(jid).startsWith('-'))

// ───────── error ─────────
export class TelegramError extends Error {
    constructor(message, { code, retryAfter, method } = {}) {
        super(message)
        this.name = 'TelegramError'
        this.code = code
        this.retryAfter = retryAfter
        this.method = method
    }
}

// ───────── pemanggil Bot API ─────────
async function request(token, method, params = {}, files = {}, { timeout = 60_000, signal } = {}) {
    const url = `${apiBase()}/bot${token}/${method}`
    const fileEntries = Object.entries(files).filter(([, f]) => f?.buffer)
    let init

    if (fileEntries.length) {
        const form = new FormData()
        for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null) continue
            form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
        }
        for (const [k, f] of fileEntries) {
            form.append(k, new Blob([f.buffer], { type: f.mimetype || 'application/octet-stream' }), f.filename || 'file')
        }
        init = { method: 'POST', body: form }
        timeout = Math.max(timeout, 120_000)
    } else {
        init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) }
    }

    const timer = AbortSignal.timeout(timeout)
    init.signal = signal ? AbortSignal.any([signal, timer]) : timer

    let res
    try {
        res = await fetch(url, init)
    } catch (e) {
        if (e?.name === 'AbortError' && signal?.aborted) throw e
        // jangan bocorkan token lewat pesan error
        const msg = String(e?.cause?.message || e?.message || e).split(token).join('***')
        throw new TelegramError(`${method}: ${msg}`, { method })
    }

    const data = await res.json().catch(() => null)
    if (!data?.ok) {
        throw new TelegramError(data?.description || `HTTP ${res.status}`, {
            code: data?.error_code || res.status,
            retryAfter: data?.parameters?.retry_after,
            method
        })
    }
    return data.result
}

// panggil method Bot API + retry kalau kena limit
async function call(token, method, params, files, opts) {
    try {
        return await request(token, method, params, files, opts)
    } catch (e) {
        // flood control: tunggu sesuai permintaan Telegram lalu coba sekali lagi
        if (e.code === 429 && e.retryAfter && e.retryAfter <= 30 && method !== 'getUpdates') {
            await sleep((e.retryAfter + 1) * 1000)
            return request(token, method, params, files, opts)
        }
        throw e
    }
}

// ───────── format teks WhatsApp -> HTML Telegram ─────────
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * *tebal* _miring_ ~coret~ `kode` ```blok``` dari WhatsApp diubah ke HTML Telegram.
 * mentionMap: { '<id>': 'Nama' } -> "@<id>" di teks jadi mention yang bisa diklik.
 */
export function waToTelegramHtml(input = '', mentionMap = {}) {
    let text = String(input)
    const slots = []
    const hold = (html) => { slots.push(html); return `\u0000${slots.length - 1}\u0000` }

    text = text.replace(/```([\s\S]*?)```/g, (_, c) => hold(`<pre>${escapeHtml(c.replace(/^\n/, '').replace(/\n$/, ''))}</pre>`))
    text = text.replace(/`([^`\n]+)`/g, (_, c) => hold(`<code>${escapeHtml(c)}</code>`))
    text = text.replace(/https?:\/\/[^\s<>]+/g, (u) => hold(escapeHtml(u)))
    for (const [id, name] of Object.entries(mentionMap)) {
        text = text.split(`@${id}`).join(hold(`<a href="tg://user?id=${id}">${escapeHtml(name)}</a>`))
    }

    text = escapeHtml(text)
    text = text.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, '$1<b>$2</b>')
    text = text.replace(/(^|[^\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w_])/g, '$1<i>$2</i>')
    text = text.replace(/(^|[^\w~])~(?!\s)([^~\n]+?)(?<!\s)~(?![\w~])/g, '$1<s>$2</s>')

    return text.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[i])
}

// pecah teks panjang jadi beberapa pesan
export function splitText(text, max = SAFE_TEXT) {
    const s = String(text)
    if (s.length <= max) return [s]
    const parts = []
    let rest = s
    while (rest.length > max) {
        let cut = rest.lastIndexOf('\n', max)
        if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max)
        if (cut < max * 0.5) cut = max
        parts.push(rest.slice(0, cut))
        rest = rest.slice(cut).replace(/^\n/, '')
    }
    if (rest) parts.push(rest)
    return parts
}

// ───────── sumber media ─────────
const EXT = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'application/pdf': 'pdf'
}
const extOf = (mime) => EXT[String(mime || '').toLowerCase()] || 'bin'

// siapkan sumber file (buffer/URL/path) untuk dikirim
async function resolveSource(src, fallbackName = 'file', mimetype) {
    if (Buffer.isBuffer(src)) return { kind: 'buffer', buffer: src, filename: fallbackName }
    if (src instanceof Uint8Array) return { kind: 'buffer', buffer: Buffer.from(src), filename: fallbackName }
    const ref = typeof src === 'string' ? src : src?.url
    if (typeof ref === 'string') {
        if (/^https?:\/\//i.test(ref)) return { kind: 'url', url: ref, filename: fallbackName }
        if (/^data:/i.test(ref)) {
            const b64 = ref.slice(ref.indexOf(',') + 1)
            return { kind: 'buffer', buffer: Buffer.from(b64, 'base64'), filename: fallbackName }
        }
        if (fs.existsSync(ref)) return { kind: 'buffer', buffer: fs.readFileSync(ref), filename: path.basename(ref) }
    }
    throw new Error(`Sumber media tidak valid untuk Telegram${mimetype ? ` (${mimetype})` : ''}`)
}

const isUrlFetchError = (e) => e?.code === 400 &&
    /wrong file identifier|failed to get http url content|wrong type of the web page content|http url specified|wrong remote file/i.test(e.message)

// unduh file dari URL
async function downloadUrl(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`Gagal mengunduh media (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
}

// ───────── tombol / rich -> teks biasa (Telegram tidak punya tombol native WA) ─────────
function parseJson(s) { try { return JSON.parse(s) } catch { return {} } }

// ubah tombol jadi teks biasa (cadangan)
export function buttonsToPlain(buttons = []) {
    const lines = []
    for (const b of buttons || []) {
        if (!b) continue
        if (b.name && b.buttonParamsJson) {
            const p = parseJson(b.buttonParamsJson)
            if (b.name === 'single_select') {
                for (const sec of p.sections || []) for (const row of sec.rows || []) {
                    lines.push(`▢ ${String(row.id || row.title).trim()}${row.description ? ` (${row.description})` : ''}`)
                }
            } else if (b.name === 'quick_reply') lines.push(`▢ ${String(p.id || p.display_text).trim()}`)
            else if (b.name === 'cta_url') lines.push(`${p.display_text}: ${p.url}`)
            else if (b.name === 'cta_copy') lines.push(`${p.display_text}: ${p.copy_code}`)
            else if (b.name === 'cta_call') lines.push(`${p.display_text}: ${p.phone_number}`)
            continue
        }
        const label = b.buttonText?.displayText || b.displayText || b.text || b.title || b.buttonId || b.id
        if (b.url) lines.push(`${label}: ${b.url}`)
        else if (label) lines.push(`▢ ${label}`)
    }
    return lines.join('\n')
}

// ───────── tombol WhatsApp -> inline keyboard Telegram ─────────
// callback_data Telegram maksimal 64 byte; id yang lebih panjang disimpan di sini dan dipulihkan saat ditekan
const cbStore = new Map()
let cbSeq = 0
// simpan data callback tombol (batas 64 byte Telegram)
const cbData = (id) => {
    const s = String(id ?? '')
    if (!s) return null
    if (Buffer.byteLength(s) <= 64) return s
    const key = `~${(++cbSeq).toString(36)}`
    cbStore.set(key, s)
    while (cbStore.size > 2000) cbStore.delete(cbStore.keys().next().value)
    return key
}

/**
 * Daftar tombol gaya WhatsApp (shorthand { type, text, id } atau native { name, buttonParamsJson })
 * -> { inline_keyboard } Telegram. Mengembalikan null kalau tidak ada satu pun tombol yang bisa dipakai.
 * reply / list -> tombol callback (ditekan = bot menerima id-nya seperti pesan teks), url -> tombol link,
 * copy -> tombol salin. Tombol list dibentang jadi satu tombol per baris-pilihan.
 */
export function buttonsToInline(buttons = []) {
    const clip = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 56) || '•'
    const rows = []
    let pair = []
    const push = (btn, wide = false) => {
        if (wide) { if (pair.length) { rows.push(pair); pair = [] } rows.push([btn]); return }
        pair.push(btn)
        if (pair.length === 2) { rows.push(pair); pair = [] }
    }
    const callback = (label, id) => {
        const data = cbData(id ?? label)
        if (data) push({ text: clip(label), callback_data: data })
    }

    for (const b of buttons || []) {
        if (!b || typeof b !== 'object') continue

        if (b.name && b.buttonParamsJson) {
            const p = typeof b.buttonParamsJson === 'string' ? parseJson(b.buttonParamsJson) : b.buttonParamsJson
            if (b.name === 'single_select') {
                for (const sec of p.sections || []) for (const r of sec.rows || []) {
                    callback(r.description && String(r.description).length <= 14 ? `${r.title} (${r.description})` : r.title, r.id || r.title)
                }
            } else if (b.name === 'quick_reply') callback(p.display_text, p.id)
            else if (b.name === 'cta_url' && p.url) push({ text: clip(p.display_text), url: p.url }, true)
            else if (b.name === 'cta_copy' && p.copy_code) push({ text: clip(p.display_text), copy_text: { text: String(p.copy_code).slice(0, 256) } }, true)
            continue
        }

        const type = String(b.type || '').toLowerCase().replace(/^cta_/, '')
        const label = b.text ?? b.display_text ?? b.title ?? b.buttonText?.displayText ?? b.displayText

        if (type === 'list' || type === 'select' || type === 'single_select') {
            const sections = b.sections || [{ rows: b.rows || [] }]
            for (const sec of sections) for (const r of sec.rows || []) {
                const t = String(r.title ?? r.text ?? r.id ?? '')
                const d = r.description || r.desc
                callback(d && String(d).length <= 14 ? `${t} (${d})` : t, r.id ?? t)
            }
        } else if (type === 'url' || (!type && b.url)) {
            if (b.url) push({ text: clip(label), url: b.url }, true)
        } else if (type === 'copy') {
            const code = b.code ?? b.copy_code
            if (code) push({ text: clip(label), copy_text: { text: String(code).slice(0, 256) } }, true)
        } else if (type === 'reply' || type === 'quick_reply' || b.id || b.buttonId) {
            callback(label, b.id ?? b.buttonId)
        }
    }
    if (pair.length) rows.push(pair)
    return rows.length ? { inline_keyboard: rows.slice(0, 50) } : null
}

// ═══════════════ sock Telegram (tiruan Baileys) ═══════════════
const REACTION_MAP = {
    '⏳': '👀', '⌛': '👀', '🕒': '👀', '🔍': '👀', '✅': '👌', '☑️': '👌', '✔️': '👌',
    '❌': '👎', '⚠️': '🤔', '😂': '🤣', '😅': '😁', '': '🔥', '🎉': '🎉'
}

// izin penuh untuk anggota grup (buka grup / not_announcement)
const FULL_PERMS = {
    can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true,
    can_send_videos: true, can_send_video_notes: true, can_send_voice_notes: true, can_send_polls: true,
    can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true,
    can_change_info: false, can_pin_messages: false
}
// semua izin dimatikan (tutup grup / announcement)
const NO_PERMS = Object.fromEntries(Object.keys(FULL_PERMS).map(k => [k, false]))

const capMap = (map, max) => { while (map.size > max) map.delete(map.keys().next().value) }

// buat objek sock mirip Baileys: sendMessage, group, kick, dsb. lewat Bot API
export function createTelegramSock(token, helpers = {}) {
    const names = new Map()       // user id -> nama tampilan
    const usernames = new Map()   // username (lowercase) -> user id
    const seen = new Map()        // jid grup -> Set id anggota yang pernah terlihat
    const threads = new Map()     // jid grup -> { id, at } (topik forum terakhir)

    const api = (method, params, files, opts) => call(token, method, params, files, opts)

    const noteUser = (user, groupJid) => {
        if (!user?.id) return
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || String(user.id)
        names.set(String(user.id), name)
        if (user.username) usernames.set(user.username.toLowerCase(), String(user.id))
        if (groupJid) {
            if (!seen.has(groupJid)) seen.set(groupJid, new Set())
            const set = seen.get(groupJid)
            set.add(String(user.id))
            if (set.size > 500) set.delete(set.values().next().value)
        }
        capMap(names, 5000); capMap(usernames, 5000); capMap(seen, 300)
    }

    const targetParams = (jid, options = {}) => {
        const params = { chat_id: chatIdOf(jid) }
        const q = options?.quoted
        const qid = q?.key?.id ?? q?.id
        const qchat = q?.chat || q?.key?.remoteJid
        if (qid && /^\d+$/.test(String(qid)) && qchat === jid) {
            params.reply_parameters = { message_id: Number(qid), allow_sending_without_reply: true }
        }
        const t = threads.get(jid)
        const thread = q?.threadId || (t && Date.now() - t.at < THREAD_TTL ? t.id : null)
        if (thread) params.message_thread_id = thread
        return params
    }

    const wrap = (jid, r, message) => ({
        key: { remoteJid: jid, id: String(r?.message_id ?? ''), fromMe: true },
        message, messageTimestamp: r?.date, status: 1
    })

    const mentionMapOf = (content) => {
        const jids = [...(content.mentions || []), ...(content.contextInfo?.mentionedJid || [])]
        const map = {}
        for (const j of jids) {
            if (!/@telegram$/.test(j)) continue
            const id = chatIdOf(j)
            map[id] = names.get(id) || 'user'
        }
        return map
    }

    // ── kirim teks (dipecah kalau panjang, fallback ke teks polos kalau HTML ditolak) ──
    async function sendText(jid, text, options, content = {}) {
        const mentionMap = mentionMapOf(content)
        let last = null
        const parts = splitText(text).filter(x => x.trim())
        for (const [i, part] of parts.entries()) {
            const base = {
                ...targetParams(jid, options),
                link_preview_options: { is_disabled: content.linkPreview ? false : true },
                // keyboard hanya menempel di potongan terakhir
                ...(content._markup && i === parts.length - 1 ? { reply_markup: content._markup } : {})
            }
            try {
                last = await api('sendMessage', { ...base, text: waToTelegramHtml(part, mentionMap).slice(0, MAX_TEXT), parse_mode: 'HTML' })
            } catch (e) {
                if (!/can't parse entities|unsupported start tag|can't find end/i.test(e.message)) throw e
                last = await api('sendMessage', { ...base, text: part.slice(0, MAX_TEXT) })
            }
        }
        return last ? wrap(jid, last, { conversation: text }) : null
    }

    // ── kirim media (URL dulu, kalau Telegram gagal mengambil URL -> unduh & upload) ──
    async function sendFile(jid, method, field, src, options, extra = {}, { mimetype, fileName, caption } = {}) {
        const fallbackName = fileName || `${field}.${extOf(mimetype)}`
        const s = await resolveSource(src, fallbackName, mimetype)
        const params = { ...targetParams(jid, options), ...extra }

        let captionHtml
        let captionTail = null
        if (caption) {
            const text = String(caption)
            if (text.length > MAX_CAPTION) captionTail = text
            else captionHtml = waToTelegramHtml(text, mentionMapOf(extra._content || {}))
        }
        delete params._content
        if (extra._content?._markup && !captionTail) params.reply_markup = extra._content._markup
        if (captionHtml) { params.caption = captionHtml; params.parse_mode = 'HTML' }

        const upload = (buffer) => api(method, params, { [field]: { buffer, filename: s.filename || fallbackName, mimetype } })
        let r
        try {
            if (s.kind === 'url') {
                try { r = await api(method, { ...params, [field]: s.url }) }
                catch (e) { if (!isUrlFetchError(e)) throw e; r = await upload(await downloadUrl(s.url)) }
            } else {
                r = await upload(s.buffer)
            }
        } catch (e) {
            if (captionHtml && /can't parse entities/i.test(e.message)) {
                delete params.parse_mode
                params.caption = String(caption).slice(0, MAX_CAPTION)
                r = s.kind === 'url' ? await api(method, { ...params, [field]: s.url }) : await upload(s.buffer)
            } else throw e
        }

        // caption terlalu panjang: kirim sebagai teks terpisah setelah medianya
        if (captionTail) await sendText(jid, captionTail, options, extra._content || {}).catch(() => null)
        return r
    }

    const sock = {
        platform: 'telegram',
        user: { id: userJid('0'), name: 'Telegram Bot', username: '' },
        ev: { on() { return this }, off() { return this }, once() { return this }, removeAllListeners() { return this } },
        signalRepository: { lidMapping: { getLIDForPN: async () => null, getPNForLID: async () => null } },
        tg: { api, names, usernames, seen, threads, noteUser },

        decodeJid: (jid) => jid,
        getName: (jid) => names.get(chatIdOf(jid)) || chatIdOf(jid),
        end() {},
        logout: async () => {},

        // ───────── kirim pesan ─────────
        // pesan dengan tombol: dikirim sebagai inline keyboard; kalau Telegram menolak, jatuh ke daftar teks
        async sendMessage(jid, content = {}, options = {}) {
            cuteContent(content)
            if (Array.isArray(content.buttons) && content.buttons.length) {
                const markup = buttonsToInline(content.buttons)
                if (markup) {
                    try {
                        return await sock._send(jid, { ...content, _markup: markup }, options)
                    } catch (e) {
                        if (!/button|reply markup|keyboard|callback/i.test(e.message)) throw e
                        console.log('[ TELEGRAM ] keyboard ditolak, pakai daftar teks:', e.message)
                    }
                }
            }
            return sock._send(jid, content, options)
        },

        async _send(jid, content = {}, options = {}) {
            if (!jid) throw new Error('JID tujuan kosong')

            // reaksi
            if (content.react) {
                const key = content.react.key
                const emoji = content.react.text
                const target = key?.remoteJid || jid
                const mapped = emoji ? (REACTION_MAP[emoji] || emoji) : null
                try {
                    await api('setMessageReaction', {
                        chat_id: chatIdOf(target), message_id: Number(key?.id),
                        reaction: mapped ? [{ type: 'emoji', emoji: mapped }] : []
                    })
                } catch { /* emoji di luar daftar reaksi Telegram: abaikan */ }
                return null
            }

            // hapus pesan
            if (content.delete) {
                const key = content.delete
                await api('deleteMessage', { chat_id: chatIdOf(key.remoteJid || jid), message_id: Number(key.id) }).catch(() => null)
                return null
            }

            // edit pesan
            if (content.edit) {
                const key = content.edit
                const text = content.text ?? content.caption ?? ''
                const params = {
                    chat_id: chatIdOf(key.remoteJid || jid), message_id: Number(key.id),
                    text: waToTelegramHtml(text, mentionMapOf(content)).slice(0, MAX_TEXT), parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true }
                }
                try {
                    await api('editMessageText', params)
                } catch (e) {
                    if (/not modified/i.test(e.message)) return { key }
                    if (/no text in the message/i.test(e.message)) {
                        const { text: _t, link_preview_options: _l, ...rest } = params
                        await api('editMessageCaption', { ...rest, caption: params.text.slice(0, MAX_CAPTION) }).catch(() => null)
                    } else if (/can't parse entities/i.test(e.message)) {
                        await api('editMessageText', { chat_id: params.chat_id, message_id: params.message_id, text: String(text).slice(0, MAX_TEXT) }).catch(() => null)
                    } else throw e
                }
                return { key }
            }

            // tombol -> daftar teks
            let caption = content.caption
            let text = content.text
            if (Array.isArray(content.buttons) && content.buttons.length) {
                const extra = content._markup ? '' : buttonsToPlain(content.buttons)
                if (content.image || content.video) caption = [caption || text, extra, content.footer].filter(Boolean).join('\n\n')
                else text = [text, extra, content.footer].filter(Boolean).join('\n\n')
            }

            const mimetype = content.mimetype
            const meta = { mimetype, fileName: content.fileName, caption }
            const ctx = { _content: content }

            if (content.image) {
                try {
                    return wrap(jid, await sendFile(jid, 'sendPhoto', 'photo', content.image, options, ctx, { ...meta, mimetype: mimetype || 'image/jpeg' }), content)
                } catch (e) {
                    if (!/PHOTO_|IMAGE_PROCESS|wrong file|dimensions/i.test(e.message)) throw e
                    return wrap(jid, await sendFile(jid, 'sendDocument', 'document', content.image, options, ctx, { ...meta, mimetype: mimetype || 'image/jpeg' }), content)
                }
            }
            if (content.video) {
                const gif = !!content.gifPlayback
                return wrap(jid, await sendFile(jid, gif ? 'sendAnimation' : 'sendVideo', gif ? 'animation' : 'video', content.video, options, { ...ctx, supports_streaming: true }, { ...meta, mimetype: mimetype || 'video/mp4' }), content)
            }
            if (content.audio) {
                if (content.ptt) {
                    try {
                        return wrap(jid, await sendFile(jid, 'sendVoice', 'voice', content.audio, options, ctx, { ...meta, mimetype: mimetype || 'audio/ogg' }), content)
                    } catch (e) { if (e?.code !== 400) throw e }
                }
                return wrap(jid, await sendFile(jid, 'sendAudio', 'audio', content.audio, options, ctx, { ...meta, mimetype: mimetype || 'audio/mpeg' }), content)
            }
            if (content.sticker) {
                try {
                    return wrap(jid, await sendFile(jid, 'sendSticker', 'sticker', content.sticker, options, ctx, { mimetype: 'image/webp', fileName: 'sticker.webp' }), content)
                } catch (e) {
                    if (e?.code !== 400) throw e
                    // sticker animasi WhatsApp tidak diterima Telegram: kirim sebagai file
                    return wrap(jid, await sendFile(jid, 'sendDocument', 'document', content.sticker, options, ctx, { mimetype: 'image/webp', fileName: 'sticker.webp' }), content)
                }
            }
            if (content.document) {
                return wrap(jid, await sendFile(jid, 'sendDocument', 'document', content.document, options, ctx, {
                    ...meta, mimetype: mimetype || 'application/octet-stream', fileName: content.fileName || 'file'
                }), content)
            }
            if (content.location) {
                const loc = content.location
                const r = await api('sendLocation', {
                    ...targetParams(jid, options),
                    latitude: loc.degreesLatitude ?? loc.latitude, longitude: loc.degreesLongitude ?? loc.longitude
                })
                return wrap(jid, r, content)
            }

            if (text === undefined || text === null) text = caption
            if (text === undefined || text === null || text === '') {
                console.log('[ TELEGRAM ] payload tidak didukung, dilewati:', Object.keys(content).join(','))
                return null
            }
            return sendText(jid, String(text), options, content)
        },

        // ───────── fallback fitur khusus WhatsApp ─────────
        async relayMessage() { throw new Error('relayMessage tidak didukung di Telegram') },
        async waUploadToServer() { throw new Error('waUploadToServer tidak didukung di Telegram') },
        async newsletterMetadata() { throw new Error('Saluran WhatsApp tidak ada di Telegram') },
        async onWhatsApp() { return [] },
        async profilePictureUrl() {
            // URL file Telegram memuat token bot, jadi sengaja tidak dibagikan ke plugin (bisa bocor ke API pihak ketiga)
            throw new Error('not-authorized')
        },
        async updateProfilePicture() { throw new Error('Tidak didukung di Telegram') },
        async presenceSubscribe() {},
        async readMessages() {},
        async sendPresenceUpdate(type, jid) {
            const action = type === 'composing' ? 'typing' : type === 'recording' ? 'record_voice' : null
            if (action && jid) await api('sendChatAction', { chat_id: chatIdOf(jid), action }).catch(() => null)
        },

        async sendButtons(jid, o = {}, relay = {}) {
            const body = [o.title, o.text || o.caption].filter(Boolean).join('\n\n') || ' '
            const media = o.image ? { image: o.image } : o.video ? { video: o.video } : null
            const rest = { buttons: o.buttons, footer: o.footer }
            return sock.sendMessage(jid, media ? { ...media, caption: body, ...rest } : { text: body, ...rest }, relay)
        },
        async sendButton(jid, source, text, quoted, options = {}) {
            return sock.sendButtons(jid, { text, footer: options.footer, title: options.title, buttons: options.buttons, ...(source ? { image: source } : {}) }, { quoted })
        },
        async sendButtonImage(jid, image, buttons = [], text = '', footer = '', mentions = [], quoted) {
            return sock.sendButtons(jid, { image, buttons, text, footer, mentions }, { quoted })
        },
        async sendRichResponse(jid, data = {}, options = {}) {
            const body = helpers.richToText ? helpers.richToText(data) : String(data?.text || data?.body || '')
            return sock.sendMessage(jid, { text: body || ' ' }, options)
        },
        async sendAIRich(jid, data = {}, options = {}) { return sock.sendRichResponse(jid, data, options) },
        async sendTable(jid, data = {}, options = {}) { return sock.sendRichResponse(jid, data, options) },
        async sendFomo(jid, o = {}, options = {}) { return sock.sendRichResponse(jid, o, options) },

        // ───────── grup ─────────
        async groupMetadata(jid) {
            const chat_id = chatIdOf(jid)
            const [chat, admins, count] = await Promise.all([
                api('getChat', { chat_id }),
                api('getChatAdministrators', { chat_id }),
                api('getChatMemberCount', { chat_id }).catch(() => null)
            ])
            const adminIds = new Set()
            const participants = []
            let owner
            for (const a of admins) {
                noteUser(a.user)
                adminIds.add(String(a.user.id))
                if (a.status === 'creator') owner = userJid(a.user.id)
                participants.push({ id: userJid(a.user.id), admin: a.status === 'creator' ? 'superadmin' : 'admin' })
            }
            // Telegram tidak punya daftar anggota penuh: pakai anggota yang pernah terlihat di grup
            for (const id of seen.get(jid) || []) {
                if (!adminIds.has(id)) participants.push({ id: userJid(id), admin: null })
            }
            return { id: jid, subject: chat.title || '', desc: chat.description || '', owner, size: count ?? participants.length, participants }
        },

        async groupParticipantsUpdate(jid, ids = [], action) {
            const chat_id = chatIdOf(jid)
            const out = []
            for (const target of ids) {
                const user_id = Number(chatIdOf(target))
                try {
                    if (action === 'remove') {
                        await api('banChatMember', { chat_id, user_id })
                        await api('unbanChatMember', { chat_id, user_id, only_if_banned: true }).catch(() => null)
                    } else if (action === 'promote') {
                        await api('promoteChatMember', {
                            chat_id, user_id, can_manage_chat: true, can_delete_messages: true,
                            can_restrict_members: true, can_invite_users: true, can_pin_messages: true
                        })
                    } else if (action === 'demote') {
                        await api('promoteChatMember', {
                            chat_id, user_id, can_manage_chat: false, can_delete_messages: false,
                            can_restrict_members: false, can_invite_users: false, can_pin_messages: false,
                            can_change_info: false, can_promote_members: false
                        })
                    } else {
                        out.push({ status: '403', jid: target })
                        continue
                    }
                    out.push({ status: '200', jid: target })
                } catch (e) {
                    out.push({ status: String(e.code || 500), jid: target, error: e.message })
                }
            }
            return out
        },

        async groupSettingUpdate(jid, setting) {
            const chat_id = chatIdOf(jid)
            if (setting === 'announcement') return api('setChatPermissions', { chat_id, permissions: NO_PERMS })
            if (setting === 'not_announcement') return api('setChatPermissions', { chat_id, permissions: FULL_PERMS })
            throw new Error(`Pengaturan grup "${setting}" tidak didukung di Telegram`)
        },
        groupUpdateSubject: (jid, title) => api('setChatTitle', { chat_id: chatIdOf(jid), title }),
        groupUpdateDescription: (jid, description) => api('setChatDescription', { chat_id: chatIdOf(jid), description }),
        groupLeave: (jid) => api('leaveChat', { chat_id: chatIdOf(jid) }),
        async groupInviteCode() { throw new Error('Kode undangan gaya WhatsApp tidak ada di Telegram') },
        async groupRevokeInvite() { throw new Error('Tidak didukung di Telegram') },
        async groupGetInviteInfo() { throw new Error('Tidak didukung di Telegram') },
        async groupToggleEphemeral() { throw new Error('Tidak didukung di Telegram') }
    }

    return sock
}

// ═══════════════ update masuk -> objek `m` ═══════════════
const hasText = (msg) => typeof msg.text === 'string' || typeof msg.caption === 'string'

// ambil info media (foto, video, audio, dokumen) dari pesan Telegram
function extractMedia(msg) {
    if (msg.photo?.length) {
        const p = msg.photo[msg.photo.length - 1]
        return { mtype: 'imageMessage', node: { mimetype: 'image/jpeg', fileLength: p.file_size, file_id: p.file_id, width: p.width, height: p.height } }
    }
    if (msg.animation) {
        const a = msg.animation
        return { mtype: 'videoMessage', node: { mimetype: a.mime_type || 'video/mp4', fileLength: a.file_size, file_id: a.file_id, seconds: a.duration, gifPlayback: true, fileName: a.file_name } }
    }
    if (msg.video) {
        const v = msg.video
        return { mtype: 'videoMessage', node: { mimetype: v.mime_type || 'video/mp4', fileLength: v.file_size, file_id: v.file_id, seconds: v.duration, fileName: v.file_name } }
    }
    if (msg.video_note) {
        const v = msg.video_note
        return { mtype: 'videoMessage', node: { mimetype: 'video/mp4', fileLength: v.file_size, file_id: v.file_id, seconds: v.duration, ptv: true } }
    }
    if (msg.voice) {
        const v = msg.voice
        return { mtype: 'audioMessage', node: { mimetype: v.mime_type || 'audio/ogg', fileLength: v.file_size, file_id: v.file_id, seconds: v.duration, ptt: true } }
    }
    if (msg.audio) {
        const a = msg.audio
        return { mtype: 'audioMessage', node: { mimetype: a.mime_type || 'audio/mpeg', fileLength: a.file_size, file_id: a.file_id, seconds: a.duration, fileName: a.file_name } }
    }
    if (msg.sticker) {
        const s = msg.sticker
        const mimetype = s.is_animated ? 'application/x-tgsticker' : s.is_video ? 'video/webm' : 'image/webp'
        return { mtype: 'stickerMessage', node: { mimetype, fileLength: s.file_size, file_id: s.file_id, isAnimated: !!(s.is_animated || s.is_video) } }
    }
    if (msg.document) {
        const d = msg.document
        return { mtype: 'documentMessage', node: { mimetype: d.mime_type || 'application/octet-stream', fileLength: d.file_size, file_id: d.file_id, fileName: d.file_name } }
    }
    return null
}

// buat fungsi unduh media dari file_id
function makeDownloader(token, fileId) {
    return async () => {
        const info = await call(token, 'getFile', { file_id: fileId })
        const res = await fetch(`${apiBase()}/file/bot${token}/${info.file_path}`, { signal: AbortSignal.timeout(120_000) })
        if (!res.ok) throw new Error(`Gagal mengunduh file Telegram (${res.status})`)
        return Buffer.from(await res.arrayBuffer())
    }
}

// ambil pengirim pesan
function senderOf(msg) {
    // pesan atas nama grup/channel (admin anonim, dst) punya sender_chat
    return msg.from || (msg.sender_chat ? { id: msg.sender_chat.id, first_name: msg.sender_chat.title } : null)
}

// bangun objek pesan yang di-reply
function buildQuoted(sock, token, reply, chat) {
    if (!reply || reply.forum_topic_created) return null
    const from = senderOf(reply)
    const media = extractMedia(reply)
    const mtype = media?.mtype || (reply.location ? 'locationMessage' : 'extendedTextMessage')
    const text = reply.text || reply.caption || ''
    const node = media?.node || (reply.location
        ? { degreesLatitude: reply.location.latitude, degreesLongitude: reply.location.longitude }
        : { text })
    const sender = from ? userJid(from.id) : chat
    const id = String(reply.message_id)
    const q = {
        id, chat, sender, mtype, msg: node, text, body: text,
        fromMe: !!from?.is_bot && String(from.id) === chatIdOf(sock.user?.id),
        pushName: from ? sock.getName(userJid(from.id)) : 'Unknown',
        mimetype: node.mimetype, fileName: node.fileName,
        isMedia: !!node.mimetype,
        download: node.file_id ? makeDownloader(token, node.file_id) : null,
        key: { remoteJid: chat, id, participant: sender, fromMe: false },
        message: { [mtype]: node }
    }
    q.forwardable = { key: q.key, message: q.message }
    return q
}

// Klien Telegram mengubah teks bergaya markdown jadi format dan MENGHAPUS penandanya dari message.text:
//   `kode`, ```blok```, ||spoiler||, **tebal**, __miring__, ~~coret~~
// Akibatnya kode yang ditempel (mis. lewat .addplugin / .eval) rusak: "a || b || c" kehilangan "||",
// backtick template literal hilang. Fungsi ini menyusun ulang penanda itu dari daftar entity.
const MD_MARK = {
    bold: ['**', '**'], italic: ['__', '__'], strikethrough: ['~~', '~~'],
    spoiler: ['||', '||'], code: ['`', '`']
}

// kembalikan format tebal/miring dari entity Telegram jadi markdown WhatsApp
export function restoreMarkdown(text = '', entities = []) {
    text = String(text)
    const list = (entities || []).filter(e => e && e.length > 0 && (MD_MARK[e.type] || e.type === 'pre'))
    if (!list.length) return text

    const opens = new Map()
    const closes = new Map()
    const add = (map, pos, item) => { if (!map.has(pos)) map.set(pos, []); map.get(pos).push(item) }

    list.forEach((e, idx) => {
        let open, close
        if (e.type === 'pre') {
            const body = text.substr(e.offset, e.length)
            if (e.language) { open = '```' + e.language + '\n'; close = '\n```' }
            else if (body.includes('\n')) { open = '```\n'; close = '\n```' }
            else { open = '```'; close = '```' }      // satu baris: jangan menambah newline di dalam string kode
        } else {
            [open, close] = MD_MARK[e.type]
        }
        add(opens, e.offset, { open, len: e.length, idx })
        add(closes, e.offset + e.length, { close, start: e.offset, len: e.length, idx })
    })

    let out = ''
    for (let i = 0; i <= text.length; i++) {
        // tutup yang paling dalam dulu, lalu buka yang paling luar dulu
        if (closes.has(i)) out += closes.get(i).sort((a, b) => b.start - a.start || a.len - b.len || b.idx - a.idx).map(x => x.close).join('')
        if (opens.has(i)) out += opens.get(i).sort((a, b) => b.len - a.len || a.idx - b.idx).map(x => x.open).join('')
        if (i < text.length) out += text[i]
    }
    return out
}

/**
 * Update Telegram -> `m` (bentuknya mengikuti serialize() WhatsApp). Mengembalikan null untuk
 * pesan yang tidak perlu diproses (dari bot lain, pesan servis, command untuk bot lain).
 */
export function buildMessage(sock, token, msg, { prefix = () => '.' } = {}) {
    if (!msg || msg.from?.is_bot) return null
    const from = senderOf(msg)
    if (!from) return null

    const chat = chatJidOf(msg.chat)
    const sender = userJid(from.id)
    const isGroup = msg.chat.type !== 'private'
    sock.tg.noteUser(from, isGroup ? chat : null)
    if (msg.reply_to_message?.from) sock.tg.noteUser(msg.reply_to_message.from, isGroup ? chat : null)
    if (isGroup && msg.is_topic_message && msg.message_thread_id) {
        sock.tg.threads.set(chat, { id: msg.message_thread_id, at: Date.now() })
    }

    const media = extractMedia(msg)
    const rawText = msg.text ?? msg.caption ?? ''
    const original = restoreMarkdown(rawText, msg.entities || msg.caption_entities)

    if (!media && !msg.location && !(typeof msg.text === 'string')) return null

    // mention (text_mention membawa id, @username dicari dari user yang pernah terlihat)
    const mentionedJid = []
    for (const e of [...(msg.entities || []), ...(msg.caption_entities || [])]) {
        if (e.type === 'text_mention' && e.user?.id) mentionedJid.push(userJid(e.user.id))
        else if (e.type === 'mention') {
            const uname = rawText.substr(e.offset + 1, e.length - 1).toLowerCase()
            const id = sock.tg.usernames.get(uname)
            if (id) mentionedJid.push(userJid(id))
        }
    }

    // "/menu@NamaBot arg" -> "<prefix>menu arg"; command untuk bot lain diabaikan
    let body = original
    const cmd = /^\/([A-Za-z0-9_]+)(?:@([A-Za-z0-9_]+))?(?=\s|$)/.exec(body)
    if (cmd) {
        const botName = String(sock.user?.username || '').toLowerCase()
        if (cmd[2] && botName && cmd[2].toLowerCase() !== botName) return null
        body = `${prefix()}${cmd[1].toLowerCase()}${body.slice(cmd[0].length)}`
    }

    const mtype = media?.mtype || (msg.location ? 'locationMessage' : 'extendedTextMessage')
    const node = media
        ? { ...media.node, caption: msg.caption || '' }
        : msg.location
            ? { degreesLatitude: msg.location.latitude, degreesLongitude: msg.location.longitude }
            : { text: body }

    const id = String(msg.message_id)
    const m = {
        key: { remoteJid: chat, id, fromMe: false, participant: isGroup ? sender : undefined },
        id: msg._cbId || id, chat, sender, fromMe: false, isGroup, isNewsletter: false, isBaileys: false,
        pushName: sock.getName(sender), messageTimestamp: msg.date,
        platform: 'telegram', username: from.username || '', threadId: msg.is_topic_message ? msg.message_thread_id : undefined,
        message: { [mtype]: node },
        mtype, msg: node, body, text: body, mentionedJid,
        isMedia: !!node.mimetype,
        download: node.file_id ? makeDownloader(token, node.file_id) : null,
        quoted: buildQuoted(sock, token, msg.reply_to_message, chat)
    }

    m.reply = (text, options = {}) => {
        const { thumbnail, title, description, sourceUrl, largerThumbnail, forward, ...content } = options
        if (Buffer.isBuffer(text)) return sock.sendMessage(m.chat, { document: text, ...content }, { quoted: m })
        return sock.sendMessage(m.chat, { text, ...content }, { quoted: m })
    }
    return m
}

// ═══════════════ start / stop ═══════════════
// teks ditulis dengan format WhatsApp (*tebal*, `kode`); sendMessage yang mengubahnya ke HTML Telegram
const infoText = (m, ownersEmpty, pfx) => {
    const lines = [
        `Halo ${m.pushName}! Bot *${global.namebot || 'Bot'}* aktif di Telegram.`,
        '',
        `ID Telegram kamu: \`${chatIdOf(m.sender)}\``,
        `ID chat ini: \`${chatIdOf(m.chat)}\``,
        '',
        `Ketik ${pfx || '/'}menu untuk melihat fitur.`
    ]
    if (ownersEmpty) {
        lines.push('', 'Owner Telegram belum diatur. Isi ID kamu di `global.telegram.owners` pada config.js supaya command owner bisa dipakai.')
    }
    return lines.join('\n')
}

/**
 * Menyambung bot Telegram dan mulai polling.
 *   token     : token dari @BotFather
 *   handler   : handler(sock, m) milik bot (handler.js)
 *   schedule  : (kunciChat, fn) => ... untuk membatasi paralelisme per chat (opsional)
 *   prefix    : () => prefix utama, dipakai mengubah "/menu" jadi "<prefix>menu"
 *   helpers   : { richToText } dari lib/platform/wa.js (opsional)
 *   log       : (level, pesan) => void  (level: info | ok | warn | error)
 * Mengembalikan { sock, me, stop }.
 */
export async function startTelegram({ token, handler, schedule, prefix = () => '.', helpers = {}, log } = {}) {
    if (!token) throw new Error('Token Telegram kosong')
    const say = log || ((level, msg) => console.log(`[ TELEGRAM ] ${msg}`))
    const sock = createTelegramSock(token, helpers)
    const run = schedule || ((key, fn) => fn())

    const ctrl = { stopped: false, offset: 0, abort: new AbortController(), fatal: false }

    // validasi token (tunggu terus kalau cuma jaringan yang bermasalah)
    let me = null
    for (let wait = 2000; !ctrl.stopped;) {
        try { me = await call(token, 'getMe'); break } catch (e) {
            if (e.code === 401 || e.code === 404) throw new Error('Token Telegram tidak valid. Cek lagi token dari @BotFather.')
            say('warn', `Belum bisa menghubungi Telegram (${e.message}), coba lagi ${Math.round(wait / 1000)} detik...`)
            await sleep(wait); wait = Math.min(wait * 2, 30_000)
        }
    }
    if (!me) throw new Error('Dihentikan sebelum tersambung')

    sock.user = { id: userJid(me.id), name: me.first_name, username: me.username || '' }

    // polling & webhook tidak bisa jalan bersamaan
    await call(token, 'deleteWebhook', { drop_pending_updates: cfg().dropPending !== false }).catch(() => null)

    if (cfg().registerCommands !== false) {
        await call(token, 'setMyCommands', {
            commands: [
                { command: 'menu', description: 'Daftar fitur bot' },
                { command: 'myid', description: 'Lihat ID Telegram kamu' },
                { command: 'ping', description: 'Cek bot hidup' },
                { command: 'stop', description: 'Matikan notifikasi dari bot' }
            ]
        }).catch(() => null)
    }

    const ownersEmpty = () => !([].concat(cfg().owners || []).filter(Boolean).length)

    // tombol inline ditekan -> diperlakukan seperti user mengetik isi tombolnya (mis. ".menj rpg")
    async function dispatchCallback(cq) {
        call(token, 'answerCallbackQuery', { callback_query_id: cq.id }).catch(() => null)
        const base = cq.message
        const data = cbStore.get(cq.data) ?? cq.data
        if (!base?.chat || !cq.from || !data) return
        return dispatch({
            message: {
                message_id: base.message_id, date: Math.floor(Date.now() / 1000), chat: base.chat, from: cq.from,
                text: String(data), is_topic_message: base.is_topic_message, message_thread_id: base.message_thread_id,
                // id unik per penekanan tombol: message_id milik pesan bot yang sama dipakai semua tombolnya,
                // sehingga tanpa ini penekanan ke-2 dianggap duplikat/pesan bot sendiri oleh handler dan diabaikan
                _cbId: `cb${cq.id}`
            }
        })
    }

    async function dispatch(update) {
        if (update.callback_query) return dispatchCallback(update.callback_query)
        const msg = update.message
        if (!msg) return
        const maxAge = Number(cfg().maxAgeSec || 0)
        if (maxAge && Math.floor(Date.now() / 1000) - msg.date > maxAge) return

        // /start dan /myid dijawab langsung (juga di mode self & sebelum owner diatur)
        const first = (msg.text || '').trim()
        const sys = /^\/(start|myid|id|stop|berhenti)(?:@([A-Za-z0-9_]+))?(?=\s|$)/i.exec(first)
        if (sys && !msg.from?.is_bot && (!sys[2] || sys[2].toLowerCase() === String(me.username).toLowerCase())) {
            const word = sys[1].toLowerCase()
            // /start = daftar penerima notifikasi berkala, /stop = berhenti
            if (word === 'start') addSubscriber(msg.from, msg.chat)
            if (word === 'stop' || word === 'berhenti') {
                const was = removeSubscriber(msg.chat?.id)
                await sock.sendMessage(chatJidOf(msg.chat), { text: was ? '🔕 Notifikasi dimatikan. Ketik /start kapan saja kalau mau menyalakannya lagi.' : 'Notifikasi sudah nonaktif. Ketik /start untuk menyalakannya.' }).catch(() => null)
                return
            }
            const probe = buildMessage(sock, token, { ...msg, text: '/x' }, { prefix })
            if (probe) {
                const pfx = prefix()
                await sock.sendMessage(probe.chat, { text: infoText(probe, ownersEmpty(), pfx) }, { quoted: probe }).catch(() => null)
            }
            return
        }

        const m = buildMessage(sock, token, msg, { prefix })
        if (!m) return
        await run(m.chat, async () => {
            try { await handler(sock, m) } catch (e) { say('error', `handler: ${e.message}`) }
        })
    }

    async function loop() {
        let backoff = 1000
        while (!ctrl.stopped) {
            try {
                const updates = await call(token, 'getUpdates', {
                    offset: ctrl.offset, timeout: 50, allowed_updates: ['message', 'callback_query']
                }, {}, { timeout: 65_000, signal: ctrl.abort.signal })
                backoff = 1000
                for (const u of updates) {
                    ctrl.offset = u.update_id + 1
                    dispatch(u).catch(e => say('error', `dispatch: ${e.message}`))
                }
            } catch (e) {
                if (ctrl.stopped) break
                if (e.code === 401) { say('error', 'Token Telegram ditolak, polling dihentikan.'); ctrl.fatal = true; break }
                if (e.code === 409) {
                    say('warn', 'Ada instance lain yang memakai bot Telegram ini (409). Matikan yang lain dulu.')
                    await sleep(5000); continue
                }
                say('warn', `Polling gagal (${e.message}), mencoba lagi ${Math.round(backoff / 1000)} detik...`)
                await sleep(backoff); backoff = Math.min(backoff * 2, 30_000)
            }
        }
    }

    say('ok', `Bot @${me.username} terhubung`)
    loop()
    const promo = startPromo({ call: (method, params) => call(token, method, params), prefix, cfg: cfg().promo || {}, say })

    return {
        sock, me,
        stop() { ctrl.stopped = true; promo.stop(); try { ctrl.abort.abort() } catch {} },
        get fatal() { return ctrl.fatal }
    }
}
