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

// Kumpulan scraper & downloader (YouTube, TikTok, IG, dll).

import axios from 'axios'
import crypto from 'crypto'
import fs, { promises, mkdirSync } from 'fs'
import path, { join } from 'path'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import qs from 'qs'
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import FormData from 'form-data'
import { JSDOM } from 'jsdom'
import mimeDb from 'mime-types'
import { footerText, rbDefine, rbDefineLib } from '../core/system.js'
import { pickImage, reactTo } from '../core/file.js'
import _ngDns from 'dns'
import _ngHttp from 'http'
import _ngHttps from 'https'
import _ngNet from 'net'
import { createRequire as _createRequire } from 'module'
import { createContext as _igjhCreateContext, runInContext as _igjhRunInContext } from 'node:vm'
import { webcrypto as _igjhWebcrypto } from 'node:crypto'
import _pkQRCode from 'qrcode'


// ╔══════════════ [ scraper.js ] ══════════════╗

// ───────── scraper ─────────
// Scraper downloader (YouTube, Instagram, Pinterest, TikTok, Terabox, Mediafire, dll).
// Tiap scraper tetap berdiri sendiri di dalam scope-nya; yang dipakai plugin diekspor di bawah.


// ── ytdl ──
const _ytdl = (() => {
// pola untuk mengambil ID video YouTube dari URL
const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
// jalankan perintah shell sebagai promise
const run = promisify(exec);

// ambil ID video dari URL YouTube
function extractVideoId(url) {
  return String(url || "").match(YOUTUBE_ID_REGEX)?.[1] || null;
}

// cadangan: unduh audio MP3 kalau cara utama gagal
async function fallbackToMp3Buffer(url) {
  const tempDir = path.join(process.cwd(), 'database', 'tmp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const id = crypto.randomBytes(6).toString("hex");
  const inputPath = path.join(tempDir, `ytfb_${id}.bin`);
  const outputPath = path.join(tempDir, `ytfb_${id}.mp3`);

  try {
    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const buffer = Buffer.from(data);
    if (!buffer.length) {
      throw new Error("Audio fallback kosong");
    }

    fs.writeFileSync(inputPath, buffer);

    await run(
      `ffmpeg -y -i "${inputPath}" -vn -map_metadata -1 -ac 2 -ar 44100 -c:a libmp3lame -b:a 192k "${outputPath}"`,
      { timeout: 120000 },
    );

    const mp3Buffer = fs.readFileSync(outputPath);
    if (!mp3Buffer.length) {
      throw new Error("Konversi fallback ke MP3 gagal");
    }

    return mp3Buffer;
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
}

// unduh video/audio YouTube
async function ytdl(url, format = "mp3") {
  try {
    const videoId = extractVideoId(url);

    if (!videoId) {
      return {
        status: false,
        mess: "Format URL tidak dikenali atau bukan link YouTube yang valid.",
      };
    }

    const normalizedFormat =
      String(format || "mp3").toLowerCase() === "mp4" ? "mp4" : "mp3";

    const client = axios.create({
      timeout: 60000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7271.123 Mobile Safari/537.36",
        Referer: "https://id.ytmp3.mobi/",
      },
    });

    const { data: init } = await client.get("https://d.ymcdn.org/api/v1/init", {
      params: {
        p: "y",
        23: "1llum1n471",
        _: Math.random(),
      },
    });

    if (!init?.convertURL) {
      return {
        status: false,
        mess: "Gagal menginisialisasi server (Init failed).",
      };
    }

    const { data: convert } = await client.get(init.convertURL, {
      params: {
        v: videoId,
        f: normalizedFormat,
        _: Math.random(),
      },
    });

    if (!convert?.progressURL || !convert?.downloadURL) {
      return {
        status: false,
        mess: "Gagal mendapatkan data konversi.",
      };
    }

    let progress = 0;
    let title = convert.title || "";
    let attempts = 0;
    const maxAttempts = 20;

    while (progress < 3 && attempts < maxAttempts) {
      const { data } = await client.get(convert.progressURL);

      if ((data?.error || 0) > 0) {
        return {
          status: false,
          mess: `Error dari server: ${data.error}`,
        };
      }

      progress = Number(data?.progress || 0);
      title = data?.title || title;

      if (progress < 3) {
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (attempts >= maxAttempts && progress < 3) {
      return {
        status: false,
        mess: "Request timeout (proses terlalu lama).",
      };
    }

    return { status: true, title, dl: convert.downloadURL };
  } catch (e) {
    return { status: false, mess: `System Error: ${e.message}` };
  }
}

// objek downloader YouTube (alias export)
class Youtube {
  constructor() {
    this.CREATED_BY = "Ditzzy";
    this.NOTE = "Thank you for using this scrape";
  }

  wrapResponse(data) {
    return {
      created_by: this.CREATED_BY,
      note: this.NOTE,
      results: data,
    };
  }

  async download(url, format = "audio") {
    const outputFormat = ["video", "mp4"].includes(
      String(format || "audio").toLowerCase(),
    )
      ? "mp4"
      : "mp3";
    const result = await ytdl(url, outputFormat);

    if (!result?.status || !result?.dl) {
      throw new Error(result?.mess || "Gagal mengunduh konten YouTube");
    }

    return this.wrapResponse({
      title: result.title,
      download: result.dl,
      url: result.dl,
      format: outputFormat,
    });
  }
}

  return { default: ytdl, ytdl, Youtube, fallbackToMp3Buffer }
})()
// unduh video/audio YouTube
const ytdl = _ytdl.default
// objek downloader YouTube (alias export)
const Youtube = _ytdl.Youtube
// cadangan: unduh audio MP3 kalau cara utama gagal
const fallbackToMp3Buffer = _ytdl.fallbackToMp3Buffer

// ── ig ──
const _ig = (() => {
// unduh foto/video Instagram
async function instagramDownloader(url) {
  const endpoint = "https://api.azbry.com/api/download/instagramv2";
  const response = await axios.get(endpoint, {
    params: { url: url },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  const data = response.data;
  if (!data || !data.status || !Array.isArray(data.links) || data.links.length === 0) {
    throw new Error("Gagal mengambil media dari API Instagram");
  }

  const media = data.links.map((item) => {
    const itemType = String(item.type || "").toLowerCase();
    const itemUrl = String(item.url || "").toLowerCase();
    const isVideo = itemType === "video" || itemType === "mp4" || itemUrl.includes(".mp4");
    return {
      type: isVideo ? "video" : "image",
      url: item.url,
      thumbnail: item.thumbnail || "",
    };
  });

  const firstLink = data.links[0] || {};
  const captionText = firstLink.text && firstLink.text !== "null" ? firstLink.text.trim() : "";
  const authorName = data.author && data.author !== "Unknown" ? data.author : "-";
  const thumbUrl = firstLink.thumbnail || data.thumbnail || "";

  return {
    status: true,
    username: authorName,
    title: captionText || authorName,
    caption: captionText,
    thumbnail: thumbUrl,
    avatar: data.avatar || "",
    media: media,
  };
}

  return { default: instagramDownloader }
})()
// unduh foto/video Instagram
const instagramDownloader = _ig.default

// ── pindl ──
const _pindl = (() => {
// header HTTP bawaan scraper
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "id,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
  "X-Requested-With": "XMLHttpRequest",
  Origin: "https://ilovepin.net",
  Referer: "https://ilovepin.net/id",
};

// cari/unduh gambar Pinterest
async function scrapePinterest(pinUrl) {
  try {
    const mainPage = await axios.get("https://ilovepin.net/id", {
      headers: {
        "User-Agent": headers["User-Agent"],
      },
    });
    const rawCookies = mainPage.headers["set-cookie"];
    const cookieString = rawCookies ? rawCookies.join("; ") : "";

    const dataBody = qs.stringify({
      url: pinUrl,
    });

    const { data } = await axios.post(
      "https://ilovepin.net/proxy.php",
      dataBody,
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: cookieString,
        },
      },
    );

    if (!data.api || data.api.status !== "OK") {
      throw new Error("Gagal mengambil data atau URL tidak valid.");
    }

    const api = data.api;
    const items = api.mediaItems || [];

    const videos = items.filter((i) => i.type === "Video");
    const images = items.filter((i) => i.type === "Image");
    const audios = items.filter((i) => i.type === "Audio");

    const result = {
      title: api.title,
      description: api.description?.trim() || "-",
      author: {
        name: api.userInfo?.name,
        username: api.userInfo?.username,
        avatar: api.userInfo?.userAvatar,
      },
      stats: {
        likes: api.mediaStats?.likesCount,
        shares: api.mediaStats?.sharesCount,
      },
      media: [],
    };

    if (videos.length > 0) {
      videos.sort((a, b) => {
        const sizeA =
          parseFloat(a.mediaFileSize) *
          (a.mediaFileSize.includes("MB") ? 1024 : 1);
        const sizeB =
          parseFloat(b.mediaFileSize) *
          (b.mediaFileSize.includes("MB") ? 1024 : 1);
        return sizeB - sizeA;
      });

      result.media = videos.map((v) => ({
        type: "video",
        quality: v.mediaQuality === "HD" ? "HD" : `SD (${v.mediaRes})`,
        extension: v.mediaExtension,
        size: v.mediaFileSize,
        url: v.mediaUrl,
      }));
    } else if (images.length > 0) {
      result.media = images.map((img) => ({
        type: "image",
        quality: "Original",
        extension: img.mediaExtension,
        size: img.mediaFileSize,
        url: img.mediaUrl,
      }));
    }

    return result;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}


// useage
// const url = 'https://id.pinterest.com/pin/87186942777228203/';

// scrapePinterest(url).then(res => {
//   if (res) {
//     console.log(JSON.stringify(res, null, 2));
//   }
// });
// /* respon
// {
//   "title": "heyeeog's Media",
//   "description": "-",
//   "author": {
//     "name": "H",
//     "username": "heyeeog",
//     "avatar": "https://s15.mcontent.app/v3/v/image/87187080194607525/87187080194607525/332c572b8c60be6f9e8ab9fd43b61aa5.jpg?token=1767599492ea8665974d03f7b699e59d60b56aa13e"
//   },
//   "stats": {
//     "likes": "1K",
//     "shares": "40K"
//   },
//   "media": [
//     {
//       "type": "video",
//       "quality": "HD",
//       "extension": "MP4",
//       "size": "2.16 MB",
//       "url": "https://s15.mcontent.app/v3/videoProcess/87186942777228203/280d107da6300ddd5613860656fd53d6/720p"
//     },
//     {
//       "type": "video",
//       "quality": "SD (648x1152)",
//       "extension": "MP4",
//       "size": "1.66 MB",
//       "url": "https://s15.mcontent.app/v3/videoProcess/87186942777228203/c974343bf779666b9547b76bf0586c7d/648p"
//     },
//     {
//       "type": "video",
//       "quality": "SD (486x864)",
//       "extension": "MP4",
//       "size": "1.16 MB",
//       "url": "https://s15.mcontent.app/v3/videoProcess/87186942777228203/02f0e7df39aa43abb41cf3a8925327f9/486p"
//     },
//     {
//       "type": "video",
//       "quality": "SD (360x640)",
//       "extension": "MP4",
//       "size": "760.32 KB",
//       "url": "https://s15.mcontent.app/v3/videoProcess/87186942777228203/fbc3c1f0361573d1334cdadfe26e8ba4/360p"
//     },
//     {
//       "type": "video",
//       "quality": "SD (234x416)",
//       "extension": "MP4",
//       "size": "394.04 KB",
//       "url": "https://s15.mcontent.app/v3/videoProcess/87186942777228203/ef58218a30aa8e6842e86b7ec9d8c9e0/234p"
//     }
//   ]
// }
// */

  return { default: scrapePinterest }
})()
// cari/unduh gambar Pinterest
const scrapePinterest = _pindl.default

// ── aio ──
const _aio = (() => {
// pola URL untuk mengenali platform
const PLATFORM_DETECT = [
  { key: "instagram", patterns: ["instagram.com"] },
  { key: "youtube", patterns: ["youtube.com", "youtu.be"] },
  { key: "tiktok", patterns: ["tiktok.com", "vt.tiktok.com"] },
  { key: "facebook", patterns: ["facebook.com", "fb.watch", "fb.com"] },
  { key: "pinterest", patterns: ["pinterest.com", "pin.it"] },
  { key: "capcut", patterns: ["capcut.com"] },
  { key: "twitter", patterns: ["twitter.com", "x.com"] },
  { key: "threads", patterns: ["threads.net"] },
  { key: "reddit", patterns: ["reddit.com"] },
];

// kenali platform dari URL
function detectPlatform(url) {
  const lower = (url || "").toLowerCase();
  for (const p of PLATFORM_DETECT) {
    if (p.patterns.some((pat) => lower.includes(pat))) return p.key;
  }
  return null;
}

// handler AIO untuk Instagram
async function handleInstagram(url) {
  const result = await instagramDownloader(url);
  const media = (result.media || []).map((item) => ({
    type: item.type === "video" || item.type === "mp4" ? "video" : "image",
    url: item.url,
  }));
  return {
    platform: "instagram",
    title: result.title || result.username || "Instagram",
    thumbnail: result.thumbnail || null,
    media,
  };
}

// handler AIO untuk YouTube
async function handleYoutube(url) {
  const yt = new Youtube();
  const videoResult = await yt.download(url, "mp4");
  const audioResult = await yt.download(url, "mp3");
  const media = [];
  if (videoResult?.results?.download) {
    media.push({
      type: "video",
      url: videoResult.results.download,
      quality: "mp4",
    });
  }
  if (audioResult?.results?.download) {
    media.push({
      type: "audio",
      url: audioResult.results.download,
      quality: "mp3",
    });
  }
  return {
    platform: "youtube",
    title:
      videoResult?.results?.title || audioResult?.results?.title || "YouTube",
    thumbnail: null,
    media,
  };
}

// handler AIO untuk TikTok
async function handleTiktok(url) {
  const domain = "https://www.tikwm.com/api/";
  const res = (
    await axios.post(
      domain,
      {},
      {
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: "https://www.tikwm.com",
          Referer: "https://www.tikwm.com/",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
          "X-Requested-With": "XMLHttpRequest",
        },
        params: { url, count: 12, cursor: 0, web: 1, hd: 1 },
      },
    )
  ).data.data;

  const media = [];
  if (res?.duration === 0) {
    (res.images || []).forEach((v) => media.push({ type: "image", url: v }));
  } else {
    if (res?.hdplay)
      media.push({
        type: "video",
        url: "https://www.tikwm.com" + res.hdplay,
        quality: "HD",
      });
    if (res?.play)
      media.push({
        type: "video",
        url: "https://www.tikwm.com" + res.play,
        quality: "NoWM",
      });
  }

  return {
    platform: "tiktok",
    title: res?.title || "TikTok",
    thumbnail: res?.cover ? "https://www.tikwm.com" + res.cover : null,
    author: res?.author?.nickname || null,
    media,
  };
}

// handler AIO untuk Facebook
async function handleFacebook(url) {
  const { fbdown } = await import("btch-downloader");
  const data = await fbdown(url);
  if (!data?.status) throw new Error("Facebook API returned no data");
  const videoUrl = data.HD || data.Normal_video;
  if (!videoUrl) throw new Error("No video URL");
  return {
    platform: "facebook",
    title: data.title || "Facebook",
    thumbnail: data.thumbnail || null,
    media: [{ type: "video", url: videoUrl, quality: data.HD ? "HD" : "SD" }],
  };
}

// handler AIO untuk Pinterest
async function handlePinterest(url) {
  const result = await scrapePinterest(url);
  if (!result?.media?.length) throw new Error("No media found");
  return {
    platform: "pinterest",
    title: result.title || "Pinterest",
    thumbnail: null,
    media: result.media.map((m) => ({
      type: m.type === "video" ? "video" : "image",
      url: m.url,
      quality: m.quality || null,
    })),
  };
}

// handler AIO untuk CapCut
async function handleCapcut(url) {
  const { capcut } = await import("btch-downloader");
  const data = await capcut(url);
  if (!data?.status || !data?.originalVideoUrl)
    throw new Error("No CapCut video");
  return {
    platform: "capcut",
    title: data.title || "CapCut",
    thumbnail: data.thumbnail || null,
    media: [{ type: "video", url: data.originalVideoUrl }],
  };
}

// header untuk situs savefbs
const SAVEFBS_HEADERS = {
  accept: "*/*",
  "content-type": "application/json",
  referer: "https://savefbs.com/all-in-one-video-downloader/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
};

// handler cadangan lewat savefbs
async function handleSavefbs(url) {
  const BASE_URL = "https://savefbs.com/api/v1/aio";
  const infoRes = await fetch(`${BASE_URL}/html`, {
    method: "POST",
    headers: SAVEFBS_HEADERS,
    body: JSON.stringify({
      vid: url,
      prefix: "savefbs.com",
      ex: "",
      format: "",
    }),
  });
  const html = await infoRes.text();
  const $ = cheerio.load(html);

  const title = $("h3.text-sm").text().trim();
  const thumb = $("img.aio-thumbnail").attr("src");
  const token = $(".aio-format-btn").first().attr("data-loader-id");

  const formats = [];
  $(".aio-format-btn").each((_, el) => {
    const onclick = $(el).attr("onclick");
    const match = onclick?.match(/'([^']+)'/);
    if (match) formats.push(match[1]);
  });

  if (!token || !formats.length) throw new Error("Savefbs returned no data");

  const VIDEO_PRIORITY = ["1080", "720", "480", "360"];
  const AUDIO_FORMATS = ["mp3", "wav"];
  const bestVideo = VIDEO_PRIORITY.find((f) => formats.includes(f));
  const format =
    bestVideo || formats.find((f) => !AUDIO_FORMATS.includes(f)) || formats[0];

  const dlRes = await fetch(`${BASE_URL}/download`, {
    method: "POST",
    headers: SAVEFBS_HEADERS,
    body: JSON.stringify({ token, format }),
  });
  const dlData = await dlRes.json();
  const downloadUrl = dlData?.url || dlData?.download || dlData?.data?.url;
  if (!downloadUrl) throw new Error("Savefbs no download URL");

  const isAudio = AUDIO_FORMATS.includes(format);
  return {
    platform: "savefbs",
    title: title || "Downloaded",
    thumbnail: thumb || null,
    media: [
      { type: isAudio ? "audio" : "video", url: downloadUrl, quality: format },
    ],
  };
}

// tabel platform -> handler
const PLATFORM_HANDLERS = {
  instagram: handleInstagram,
  youtube: handleYoutube,
  tiktok: handleTiktok,
  facebook: handleFacebook,
  pinterest: handlePinterest,
  capcut: handleCapcut,
  twitter: handleSavefbs,
  threads: handleSavefbs,
  reddit: handleSavefbs,
};

// downloader semua-platform: pilih handler sesuai URL
async function aiodl(url) {
  const platform = detectPlatform(url);
  if (!platform) throw new Error("Platform tidak dikenali");

  const handler = PLATFORM_HANDLERS[platform];
  if (!handler) throw new Error(`Handler untuk ${platform} tidak tersedia`);

  try {
    return await handler(url);
  } catch (err) {
    if (
      platform !== "twitter" &&
      platform !== "threads" &&
      platform !== "reddit"
    ) {
      try {
        return await handleSavefbs(url);
      } catch {}
    }
    throw err;
  }
}

  return { aiodl, detectPlatform }
})()
// downloader semua-platform: pilih handler sesuai URL
const aiodl = _aio.aiodl
// kenali platform dari URL
const detectPlatform = _aio.detectPlatform

// ── dailymotion ──
const _dailymotion = (() => {
// buat IP acak untuk header
const getRndIP = () =>
  Array.from({ length: 4 }, () => Math.floor(Math.random() * 255)).join(".");

// unduh video Dailymotion
async function DailymotionDL(url) {
  const fakeIP = getRndIP();

  const response = await axios({
    method: "post",
    url: "https://vidomon.com/wp-json/aio-dl/video-data/",
    data: `url=${encodeURIComponent(url)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/148.0.0.0 Mobile Safari/537.36",
      Referer: `https://vidomon.com/dailymotion-video-downloader/#url=${url}`,
      "X-Forwarded-For": fakeIP,
      "X-Real-IP": fakeIP,
    },
  });

  const data = response.data;

  if (!data.medias || data.medias.length === 0) {
    return {
      status: false,
      error: "Tidak ada media yang tersedia",
    };
  }

  const best = data.medias
    .filter((m) => m.videoAvailable && m.extension === "mp4")
    .sort((a, b) => parseInt(b.quality) - parseInt(a.quality))[0];

  return {
    status: true,
    title: data.title,
    thumbnail: data.thumbnail,
    duration: data.duration,
    source: data.source,
    video: best ? best.url : data.medias[0].url,
    quality: best ? best.quality : data.medias[0].quality,
    medias: data.medias,
  };
}

  return { DailymotionDL }
})()
// unduh video Dailymotion
const DailymotionDL = _dailymotion.DailymotionDL

// ── fbdown ──
const _fbdown = (() => {
// unduh video Facebook
async function fbdown(url) {
  try {
    const res = await axios.get(`https://api.azbry.com/api/download/facebook?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.status) {
      return res.data;
    }
    return { status: false, message: "Gagal mengambil data dari API" };
  } catch (err) {
    return { status: false, message: err.message };
  }
}

  return { fbdown }
})()
// unduh video Facebook
const fbdown = _fbdown.fbdown

// ── likee ──
const _likee = (() => {
// unduh video Likee
async function likee(url){
    try{
        if(!/likee\.video|likee\.com|likee\.video/.test(url)) throw new Error('Invalid url')

        const res = await axios.post(
            'https://likeedownloader.com/process',
            new URLSearchParams({ id:url, locale:'en' }),
            {
                headers:{
                    'User-Agent':'Mozilla/5.0 (Linux; Android 10)',
                    'Accept':'application/json,text/javascript,*/*',
                    'x-requested-with':'XMLHttpRequest',
                    'Content-Type':'application/x-www-form-urlencoded',
                    origin:'https://likeedownloader.com',
                    referer:'https://likeedownloader.com/en'
                }
            }
        )

        const html = res.data && res.data.template ? res.data.template : null
        if(!html) throw new Error('Fetch failed')

        function pick(re){
            const m = html.match(re)
            return m ? m[1] : null
        }

        return {
            thumbnail : pick(/<img[^>]+src="([^"]+)"/),
            with_watermark : pick(/with_watermark[^>]+href="([^"]+)"/),
            without_watermark : pick(/without_watermark[^>]+href="([^"]+)"/),
            stats : pick(/(\d{1,2}\.\d{1,2}K[^<]+)/)
        }

    }catch(e){
        throw new Error(e.message)
    }
}

  return { default: likee }
})()
// unduh video Likee
const likee = _likee.default

// ── mediafire ──
const _mediafire = (() => {
// tabel ekstensi -> mime type
const mimeTypes = {
  "7z": "application/x-7z-compressed",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  apk: "application/vnd.android.package-archive",
  exe: "application/x-msdownload",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  txt: "text/plain",
  json: "application/json",
  js: "application/javascript",
  html: "text/html",
  css: "text/css",
};

// tebak mime type dari URL
function getMimeTypeFromUrl(url) {
  if (!url) return "application/octet-stream";

  const fileName = url.split("/").pop()?.split("?")[0] || "";
  const extension = fileName.includes(".")
    ? fileName.split(".").pop().toLowerCase()
    : "";

  return mimeTypes[extension] || "application/octet-stream";
}

// ambil link unduhan MediaFire
async function mediafire(url) {
  const { data: html } = await axios.get(url, {
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    "MediaFire File";
  const images = $('meta[property="og:image"]').attr("content") || "";
  const description =
    $('meta[property="og:description"]').attr("content") ||
    "not found description.";
  const link_download =
    $("#downloadButton").attr("href") ||
    $('a[aria-label="Download file"]').attr("href") ||
    "";
  const sizes = $("#downloadButton").text().trim();
  const sizeMatch = sizes.match(/\(([^)]+)\)/);
  const size = sizeMatch?.[1]?.trim() || "";
  const mimetype = getMimeTypeFromUrl(link_download);

  if (!link_download) {
    throw new Error("MediaFire download link not found");
  }

  return {
    meta: {
      title,
      images,
      description,
    },
    download: {
      link_download,
      size,
      mimetype,
    },
  };
}

  return { default: mediafire }
})()
// ambil link unduhan MediaFire
const mediafire = _mediafire.default

// ── rednote ──
const _rednote = (() => {
// buat IP acak untuk header
const generateRandomIP = () =>
  Array.from({ length: 4 }, () => Math.floor(Math.random() * 255)).join(".");

// unduh video/foto RedNote (Xiaohongshu)
async function RedNoteDL(xhsUrl) {
  const fakeIP = generateRandomIP();

  const response = await axios.post(
    "https://rednote.savevideodown.com/api/download",
    { url: xhsUrl },
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        Referer: "https://rednote.savevideodown.com/",
        Origin: "https://rednote.savevideodown.com",
        "X-Forwarded-For": fakeIP,
        "X-Real-IP": fakeIP,
        "Client-IP": fakeIP,
      },
    },
  );

  const resData = response.data;

  if (!resData.success) {
    return {
      status: false,
      error: resData.error || "Gagal mengambil data",
    };
  }

  return {
    status: true,
    title: resData.title,
    author: resData.author,
    type: resData.type,
    results:
      resData.type === "video"
        ? [resData.directVideoUrl || resData.downloadUrl]
        : resData.directImages || [],
  };
}

  return { RedNoteDL }
})()
// unduh video/foto RedNote (Xiaohongshu)
const RedNoteDL = _rednote.RedNoteDL

// ── terabox ──
const _terabox = (() => {
// pengaturan scraper TeraBox
const CONFIG = {
  base: "https://flowvideoplayer.com",
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// ambil link unduhan TeraBox
async function TeraBoxDL(url) {
  try {
    const session = await axios.get(CONFIG.base, {
      headers: { "User-Agent": CONFIG.ua },
    });

    const rawCookies = session.headers["set-cookie"] || [];
    const cookieStr = rawCookies.map((c) => c.split(";")[0]).join("; ");
    const token = session.data.match(
      /name=["']csrf-token["']\s+content=["']([^"']+)["']/i,
    )?.[1];

    if (!token) {
      return { status: false, error: "CSRF Token not found" };
    }

    const response = await axios.post(
      `${CONFIG.base}/telegram/bot/search/video`,
      { url },
      {
        headers: {
          "User-Agent": CONFIG.ua,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
          "X-Requested-With": "XMLHttpRequest",
          Cookie: cookieStr,
          Origin: CONFIG.base,
          Referer: `${CONFIG.base}/`,
        },
      },
    );

    const result = response.data;
    if (result.error === false && result.data && result.data.length > 0) {
      const item = result.data[0];
      return {
        status: true,
        file_name: item.file_name,
        thumbnail: item.thumbnail,
        download_url: item.download_url,
        stream_url: item.stream_final_url || item.stream_url,
        file_size: item.file_size,
        file_size_bytes: item.file_size_bytes,
        duration: item.duration,
        extension: item.extension,
        share_url: item.share_url,
      };
    }

    return { status: false, error: "Tidak ada data ditemukan" };
  } catch (e) {
    return { status: false, error: e.message };
  }
}

  return { TeraBoxDL }
})()
// ambil link unduhan TeraBox
const TeraBoxDL = _terabox.TeraBoxDL

// ── tiktok ──
const _tiktok = (() => {
// alamat API cadangan TikTok
const YUULABS_API = "https://api.yuulabs.web.id/api/downloader/tiktok?url=";
// header request TikTok
const REQUEST_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
};

// unduh TikTok lewat YuuLabs
async function ttdownFromYuuLabs(url) {
  const { data } = await axios.get(`${YUULABS_API}${encodeURIComponent(url)}`, {
    timeout: 30000,
    headers: REQUEST_HEADERS,
  });

  if (!data?.status || !data?.result) {
    throw new Error(data?.message || "YuuLabs response invalid");
  }

  const result = data.result;
  const downloads = [];

  if (result.videoUrl) {
    downloads.push({
      type: "nowatermark",
      label: "Video tanpa watermark",
      url: result.videoUrl,
    });
  }

  if (result.hdVideo) {
    downloads.push({
      type: "nowatermark_hd",
      label: "Video HD",
      url: result.hdVideo,
    });
  }

  if (result.audioUrl) {
    downloads.push({
      type: "mp3",
      label: "Audio MP3",
      url: result.audioUrl,
    });
  }

  if (downloads.length === 0) {
    throw new Error("YuuLabs tidak mengembalikan link download");
  }

  return {
    title: result.description || "",
    author: {
      username: result.author || "",
      avatar: null,
    },
    cover: null,
    downloads,
  };
}

// unduh TikTok lewat MusicalDown
async function ttdownFromMusicalDown(url) {
  const { data: html, headers } = await axios.get(
    "https://musicaldown.com/en",
    {
      timeout: 30000,
      headers: REQUEST_HEADERS,
    },
  );
  const $ = cheerio.load(html);

  const payload = {};
  $("#submit-form input").each((i, elem) => {
    const name = $(elem).attr("name");
    const value = $(elem).attr("value");
    if (name) payload[name] = value || "";
  });

  const urlField = Object.keys(payload).find((key) => !payload[key]);
  if (urlField) payload[urlField] = url;

  const cookieHeader = Array.isArray(headers["set-cookie"])
    ? headers["set-cookie"].join("; ")
    : "";

  const { data } = await axios.post(
    "https://musicaldown.com/download",
    new URLSearchParams(payload).toString(),
    {
      timeout: 30000,
      headers: {
        ...REQUEST_HEADERS,
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        cookie: cookieHeader,
        origin: "https://musicaldown.com",
        referer: "https://musicaldown.com/",
      },
    },
  );

  const $$ = cheerio.load(data);
  const videoHeader = $$(".video-header");
  const bgImage = videoHeader.attr("style");
  const coverMatch = bgImage?.match(/url\((.*?)\)/);

  const downloads = [];
  $$("a.download").each((i, elem) => {
    const $elem = $$(elem);
    const type = $elem.data("event")?.replace("_download_click", "");
    const label = $elem.text().trim();
    const downloadUrl = $elem.attr("href");
    if (!downloadUrl) return;
    downloads.push({
      type,
      label,
      url: downloadUrl,
    });
  });

  if (downloads.length === 0) {
    throw new Error("MusicalDown tidak mengembalikan link download");
  }

  return {
    title: $$(".video-desc").text().trim(),
    author: {
      username: $$(".video-author b").text().trim(),
      avatar: $$(".img-area img").attr("src"),
    },
    cover: coverMatch ? coverMatch[1] : null,
    downloads,
  };
}

// unduh TikTok tanpa watermark
async function ttdown(url) {
  try {
    if (!url.includes("tiktok.com")) throw new Error("Invalid url.");
    try {
      return await ttdownFromYuuLabs(url);
    } catch {
      return await ttdownFromMusicalDown(url);
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

  return { default: ttdown }
})()
// unduh TikTok tanpa watermark
const ttdown = _tiktok.default

export { ytdl, Youtube, fallbackToMp3Buffer, instagramDownloader, scrapePinterest, aiodl, detectPlatform, DailymotionDL, fbdown, likee, mediafire, RedNoteDL, TeraBoxDL, ttdown }

// ╔══════════════ [ data/index.js ] ══════════════╗

// ───────── data ─────────
// Konversi media (ffmpeg, webp -> mp4) dan scraper sfile.


// ── converter ──
const _converter = (() => {
// folder file sementara konverter
const TMP_DIR = join(process.cwd(), 'database', 'tmp');
try { mkdirSync(TMP_DIR, { recursive: true }) } catch {}

// jalankan ffmpeg pada buffer
function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
  return new Promise(async (resolve, reject) => {
    try {
      let tmp = join(TMP_DIR, +new Date() + '.' + ext);
      let out = tmp + '.' + ext2;
      await promises.writeFile(tmp, buffer);
      const ffmpegProcess = spawn('ffmpeg', [
        '-y',
        '-i', tmp,
        ...args,
        out
      ]);
      ffmpegProcess.on('error', (err) => {
        console.error('Error spawning ffmpeg:', err);
        reject(err);
      });
      ffmpegProcess.on('close', async (code) => {
        try {
          await promises.unlink(tmp);
          if (code !== 0) return reject(code);
          if (!await promises.access(out).then(() => true).catch(() => false)) {
            return reject(new Error('Output file not found'));
          }
          resolve({
            data: await promises.readFile(out),
            filename: out,
            delete() {
              return promises.unlink(out);
            }
          });
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Convert Audio to Playable WhatsApp Audio
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension 
 * @returns {Promise<{data: Buffer, filename: String, delete: Function}>}
 */
function toPTT(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-vbr', 'on',
  ], ext, 'ogg');
}

/**
 * Convert Audio to Playable WhatsApp PTT
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension 
 * @returns {Promise<{data: Buffer, filename: String, delete: Function}>}
 */
function toAudio(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-vbr', 'on',
    '-compression_level', '10'
  ], ext, 'opus');
}

/**
 * Convert Audio to Playable WhatsApp Video
 * @param {Buffer} buffer Video Buffer
 * @param {String} ext File Extension 
 * @returns {Promise<{data: Buffer, filename: String, delete: Function}>}
 */
function toVideo(buffer, ext) {
  return ffmpeg(buffer, [
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-ab', '128k',
    '-ar', '44100',
    '-crf', '32',
    '-preset', 'slow'
  ], ext, 'mp4');
}

  return { toAudio, toPTT, toVideo, ffmpeg }
})()
// ubah media jadi audio
const toAudio = _converter.toAudio
// ubah audio jadi voice note (PTT)
const toPTT = _converter.toPTT
// ubah media jadi video
const toVideo = _converter.toVideo
// jalankan ffmpeg pada buffer
const ffmpeg = _converter.ffmpeg

// ── webp2mp4 ──
const _webp2mp4 = (() => {
/**
 * 
 * @param {Buffer|String} source 
 */

// ubah stiker webp animasi jadi mp4
async function webp2mp4(source) {
  let form = new FormData
  let isUrl = typeof source === 'string' && /https?:\/\//.test(source)
  form.append('new-image-url', isUrl ? source : '')
  form.append('new-image', isUrl ? '' : source, 'image.webp')
  let res = await fetch('https://ezgif.com/webp-to-mp4', {
    method: 'POST',
    body: form
  })
  let html = await res.text()
  let { document } = new JSDOM(html).window
  let form2 = new FormData
  let obj = {}
  for (let input of document.querySelectorAll('form input[name]')) {
    obj[input.name] = input.value
    form2.append(input.name, input.value)
  }
  let res2 = await fetch('https://ezgif.com/webp-to-mp4/' + obj.file, {
    method: 'POST',
    body: form2
  })
  let html2 = await res2.text()
  let { document: document2 } = new JSDOM(html2).window
  return new URL(document2.querySelector('div#output > p.outfile > video > source').src, res2.url).toString()
}

// ubah stiker webp jadi png
async function webp2png(source) {
  let form = new FormData
  let isUrl = typeof source === 'string' && /https?:\/\//.test(source)
  form.append('new-image-url', isUrl ? source : '')
  form.append('new-image', isUrl ? '' : source, 'image.webp')
  let res = await fetch('https://ezgif.com/webp-to-png', {
    method: 'POST',
    body: form
  })
  let html = await res.text()
  let { document } = new JSDOM(html).window
  let form2 = new FormData
  let obj = {}
  for (let input of document.querySelectorAll('form input[name]')) {
    obj[input.name] = input.value
    form2.append(input.name, input.value)
  }
  let res2 = await fetch('https://ezgif.com/webp-to-png/' + obj.file, {
    method: 'POST',
    body: form2
  })
  let html2 = await res2.text()
  let { document: document2 } = new JSDOM(html2).window
  return new URL(document2.querySelector('div#output > p.outfile > img').src, res2.url).toString()
}

  return { webp2mp4, webp2png }
})()
// ubah stiker webp animasi jadi mp4
const webp2mp4 = _webp2mp4.webp2mp4
// ubah stiker webp jadi png
const webp2png = _webp2mp4.webp2png

// ── sfile ──
const _sfile = (() => {
// header untuk sfile.mobi
const sfileHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive'
}

// cari file di sfile.mobi
async function sfileSearch(query, page = 1) {
  const res = await fetch(`https://sfile.co/search.php?q=${encodeURIComponent(query)}&page=${page}`, { headers: sfileHeaders })
  const $ = cheerio.load(await res.text())
  const results = []

  $('.group.px-2').each((_, el) => {
    const title = $(el).find('.min-w-0 a').text().trim()
    const link = $(el).find('a').attr('href')
    const info = $(el).find('.mt-1').text().split('•')

    if (link) {
      results.push({
        title,
        size: info[0]?.trim(),
        upload: info[1]?.trim(),
        link
      })
    }
  })

  return results
}

// ambil link unduhan sfile.mobi
async function sfileDownload(url, buffer = true) {
  const res = await fetch(url, { headers: sfileHeaders })
  const html = await res.text()
  const $ = cheerio.load(html)

  const metadata = {
    filename: $('.overflow-hidden img').attr('alt')?.trim() || 'file',
    mimetype: $('.divide-y span').first().text().trim(),
    download_count: $('.divide-y .font-semibold').eq(1).text().trim(),
    author_name: $('.divide-y a').first().text().trim()
  }

  let dl =
    $('#download').attr('data-dw-url') ||
    $('a#download').attr('href')

  if (!dl) throw new Error('Download URL tidak ditemukan')

  const cdn = await fetch(dl, {
    headers: sfileHeaders,
    redirect: 'follow'
  })

  const finalUrl = cdn.url

  if (!finalUrl) throw new Error('Redirect CDN gagal')

  if (!buffer) {
    return { metadata, download: finalUrl }
  }

  const arrayBuffer = await cdn.arrayBuffer()

  return {
    metadata,
    download: Buffer.from(arrayBuffer)
  }
}

  return { sfileSearch, sfileDownload }
})()
// cari file di sfile.mobi
const sfileSearch = _sfile.sfileSearch
// ambil link unduhan sfile.mobi
const sfileDownload = _sfile.sfileDownload

export { toAudio, toPTT, toVideo, ffmpeg, webp2mp4, webp2png, sfileSearch, sfileDownload }


// ╔══════════════ [ tools.js ] ══════════════╗

// ───────── tools ─────────
// Scraper & engine untuk plugin tools: hd / hdr / hd2, tempmail, whatmusic,
// ssweb, rch, fetch, blur, dan fitur berbasis API
// (ocr, readqr).
// Fitur yang butuh multipart Blob memakai fetch/FormData bawaan Node, bukan node-fetch.

const _tools = (() => {
    const nativeFetch = globalThis.fetch
    const NativeForm = globalThis.FormData
    const NativeBlob = globalThis.Blob
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
    const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36'

    // error yang pesannya aman ditampilkan langsung ke pengguna
    const friendly = (message) => Object.assign(new Error(message), { friendly: true })

    // ── upload sementara (dipakai API yang butuh URL gambar) ──
    async function uploadUguu(buffer, filename = 'image.jpg') {
        const form = new FormData()
        form.append('files[]', buffer, filename)
        const res = await axios.post('https://uguu.se/upload.php', form, { headers: form.getHeaders() })
        const url = res.data?.files?.[0]?.url
        if (!url) throw new Error('Upload gambar gagal')
        return url
    }

    async function uploadPone(buffer, filename = 'file.jpg') {
        const form = new FormData()
        form.append('files[]', buffer, { filename })
        const res = await axios.post('https://pone.rs/upload.php', form, {
            headers: {
                ...form.getHeaders(),
                'user-agent': ANDROID_UA,
                accept: '*/*',
                origin: 'https://pone.rs',
                referer: 'https://pone.rs/'
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 60000,
            validateStatus: () => true
        })
        const url = res.data?.files?.[0]?.url?.replaceAll('\\/', '/')
        if (!res.data?.success || !url) throw new Error('Upload gambar gagal')
        return url
    }

    // ── hd / hdr : iLoveIMG, cadangan Remini ──
    async function iloveToken() {
        const html = await axios.get('https://www.iloveimg.com/upscale-image')
        const $ = cheerio.load(html.data)
        const script = $('script')
            .filter((i, el) => ($(el).html() || '').includes('ilovepdfConfig ='))
            .html()
        const json = JSON.parse(script.split('ilovepdfConfig = ')[1].split(';')[0])
        const csrf = $('meta[name="csrf-token"]').attr('content')
        return { token: json.token, csrf }
    }

    async function iloveUpscale(buffer, scale = 4) {
        const { token, csrf } = await iloveToken()
        const servers = [
            'api1g', 'api2g', 'api3g', 'api8g', 'api9g', 'api10g', 'api11g',
            'api12g', 'api13g', 'api14g', 'api15g', 'api16g', 'api17g', 'api18g',
            'api19g', 'api20g', 'api21g', 'api22g', 'api24g', 'api25g'
        ]
        const server = servers[Math.floor(Math.random() * servers.length)]
        const task = 'r68zl88mq72xq94j2d5p66bn2z9lrbx20njsbw2qsAvgmzr11lvfhAx9kl87pp6yqgx7c8vg7sfbqnrr42qb16v0gj8jl5s0kq1kgp26mdyjjspd8c5A2wk8b4Adbm6vf5tpwbqlqdr8A9tfn7vbqvy28ylphlxdl379psxpd8r70nzs3sk1'
        const headers = {
            Authorization: 'Bearer ' + token,
            Origin: 'https://www.iloveimg.com/',
            Cookie: '_csrf=' + csrf,
            'User-Agent': 'Mozilla/5.0'
        }

        const upForm = new FormData()
        upForm.append('name', 'image.jpg')
        upForm.append('chunk', '0')
        upForm.append('chunks', '1')
        upForm.append('task', task)
        upForm.append('preview', '1')
        upForm.append('file', buffer, 'image.jpg')
        const upload = await axios.post(`https://${server}.iloveimg.com/v1/upload`, upForm, {
            headers: { ...headers, ...upForm.getHeaders() }
        })

        const form = new FormData()
        form.append('task', task)
        form.append('server_filename', upload.data.server_filename)
        form.append('scale', scale)
        const res = await axios.post(`https://${server}.iloveimg.com/v1/upscale`, form, {
            headers: { ...headers, ...form.getHeaders() },
            responseType: 'arraybuffer'
        })
        return Buffer.from(res.data)
    }

    const REMINI_API = 'https://a.android.api.remini.ai/v1/mobile'
    const REMINI_ORACLE = 'https://api.remini.ai/v1/mobile/oracle'

    function reminiDeviceIds() {
        const a = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        return {
            android_id: a,
            aaid: crypto.randomUUID(),
            backup_persistent_id: a + '_com.bigwinepot.nwdn.international',
            non_backup_persistent_id: crypto.randomUUID()
        }
    }

    let reminiDevice = reminiDeviceIds()
    let reminiToken = null

    function reminiBaseHeaders(extra) {
        return {
            'bsp-id': 'com.bigwinepot.nwdn.international.android',
            'build-number': '202514479', 'build-version': '3.7.1020',
            'country': 'US', 'device-manufacturer': 'Samsung', 'device-model': 'SM-G998B',
            'device-type': '6.8', 'language': 'en', 'locale': 'en_US',
            'os-version': '33', 'platform': 'Android', 'timezone': 'America/New_York',
            'android-id': reminiDevice.android_id, 'aaid': reminiDevice.aaid,
            'accept-encoding': 'gzip', 'user-agent': 'okhttp/4.12.0',
            ...(extra || {})
        }
    }

    function reminiAuthHeaders(extra) {
        const headers = reminiBaseHeaders(extra)
        if (reminiToken) headers['identity-token'] = reminiToken
        return headers
    }

    async function reminiAuth() {
        reminiDevice = reminiDeviceIds()
        const res = await nativeFetch(REMINI_ORACLE + '/setup', {
            headers: reminiBaseHeaders({
                'first-install-timestamp': Math.floor(Date.now() / 1000) + 'E9',
                'backup-persistent-id': reminiDevice.backup_persistent_id,
                'non-backup-persistent-id': reminiDevice.non_backup_persistent_id,
                'environment': 'Production', 'settings-response-version': 'v2',
                'is-app-running-in-background': 'false', 'is-old-user': 'true',
                'app-set-id': 'd44bd45a-a45d-4470-9674-7348a8e3fb71'
            })
        })
        const data = await res.json()
        reminiToken = data.settings.__identity__.token
        if (!reminiToken) throw new Error('No token from Remini')
        await nativeFetch(REMINI_API + '/users/@me', { headers: reminiAuthHeaders() })
    }

    async function reminiEnhance(buffer) {
        await reminiAuth()
        const md5 = crypto.createHash('md5').update(buffer).digest('base64')

        const meta = { size: buffer.length }
        try {
            const { default: sharp } = await import('sharp')
            const info = await sharp(buffer).metadata()
            meta.width = info.width
            meta.height = info.height
        } catch {}

        const taskRes = await nativeFetch(REMINI_API + '/tasks', {
            method: 'POST',
            headers: reminiAuthHeaders({ 'content-type': 'application/json; charset=UTF-8' }),
            body: JSON.stringify({
                image_content_type: 'image/jpeg',
                image_md5: md5,
                feature: { type: 'enhance', models: [] },
                metadata: meta,
                options: { high_quality_output: false, save_input: true }
            })
        })
        const task = await taskRes.json()
        if (!task.task_id || !task.upload_url || !task.upload_headers) throw new Error('Missing fields in Remini Task')

        await nativeFetch(task.upload_url, {
            method: 'PUT',
            headers: { ...task.upload_headers, 'Content-Length': buffer.length.toString(), 'User-Agent': 'okhttp/4.12.0' },
            body: buffer
        })

        await nativeFetch(REMINI_API + '/tasks/' + task.task_id + '/process', {
            method: 'POST',
            headers: reminiAuthHeaders({ 'content-length': '0' })
        })

        let cdnUrl = null
        for (let i = 0; i < 40; i++) {
            await wait(5000)
            const pollRes = await nativeFetch(REMINI_API + '/tasks/' + task.task_id, { headers: reminiAuthHeaders() })
            const poll = await pollRes.json()
            if (poll.status === 'completed') {
                const outs = poll.result && poll.result.outputs
                if (outs && Array.isArray(outs) && outs[0] && outs[0].url) cdnUrl = outs[0].url
                break
            }
            if (poll.status === 'failed' || poll.status === 'error') throw new Error('Remini Task failed')
        }

        if (!cdnUrl) throw new Error('No output URL from Remini')
        const final = await axios.get(cdnUrl, { responseType: 'arraybuffer' })
        return Buffer.from(final.data)
    }

    // scale: 2 untuk hd, 4 untuk hdr
    async function upscaleImage(buffer, scale = 4) {
        try {
            return await iloveUpscale(buffer, scale)
        } catch (e) {
            console.log('[iLoveIMG Error] Fallback ke Remini...', e.message)
            return reminiEnhance(buffer)
        }
    }

    // ── tempmail : tempail.top ──
    const activeMails = new Map() // email -> token (selama bot hidup)
    const tempail = {
        base: 'https://tempail.top/api',
        headers: { 'user-agent': 'Postify/1.0.0' },
        deletedAt: null
    }

    const tempailExpired = () => !!tempail.deletedAt && Date.now() > tempail.deletedAt

    async function tempMailCreate() {
        let res
        try {
            res = await axios.post(`${tempail.base}/email/create/ApiTempail`, null, { headers: tempail.headers })
        } catch (e) {
            throw friendly(e.message)
        }
        if (res.data.status !== 'success') throw friendly('Gagal bikin email temp nya bree..')

        const { email, email_token: token, deleted_in: deletedIn } = res.data.data
        tempail.deletedAt = new Date(deletedIn).getTime()
        activeMails.set(email, token)
        return { email, deletedIn }
    }

    async function tempMailInbox(email) {
        const token = activeMails.get(email)
        if (!token) throw friendly('❌ Email tidak ditemukan di database bot (mungkin bot baru direstart atau email sudah kadaluarsa). Silakan buat baru dengan tempmail')
        if (tempailExpired()) throw friendly('Email Tempnya udah expired bree..')

        let res
        try {
            res = await axios.get(`${tempail.base}/messages/${token}/ApiTempail`, { headers: tempail.headers })
        } catch (e) {
            throw friendly(e.message)
        }
        if (res.data.status !== 'success') throw friendly('Gagal ambil list pesan bree..')
        const { mailbox, messages } = res.data.data
        return { mailbox, messages }
    }

    async function tempMailRead(messageId) {
        if (tempailExpired()) throw friendly('Email Tempnya udah expired bree..')

        let res
        try {
            res = await axios.get(`${tempail.base}/message/${messageId}/ApiTempail`, { headers: tempail.headers })
        } catch (e) {
            throw friendly(e.message)
        }
        if (res.data.status !== 'success') throw friendly('Gagal ambil isi pesan bree..')

        const [msg] = res.data.data
        return {
            subject: msg.subject,
            isSeen: msg.is_seen,
            from: msg.from,
            fromEmail: msg.from_email,
            receivedAt: msg.receivedAt,
            id: msg.id,
            attachments: msg.attachments,
            content: msg.content
        }
    }

    // ── whatmusic : audd.io ──
    async function identifyAudio(buffer) {
        const form = new NativeForm()
        form.append('file', new NativeBlob([buffer], { type: 'audio/mpeg' }), 'sample.mp3')
        form.append('api_token', 'test')
        form.append('return', 'spotify,apple_music')

        const res = await nativeFetch('https://api.audd.io/', { method: 'POST', body: form })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        if (data.status !== 'success' || !data.result) return null
        return data.result
    }

    // ── ssweb / recordweb : bentosnap ──
    const SNAP_API = 'https://shinana-bentosnap.hf.space/api'
    const SNAP_HEADERS = { accept: 'application/json', 'Content-Type': 'application/json' }
    const pickResultUrl = (d) => d?.url || d?.image || d?.video || d?.result || d?.output || d?.data?.url

    async function webScreenshot(url, device = 'desktop_fhd') {
        const { data } = await axios.post(`${SNAP_API}/screenshot`, {
            url, device, dark_mode: false, wait_ms: 1500
        }, { headers: SNAP_HEADERS, timeout: 120000 })

        const out = pickResultUrl(data)
        if (!out) throw friendly(`Gagal ambil hasil screenshot.\n\n${JSON.stringify(data, null, 2).slice(0, 1000)}`)
        return out
    }

    async function webRecord(url, device = 'desktop_fhd', duration = 8000) {
        const { data } = await axios.post(`${SNAP_API}/record`, {
            url, device, duration_ms: duration, fps: 30, scroll: true, dark_mode: false, wait_ms: 1500
        }, { headers: SNAP_HEADERS, timeout: 120000 })

        const out = pickResultUrl(data)
        if (!out) throw friendly(`Gagal ambil hasil video.\n\n${JSON.stringify(data, null, 2).slice(0, 1000)}`)
        return out
    }

    // ── fetch : ambil isi URL apa pun ──
    async function fetchAny(input) {
        let url = String(input).trim()
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url

        const res = await nativeFetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

        const contentType = res.headers.get('content-type')?.split(';')[0].trim() || 'application/octet-stream'
        const contentLength = Number(res.headers.get('content-length')) || 0
        if (contentLength > 500 * 1024 * 1024) throw new Error('File terlalu besar (Max 500 MB)')

        const disposition = res.headers.get('content-disposition')
        let filename = 'file'
        if (disposition && /filename=/i.test(disposition)) {
            filename = disposition.split('filename=')[1].replace(/UTF-8''/i, '').replace(/["']/g, '').trim()
        } else {
            filename = decodeURIComponent(path.basename(new URL(res.url).pathname)) || 'file'
        }

        const ext = mimeDb.extension(contentType)
        if (!path.extname(filename) && ext) filename += '.' + ext

        if (/^text\//i.test(contentType)) {
            return { kind: 'text', filename, contentType, text: await res.text() }
        }
        if (/application\/json/i.test(contentType)) {
            return { kind: 'text', filename, contentType, text: JSON.stringify(await res.json(), null, 2) }
        }
        return { kind: 'binary', filename, contentType, buffer: Buffer.from(await res.arrayBuffer()) }
    }

    // ── blur : popcat ──
    async function popcatBlur(buffer) {
        const url = await uploadUguu(buffer)
        return `https://api.popcat.xyz/v2/blur?image=${encodeURIComponent(url)}`
    }

    // ── fitur berbasis API: ocr, readqr, hd2,
    //    AI chat & gambar (gpt, claudehaiku, clara, ethan, guru, maya, nova, aicostum, unlimitedai,
    //    flux, text2img, editimg, imagetoprompt, removewm) ──
    const API_HOST = 'https://apiii-xrina.vercel.app'

    // spec tiap fitur API (name, title, path, kind, fields, ...) kini ditulis di file plugin masing-masing
    const META_KEYS = new Set(['status', 'success', 'code', 'statusCode', 'creator', 'author_api', 'timestamp'])
    const humanKey = (k) => String(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase())
    const TEXT_KEYS = ['result', 'response', 'answer', 'reply', 'text', 'output', 'content', 'message', 'data']
    const URL_KEYS = ['url', 'image', 'image_url', 'imageUrl', 'img', 'result', 'output', 'link', 'data']

    // cari teks hasil di dalam JSON (bentuk respons API bisa beda-beda)
    function pickText(v, depth = 0) {
        if (v == null || depth > 4) return null
        if (typeof v === 'string') return v.trim() || null
        if (Array.isArray(v)) {
            for (const it of v) { const r = pickText(it, depth + 1); if (r) return r }
            return null
        }
        if (typeof v === 'object') {
            for (const k of TEXT_KEYS) {
                if (k in v) { const r = pickText(v[k], depth + 1); if (r) return r }
            }
        }
        return null
    }

    // cari link gambar di dalam JSON
    function pickUrl(v, depth = 0) {
        if (v == null || depth > 4) return null
        if (typeof v === 'string') return /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : null
        if (Array.isArray(v)) {
            for (const it of v) { const r = pickUrl(it, depth + 1); if (r) return r }
            return null
        }
        if (typeof v === 'object') {
            for (const k of URL_KEYS) {
                if (k in v) { const r = pickUrl(v[k], depth + 1); if (r) return r }
            }
            for (const val of Object.values(v)) { const r = pickUrl(val, depth + 1); if (r) return r }
        }
        return null
    }

    // markdown ala AI -> format WhatsApp
    const toWhatsApp = (s) => String(s)
        .replace(/\*\*(.+?)\*\*/gs, '*$1*')
        .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
        .trim()

    function payloadOf(root) {
        if (root && typeof root === 'object' && !Array.isArray(root)) {
            for (const k of ['result', 'results', 'data', 'response']) {
                if (root[k] !== undefined && root[k] !== null && root[k] !== '') return root[k]
            }
        }
        return root
    }

    function inline(v, depth = 0) {
        if (v === null || v === undefined) return ''
        if (typeof v !== 'object') return String(v)
        if (Array.isArray(v)) return v.map(x => inline(x, depth + 1)).filter(Boolean).join(', ')
        if (depth >= 2) return ''
        return Object.entries(v).filter(([k]) => !META_KEYS.has(k))
            .map(([k, x]) => `${humanKey(k)}: ${inline(x, depth + 1)}`).join(' | ')
    }

    function formatObject(o) {
        const q = ['quote', 'quotes', 'kata', 'text', 'teks'].find(k => typeof o[k] === 'string' && o[k].trim())
        if (q) {
            const by = ['author', 'penulis', 'by'].find(k => typeof o[k] === 'string' && o[k].trim())
            return `${o[q].trim()}${by ? `\n\n— ${o[by].trim()}` : ''}`
        }
        return Object.entries(o)
            .filter(([k, v]) => !META_KEYS.has(k) && v !== null && v !== undefined && v !== '')
            .map(([k, v]) => {
                const val = inline(v)
                if (!val) return null
                return val.includes('\n') ? `*${humanKey(k)}:*\n${val}` : `*${humanKey(k)}:* ${val}`
            })
            .filter(Boolean).join('\n')
    }

    function formatAny(root) {
        const v = payloadOf(root)
        if (v === null || v === undefined) return ''
        if (typeof v !== 'object') return String(v).trim()
        if (Array.isArray(v)) {
            const items = v.slice(0, 10).map((it, i) => {
                const body = typeof it === 'object' && it ? formatObject(it) : String(it)
                if (!body) return null
                return typeof it === 'object' ? `*${i + 1}.* ${body.replace(/\n/g, '\n    ')}` : body
            }).filter(Boolean)
            const more = v.length > 10 ? `\n\n_…dan ${v.length - 10} hasil lainnya_` : ''
            return items.join('\n\n') + more
        }
        return formatObject(v)
    }

    // cari media (video / audio / gambar / file) di dalam JSON
    const SKIP_KEY = /thumb|cover|avatar|icon|poster|profile|logo|preview|watermark/i
    const MEDIA_EXT = {
        video: /\.(mp4|mkv|webm|mov|m3u8)(\?|$)/i,
        audio: /\.(mp3|m4a|opus|ogg|wav|aac)(\?|$)/i,
        image: /\.(jpe?g|png|webp|gif)(\?|$)/i
    }

    function classifyMedia(url, key, parent) {
        const hint = `${parent?.type || ''} ${parent?.mime || ''} ${parent?.mimetype || ''} ${parent?.format || ''} ${parent?.ext || ''}`.toLowerCase()
        if (/video|mp4/.test(hint)) return 'video'
        if (/audio|mp3|m4a/.test(hint)) return 'audio'
        if (/image|photo|jpe?g|png|webp/.test(hint)) return 'image'
        if (MEDIA_EXT.video.test(url)) return 'video'
        if (MEDIA_EXT.audio.test(url)) return 'audio'
        if (MEDIA_EXT.image.test(url)) return 'image'
        if (/video|mp4|nowm|hd|sd/i.test(key)) return 'video'
        if (/audio|mp3|music|sound/i.test(key)) return 'audio'
        if (/image|photo|img|pic/i.test(key)) return 'image'
        return 'file'
    }

    function collectMedia(root) {
        const found = { video: [], audio: [], image: [], file: [] }
        const seen = new Set()
        const meta = {}

        const walk = (v, key = '', parent = null, depth = 0) => {
            if (v === null || v === undefined || depth > 6) return
            if (typeof v === 'string') {
                const s = v.trim()
                if (/^(title|caption|desc|description|name|filename|fileName|file_name)$/i.test(key) && !meta.title && !/^https?:\/\//i.test(s)) {
                    meta.title = s
                }
                if (/^(size|filesize|file_size)$/i.test(key) && !meta.size) meta.size = s
                if (/^https?:\/\/\S+$/i.test(s) && !seen.has(s)) {
                    seen.add(s)
                    const kind = classifyMedia(s, key, parent)
                    if (SKIP_KEY.test(key) && kind !== 'video' && kind !== 'audio') { found.thumb = found.thumb || s; return }
                    found[kind].push(s)
                }
                return
            }
            if (typeof v === 'number') {
                if (/^(size|filesize|file_size)$/i.test(key) && !meta.size) meta.size = v
                return
            }
            if (Array.isArray(v)) { v.forEach(x => walk(x, key, parent, depth + 1)); return }
            if (typeof v === 'object') {
                for (const [k, x] of Object.entries(v)) walk(x, k, v, depth + 1)
            }
        }
        walk(payloadOf(root))
        return { found, meta }
    }

    // pecah argumen "a|b|c" sesuai fields -> { params } atau { error }
    function parseArgs(spec, raw) {
        const text = String(raw || '').trim()
        const parts = []
        let remain = text

        spec.fields.forEach((f, i) => {
            const isLast = i === spec.fields.length - 1
            if (f.rest && isLast) {
                parts.push(remain.trim())
                remain = ''
                return
            }
            const idx = remain.indexOf('|')
            if (idx === -1) {
                parts.push(remain.trim())
                remain = ''
            } else {
                parts.push(remain.slice(0, idx).trim())
                remain = remain.slice(idx + 1)
            }
        })

        const params = {}
        for (let i = 0; i < spec.fields.length; i++) {
            const f = spec.fields[i]
            let v = parts[i] || ''
            if (!v) {
                if (f.req) return { error: `Bagian *${f.label}* wajib diisi.` }
                v = f.def ? f.def() : ''
            }
            if (f.oneOf && v && !f.oneOf.includes(v.toLowerCase())) {
                return { error: `Bagian *${f.label}* harus salah satu dari: ${f.oneOf.join(', ')}.` }
            }
            params[f.key] = f.oneOf ? v.toLowerCase() : v
        }
        return { params }
    }

    // pesan "Command salah" + format & contoh
    function wrongCommand(name, spec, prefix, reason) {
        const usage = spec.fields.map(f => (f.req ? `<${f.label}>` : `[${f.label}]`)).join('|')
        const optional = spec.fields.filter(f => !f.req).map(f => f.label)

        let t = '*Command salah!*\n'
        if (reason) t += `${reason}\n`
        t += `\n*${spec.title}*\n`
        t += spec.image ? 'Reply / kirim *foto* dengan caption:\n' : 'Cara pakai:\n'
        t += `${prefix}${name}${usage ? ' ' + usage : ''}`
        if (spec.example) t += `\n\n*Contoh:*\n${prefix}${name} ${spec.example}`
        if (spec.quoted) t += `\n\n_Atau reply pesan teks lalu ketik ${prefix}${name}_`
        if (optional.length && !spec.hideOptionalNote) t += `\n\n_Boleh dikosongkan: ${optional.join(', ')}_`
        if (spec.extraHelp) t += `\n\n${spec.extraHelp}`
        return t
    }

    async function callApi(spec, params) {
        const query = Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&')
        const res = await nativeFetch(`${API_HOST}/${spec.path}${query ? '?' + query : ''}`, {
            signal: AbortSignal.timeout(spec.timeout || 120000),
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()

        if (/^(image|video|audio)\//.test(type)) {
            if (!res.ok) throw new Error(`API error ${res.status}`)
            return { type, buf: Buffer.from(await res.arrayBuffer()) }
        }

        const raw = await res.text()
        let json = null
        try { json = JSON.parse(raw) } catch { /* bukan JSON */ }

        if (!res.ok || json?.status === false || json?.success === false) {
            const why = pickText(json?.error) || pickText(json?.message) || `API error ${res.status}`
            throw new Error(why)
        }
        return { type, json, raw }
    }

    async function downloadResult(url) {
        const res = await nativeFetch(url, { signal: AbortSignal.timeout(60000) })
        if (!res.ok) throw new Error(`Gagal unduh hasil (${res.status})`)
        return Buffer.from(await res.arrayBuffer())
    }

    // Susun item kirim untuk hasil bertipe media (video / audio / gambar / file)
    function mediaItems(spec, out, footer) {
        const cap = `*${spec.title}*\n${footer}`

        if (out.buf) {
            if (out.type.startsWith('video/')) return [{ type: 'video', buffer: out.buf, mimetype: 'video/mp4', caption: cap }]
            if (out.type.startsWith('audio/')) return [{ type: 'audio', buffer: out.buf, mimetype: 'audio/mpeg' }]
            return [{ type: 'image', buffer: out.buf, caption: cap }]
        }

        const { found, meta } = collectMedia(out.json)
        const caption = `${meta.title ? `*${meta.title}*\n` : ''}${cap}`

        if (found.video.length) return [{ type: 'video', url: found.video[0], mimetype: 'video/mp4', caption }]
        if (found.audio.length) {
            return [{ type: 'audio', url: found.audio[0], mimetype: 'audio/mpeg', fileName: `${meta.title || spec.title}.mp3` }]
        }
        if (found.image.length) {
            return found.image.slice(0, 10).map((url, i) => ({ type: 'image', url, caption: i === 0 ? caption : '' }))
        }
        if (found.file.length) {
            const link = found.file[0]
            const name = meta.title && /\.[a-z0-9]{2,5}$/i.test(meta.title) ? meta.title : `${meta.title || spec.title.replace(/\W+/g, '_')}`
            const sizeNote = meta.size ? `\nUkuran: ${meta.size}` : ''
            return [{
                type: 'document', url: link, fileName: name, mimetype: 'application/octet-stream',
                caption: `${caption}${sizeNote}`, fallbackText: `${caption}${sizeNote}\n\n${link}`
            }]
        }

        const text = formatAny(out.json)
        if (!text) throw new Error('Respons API tidak berisi media')
        return null
    }

    // Jalankan satu fitur API.
    //   hasil: { usage, failed? }  -> pesan "Command salah" (failed = foto tidak terbaca)
    //          { text }            -> teks siap kirim
    //          { items }           -> daftar media untuk dikirim
    //   error lain dilempar (API down, dsb.)
    async function runApiTool(spec, { rawArgs = '', quotedText = '', hasImage = false, getImage, prefix = '.', onStart } = {}) {
        if (!spec || typeof spec !== 'object') throw new Error('Spec fitur API tidak valid')
        const name = spec.name

        // 1. validasi argumen
        let args = rawArgs
        if (!String(args).trim() && spec.quoted) args = quotedText || ''

        const parsed = parseArgs(spec, args)
        if (parsed.error) {
            const reason = String(args || '').trim() ? parsed.error : ''
            return { usage: wrongCommand(name, spec, prefix, reason) }
        }

        // 2. validasi foto
        if (spec.image && !hasImage) {
            return { usage: wrongCommand(name, spec, prefix, 'Foto belum dikirim — reply atau kirim foto dulu.') }
        }

        // 3. proses
        await onStart?.()
        const params = { ...parsed.params }

        if (spec.image) {
            const buffer = await getImage()
            if (!buffer) {
                return { usage: wrongCommand(name, spec, prefix, 'Foto tidak terbaca, coba kirim ulang.'), failed: true }
            }
            const url = await uploadPone(buffer, `upload-${Date.now()}.jpg`)
            for (const key of spec.image) params[key] = url
        }

        const out = await callApi(spec, params)
        const footer = footerText()

        if (spec.kind === 'image') {
            let buf = out.buf
            if (!buf) {
                const link = pickUrl(out.json)
                if (!link) throw new Error('Respons API tidak berisi gambar')
                buf = await downloadResult(link)
            }
            return { items: [{ type: 'image', buffer: buf, caption: `${spec.title}\n${footer}` }] }
        }

        if (spec.kind === 'media') {
            const items = mediaItems(spec, out, footer)
            if (items) return { items }
            return { text: `*${spec.title}*\n\n${toWhatsApp(formatAny(out.json))}` }
        }

        if (out.buf) throw new Error('Respons API berupa file, bukan teks')
        let text = spec.plain
            ? (pickText(out.json) || (out.json ? null : String(out.raw || '').trim()))
            : (out.json ? formatAny(out.json) : String(out.raw || '').trim())
        if (!text || /^<!doctype html|^<html/i.test(text)) throw new Error('Respons API kosong')
        return { text: `*${spec.title}*\n\n${toWhatsApp(text)}` }
    }

    // Kirim daftar media hasil runApiTool
    async function sendApiItems(sock, jid, items, quoted) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const content = { [item.type]: item.buffer || { url: item.url } }
            if (item.mimetype) content.mimetype = item.mimetype
            if (item.caption && item.type !== 'audio') content.caption = item.caption
            if (item.fileName) content.fileName = item.fileName

            try {
                await sock.sendMessage(jid, content, { quoted })
            } catch (e) {
                if (!item.fallbackText) throw e
                console.error('[API-TOOL] kirim dokumen gagal, kirim link:', e?.message || e)
                await sock.sendMessage(jid, { text: item.fallbackText }, { quoted })
            }
            if (i < items.length - 1) await wait(1500)
        }
    }

    // Alur lengkap satu command fitur API: validasi, reaksi, proses, kirim hasil
    async function handleApiTool(spec, m, { sock, text, prefix }) {
        const image = pickImage(m)
        try {
            const result = await runApiTool(spec, {
                rawArgs: text,
                quotedText: m.quoted?.text || '',
                hasImage: !!image,
                getImage: () => image.download(),
                prefix,
                onStart: () => reactTo(sock, m, '⏳')
            })

            if (result.usage) {
                if (result.failed) await reactTo(sock, m, '❌')
                return m.reply(result.usage)
            }

            if (result.items) await sendApiItems(sock, m.chat, result.items, m)
            else await m.reply(result.text)
            await reactTo(sock, m, '✅')
        } catch (e) {
            console.error('[API-TOOL]', spec.name, e?.message || e)
            await reactTo(sock, m, '❌')
            await m.reply('Gagal memproses. API mungkin sedang down atau data tidak valid, coba lagi nanti.')
        }
    }

    return {
        uploadUguu, uploadPone, upscaleImage,
        tempMailCreate, tempMailInbox, tempMailRead,
        identifyAudio, webScreenshot, webRecord,
        fetchAny,
        popcatBlur, runApiTool, sendApiItems, handleApiTool
    }
})()

export const {
    uploadUguu, uploadPone, upscaleImage,
    tempMailCreate, tempMailInbox, tempMailRead,
    identifyAudio, webScreenshot, webRecord,
    fetchAny,
    popcatBlur, runApiTool, sendApiItems, handleApiTool
} = _tools


// ╔══════════════ [ dataid.js ] ══════════════╗

// ───────── dataid ─────────
// Helper bersama fitur data Indonesia: cekgempa, jadwalsholat, kodewilayah, cuaca, cekresi,
// kurs, harilibur. Error jaringan dijadikan pesan ramah (FriendlyError), bukan crash.

const _dataid = (() => {
    const nativeFetch = globalThis.fetch

    // Helper bersama untuk fitur data Indonesia (cekgempa, cuaca, kodewilayah, kurs, dll).
    // Semua fungsi di sini aman dipakai: error jaringan dijadikan pesan yang ramah, bukan crash.

    const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

    // Error yang pesannya aman ditampilkan langsung ke pengguna
    class FriendlyError extends Error {
        constructor(message, status) {
            super(message)
            this.name = 'FriendlyError'
            this.status = status
        }
    }

    async function fetchJSON(url, { timeout = 15000, headers = {} } = {}) {
        let res
        try {
            res = await nativeFetch(url, {
                headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
                signal: AbortSignal.timeout(timeout)
            })
        } catch (e) {
            throw new FriendlyError(
                e?.name === 'TimeoutError' || e?.name === 'AbortError'
                    ? 'Server data terlalu lama merespons, coba lagi nanti.'
                    : 'Tidak bisa terhubung ke server data, coba lagi nanti.'
            )
        }
        if (!res.ok) throw new FriendlyError(`Server data mengembalikan HTTP ${res.status}.`, res.status)
        try {
            return await res.json()
        } catch {
            throw new FriendlyError('Respons server data tidak valid, coba lagi nanti.')
        }
    }

    // Cache sederhana di memori: { key -> { at, value } }
    const store = new Map()
    async function cached(key, ttl, loader) {
        const hit = store.get(key)
        if (hit && Date.now() - hit.at < ttl) return hit.value
        const value = await loader()
        store.set(key, { at: Date.now(), value })
        return value
    }
    const peekCache = (key) => store.get(key)?.value

    // Bungkus handler supaya semua error ditangani rapi
    const guard = (fn) => async (m, ctx) => {
        try {
            return await fn(m, ctx)
        } catch (e) {
            if (e instanceof FriendlyError) return ctx.reply(`[ ! ] ${e.message}`)
            console.error(e)
            return ctx.reply('[ ! ] Terjadi kesalahan saat mengambil data, coba lagi nanti.')
        }
    }

    // ───────── tanggal (WIB) ─────────
    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

    // { y, m, d } untuk saat ini di zona WIB
    function nowWib() {
        const t = new Date(Date.now() + 7 * 3600 * 1000)
        return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
    }

    const pad = (n) => String(n).padStart(2, '0')

    // ───────── teks ─────────
    function titleCase(str = '') {
        const keep = new Set(['DKI', 'DI', 'NTB', 'NTT', 'TNI', 'RI'])
        return String(str)
            .toLowerCase()
            .replace(/(^|[\s.(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
            .split(/(\s+)/)
            .map(w => (keep.has(w.toUpperCase()) ? w.toUpperCase() : w))
            .join('')
    }

    const norm = (str = '') =>
        String(str)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\bkabupaten\b|\bkab\b\.?/g, 'kab')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()

    // ───────── data wilayah (kode Kemendagri, format 31.71.03.1001) ─────────
    // Sumber utama wilayah.id, cadangan api.datawilayah.com. Keduanya file statis di CDN.
    const SOURCES = [
        {
            base: 'https://wilayah.id/api',
            prov: () => 'provinces.json',
            reg: (c) => `regencies/${c}.json`,
            dis: (c) => `districts/${c}.json`,
            vil: (c) => `villages/${c}.json`
        },
        {
            base: 'https://api.datawilayah.com/api',
            prov: () => 'provinsi.json',
            reg: (c) => `kabupaten_kota/${c}.json`,
            dis: (c) => `kecamatan/${c}.json`,
            vil: (c) => `desa_kelurahan/${c}.json`
        }
    ]

    const DAY = 24 * 3600 * 1000

    function rows(json) {
        const list = Array.isArray(json) ? json : (json?.data || json?.result || json?.results || [])
        if (!Array.isArray(list)) return []
        return list
            .map(x => ({
                code: String(x?.code ?? x?.kode_wilayah ?? x?.kode ?? x?.id ?? '').trim(),
                name: String(x?.name ?? x?.nama ?? x?.nama_wilayah ?? '').trim()
            }))
            .filter(x => x.code && x.name)
    }

    async function level(kind, code) {
        return cached(`wilayah:${kind}:${code ?? ''}`, DAY, async () => {
            let lastError
            for (const src of SOURCES) {
                try {
                    const list = rows(await fetchJSON(`${src.base}/${src[kind](code)}`))
                    if (list.length) return list
                } catch (e) {
                    lastError = e
                }
            }
            if (lastError?.status === 404) return []
            throw new FriendlyError('Data wilayah belum bisa diambil, coba lagi nanti.')
        })
    }

    const getProvinces = () => level('prov')
    const getRegencies = (provCode) => level('reg', provCode)
    const getDistricts = (regCode) => level('dis', regCode)
    const getVillages = (disCode) => level('vil', disCode)

    // seluruh kabupaten/kota se-Indonesia (diambil per provinsi, di-cache 24 jam)
    async function getAllRegencies() {
        return cached('wilayah:allreg', DAY, async () => {
            const provs = await getProvinces()
            const lists = await Promise.all(provs.map(p => getRegencies(p.code).catch(() => [])))
            const all = lists.flat()
            if (!all.length) throw new FriendlyError('Data wilayah belum bisa diambil, coba lagi nanti.')
            return all
        })
    }

    // Cari item berdasarkan nama. Mengembalikan daftar terurut dari yang paling cocok.
    // "kota bogor" hanya cocok dengan KOTA BOGOR, "kab bogor" hanya dengan KAB. BOGOR.
    function matchByName(items, query) {
        const q = norm(query)
        if (!q) return []
        const PREFIX = new Set(['kab', 'kota', 'adm'])
        const qTokens = q.split(' ')
        const wantPrefix = qTokens.filter(t => PREFIX.has(t))
        const qCore = qTokens.filter(t => !PREFIX.has(t)).join(' ')
        if (!qCore) return []

        const out = []
        for (const item of items) {
            const n = norm(item.name)
            const tokens = n.split(' ')
            if (wantPrefix.length && !wantPrefix.every(p => tokens.includes(p))) continue
            const core = tokens.filter(t => !PREFIX.has(t)).join(' ')
            let score = 0
            if (core === qCore) score = 3
            else if (core.startsWith(qCore)) score = 2
            else if (qCore.split(' ').every(t => core.includes(t))) score = 1
            if (score) out.push({ item, score })
        }
        return out.sort((a, b) => b.score - a.score).map(x => x.item)
    }

    // hasil terbaik; kalau ada beberapa yang sama bagusnya (mis. "bogor") kembalikan semuanya
    function bestMatches(items, query) {
        const found = matchByName(items, query)
        if (!found.length) return []
        const q = norm(query).split(' ').filter(t => !['kab', 'kota', 'adm'].includes(t)).join(' ')
        const exact = found.filter(x => norm(x.name).split(' ').filter(t => !['kab', 'kota', 'adm'].includes(t)).join(' ') === q)
        return exact.length ? exact : found
    }

    return {
        FriendlyError,
    fetchJSON,
    cached,
    peekCache,
    guard,
    HARI,
    BULAN,
    nowWib,
    pad,
    titleCase,
    norm,
    getProvinces,
    getRegencies,
    getDistricts,
    getVillages,
    getAllRegencies,
    matchByName,
    bestMatches
    }
})()

export const {
    FriendlyError,
    fetchJSON,
    cached,
    peekCache,
    guard,
    HARI,
    BULAN,
    nowWib,
    pad,
    titleCase,
    norm,
    getProvinces,
    getRegencies,
    getDistricts,
    getVillages,
    getAllRegencies,
    matchByName,
    bestMatches
} = _dataid

rbDefineLib('cekbio', async ({ rbLib }) => {
  const fs = (__m => __m.default ?? __m)((await import('node:fs')))

  function getJamPercentage(bioData, setAt, isBusiness) {
    let score = 50
    if (bioData) score += 20
    if (setAt) score += 15
    if (isBusiness) score += 15
    return Math.min(100, score)
  }

  function createProgressBar(current, total) {
    const percent = total > 0 ? Math.floor((current / total) * 10) : 0
    const pctNum = total > 0 ? Math.floor((current / total) * 100) : 0
    return '█'.repeat(percent) + '░'.repeat(Math.max(0, 10 - percent)) + ` ${pctNum}%`
  }

  async function checkMetaBusiness(conn, jid) {
    try {
      const profile = await conn.getBusinessProfile?.(jid).catch(() => null)
      return { isBusiness: Boolean(profile) }
    } catch {
      return { isBusiness: false }
    }
  }

  function createBioResultFile(results, total, source) {
    const tmpPath = `/tmp/cekbio_${Date.now()}.txt`
    const text = (results || []).map(r => `${r.number} | ${r.status || r.bio || '-'}`).join('\n')
    fs.writeFileSync(tmpPath, text, 'utf8')
    return tmpPath
  }

  async function parseNumbersFromBuffer(buffer, fileName = '') {
    try {
      const text = buffer.toString('utf8')
      const matches = text.match(/\b\d{10,15}\b/g)
      return matches ? Array.from(new Set(matches)) : []
    } catch {
      return []
    }
  }

  const __default = {
    getJamPercentage,
    createProgressBar,
    checkMetaBusiness,
    createBioResultFile,
    parseNumbersFromBuffer
  }
  return { getJamPercentage, createProgressBar, checkMetaBusiness, createBioResultFile, parseNumbersFromBuffer, default: __default }
})

rbDefineLib('helperbails', async () => {
  const baileys = await import('@whiskeysockets/baileys')
  // Kaguya tidak punya kelas tombol/carousel khusus; send() melempar error supaya fallback pesan biasa dipakai
  class Button {
    constructor() {}
    setBody() { return this } setFooter() { return this } setTitle() { return this } setDocument() { return this }
    addCopy() { return this } addUrl() { return this } addCard() { return this }
    async send() { throw new Error('tombol khusus tidak tersedia') }
  }
  return { ...baileys, Button, ButtonV2: Button, Carousel: Button, AIRich: undefined, default: (sock) => sock }
})


// ╔══════════════ [ netguard.js ] ══════════════╗

// fetch aman anti-SSRF: hanya alamat publik, redirect dicek ulang, ukuran dibatasi
export const netguard = (() => {
  const dns = _ngDns, http = _ngHttp, https = _ngHttps, net = _ngNet
  // Pengambil URL yang aman dari SSRF — dipakai .cekweb .geturl .sumberweb .cekssl
  //   • hanya http/https, port bebas tetapi alamat tujuan HARUS publik (loopback, LAN, link-local, CGNAT, metadata cloud diblokir)
  //   • pengecekan dilakukan di level `lookup` DNS, jadi redirect & DNS-rebinding ikut terjaga (bukan sekadar cek hostname)
  //   • redirect diikuti manual (maks 5) dan tiap lompatan diperiksa ulang
  //   • ukuran dibatasi: lewat batas → error (atau dipotong bila truncate:true)
  // Hanya memakai modul bawaan Node (tanpa axios), sehingga bisa diuji lokal.

  const UA = 'Mozilla/5.0 (compatible; KaguyaBot/1.0; +https://whatsapp.com)'
  let _allowPrivate = false                       // HANYA untuk skrip uji (server lokal). Jangan dipanggil dari plugin.
  const _testAllowPrivate = (v) => { _allowPrivate = !!v }

  function isPrivateIp(ip) {
    ip = String(ip || '').toLowerCase()
    if (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7))) ip = ip.slice(7)
    if (net.isIPv4(ip)) {
      const [a, b] = ip.split('.').map(Number)
      return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19))
    }
    if (net.isIPv6(ip)) return ip === '::' || ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith('ff')
    return true                                    // bukan IP valid → tolak
  }

  // lookup khusus: tolak jika SALAH SATU alamat hasil DNS bersifat privat
  function guardedLookup(host, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    dns.lookup(host, { all: true, verbatim: true }, (err, addrs) => {
      if (err) return cb(err)
      if (!_allowPrivate && addrs.some(a => isPrivateIp(a.address))) return cb(Object.assign(new Error('alamat tujuan privat/internal diblokir'), { code: 'EBLOCKED' }))
      if (opts && opts.all) return cb(null, addrs)
      cb(null, addrs[0].address, addrs[0].family)
    })
  }

  // normalisasi + validasi awal. Mengembalikan URL atau null.
  function parseUrl(u) {
    try {
      u = String(u || '').trim().replace(/[<>]/g, '')
      const x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u)
      if (!/^https?:$/.test(x.protocol) || x.username || x.password) return null
      if (net.isIP(x.hostname.replace(/^\[|\]$/g, ''))) { if (!_allowPrivate && isPrivateIp(x.hostname.replace(/^\[|\]$/g, ''))) return null }
      else if (!x.hostname.includes('.') && !_allowPrivate) return null
      if (!_allowPrivate && /\.(local|internal|localhost|lan)$/i.test(x.hostname)) return null
      return x
    } catch { return null }
  }

  function once(url, { method, headers, timeout, maxBytes, truncate }) {
    return new Promise((resolve, reject) => {
      const lib = url.protocol === 'https:' ? https : http
      const req = lib.request(url, { method, headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Encoding': 'identity', ...headers }, lookup: guardedLookup, timeout }, (res) => {
        const out = { status: res.statusCode, headers: res.headers, chunks: [], bytes: 0, truncated: false }
        if (method === 'HEAD' || (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)) { res.resume(); return resolve({ ...out, buffer: Buffer.alloc(0) }) }
        const declared = Number(res.headers['content-length'] || 0)
        if (!truncate && declared > maxBytes) { res.destroy(); return reject(Object.assign(new Error('file terlalu besar'), { code: 'ETOOBIG', size: declared })) }
        res.on('data', (c) => {
          out.bytes += c.length
          if (out.bytes > maxBytes) {
            if (!truncate) { res.destroy(); return reject(Object.assign(new Error('file terlalu besar'), { code: 'ETOOBIG', size: out.bytes })) }
            out.chunks.push(c.subarray(0, c.length - (out.bytes - maxBytes))); out.bytes = maxBytes; out.truncated = true; res.destroy(); return resolve({ ...out, buffer: Buffer.concat(out.chunks) })
          }
          out.chunks.push(c)
        })
        res.on('end', () => resolve({ ...out, buffer: Buffer.concat(out.chunks) }))
        res.on('error', (e) => { if (out.truncated) return; reject(e) })
        res.on('close', () => { if (out.truncated) resolve({ ...out, buffer: Buffer.concat(out.chunks) }) })
      })
      req.on('timeout', () => req.destroy(Object.assign(new Error('waktu habis'), { code: 'ETIMEDOUT' })))
      req.on('error', reject)
      req.end()
    })
  }

  // safeFetch(url, { method, headers, timeout, maxBytes, truncate, maxRedirects })
  //  → { status, headers, buffer, bytes, truncated, url (akhir), chain:[{url,status}], ms }
  async function safeFetch(input, o = {}) {
    const opt = { method: o.method || 'GET', headers: o.headers || {}, timeout: o.timeout || 20000, maxBytes: o.maxBytes || 5 * 1024 * 1024, truncate: !!o.truncate }
    let url = parseUrl(input); if (!url) throw Object.assign(new Error('URL tidak valid atau mengarah ke alamat internal'), { code: 'EBADURL' })
    const chain = [], t0 = Date.now(), max = o.maxRedirects == null ? 5 : o.maxRedirects
    for (let i = 0; i <= max; i++) {
      const r = await once(url, opt)
      chain.push({ url: url.href, status: r.status })
      if (r.status >= 300 && r.status < 400 && r.headers.location) {
        let next; try { next = new URL(r.headers.location, url) } catch { throw new Error('redirect tidak valid') }
        const ok = parseUrl(next.href); if (!ok) throw Object.assign(new Error('redirect ke alamat tidak diizinkan'), { code: 'EBADURL' })
        url = ok; continue
      }
      return { ...r, url: url.href, chain, ms: Date.now() - t0 }
    }
    throw new Error('terlalu banyak redirect')
  }

  const fileNameOf = (res) => {
    const cd = String(res.headers['content-disposition'] || '')
    let n = (cd.match(/filename\*=UTF-8''([^;]+)/i) || [])[1]; if (n) { try { n = decodeURIComponent(n) } catch {} }
    n = n || (cd.match(/filename="?([^";]+)"?/i) || [])[1]
    if (!n) { try { n = decodeURIComponent(new URL(res.url).pathname.split('/').filter(Boolean).pop() || '') } catch { n = '' } }
    n = String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').slice(0, 100)
    return n || 'file'
  }

  return { safeFetch, parseUrl, isPrivateIp, fileNameOf, guardedLookup, UA, _testAllowPrivate }
})()
// cek apakah IP privat/lokal (diblokir)
export const isPrivateIp = netguard.isPrivateIp


// ╔══════════════ [ pdfmini.js ] ══════════════╗

// pembuat PDF sederhana tanpa library
const pdfmini = (() => {
  // PDF minimal tanpa dependensi: halaman gambar (JPEG) dan halaman teks (Helvetica). A4 = 595x842 pt.
  const W = 595, H = 842, M = 50
  // lebar glif Helvetica (AFM) untuk ASCII 32..126, per 1000 unit
  const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584]
  // teks -> byte WinAnsi (Latin-1 cukup untuk Indonesia/Eropa); sisanya jadi "?"
  const latin = (s) => Array.from(String(s).normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\t/g, '    ').replace(/[•●]/g, '*')).map(c => { const k = c.codePointAt(0); return k >= 32 && k < 127 ? c : k >= 160 && k <= 255 ? c : '?' }).join('')
  const cw = (ch) => { const k = ch.charCodeAt(0); return k >= 32 && k < 127 ? HW[k - 32] : 556 }
  const strW = (s, size) => Array.from(s).reduce((n, c) => n + cw(c), 0) * size / 1000
  function wrap(text, size, maxW) {
    const out = []
    for (const para0 of String(text).replace(/\r/g, '').split('\n')) {
      const para = latin(para0)
      if (!para.trim()) { out.push(''); continue }
      let line = ''
      for (const word of para.split(/ +/)) {
        let w = word
        while (strW(w, size) > maxW) { // kata super panjang: potong
          let i = w.length; while (i > 1 && strW(w.slice(0, i), size) > maxW) i--
          if (line) { out.push(line); line = '' } out.push(w.slice(0, i)); w = w.slice(i)
        }
        const t = line ? line + ' ' + w : w
        if (strW(t, size) <= maxW) line = t; else { out.push(line); line = w }
      }
      out.push(line)
    }
    return out
  }
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  // pages: [{ jpeg:Buffer, w, h } | { text:string, title? }]
  function build(pages, opts = {}) {
    const size = opts.size || 12, lead = size * 1.4, objs = []   // objs[i] = Buffer (isi objek nomor i+1)
    const add = (b) => { objs.push(Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1')); return objs.length }
    add('')  // 1 = catalog (diisi akhir), 2 = pages (diisi akhir)
    add('')
    const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    const fontB = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    const kids = []
    const addPage = (content, res) => {
      const c = add(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]))
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${c} 0 R /Resources ${res} >>`))
    }
    for (const p of pages) {
      if (p.jpeg) {
        const img = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`), p.jpeg, Buffer.from('\nendstream')]))
        const k = Math.min((W - 2 * 30) / p.w, (H - 2 * 30) / p.h), dw = p.w * k, dh = p.h * k, x = (W - dw) / 2, y = (H - dh) / 2
        addPage(Buffer.from(`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`), `<< /XObject << /Im0 ${img} 0 R >> >>`)
      } else {
        const lines = wrap(p.text, size, W - 2 * M), per = Math.floor((H - 2 * M) / lead), res = `<< /Font << /F1 ${font} 0 R /F2 ${fontB} 0 R >> >>`
        let i = 0, first = true
        do {
          const hasTitle = first && p.title, n = per - (hasTitle ? 2 : 0), chunk = lines.slice(i, i + Math.max(1, n))
          let s = 'BT\n', y = H - M - size
          if (hasTitle) { s += `/F2 ${size + 6} Tf 1 0 0 1 ${M} ${y} Tm (${esc(latin(p.title))}) Tj\n`; y -= lead * 2 }
          s += `/F1 ${size} Tf ${lead.toFixed(2)} TL 1 0 0 1 ${M} ${y.toFixed(2)} Tm\n`
          chunk.forEach((l, j) => { s += (j ? 'T* ' : '') + `(${esc(l)}) Tj\n` })
          addPage(Buffer.from(s + 'ET', 'latin1'), res); i += chunk.length; first = false
        } while (i < lines.length)
      }
    }
    objs[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>')
    objs[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`)
    const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')], offs = []; let pos = parts[0].length
    objs.forEach((b, i) => { offs.push(pos); const o = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), b, Buffer.from('\nendobj\n')]); parts.push(o); pos += o.length })
    let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')
    x += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`
    parts.push(Buffer.from(x)); return Buffer.concat(parts)
  }

  return { build, wrap, latin }
})()


// ╔══════════════ [ Instagram JH ] ══════════════╗
/*
- HARGAI WOY JANGAN DIHAPUS!
- Skrep by *JH a.k.a DHIKA - FIONY BOT*
- Credits to all Fiony's Bot Admin.
- Maaf kalo kurang maksimal atau berantakan
- Hasil gabut saja xixixi.
*/
// Scraper Instagram: JHFastDL (fastdl.app), JHSssIG (sssinstagram.com), JHICog (instacognito, puppeteer)
// Dipakai oleh plugins/download: igdl, ig3, igaudio, instagramdl

const IGJH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

// ───────── helper input (URL / username) ─────────
export function resolveIgTarget(rawInput) {
  const raw = String(rawInput || '').trim()
  let targetUrl = raw.match(/https?:\/\/(www\.)?instagram\.com[^\s]+/i)?.[0]
  if (!targetUrl) {
    const cleanUsername = raw.replace(/^@/, '').split(/[\/?#\s]/)[0]
    if (!cleanUsername) return ''
    targetUrl = `https://www.instagram.com/stories/${cleanUsername}/`
  } else if (targetUrl.includes('/stories/')) {
    const storyMatch = targetUrl.match(/\/stories\/([^\/?#]+)/)
    if (storyMatch) targetUrl = `https://www.instagram.com/stories/${storyMatch[1]}/`
  }
  return targetUrl
}

// ───────── pabrik downloader (FastDL & SssInstagram punya alur sama) ─────────
function makeSignatureDownloader({ host, sitekey, defaultChunk }) {
  const BASE = `https://${host}`
  const API = `https://api-wh.${host}`
  const jantung = {
    'User-Agent': IGJH_UA,
    'Accept': 'application/json, text/plain, */*',
    'Origin': BASE,
    'Referer': BASE + '/'
  }

  const resolveCaptcha = async () => {
    const { data: createTask } = await axios.post('https://cap.jhx.my.id/api/createTask', { url: BASE + '/', type: 'turnstile-min', sitekey })
    if (!createTask.success) throw new Error('Gagal membuat task captcha')
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const { data: checkTask } = await axios.post('https://cap.jhx.my.id/api/getResult', { jobId: createTask.jobId })
      if (checkTask.status === 'ready' && checkTask.solution?.token) return checkTask.solution.token
      if (checkTask.status === 'failed') throw new Error('Solver gagal menyelesaikan captcha')
    }
    throw new Error('Timeout menunggu hasil captcha')
  }

  const getSignatureFunction = async () => {
    let chunkId = defaultChunk
    try {
      const { data: mainHtml } = await axios.get(BASE + '/', { headers: jantung })
      const appId = mainHtml.match(/\/js\/app\.js\?id=([a-zA-Z0-9]+)/)?.[1]
      if (appId) {
        const { data: appJs } = await axios.get(`${BASE}/js/app.js?id=${appId}`, { headers: jantung })
        chunkId = appJs.match(/54:\s*"([a-zA-Z0-9]+)"/)?.[1] || chunkId
      }
    } catch {}

    const { data: chunkCode } = await axios.get(`${BASE}/js/link.chunk.js?ch=${chunkId}`, { headers: jantung })

    const contextObj = { crypto: _igjhWebcrypto, fetch: async () => ({ json: async () => ({ msec: Date.now() / 1000 }) }), atob, btoa, TextDecoder, TextEncoder, Uint8Array, Array, String, Number, RegExp, Set, Error, TypeError, Promise, isNaN, parseInt, Date, Math, JSON, setTimeout: (f, t) => setTimeout(f, t), setInterval: (f, t) => setInterval(f, t), clearTimeout, clearInterval }
    contextObj.window = contextObj.self = contextObj.globalThis = contextObj.top = contextObj.document = contextObj.location = contextObj.navigator = contextObj
    contextObj.href = BASE + '/'; contextObj.hostname = host; contextObj.userAgent = jantung['User-Agent']; contextObj.webpackChunk = []

    _igjhCreateContext(contextObj); _igjhRunInContext(chunkCode, contextObj)

    const webpackEngine = contextObj.webpackChunk?.[0]?.[1]
    if (!webpackEngine) throw new Error('Gagal memuat modul Webpack')

    const moduleCache = {}
    const requireModule = (id) => {
      if (moduleCache[id]) return moduleCache[id].exports
      const mod = { exports: {} }; moduleCache[id] = mod
      webpackEngine[id](mod, mod.exports, requireModule); return mod.exports
    }
    requireModule.d = (exports, def) => Object.keys(def).forEach(k => !Object.prototype.hasOwnProperty.call(exports, k) && Object.defineProperty(exports, k, { enumerable: true, get: def[k] }))
    requireModule.r = (exports) => { Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' }); Object.defineProperty(exports, '__esModule', { value: true }) }

    const targetModule = requireModule(7027)
    return targetModule.default || targetModule
  }

  // return: { author, caption, media: [{ type: 'Video'|'Image', url }] } (throw kalau gagal)
  return async function download(rawInput) {
    const targetUrl = resolveIgTarget(rawInput)
    if (!targetUrl || !targetUrl.includes('instagram.com')) throw new Error('URL Instagram tidak valid')

    const isStory = targetUrl.includes('/stories/')
    const apiEndpoint = isStory ? `${API}/api/v1/instagram/story` : `${API}/api/convert`

    const generateSignature = await getSignatureFunction()
    const requestPayload = await generateSignature(isStory ? { url: targetUrl } : { target_url: targetUrl })

    let captchaToken = await resolveCaptcha()
    const exchangeToken = async (token) => {
      const { data } = await axios.post(`${API}/api/cf`, `cfToken=${encodeURIComponent(token)}`, { headers: { ...jantung, 'Content-Type': 'application/x-www-form-urlencoded' } })
      if (!data.result) throw new Error('Gagal menukar token captcha')
      return data.result
    }

    let webhookToken = await exchangeToken(captchaToken)
    const fetchMedia = async (token) => axios.post(apiEndpoint, requestPayload, { headers: { ...jantung, 'Content-Type': 'application/json', 'wh-cf-token': token }, validateStatus: () => true })

    let apiResponse = await fetchMedia(webhookToken)
    if (apiResponse.status === 422 || apiResponse.data?.code === 'CAPTCHA_REQUIRED') {
      captchaToken = await resolveCaptcha()
      webhookToken = await exchangeToken(captchaToken)
      apiResponse = await fetchMedia(webhookToken)
    }

    const responseData = isStory ? apiResponse.data?.result : apiResponse.data
    if (!Array.isArray(responseData) || responseData.length === 0) throw new Error(apiResponse.data?.message || 'Server menolak permintaan atau data media tidak ditemukan')

    const metadata = {
      author: isStory ? (responseData[0].user?.username || 'unknown') : (responseData[0].meta?.username || 'unknown'),
      caption: isStory ? '' : (responseData[0].meta?.title || '')
    }

    const mediaList = []
    responseData.forEach(item => {
      if (isStory) {
        const videos = item.video_versions || []
        const images = item.image_versions2?.candidates || []
        if (videos.length) mediaList.push({ type: 'Video', url: videos[0].url_wrapped || videos[0].url })
        else if (images.length) mediaList.push({ type: 'Image', url: images[0].url_wrapped || images[0].url })
      } else {
        const assets = Array.isArray(item.url) ? item.url : []
        assets.forEach(asset => {
          const typeLabel = (asset.type === 'mp4' || asset.ext === 'mp4') ? 'Video' : 'Image'
          mediaList.push({ type: typeLabel, url: asset.url })
        })
      }
    })

    if (!mediaList.length) throw new Error('Media tidak ditemukan')
    return { author: metadata.author, caption: metadata.caption, media: mediaList }
  }
}

// JHFastDL  -> fastdl.app
export const JHFastDL = makeSignatureDownloader({ host: 'fastdl.app', sitekey: '0x4AAAAAABhLwGG2XCb7fE2M', defaultChunk: 'd29415e56f2dc09c' })
// JHSssIG   -> sssinstagram.com
export const JHSssIG = makeSignatureDownloader({ host: 'sssinstagram.com', sitekey: '0x4AAAAAABidZPD0BFP2LVxa', defaultChunk: 'a8161cb908c227fb' })

// JHIgExport -> igexport.com (tanpa captcha, cepat). Hanya link post / reel / tv (story & username tidak didukung).
// return sama seperti FastDL/SssIG: { author, caption, media: [{ type: 'Video'|'Image', url }] }
export async function JHIgExport(rawInput) {
  const BASE = 'https://igexport.com'
  const found = resolveIgTarget(rawInput).match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/[a-zA-Z0-9_\-.]+/i)
  if (!found) throw new Error('igexport hanya mendukung link post / reel')
  const url = found[0]
  const isReel = /\/(?:reel|reels|tv)\//i.test(url)

  const { data } = await axios.get(`${BASE}/api/${isReel ? 'ig-reels' : 'ig-photo'}/?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': IGJH_UA, 'Accept': 'application/json', 'Referer': `${BASE}/id/video-download/` },
    timeout: 30000
  })
  if (!data?.ok) throw new Error('Media Instagram tidak ditemukan atau akun bersifat privat')

  const media = isReel
    ? (data.media?.videoUrl ? [{ type: 'Video', url: data.media.videoUrl }] : [])
    : (data.media?.items || []).filter(i => i?.url).map(i => ({ type: i.type === 'video' ? 'Video' : 'Image', url: i.url }))
  if (!media.length) throw new Error('Media tidak ditemukan')
  return { author: 'unknown', caption: '', media }
}

// Urutan default: igexport (cepat, tanpa captcha) -> FastDL -> SssInstagram. first = 'sss' -> SssIG dulu (dipakai ig3).
// Story / username otomatis melewati igexport. Error yang ditampilkan = error server terakhir yang dicoba.
export async function igDownloadAuto(rawInput, first = 'fastdl') {
  const order = first === 'sss' ? [JHSssIG, JHFastDL, JHIgExport] : [JHIgExport, JHFastDL, JHSssIG]
  let lastErr, igxErr
  for (const fn of order) {
    try { return await fn(rawInput) } catch (e) { if (fn === JHIgExport) igxErr = e; else lastErr = e }
  }
  throw lastErr || igxErr || new Error('Semua server gagal')
}

// ───────── JHICog -> instacognito.com (puppeteer, mode: profile/posts/reels/stories/highlights/highlightstories) ─────────
export async function JHICog(mode, username, extraId) {
  const pupMod = await import('puppeteer')
  const puppeteer = pupMod.default ? pupMod.default : pupMod

  const baseRes = { status: true, author_skrep: 'JH a.k.a Dhika', kesayangan: 'Fiony Alveria♡', data: {} }

  const pick = (...vals) => {
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] !== undefined && vals[i] !== null && vals[i] !== '') return vals[i]
    }
    return ''
  }

  const BASE = 'https://instacognito.com'
  const PAGE_URL = `${BASE}/en/story-viewer`

  const mediaUrl = (id) => {
    const cId = pick(id, '')
    return cId !== '' ? `${BASE}/media?id=${encodeURIComponent(String(cId).split('').reverse().join(''))}` : ''
  }

  const fmtMedia = (m) => ({
    posted: pick(m.pd, 0),
    caption: pick(m.c, ''),
    likes: pick(m.lc, 0),
    comments: pick(m.cc, 0),
    image_url: mediaUrl(m.iu),
    video_url: mediaUrl(m.vu),
    image_hd_url: mediaUrl(m.hu),
    video_hd_url: mediaUrl(m.vhu)
  })

  const fmtPost = (p) => {
    const baseM = fmtMedia(p)
    baseM.carousel = (p.om ? p.om : []).map(fmtMedia)
    return baseM
  }

  const fmtStory = (s) => ({
    posted: pick(s.pd, 0),
    image_url: mediaUrl(s.iu),
    video_url: mediaUrl(s.vu),
    mentions: pick(s.m, s.mentions, s.mu, [])
  })

  let browser = null
  let page = null

  try {
    const cleanMode = String(pick(mode, '')).toLowerCase()
    const cleanUser = String(pick(username, '')).replace(/^@/, '')

    if (cleanMode === '') throw new Error('Mode tidak boleh kosong (profile, posts, reels, stories, highlights, highlightstories)')
    if (cleanUser === '') throw new Error('Username tidak boleh kosong')

    browser = await puppeteer.launch({
      headless: 'new',
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--window-size=1280,800']
    })

    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    const rawUa = await browser.userAgent()
    await page.setUserAgent(rawUa.replace('HeadlessChrome', 'Chrome'))
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })

    let cfAttempts = 0
    let cfPassed = false
    while (!cfPassed && cfAttempts < 40) {
      const lowTitle = (await page.title()).toLowerCase()
      if (!lowTitle.includes('just a moment') && !lowTitle.includes('attention required')) {
        cfPassed = true
        break
      }

      const targetFrame = page.frames().find(f => f.url().includes('challenges.cloudflare.com')) || null
      if (targetFrame) {
        try {
          const checkbox = await targetFrame.$('input[type="checkbox"]')
          if (checkbox) {
            await checkbox.click()
          } else {
            const bodyEl = await targetFrame.$('body')
            if (bodyEl) {
              const box = await bodyEl.boundingBox()
              if (box) await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2))
            }
          }
        } catch (e) {}
      }

      await new Promise(r => setTimeout(r, 1500))
      cfAttempts++
    }

    if (!cfPassed) throw new Error('Gagal ngelewatin Cloudflare lek')

    try {
      await page.waitForFunction(() => typeof fetchAsync === 'function', { timeout: 30000 })
    } catch (e) {
      throw new Error('Fungsi internal web (fetchAsync) ga ketemu lek')
    }

    const apiCall = async (apiPath, reqBody) => {
      return await page.evaluate(async (pPath, pBody) => {
        let lastR = null
        for (let i = 0; i < 3; i++) {
          try {
            const r = await fetchAsync(pPath, 'POST', pBody)
            lastR = r
            if (typeof r === 'object' && r !== null && Object.keys(r).length > 0) {
              const errStr = r.e !== undefined && r.e !== null ? r.e : ''
              if (errStr === '' || String(errStr).includes('NO_')) return r
            }
          } catch (e) {
            lastR = { e: 'FETCH_ERROR: ' + (e && e.message ? e.message : '') }
          }
          await new Promise(r => setTimeout(r, 1500))
        }
        return lastR
      }, apiPath, reqBody)
    }

    const errOf = (r, emptyLabel = 'EMPTY_RESPONSE') => {
      if (typeof r !== 'object' || r === null) return emptyLabel
      return r.e !== undefined && r.e !== null ? r.e : ''
    }

    // kembalikan respons kalau OK / NO_ (kosong), lempar error kalau lainnya
    const checked = (r, label) => {
      const e = errOf(r)
      if (typeof r !== 'object' || r === null) throw new Error(`API ${label} error: ${e}`)
      if (e !== '' && !String(e).includes('NO_')) throw new Error(`API ${label} error: ${e}`)
      return r
    }

    const paged = async (apiPath, listKey, pBody) => {
      const r = checked(await apiCall(apiPath, pBody), apiPath)
      return r[listKey] ? r[listKey] : []
    }

    const profileRes = await apiCall('/api/profile', { _u: cleanUser })
    const pErrStr = errOf(profileRes, 'NOT_FOUND')
    if (typeof profileRes !== 'object' || profileRes === null) throw new Error(`Profile error: ${pErrStr}`)
    if (pErrStr !== '') throw new Error(`Profile error: ${pErrStr}`)

    const uData = profileRes.u ? profileRes.u : null
    if (uData === null) throw new Error('Profile error: User data kosong')
    if (uData.ip) throw new Error('Profile error: Akun Private lek')

    const uId = pick(uData.id, '')
    const reqBodyMain = { _ei: uId, _u: cleanUser }
    const finalItems = []

    if (cleanMode === 'profile') {
      finalItems.push({
        id: uId,
        username: cleanUser,
        full_name: pick(uData.fn, ''),
        bio: pick(uData.b, ''),
        posts: pick(uData.mc, 0),
        followers: pick(uData.frc, 0),
        following: pick(uData.fgc, 0),
        is_private: !!uData.ip,
        profile_pic: mediaUrl(uData.pp),
        profile_pic_hd: mediaUrl(uData.hpp)
      })
    } else if (cleanMode === 'posts') {
      for (const p of await paged('/api/posts', 'p', reqBodyMain)) finalItems.push(fmtPost(p))
    } else if (cleanMode === 'reels') {
      for (const r of await paged('/api/reels', 'r', reqBodyMain)) finalItems.push(fmtPost(r))
    } else if (cleanMode === 'stories') {
      const sRes = checked(await apiCall('/api/stories', reqBodyMain), 'stories')
      for (const s of (sRes.s ? sRes.s : [])) finalItems.push(fmtStory(s))
    } else if (cleanMode === 'highlights') {
      const hRes = checked(await apiCall('/api/highlights', reqBodyMain), 'highlights')
      for (const h of (hRes.h ? hRes.h : [])) {
        finalItems.push({ id: pick(h.id, ''), title: pick(h.t, ''), cover_url: mediaUrl(h.iu) })
      }
    } else if (cleanMode === 'highlightstories') {
      const cleanExId = pick(extraId, '')
      if (cleanExId === '') throw new Error('Highlight ID ga boleh kosong buat mode ini lek')
      const hsRes = checked(await apiCall('/api/highlightStories', { _ei: cleanExId, _u: cleanUser }), 'highlightStories')
      for (const s of (hsRes.hs ? hsRes.hs : [])) finalItems.push(fmtStory(s))
    } else {
      throw new Error('Mode tidak dikenali lek (profile, posts, reels, stories, highlights, highlightstories)')
    }

    baseRes.data.mode = cleanMode
    baseRes.data.username = cleanUser
    baseRes.data.user_id = uId
    baseRes.data.total_items = finalItems.length
    baseRes.data.items = finalItems

    await browser.close()
    browser = null
    return baseRes
  } catch (error) {
    if (browser !== null) await browser.close().catch(() => {})
    baseRes.status = false
    baseRes.error = pick(error.message, 'Unknown Error')
    baseRes.data = null
    return baseRes
  }
}

// ╔══════════════ [ Premku API ] ══════════════╗
// Helper bersama untuk plugins/premku/* (https://premku.com/api/).
// API key: global.premku.apiKey di config.js (atau env PREMKU_API_KEY).
// Hanya invoice yang disimpan di database/premku.json, akun hasil order TIDAK disimpan.

const _PK_DB_FILE = path.join(process.cwd(), 'database', 'premku.json')
const _PK_STATUS_ICON = { pending: '⏳', success: '✅', paid: '✅', expired: '⌛', canceled: '❌', cancelled: '❌', failed: '❌' }
const _PK_MAX_INLINE = 15
let _pkProductCache = { at: 0, list: [] }

function _pkLoadDb() {
  try {
    const d = JSON.parse(fs.readFileSync(_PK_DB_FILE, 'utf8'))
    return { history: d.history || [], deposits: d.deposits || [] }
  } catch {
    return { history: [], deposits: [] }
  }
}
function _pkSaveDb(db) {
  fs.mkdirSync(path.dirname(_PK_DB_FILE), { recursive: true })
  fs.writeFileSync(_PK_DB_FILE, JSON.stringify(db, null, 2))
}
function _pkKey() {
  const k = process.env.PREMKU_API_KEY || global.premku?.apiKey || ''
  return /^YOUR-/i.test(k) ? '' : String(k).trim()
}

export const premku = {
  hasKey: () => !!_pkKey(),
  rp: (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID'),
  cut: (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s },
  when: (t = Date.now()) => new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }),
  quick: (text, id) => ({ type: 'reply', text, id }),
  copy: (text, code) => ({ type: 'copy', text, code: String(code) }),
  icon: (s) => _PK_STATUS_ICON[String(s || '').toLowerCase()] || '🔹',
  isAvailable: (x) => String(x?.status).toLowerCase() === 'available' && Number(x?.stock) > 0,
  loadDb: _pkLoadDb,
  saveDb: _pkSaveDb,

  // POST ke endpoint Premku; lempar Error (pesan dari API) kalau success=false
  async api(endpoint, body = {}) {
    const key = _pkKey()
    if (!key) throw new Error('API key Premku belum diisi. Owner: isi global.premku.apiKey di config.js lalu restart bot.')
    const base = process.env.PREMKU_BASE || 'https://premku.com/api/'
    let res
    try {
      res = await axios.post(base + endpoint, { api_key: key, ...body }, {
        timeout: 20000,
        validateStatus: () => true,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (e) {
      throw new Error(`Gagal terhubung ke Premku (${e.code || e.message})`)
    }
    const d = res.data
    if (!d || typeof d !== 'object') throw new Error(`Respons Premku tidak valid (HTTP ${res.status})`)
    if (!d.success) throw new Error(d.message || `Permintaan ditolak (HTTP ${res.status})`)
    return d
  },

  async products(force = false) {
    if (!force && Date.now() - _pkProductCache.at < 30_000 && _pkProductCache.list.length) return _pkProductCache.list
    const d = await premku.api('products')
    _pkProductCache = { at: Date.now(), list: Array.isArray(d.products) ? d.products : [] }
    return _pkProductCache.list
  },

  async qr(dataUri, raw) {
    if (typeof dataUri === 'string' && dataUri.startsWith('data:image')) return Buffer.from(dataUri.split(',')[1] || '', 'base64')
    if (raw) return _pkQRCode.toBuffer(String(raw), { width: 512, margin: 2 })
    return null
  },

  // pengirim pesan bertombol (gambar -> tombol saja -> teks biasa)
  ui(m, conn, p) {
    const menuBtn = premku.quick('🏠 Menu Premku', `${p}premku`)
    const sendBtn = async (body, buttons, image) => {
      const base = { text: body, footer: global.nameSaluran || global.namebot || 'Premku', buttons }
      if (image) { try { return await conn.sendButtons(m.chat, { ...base, image }, { quoted: m }) } catch {} }
      try { return await conn.sendButtons(m.chat, base, { quoted: m }) } catch {}
      const extra = buttons.map((b) => (b.type === 'list' ? `▢ ${b.text}` : `▢ ${b.id || b.code || ''} — ${b.text}`)).join('\n')
      return m.reply(`${body}\n\n${extra}`)
    }
    return { sendBtn, menuBtn }
  },

  // jalankan fungsi plugin dengan penanganan error seragam
  async guard(m, ui, fn) {
    try { return await fn() } catch (e) {
      await m.react?.('❌')
      return ui.sendBtn(`❌ ${e.message || e}`, [ui.menuBtn])
    }
  },

  // daftar produk berhalaman; mode 'detail' (pilih -> pkdetail) atau 'stok' (pilih -> pkstok)
  async sendProductList(m, ui, p, page = 1, mode = 'detail') {
    const { rp, cut, quick, isAvailable } = premku
    const PER_PAGE = 10
    const list = await premku.products(true)
    if (!list.length) return ui.sendBtn('Belum ada produk yang tersedia.', [ui.menuBtn])

    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
    page = Math.min(Math.max(parseInt(page) || 1, 1), pages)
    const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE)
    const target = mode === 'stok' ? 'pkstok' : 'pkdetail'

    let body = `*🛍️ DAFTAR PRODUK*${mode === 'stok' ? ' _(cek stok)_' : ''}\nHalaman ${page}/${pages} • ${list.length} produk\n`
    slice.forEach((x) => {
      body += `\n${isAvailable(x) ? '🟢' : '🔴'} *${x.name}*\n    ${rp(x.price)} • stok ${x.stock ?? 0} • ID ${x.id}`
    })

    const rows = slice.map((x) => ({
      id: `${p}${target} ${x.id}`,
      title: cut(x.name, 24),
      description: cut(`${rp(x.price)} • stok ${x.stock ?? 0}`, 72)
    }))
    const buttons = [{ type: 'list', text: '📦 Pilih Produk', sections: [{ title: `Halaman ${page}/${pages}`, rows }] }]
    const suffix = mode === 'stok' ? ' stok' : ''
    if (page > 1) buttons.push(quick('⬅️ Sebelumnya', `${p}pkproduk ${page - 1}${suffix}`))
    if (page < pages) buttons.push(quick('➡️ Berikutnya', `${p}pkproduk ${page + 1}${suffix}`))
    buttons.push(ui.menuBtn)
    return ui.sendBtn(body, buttons)
  },

  // tampilkan hasil order / status order (+ akun)
  async sendOrder(m, conn, ui, p, o, message) {
    const { rp, icon, quick, copy } = premku
    const accounts = Array.isArray(o.accounts) ? o.accounts : []
    const st = String(o.status || '').toLowerCase()
    let body = `*${icon(st)} ORDER*\n\n🧾 Invoice : ${o.invoice || '-'}`
    if (o.ref_id) body += `\n🔖 Ref : ${o.ref_id}`
    if (o.product) body += `\n📦 Produk : ${o.product}`
    if (o.qty != null) body += `\n🔢 Qty : ${o.qty}`
    if (o.price != null) body += `\n💵 Harga : ${rp(o.price)}`
    if (o.total != null) body += `\n🧮 Total : ${rp(o.total)}`
    if (o.status) body += `\n📌 Status : *${o.status}*`
    if (o.balance_after != null) body += `\n💳 Sisa saldo : ${rp(o.balance_after)}`
    if (message) body += `\n💬 ${message}`

    const lines = accounts.map((a) => `${a.username} | ${a.password}`)
    if (lines.length && lines.length <= _PK_MAX_INLINE) {
      body += `\n\n*🔐 AKUN*\n` + accounts.map((a, i) => `${i + 1}. ${a.username}\n    🔑 ${a.password}`).join('\n')
    } else if (lines.length) {
      body += `\n\n*🔐 ${lines.length} akun* dikirim sebagai file .txt`
      try {
        await conn.sendMessage(m.chat, { document: Buffer.from(lines.join('\n')), mimetype: 'text/plain', fileName: `${o.invoice || 'akun'}.txt` }, { quoted: m })
      } catch {}
    }

    const buttons = []
    if (accounts.length === 1) buttons.push(copy('📋 Salin Username', accounts[0].username), copy('📋 Salin Password', accounts[0].password))
    else if (lines.length) buttons.push(copy('📋 Salin Semua Akun', lines.join('\n').slice(0, 4000)))
    if (o.invoice) buttons.push(quick('🔍 Cek Status', `${p}pkstatus ${o.invoice}`))
    buttons.push(quick('🛍️ Produk', `${p}pkproduk`), quick('🧾 Riwayat', `${p}pkriwayat`), ui.menuBtn)
    return ui.sendBtn(body, buttons)
  }
}


// ───────── Konachan (galeri anime) — dipakai plugins/anime/konachan.js ─────────
const __konachan = (() => {
async function searchKonachan(tags) {
  const url = `https://konachan.net/post?tags=${encodeURIComponent(tags)}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    const posts = [];

    $('#post-list-posts li').each((index, element) => {
      const id = $(element).attr('id')?.replace('p', '') || null;
      const previewUrl = $(element).find('img').attr('src') || null;
      const sourceUrl = $(element).find('.thumb').attr('href') || null;

      const titleAttr = $(element).find('.thumb img').attr('title') || '';
      
      let cleanTags = [];
      if (titleAttr.includes('Tags:')) {
        const rawTags = titleAttr.split('Tags:')[1]?.split('User:')[0]?.trim();
        if (rawTags) {
          cleanTags = rawTags.split(/\s+/);
        }
      } else {
     
        cleanTags = $(element).find('img').attr('alt')?.trim().split(/\s+/) || [];
      }

      if (id) {
        posts.push({
          id: parseInt(id),
          tags: cleanTags,
          details_page: sourceUrl ? `https://konachan.net${sourceUrl}` : null,
          images: {
            preview: previewUrl ? (previewUrl.startsWith('http') ? previewUrl : `https:${previewUrl}`) : null
          }
        });
      }
    });

    return posts;
  } catch (error) {
    return { error: true, message: error.message };
  }
}
return searchKonachan
})()
export const searchKonachan = __konachan

// ───────── Auto anime Winbu (upload episode terbaru ke grup target) — plugins/anime/autoanimewinbu.js ─────────
// Data tersimpan di database/autoanime_winbu_*.json. Setelah restart jalankan lagi: .autoanimewinbu start
const __autoAnime = (() => {
const BASE_URL = 'https://winbu.net'
const DATA_DIR = path.join(process.cwd(), 'database')
const SENT_FILE = path.join(DATA_DIR, 'autoanime_winbu_sent.json')
const STATE_FILE = path.join(DATA_DIR, 'autoanime_winbu_state.json')

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': BASE_URL
}

function loadSent() {
    try {
        if (!fs.existsSync(SENT_FILE)) return new Set()
        return new Set(JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')))
    } catch {
        return new Set()
    }
}

function saveSent(set) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
        fs.writeFileSync(SENT_FILE, JSON.stringify([...set]))
    } catch {}
}

function loadState() {
    try {
        if (!fs.existsSync(STATE_FILE)) return { enabled: false, groups: [], interval: 5 }
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    } catch {
        return { enabled: false, groups: [], interval: 5 }
    }
}

function saveState(state) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
    } catch {}
}

async function fetchPage(url) {
    const res = await axios.get(url, { headers: HEADERS, timeout: 30000 })
    return String(res.data)
}

async function getOngoingAnimeList() {
    const html = await fetchPage(`${BASE_URL}/`)
    const $ = cheerio.load(html)
    const list = []

    $('.movies-list-wrap').each((_, section) => {
        const sectionTitle = $(section).find('.list-title h2').attr('title') || ''
        if (sectionTitle.includes('Anime Terbaru') || sectionTitle.includes('Populer')) {
            $(section).find('.ml-item').each((__, item) => {
                const a = $(item).find('a.ml-mask')
                const href = a.attr('href') || ''
                const title = a.attr('title')?.trim() || ''
                if (!href || !title) return

                const imgEl = $(item).find('img')
                const cover = imgEl.attr('data-original') || imgEl.attr('data-src') || imgEl.attr('src') || ''

                const normalUrl = new URL(href, BASE_URL).href
                list.push({
                    title,
                    url: normalUrl,
                    slug: href.split('/anime/')[1]?.replace(/\//g, '') || '',
                    cover: cover ? new URL(cover, BASE_URL).href : ''
                })
            })
        }
    })

    return list
}

async function getLatestEpisodeLink(animeUrl) {
    const html = await fetchPage(animeUrl)
    const $ = cheerio.load(html)
    const episodeLink = $('a[href*="episode"]').first()
    if (!episodeLink.length) return null

    let href = episodeLink.attr('href') || ''
    const text = episodeLink.text().trim() || ''
    if (!href) return null

    let fullUrl = href
    if (!href.startsWith('http')) fullUrl = new URL(href, BASE_URL).href

    const epMatch = fullUrl.match(/episode[_-]?(\d+)/i) || fullUrl.match(/ep[_-]?(\d+)/i)
    const epNum = epMatch ? epMatch[1] : 'Latest'

    return {
        number: epNum,
        text: text || `Episode ${epNum}`,
        url: fullUrl
    }
}

async function getEpisodeTime(episodeUrl) {
    try {
        const html = await fetchPage(episodeUrl)
        const $ = cheerio.load(html)

        const metaTime = $('meta[property="article:published_time"]').attr('content')
        if (metaTime) return metaTime

        const timeEl = $('time')
        if (timeEl.length) {
            const dt = timeEl.attr('datetime')
            if (dt) return dt
            const txt = timeEl.text().trim()
            if (txt) return txt
        }

        const dateText = ($('.post-date').text() || $('.entry-date').text() || $('.published').text()).trim()
        if (dateText) return dateText

        const bodyText = $('body').text()
        const match = bodyText.match(/(\d+)\s+(hours?|days?|minutes?|seconds?)\s+ago/i)
        if (match) return match[0]

        return null
    } catch {
        return null
    }
}

function parseRelativeTimeToHours(timeStr) {
    if (!timeStr) return null

    if (timeStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
        const pubDate = new Date(timeStr)
        if (!isNaN(pubDate)) return (Date.now() - pubDate) / (1000 * 60 * 60)
    }

    const regex = /(\d+)\s+(hour|day|minute|second)s?\s+ago/i
    const match = timeStr.match(regex)
    if (match) {
        const value = parseInt(match[1])
        const unit = match[2].toLowerCase()
        switch (unit) {
            case 'hour': return value
            case 'day': return value * 24
            case 'minute': return value / 60
            case 'second': return value / 3600
        }
    }

    const timestamp = Date.parse(timeStr)
    if (!isNaN(timestamp)) return (Date.now() - timestamp) / (1000 * 60 * 60)

    return null
}

async function getDownloadLink(episodeUrl) {
    const { data } = await axios.get(episodeUrl, { headers: HEADERS, timeout: 30000 })
    const $ = cheerio.load(data)
    const downloadLinks = []

    $('.download-eps ul li').each((_, el) => {
        const quality = $(el).find('strong').text().trim()
        if (!quality) return
        const links = []
        $(el).find('span a').each((__, linkEl) => {
            const provider = $(linkEl).text().trim()
            const href = $(linkEl).attr('href')
            if (provider && href) links.push({ provider, url: href })
        })
        if (links.length > 0) downloadLinks.push({ quality, links })
    })

    if (downloadLinks.length === 0) return null

    const qualityPriority = ['720p', '1080p', '480p', '360p']
    downloadLinks.sort((a, b) => {
        const getPriority = (q) => {
            const match = q.match(/(\d{3,4}p)/i)
            if (!match) return 999
            const idx = qualityPriority.indexOf(match[1].toLowerCase())
            return idx === -1 ? 999 : idx
        }
        return getPriority(a.quality) - getPriority(b.quality)
    })

    let selectedLink = null
    let selectedQuality = null

    for (const item of downloadLinks) {
        const pixeldrain = item.links.find(l =>
            l.provider.toLowerCase().includes('pixeldrain') || l.url.includes('pixeldrain')
        )
        if (pixeldrain) {
            selectedLink = pixeldrain.url
            selectedQuality = item.quality
            break
        }
    }

    if (!selectedLink) return null

    const qualityMatch = selectedQuality.match(/(\d{3,4}p)/i)
    return {
        host: 'Pixeldrain',
        url: selectedLink,
        quality: qualityMatch ? qualityMatch[1] : 'Unknown'
    }
}

function resolvePixeldrainPageUrl(rawUrl) {
    const id = (rawUrl.match(/pixeldrain\.(?:com|net)\/(?:u|d|api\/file)\/([a-zA-Z0-9]+)/i) || [])[1]
    if (id) return `https://pixeldrain.com/u/${id}`
    return rawUrl
}

async function formatSize(b) {
    if (!b) return '0 B'
    const i = Math.floor(Math.log(b) / Math.log(1024))
    return (b / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i]
}

async function notifyAndSend(sock, groupIds, linkObj, meta) {
    const pageUrl = resolvePixeldrainPageUrl(linkObj.url)

    let coverBuffer = null
    if (meta.cover) {
        try {
            const res = await axios.get(meta.cover, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: HEADERS
            })
            coverBuffer = Buffer.from(res.data)
        } catch (e) {
            console.log(`[AutoAnime-Winbu] ⚠️ Cover gagal: ${e.message}`)
        }
    }

    const caption =
        `*ANIME UPDATE! ✨*\n\n` +
        `📺 Judul: *${meta.title}*\n` +
        `🎞️ Episode: ${meta.episode}\n` +
        `📊 Kualitas: *${linkObj.quality}*`

    for (const gid of groupIds) {
        try {
            const msgPayload = coverBuffer
                ? { image: coverBuffer, caption, footer: 'Klik tombol di bawah untuk download video 👇' }
                : { text: caption, footer: 'Klik tombol di bawah untuk download video 👇' }

            await sock.sendMessage(gid, {
                ...msgPayload,
                interactiveButtons: [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: `Download ${linkObj.quality}`,
                            url: pageUrl
                        })
                    }
                ]
            })
            console.log(`[AutoAnime-Winbu] ✅ Notified ${gid}: ${meta.title} ${meta.episode}`)
            await new Promise(r => setTimeout(r, 3000))
        } catch (e) {
            console.error(`[AutoAnime-Winbu] ❌ Send error ${gid}:`, e.message)
        }
    }
}

let autoInterval = null
let _running = false
let globalSock = null

async function runCheck() {
    const state = loadState()
    const groups = state.groups || []
    if (groups.length === 0) {
        console.log('[AutoAnime-Winbu] ⚠️ No target groups configured')
        return
    }

    const sent = loadSent()
    console.log(`[AutoAnime-Winbu] 🔍 Check: ${new Date().toLocaleString('id-ID')}`)

    let animeList
    try {
        animeList = await getOngoingAnimeList()
    } catch (e) {
        console.error('[AutoAnime-Winbu] ❌ Error:', e.message)
        return
    }

    if (animeList.length === 0) {
        console.log('[AutoAnime-Winbu] Tidak ada anime')
        return
    }

    for (const anime of animeList) {
        try {
            const episodeData = await getLatestEpisodeLink(anime.url)
            if (!episodeData) continue

            const episodeKey = `${anime.slug}-${episodeData.number}`
            if (sent.has(episodeKey)) continue

            const timeStr = await getEpisodeTime(episodeData.url)
            if (timeStr) {
                const hours = parseRelativeTimeToHours(timeStr)
                if (hours !== null && hours >= 24) {
                    sent.add(episodeKey)
                    saveSent(sent)
                    continue
                }
            }

            const linkObj = await getDownloadLink(episodeData.url)
            if (!linkObj) continue

            await notifyAndSend(globalSock, groups, linkObj, {
                title: anime.title,
                episode: episodeData.text,
                cover: anime.cover || ''
            })

            sent.add(episodeKey)
            saveSent(sent)
            await new Promise(r => setTimeout(r, 5000))
        } catch (e) {
            console.error(`[AutoAnime-Winbu] ❌ Error ${anime.title}:`, e.message)
        }
    }

    console.log('[AutoAnime-Winbu] ✅ Check complete')
}

function startAutoCheck(sock, intervalMinutes = 5) {
    if (autoInterval) clearInterval(autoInterval)
    globalSock = sock
    _running = true

    const ms = intervalMinutes * 60 * 1000
    runCheck().catch(e => console.error('[AutoAnime-Winbu]', e.message))
    autoInterval = setInterval(() => {
        runCheck().catch(e => console.error('[AutoAnime-Winbu]', e.message))
    }, ms)

    if (autoInterval.unref) autoInterval.unref()
}

function stopAutoCheck() {
    if (autoInterval) clearInterval(autoInterval)
    autoInterval = null
    _running = false
}

function initAutoStart(sock) {
    const state = loadState()
    if (!state.enabled) return
    console.log('[AutoAnime-Winbu] 🔄 Auto-restore enabled')
    startAutoCheck(sock, state.interval || 5)
}


const isRunning = () => _running
return { loadSent, saveSent, loadState, saveState, getOngoingAnimeList, startAutoCheck, stopAutoCheck, initAutoStart, runCheck, isRunning }
})()
export const { loadSent, saveSent, loadState, saveState, getOngoingAnimeList, startAutoCheck, stopAutoCheck, initAutoStart, runCheck, isRunning } = __autoAnime
