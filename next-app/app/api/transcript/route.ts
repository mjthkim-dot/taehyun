import { NextRequest, NextResponse } from 'next/server';

/**
 * 🎬 YouTube 자막 자동 수집 프록시 — api/transcript.js(Vercel 서버리스)를
 * Next.js App Router route handler로 포팅. 전략 로직은 동일하게 유지한다.
 *
 * 전략 순서:
 *  S0: YouTube timedtext 레거시 API
 *  S1: InnerTube 클라이언트 5종 병렬 경쟁 (Promise.allSettled — 가장 먼저 트랙을 찾은 쪽 사용)
 *  S2: watch 페이지 ytInitialPlayerResponse 균형-괄호 파싱
 *
 * 호출: GET /api/transcript?v=VIDEO_ID  |  ?url=<youtube url>  (선택: &lang=en)
 * 응답: { vid, lang, title, text, segments:[{start,dur,text}] }
 *       실패: { error, message, why, title }
 */

export const maxDuration = 60;

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const KEY_IOS = 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc';
const KEY_ANDROID = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const KEY_WEB = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

interface ClientDef {
  label: string;
  key: string;
  cname: string;
  cver: string;
  ua: string;
  context: Record<string, unknown>;
}

const CLIENTS: ClientDef[] = [
  {
    label: 'IOS',
    key: KEY_IOS,
    cname: '5',
    cver: '19.29.1',
    ua: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)',
    context: { clientName: 'IOS', clientVersion: '19.29.1', deviceModel: 'iPhone16,2', hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'ANDROID',
    key: KEY_ANDROID,
    cname: '3',
    cver: '19.29.37',
    ua: 'com.google.android.youtube/19.29.37 (Linux; U; Android 14; en_US) gzip',
    context: { clientName: 'ANDROID', clientVersion: '19.29.37', androidSdkVersion: 34, hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'ANDROID_VR',
    key: KEY_ANDROID,
    cname: '28',
    cver: '1.56.21',
    ua: 'Mozilla/5.0 (Linux; Android 14; Oculus Quest) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/31.0.0.4 SamsungBrowser/4.3 Chrome/120.0.6099.176 Mobile VR Safari/537.36',
    context: { clientName: 'ANDROID_VR', clientVersion: '1.56.21', deviceModel: 'Oculus Quest', androidSdkVersion: 34, hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'TVHTML5',
    key: KEY_WEB,
    cname: '85',
    cver: '2.0',
    ua: DESKTOP_UA,
    context: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'MWEB',
    key: KEY_WEB,
    cname: '2',
    cver: '2.20240726.00.00',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1',
    context: { clientName: 'MWEB', clientVersion: '2.20240726.00.00', hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
];

interface Segment {
  start: number;
  dur: number;
  text: string;
}

function fetchT(url: string, opts: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function extractId(s: string) {
  s = (s || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const pats = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
    /shorts\/([A-Za-z0-9_-]{11})/,
    /live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of pats) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return '';
}

function decodeEntities(s: string) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function parseJson3(cj: { events?: { segs?: { utf8?: string }[]; tStartMs?: number; dDurationMs?: number }[] }) {
  const segments: Segment[] = [];
  if (cj && Array.isArray(cj.events)) {
    for (const ev of cj.events) {
      if (!ev.segs) continue;
      const t = ev.segs
        .map((s) => s.utf8 || '')
        .join('')
        .replace(/[\n\r]/g, ' ')
        .trim();
      if (t) segments.push({ start: Math.round((ev.tStartMs || 0) / 100) / 10, dur: Math.round((ev.dDurationMs || 0) / 100) / 10, text: t });
    }
  }
  return { text: segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim(), segments };
}

async function tryTimedtext(vid: string, preferLang: string, log: unknown[]) {
  try {
    const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${vid}`;
    const lr = await fetchT(listUrl, { headers: { 'User-Agent': DESKTOP_UA, 'Accept-Language': 'en-US' } }, 6000);
    const xml = await lr.text();

    const tracks: { lang: string; name: string; isAsr: boolean }[] = [];
    const re = /<track\b([^>]*)>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const attrs = m[1];
      const lang = (attrs.match(/\blang_code="([^"]*)"/) || [])[1] || '';
      const name = (attrs.match(/\bname="([^"]*)"/) || [])[1] || '';
      const isAsr = attrs.includes('kind="asr"');
      if (lang) tracks.push({ lang, name, isAsr });
    }

    if (!tracks.length) {
      log.push({ s: 'timedtext-list', ok: false, reason: 'no tracks in XML' });
      return null;
    }

    const pick =
      (preferLang && tracks.find((t) => t.lang === preferLang)) ||
      tracks.find((t) => t.lang === 'en' && !t.isAsr) ||
      tracks.find((t) => t.lang === 'en') ||
      tracks.find((t) => t.lang.startsWith('en')) ||
      tracks[0];

    log.push({ s: 'timedtext-list', ok: true, tracks: tracks.length, picked: pick.lang });

    const capUrl = `https://www.youtube.com/api/timedtext?v=${vid}&lang=${encodeURIComponent(pick.lang)}&name=${encodeURIComponent(pick.name)}&fmt=json3`;
    const cr = await fetchT(capUrl, { headers: { 'User-Agent': DESKTOP_UA, 'Accept-Language': 'en-US' } }, 8000);
    if (!cr.ok) {
      log.push({ s: 'timedtext-dl', ok: false, status: cr.status });
      return null;
    }
    const cj = await cr.json();
    const dl = parseJson3(cj);
    if (!dl.text) {
      log.push({ s: 'timedtext-dl', ok: false, reason: 'empty json3' });
      return null;
    }
    log.push({ s: 'timedtext-dl', ok: true, segs: dl.segments.length });
    return { ...dl, lang: pick.lang };
  } catch (e) {
    log.push({ s: 'timedtext', ok: false, err: String((e as Error)?.message || e) });
    return null;
  }
}

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  vssId?: string;
  kind?: string;
}

async function tryOneInnerTube(vid: string, c: ClientDef) {
  const r = await fetchT(
    `https://www.youtube.com/youtubei/v1/player?key=${c.key}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': c.ua,
        'Accept-Language': 'en-US,en;q=0.9',
        'X-YouTube-Client-Name': c.cname,
        'X-YouTube-Client-Version': c.cver,
        Origin: 'https://www.youtube.com',
      },
      body: JSON.stringify({
        videoId: vid,
        contentCheckOk: true,
        racyCheckOk: true,
        context: { client: c.context },
      }),
    },
    9000
  );
  if (!r.ok) throw new Error(`http ${r.status}`);
  const data = await r.json();
  const status = data?.playabilityStatus?.status || 'UNKNOWN';
  const tracks: CaptionTrack[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) {
    const reason =
      data?.playabilityStatus?.reason || data?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText || '';
    throw new Error(`${status}${reason ? ': ' + reason : ''}`);
  }
  return { tracks, title: data?.videoDetails?.title || '', status };
}

async function tryInnerTubeAll(vid: string, log: unknown[]) {
  const results = await Promise.allSettled(CLIENTS.map((c) => tryOneInnerTube(vid, c).then((r) => ({ ...r, label: c.label }))));
  let tracks: CaptionTrack[] = [];
  let title = '';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const label = CLIENTS[i].label;
    if (r.status === 'fulfilled') {
      log.push({ s: `innertube-${label}`, ok: true, tracks: r.value.tracks.length });
      if (!tracks.length) {
        tracks = r.value.tracks;
        title = r.value.title || '';
      }
    } else {
      log.push({ s: `innertube-${label}`, ok: false, reason: (r.reason as Error)?.message || String(r.reason) });
    }
  }
  return tracks.length ? { tracks, title } : null;
}

async function tryWatchPage(vid: string, log: unknown[]) {
  try {
    const r = await fetchT(
      `https://www.youtube.com/watch?v=${vid}&hl=en&bpctr=9999999999&has_verified=1`,
      { headers: { 'User-Agent': DESKTOP_UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+cb; SOCS=CAI; PREF=hl=en;' } },
      10000
    );
    const html = await r.text();
    let title = '';
    const tm = html.match(/<title>([^<]*)<\/title>/);
    if (tm) title = decodeEntities(tm[1]).replace(/ - YouTube$/, '').trim();

    const blocked = /consent\.youtube|verify you('|&#39;)?re not a robot/i.test(html);
    if (blocked) {
      log.push({ s: 'watchpage', ok: false, reason: 'bot/consent block' });
      return { tracks: [] as CaptionTrack[], title };
    }

    let tracks: CaptionTrack[] = [];
    const mPos = html.indexOf('ytInitialPlayerResponse');
    if (mPos !== -1) {
      const eqPos = html.indexOf('=', mPos + 23);
      const jsonStart = html.indexOf('{', eqPos + 1);
      if (jsonStart !== -1) {
        let depth = 0;
        let end = -1;
        for (let i = jsonStart; i < Math.min(html.length, jsonStart + 1_500_000); i++) {
          const ch = html[i];
          if (ch === '{') depth++;
          else if (ch === '}' && --depth === 0) {
            end = i;
            break;
          }
        }
        if (end !== -1) {
          try {
            const ipr = JSON.parse(html.slice(jsonStart, end + 1));
            if (!title) title = ipr?.videoDetails?.title || '';
            tracks = ipr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          } catch {
            /* 무시 */
          }
        }
      }
    }
    if (!tracks.length) {
      const ctPos = html.indexOf('"captionTracks":[');
      if (ctPos !== -1) {
        const arrStart = html.indexOf('[', ctPos);
        let depth = 0;
        let end = -1;
        for (let j = arrStart; j < Math.min(html.length, arrStart + 300_000); j++) {
          const ch = html[j];
          if (ch === '[' || ch === '{') depth++;
          else if ((ch === ']' || ch === '}') && --depth === 0) {
            end = j;
            break;
          }
        }
        if (end !== -1) {
          try {
            tracks = JSON.parse(html.slice(arrStart, end + 1).replace(/\\u0026/g, '&').replace(/\\u003d/g, '='));
          } catch {
            /* 무시 */
          }
        }
      }
    }
    log.push({ s: 'watchpage', ok: tracks.length > 0, tracks: tracks.length, title: title.slice(0, 40) });
    return { tracks, title };
  } catch (e) {
    log.push({ s: 'watchpage', ok: false, err: String((e as Error)?.message || e) });
    return { tracks: [] as CaptionTrack[], title: '' };
  }
}

async function fetchTitle(vid: string) {
  try {
    const r = await fetchT(`https://www.youtube.com/oembed?url=https://youtu.be/${vid}&format=json`, {}, 5000);
    if (!r.ok) return '';
    return (await r.json())?.title || '';
  } catch {
    return '';
  }
}

async function downloadCaption(baseUrl: string) {
  try {
    const cr = await fetchT(baseUrl + '&fmt=json3', { headers: { 'Accept-Language': 'en-US', 'User-Agent': DESKTOP_UA } }, 8000);
    if (cr.ok) {
      const dl = parseJson3(await cr.json());
      if (dl.text) return dl;
    }
  } catch {
    /* XML 폴백 */
  }
  try {
    const xr = await fetchT(baseUrl, { headers: { 'User-Agent': DESKTOP_UA } }, 8000);
    const xml = await xr.text();
    const segments: Segment[] = [];
    const re = /<text[^>]*\bstart="([\d.]+)"[^>]*?(?:\bdur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const t = decodeEntities(m[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      if (t) segments.push({ start: parseFloat(m[1]) || 0, dur: parseFloat(m[2]) || 0, text: t });
    }
    const text = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
    return { text, segments };
  } catch {
    return { text: '', segments: [] as Segment[] };
  }
}

async function fetchTranscript(
  vid: string,
  preferLang: string,
  log: unknown[]
): Promise<{ text: string; title: string; segments: Segment[]; lang?: string; why?: string }> {
  let tracks: CaptionTrack[] = [];
  let title = '';

  const tt = await tryTimedtext(vid, preferLang, log);
  if (tt && tt.text) {
    const t2 = await fetchTitle(vid);
    return { ...tt, title: t2 || title };
  }

  const it = await tryInnerTubeAll(vid, log);
  if (it) {
    tracks = it.tracks;
    title = it.title || '';
  }

  if (!tracks.length) {
    const wp = await tryWatchPage(vid, log);
    tracks = wp.tracks || [];
    if (!title) title = wp.title || '';
  }

  if (!title) title = await fetchTitle(vid);
  if (!tracks.length) {
    const why = (log as { s: string; reason?: string; err?: string; ok?: boolean }[]).map((l) => `${l.s}:${l.reason || l.err || (l.ok ? 'ok' : 'fail')}`).join(' | ');
    return { text: '', title, why, segments: [] as Segment[] };
  }

  const norm = tracks.map((t) => ({
    ...t,
    baseUrl: (t.baseUrl || '').replace(/\\u0026/g, '&').replace(/\\u003d/g, '='),
    languageCode: t.languageCode || (t.vssId || '').replace(/^[.a]+/, '') || '',
  }));

  const pick =
    (preferLang && norm.find((t) => t.languageCode === preferLang)) ||
    norm.find((t) => t.languageCode === 'en' && t.kind !== 'asr') ||
    norm.find((t) => t.languageCode === 'en') ||
    norm.find((t) => (t.languageCode || '').startsWith('en')) ||
    norm[0];

  const baseUrl = pick?.baseUrl || '';
  if (!baseUrl) return { text: '', title, why: '자막 트랙 URL이 비어 있습니다.', segments: [] as Segment[] };

  const dl = await downloadCaption(baseUrl);
  if (!dl.text) return { text: '', title, why: '자막 내용을 받지 못했습니다. (서버 IP 제한 가능)', segments: [] as Segment[] };
  return { text: dl.text, segments: dl.segments, title, lang: pick?.languageCode || '' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vid = extractId(searchParams.get('v') || searchParams.get('url') || '');
  if (!vid) {
    return NextResponse.json({ error: 'invalid_video', message: '유튜브 영상 ID를 인식하지 못했습니다.' }, { status: 400 });
  }

  const log: unknown[] = [];
  try {
    const out = await fetchTranscript(vid, searchParams.get('lang') || '', log);
    if (!out.text) {
      return NextResponse.json(
        { error: 'no_captions', message: '이 영상에는 가져올 수 있는 자막이 없습니다.', why: out.why || '', title: out.title || '' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { vid, lang: out.lang || '', title: out.title || '', text: out.text, segments: out.segments || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json({ error: 'fetch_failed', message: String((e as Error)?.message || e) }, { status: 502 });
  }
}
