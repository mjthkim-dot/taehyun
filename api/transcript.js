/* 🎬 YouTube 자막(트랜스크립트) 자동 수집 프록시 — Vercel 서버리스 함수
 *
 * 정적 SPA(브라우저)에서는 CORS 정책 때문에 유튜브 자막을 직접 가져올 수 없다.
 * 이 함수가 서버에서 유튜브 watch 페이지를 받아 captionTracks를 찾아내고,
 * 자막 트랙(json3/XML)을 파싱해 순수 텍스트로 돌려준다.
 *
 * 호출:  GET /api/transcript?v=VIDEO_ID   또는   /api/transcript?url=<youtube url>
 *        선택: &lang=en  (원하는 자막 언어코드, 없으면 영어 → 첫 트랙)
 * 응답:  { vid, lang, title, text }  /  실패 시 { error, message }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.query || {};
  const vid = extractId((q.v || q.url || '').toString());
  if (!vid) { res.status(400).json({ error: 'invalid_video', message: '유튜브 영상 ID를 인식하지 못했습니다.' }); return; }

  try {
    const out = await fetchTranscript(vid, (q.lang || '').toString());
    if (!out.text) {
      res.status(404).json({ error: 'no_captions', message: '이 영상에는 가져올 수 있는 자막이 없습니다. 스크립트를 직접 붙여넣어 주세요.', title: out.title || '' });
      return;
    }
    // segments: [{ start(초), dur(초), text }] — 실시간 싱크용 타임스탬프
    res.status(200).json({ vid, lang: out.lang || '', title: out.title || '', text: out.text, segments: out.segments || [] });
  } catch (e) {
    res.status(502).json({ error: 'fetch_failed', message: String((e && e.message) || e) });
  }
}

/* 다양한 유튜브 URL 형식 → 11자리 영상 ID */
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

async function fetchTranscript(vid, preferLang) {
  // 1) watch 페이지 HTML 수신 (consent 인터스티셜 우회 쿠키 + 데스크톱 UA)
  const r = await fetch(`https://www.youtube.com/watch?v=${vid}&hl=en`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'CONSENT=YES+cb',
    },
  });
  const html = await r.text();

  const titleM = html.match(/<title>([^<]*)<\/title>/);
  const title = titleM ? decodeEntities(titleM[1]).replace(/ - YouTube$/, '').trim() : '';

  // 2) captionTracks 배열 추출
  const tracksM = html.match(/"captionTracks":(\[.*?\])/);
  if (!tracksM) return { text: '', title };
  let tracks;
  try { tracks = JSON.parse(tracksM[1].replace(/\\u0026/g, '&')); } catch { return { text: '', title }; }
  if (!Array.isArray(tracks) || !tracks.length) return { text: '', title };

  // 3) 트랙 선택: 요청 언어 → 영어(수동) → 영어(자동) → en* → 첫 트랙
  const pick =
    (preferLang && tracks.find(t => t.languageCode === preferLang)) ||
    tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks.find(t => (t.languageCode || '').startsWith('en')) ||
    tracks[0];
  let baseUrl = (pick && pick.baseUrl || '').replace(/\\u0026/g, '&');
  if (!baseUrl) return { text: '', title };

  // 4) json3 포맷으로 깔끔하게 파싱 (실패 시 XML 폴백) — 텍스트 + 타임스탬프 세그먼트
  let text = '';
  let segments = [];
  try {
    const cr = await fetch(baseUrl + '&fmt=json3', { headers: { 'Accept-Language': 'en-US' } });
    const cj = await cr.json();
    if (cj && Array.isArray(cj.events)) {
      for (const e of cj.events) {
        if (!e.segs) continue;
        const t = e.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        segments.push({ start: Math.round((e.tStartMs || 0) / 100) / 10, dur: Math.round((e.dDurationMs || 0) / 100) / 10, text: t });
      }
      text = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
    }
  } catch { /* XML 폴백으로 */ }

  if (!text) {
    const xr = await fetch(baseUrl);
    const xml = await xr.text();
    const re = /<text[^>]*\bstart="([\d.]+)"[^>]*?(?:\bdur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const t = decodeEntities(m[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      if (!t) continue;
      segments.push({ start: parseFloat(m[1]) || 0, dur: parseFloat(m[2]) || 0, text: t });
    }
    text = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  }

  return { text, title, segments, lang: (pick && pick.languageCode) || '' };
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&#34;/g, '"')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
