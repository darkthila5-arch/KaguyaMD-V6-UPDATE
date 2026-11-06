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

// Helper untuk chat dengan Gemini.

const headers = {
    'accept-encoding': 'gzip, deflate, br, zstd, dcb, dcz'
}

const getCookie = async () => {
    const r = await fetch(`https://gemini.google.com/`, {
        method: 'head',
        headers
    })
    const c = r.headers.getSetCookie()?.[0]?.split("; ")?.[0]
    if (!c) throw Error(`gagal mendapatkan kuki`)
    return c
}

/**
 * free gemini ask, code by wolep, pakai dengan bijak yah T^T
 * @param {string} prompt 
 * @param {string} [prevSession]
 * @returns {Promise <{response: string, session: string}>}
 * @throws {Error}
 */
const askGemini = async (prompt, prevSession = "") => {
    let prevResumeArray = []
    let cookie

    try {
        if (prevSession) {
            const session = atob(prevSession)
            const obj = JSON.parse(session)
            prevResumeArray = obj.resumeArray
            cookie = obj.cookie
        } else {
            cookie = await getCookie()
        }
    } catch (_) {
        console.warn(`gagal parsing session. start percakapan baru`)
        cookie = await getCookie()
    }

    const body = new URLSearchParams({
        'f.req': JSON.stringify([
            null,
            JSON.stringify([
                [prompt],
                ["en-US"],
                prevResumeArray
            ])
        ])
    })

    const fetchResponse = await fetch("https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20260917.13_p0&f.sid=1147530711385426743&hl=en-US&_reqid=2011320&rt=c", {
        "headers": {
            ...headers,
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            "cookie": cookie,
        },
        body,
        "method": "POST"
    });
    const something = await fetchResponse.text()
    const s1 = something.trim().split('\n').at(-11)
    const o1 = JSON.parse(s1)
    const a1 = JSON.parse(o1[0][2])
    const response = a1[4][0][1][0].replace(/\*\*(.*?)\*\*/g, '*$1*')

    const c = a1[1][0]
    const r = a1[1][1]
    const rc = a1[4][0][0]
    const resumeArray = [c, r, rc]
    const sessionObj = {
        cookie,
        resumeArray
    }
    const session = btoa(JSON.stringify(sessionObj))
    return {
        response,
        session
    }
}

export { askGemini }
