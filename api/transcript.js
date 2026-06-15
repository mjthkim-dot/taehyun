/* 🎬 YouTube 자막(트랜스크립트) 자동 수집 프록시 — Vercel 서버리스 함수
 *
 * Strategy 1: YouTube InnerTube API (/youtubei/v1/player) — 앱 내부 API, 가장 안정적
 * Strategy 2: watch 페이지 → ytInitialPlayerResponse 균형-괄호 파싱 (정규식 없이)
 * Strategy 3: 개선된 정규식 (audioTracks 키로 끝 위치 확정)
 *
 * 호출:  GET /api/transcript?v=VIDEO_ID   또는   /api/transcript?url=<youtube url>
 *        선택: &lang=en
 * 응답:  { vid, lang, title, text, segments:[{start,dur,text}] }
 *        실패: { error, message }
 */

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Public Android client key used by yt-dlp / youtube-transcript ecosystem
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

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
        message: '이 영상에는 가져올 수 있는 자막이 없습니다. 스크립트를 직접 붙여넣어 주세요.',
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

/* ── 메인 트랜스크립트 수집 ─────────────────────────────────────────────── */
async function fetchTranscript(vid, preferLang) {
  let tracks = [];
  let title = '';

  /* ── Strategy 1: InnerTube API (YouTube 앱 내부 API) ─────────────────── */
  try {
    const r = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': DESKTOP_UA,
          'Accept-Language': 'en-US,en;q=0.9',
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '18.11.34',
        },
        body: JSON.stringify({
          videoId: vid,
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '18.11.34',
              androidSdkVersion: 30,
              hl: 'en',
              gl: 'US',
              utcOffsetMinutes: 0,
            },
          },
        }),
      }
    );
    if (r.ok) {
      const data = await r.json();
      title = data?.videoDetails?.title || '';
      tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    }
  } catch { /* Strategy 2로 진행 */ }

  /* ── Strategy 2: watch 페이지 → ytInitialPlayerResponse 균형-괄호 파싱 ─ */
  if (!tracks.length) {
    try {
      const r = await fetch(
        `https://www.youtube.com/watch?v=${vid}&hl=en&bpctr=9999999999&has_verified=1`,
        {
          headers: {
            'User-Agent': DESKTOP_UA,
            'Accept-Language': 'en-US,en;q=0.9',
            // CONSENT 및 SOCS 쿠키로 동의 화면 우회
            'Cookie': 'CONSENT=YES+cb; SOCS=CAI; PREF=hl=en;',
          },
        }
      );
      const html = await r.text();

      // 제목 추출
      if (!title) {
        const tm = html.match(/<title>([^<]*)<\/title>/);
        title = tm ? decodeEntities(tm[1]).replace(/ - YouTube$/, '').trim() : '';
      }

      // ytInitialPlayerResponse 위치 찾기 → 균형-괄호 탐색으로 JSON 경계 확정
      const marker = 'ytInitialPlayerResponse';
      const mPos = html.indexOf(marker);
      if (mPos !== -1) {
        const eqPos = html.indexOf('=', mPos + marker.length);
        const jsonStart = html.indexOf('{', eqPos + 1);
        if (jsonStart !== -1) {
          let depth = 0, i = jsonStart, end = -1;
          const limit = Math.min(html.length, jsonStart + 900_000);
          for (; i < limit; i++) {
            const c = html[i];
            if (c === '{') depth++;
            else if (c === '}') { if (--depth === 0) { end = i; break; } }
          }
          if (end !== -1) {
            try {
              const ipr = JSON.parse(html.slice(jsonStart, end + 1));
              if (!title) title = ipr?.videoDetails?.title || '';
              const t = ipr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
              if (t.length) tracks = t;
            } catch { /* Strategy 3으로 */ }
          }
        }
      }

      /* ── Strategy 3: captionTracks 개선 정규식 (끝 위치 고정) ──────────── */
      if (!tracks.length) {
        // audioTracks 또는 translationLanguages 키 앞까지를 끝으로 삼아 배열 경계 확정
        const m = html.match(/"captionTracks":([\s\S]*?)\s*,\s*"(?:audioTracks|translationLanguages|isTranslateable)"/);
        if (m) {
          try {
            tracks = JSON.parse(m[1].replace(/\\u0026/g, '&').replace(/\\u003d/g, '='));
          } catch {}
        }
      }

      // 전체 문자열에서 captionTracks 배열만 뽑는 최후 수단 (greedy + 균형-괄호)
      if (!tracks.length) {
        const ctPos = html.indexOf('"captionTracks":[');
        if (ctPos !== -1) {
          const arrStart = html.indexOf('[', ctPos);
          if (arrStart !== -1) {
            let depth2 = 0, j = arrStart, end2 = -1;
            for (; j < html.length && j < arrStart + 200_000; j++) {
              const c = html[j];
              if (c === '[' || c === '{') depth2++;
              else if (c === ']' || c === '}') { if (--depth2 === 0) { end2 = j; break; } }
            }
            if (end2 !== -1) {
              try {
                tracks = JSON.parse(
                  html.slice(arrStart, end2 + 1).replace(/\\u0026/g, '&').replace(/\\u003d/g, '=')
                );
              } catch {}
            }
          }
        }
      }
    } catch { /* tracks 빈 상태로 진행 */ }
  }

  if (!tracks.length) return { text: '', title };

  // baseUrl 유니코드 이스케이프 정규화
  tracks = tracks.map(t => ({
    ...t,
    baseUrl: (t.baseUrl || '').replace(/\\u0026/g, '&').replace(/\\u003d/g, '='),
  }));

  /* ── 트랙 선택: 요청 언어 → 영어 수동 → 영어 자동 → en* → 첫 번째 ─── */
  const pick =
    (preferLang && tracks.find(t => t.languageCode === preferLang)) ||
    tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks.find(t => (t.languageCode || '').startsWith('en')) ||
    tracks[0];

  const baseUrl = pick?.baseUrl || '';
  if (!baseUrl) return { text: '', title };

  /* ── 자막 다운로드: json3 우선 → XML 폴백 ───────────────────────────── */
  let text = '';
  let segments = [];

  try {
    const cr = await fetch(baseUrl + '&fmt=json3', {
      headers: { 'Accept-Language': 'en-US', 'User-Agent': DESKTOP_UA },
    });
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
    } catch {}
  }

  return { text, title, segments, lang: pick?.languageCode || '' };
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&#34;/g, '"')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
