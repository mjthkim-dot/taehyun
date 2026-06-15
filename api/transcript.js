/* 🎬 YouTube 자막(트랜스크립트) 자동 수집 프록시 — Vercel 서버리스 함수
 *
 * ⚠️ 구조적 한계: Vercel 함수는 데이터센터 IP에서 실행되므로 YouTube가 봇 차단을
 *    걸 수 있다. 이를 최대한 우회하기 위해 "여러 InnerTube 클라이언트"를 순서대로
 *    시도한다(IOS → ANDROID → MWEB → TVHTML5 → WEB). 하나가 막혀도 다음이 뚫는다.
 *    그래도 모두 막히면 watch 페이지 스크래핑을 마지막으로 시도하고,
 *    실패 시 why(원인)를 함께 돌려줘 프론트가 정확한 안내를 띄우게 한다.
 *
 * 호출:  GET /api/transcript?v=VIDEO_ID  |  ?url=<youtube url>   (선택 &lang=en)
 * 응답:  { vid, lang, title, text, segments:[{start,dur,text}] }
 *        실패: { error, message, why, title }
 */

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// InnerTube(앱 내부 API) 공개 키 — 클라이언트별로 다르다
const KEY_WEB = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const KEY_ANDROID = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const KEY_IOS = 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc';

/* 시도할 클라이언트들 — 데이터센터 IP에서 성공률 높은 순서 */
const CLIENTS = [
  {
    label: 'IOS', key: KEY_IOS,
    ua: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)',
    cname: '5', cver: '19.29.1',
    context: { clientName: 'IOS', clientVersion: '19.29.1', deviceModel: 'iPhone16,2', hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'ANDROID', key: KEY_ANDROID,
    ua: 'com.google.android.youtube/19.29.37 (Linux; U; Android 14; en_US) gzip',
    cname: '3', cver: '19.29.37',
    context: { clientName: 'ANDROID', clientVersion: '19.29.37', androidSdkVersion: 34, hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'MWEB', key: KEY_WEB,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    cname: '2', cver: '2.20240726.00.00',
    context: { clientName: 'MWEB', clientVersion: '2.20240726.00.00', hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'TVHTML5', key: KEY_WEB,
    ua: DESKTOP_UA,
    cname: '85', cver: '2.0',
    context: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
  {
    label: 'WEB', key: KEY_WEB,
    ua: DESKTOP_UA,
    cname: '1', cver: '2.20240726.00.00',
    context: { clientName: 'WEB', clientVersion: '2.20240726.00.00', hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.query || {};
  const vid = extractId((q.v || q.url || '').toString());
  if (!vid) {
    res.status(400).json({ error: 'invalid_video', message: '유튜브 영상 ID를 인식하지 못했습니다.' });
    return;
  }

  try {
    const out = await fetchTranscript(vid, (q.lang || '').toString());
    if (!out.text) {
      res.status(404).json({
        error: 'no_captions',
        message: out.why || '이 영상에는 가져올 수 있는 자막이 없습니다. 스크립트를 직접 붙여넣어 주세요.',
        why: out.why || '',
        title: out.title || '',
      });
      return;
    }
    res.status(200).json({
      vid,
      lang: out.lang || '',
      title: out.title || '',
      text: out.text,
      segments: out.segments || [],
    });
  } catch (e) {
    res.status(502).json({ error: 'fetch_failed', message: String((e && e.message) || e) });
  }
}

/* ── 유튜브 URL / 영상 ID 추출 ─────────────────────────────────────────── */
function extractId(s) {
  s = (s || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const pats = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
    /shorts\/([A-Za-z0-9_-]{11})/,
    /live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of pats) { const m = s.match(re); if (m) return m[1]; }
  return '';
}

/* ── InnerTube 한 클라이언트로 player 응답 받기 ─────────────────────────── */
async function tryInnerTube(vid, c) {
  try {
    const r = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${c.key}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': c.ua,
          'Accept-Language': 'en-US,en;q=0.9',
          'X-YouTube-Client-Name': c.cname,
          'X-YouTube-Client-Version': c.cver,
          'Origin': 'https://www.youtube.com',
        },
        body: JSON.stringify({
          videoId: vid,
          contentCheckOk: true,
          racyCheckOk: true,
          context: { client: c.context },
        }),
      }
    );
    if (!r.ok) return { tracks: [], title: '', reason: `http ${r.status}` };
    const data = await r.json();
    const status = data?.playabilityStatus?.status || '';
    const reason = data?.playabilityStatus?.reason || data?.playabilityStatus?.errorScreen
      ?.playerErrorMessageRenderer?.reason?.simpleText || '';
    const title = data?.videoDetails?.title || '';
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return { tracks, title, status, reason };
  } catch (e) {
    return { tracks: [], title: '', reason: String((e && e.message) || e) };
  }
}

/* ── watch 페이지 스크래핑 (InnerTube 전멸 시 최후 폴백) ─────────────────── */
async function scrapeWatch(vid) {
  try {
    const r = await fetch(
      `https://www.youtube.com/watch?v=${vid}&hl=en&bpctr=9999999999&has_verified=1`,
      {
        headers: {
          'User-Agent': DESKTOP_UA,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'CONSENT=YES+cb; SOCS=CAI; PREF=hl=en;',
        },
      }
    );
    const html = await r.text();
    let title = '';
    const tm = html.match(/<title>([^<]*)<\/title>/);
    if (tm) title = decodeEntities(tm[1]).replace(/ - YouTube$/, '').trim();

    let tracks = [];
    // ytInitialPlayerResponse 균형-괄호 파싱
    const mPos = html.indexOf('ytInitialPlayerResponse');
    if (mPos !== -1) {
      const eqPos = html.indexOf('=', mPos + 23);
      const jsonStart = html.indexOf('{', eqPos + 1);
      if (jsonStart !== -1) {
        let depth = 0, end = -1;
        const limit = Math.min(html.length, jsonStart + 1_500_000);
        for (let i = jsonStart; i < limit; i++) {
          const ch = html[i];
          if (ch === '{') depth++;
          else if (ch === '}' && --depth === 0) { end = i; break; }
        }
        if (end !== -1) {
          try {
            const ipr = JSON.parse(html.slice(jsonStart, end + 1));
            if (!title) title = ipr?.videoDetails?.title || '';
            tracks = ipr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          } catch { /* 무시 */ }
        }
      }
    }
    // 균형-대괄호로 captionTracks 배열만 직접 추출 (최후)
    if (!tracks.length) {
      const ctPos = html.indexOf('"captionTracks":[');
      if (ctPos !== -1) {
        const arrStart = html.indexOf('[', ctPos);
        let depth = 0, end = -1;
        for (let j = arrStart; j < html.length && j < arrStart + 300_000; j++) {
          const ch = html[j];
          if (ch === '[' || ch === '{') depth++;
          else if ((ch === ']' || ch === '}') && --depth === 0) { end = j; break; }
        }
        if (end !== -1) {
          try {
            tracks = JSON.parse(
              html.slice(arrStart, end + 1).replace(/\\u0026/g, '&').replace(/\\u003d/g, '=')
            );
          } catch { /* 무시 */ }
        }
      }
    }
    const blocked = /consent\.youtube|verify you('|&#39;)?re not a robot|로봇이 아님/i.test(html);
    return { tracks, title, reason: tracks.length ? '' : (blocked ? 'IP가 봇으로 차단됨' : 'captionTracks 없음') };
  } catch (e) {
    return { tracks: [], title: '', reason: String((e && e.message) || e) };
  }
}

/* ── oEmbed로 제목만이라도 확보 (IP 차단에 강함) ───────────────────────── */
async function fetchTitleOEmbed(vid) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://youtu.be/${vid}&format=json`);
    if (!r.ok) return '';
    const j = await r.json();
    return j?.title || '';
  } catch { return ''; }
}

/* ── 메인 ─────────────────────────────────────────────────────────────── */
async function fetchTranscript(vid, preferLang) {
  let tracks = [];
  let title = '';
  let why = '';
  let lastReason = '';

  // 1) 여러 InnerTube 클라이언트를 순서대로 시도
  for (const c of CLIENTS) {
    const res = await tryInnerTube(vid, c);
    if (res.title && !title) title = res.title;
    if (res.tracks && res.tracks.length) { tracks = res.tracks; break; }
    if (res.reason) lastReason = `${c.label}: ${res.reason}`;
    // 영상이 비공개/삭제/연령제한이면 더 시도해도 자막은 없음
    if (res.status && /LOGIN_REQUIRED|ERROR|UNPLAYABLE/.test(res.status) && res.reason) {
      why = res.reason;
    }
  }

  // 2) 전부 실패 → watch 페이지 스크래핑
  if (!tracks.length) {
    const sc = await scrapeWatch(vid);
    if (sc.title && !title) title = sc.title;
    if (sc.tracks && sc.tracks.length) tracks = sc.tracks;
    else if (sc.reason) lastReason = lastReason || sc.reason;
  }

  // 제목 보강 (둘 다 실패했어도 oEmbed로)
  if (!title) title = await fetchTitleOEmbed(vid);

  if (!tracks.length) {
    why = why || lastReason ||
      '자막 트랙을 찾지 못했습니다. (영상에 자막이 없거나 YouTube가 서버 접근을 차단했을 수 있어요)';
    return { text: '', title, why };
  }

  // baseUrl 유니코드 이스케이프 정규화
  tracks = tracks.map(t => ({
    ...t,
    baseUrl: (t.baseUrl || '').replace(/\\u0026/g, '&').replace(/\\u003d/g, '='),
    languageCode: t.languageCode || (t.vssId || '').replace(/^[.a]+/, '') || '',
  }));

  // 트랙 선택: 요청 언어 → 영어 수동 → 영어 자동 → en* → 첫 번째
  const pick =
    (preferLang && tracks.find(t => t.languageCode === preferLang)) ||
    tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks.find(t => (t.languageCode || '').startsWith('en')) ||
    tracks[0];

  const baseUrl = pick?.baseUrl || '';
  if (!baseUrl) return { text: '', title, why: '자막 트랙 URL이 비어 있습니다.' };

  // 자막 다운로드: json3 → XML 폴백
  const dl = await downloadCaption(baseUrl);
  if (!dl.text) {
    return { text: '', title, why: '자막 트랙은 찾았지만 내용을 받지 못했습니다. (서버 IP 제한 가능)' };
  }
  return { text: dl.text, segments: dl.segments, title, lang: pick?.languageCode || '' };
}

async function downloadCaption(baseUrl) {
  let text = '', segments = [];
  // json3
  try {
    const cr = await fetch(baseUrl + '&fmt=json3', { headers: { 'Accept-Language': 'en-US', 'User-Agent': DESKTOP_UA } });
    if (cr.ok) {
      const cj = await cr.json();
      if (cj && Array.isArray(cj.events)) {
        for (const ev of cj.events) {
          if (!ev.segs) continue;
          const t = ev.segs.map(s => s.utf8 || '').join('').replace(/[\n\r]/g, ' ').trim();
          if (!t) continue;
          segments.push({
            start: Math.round((ev.tStartMs || 0) / 100) / 10,
            dur: Math.round((ev.dDurationMs || 0) / 100) / 10,
            text: t,
          });
        }
        text = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
      }
    }
  } catch { /* XML 폴백 */ }

  if (!text) {
    try {
      const xr = await fetch(baseUrl, { headers: { 'User-Agent': DESKTOP_UA } });
      const xml = await xr.text();
      const re = /<text[^>]*\bstart="([\d.]+)"[^>]*?(?:\bdur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const t = decodeEntities(m[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
        if (!t) continue;
        segments.push({ start: parseFloat(m[1]) || 0, dur: parseFloat(m[2]) || 0, text: t });
      }
      text = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
    } catch { /* 무시 */ }
  }
  return { text, segments };
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&#34;/g, '"')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
