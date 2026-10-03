/**
 * 브랜드·개인정보 회귀 가드 — 상용화 Phase 0에서 제거한 상표(Preply)와
 * 실명·소속(진옥/태현/메가존)이 다시 스며들지 않는지 지킨다.
 */
import fs from 'node:fs';
import { BASE, check, finish } from './helpers.mjs';

const html = await fetch(`${BASE}/app`).then((r) => r.text());
check('문서 타이틀에 새 브랜드', html.includes('My English Coach'));
check('HTML에 Preply 없음', !html.includes('Preply') && !html.includes('PREPLY'));

const lessons = fs.readFileSync(new URL('../../data/lessons.json', import.meta.url), 'utf8');
for (const term of ['진옥', '태현', 'Taehyun', '메가존', 'Megazone', 'Preply', 'PREPLY']) {
  check(`레슨 데이터에 "${term}" 없음`, !lessons.includes(term));
}

const manifest = JSON.parse(fs.readFileSync(new URL('../../public/manifest.json', import.meta.url), 'utf8'));
check('manifest 이름 교체됨', manifest.name === 'My English Coach');

finish('05-brand-guard');
