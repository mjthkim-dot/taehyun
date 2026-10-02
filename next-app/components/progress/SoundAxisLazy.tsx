'use client';

/**
 * 진도 화면용 '소리 축 TOP3' 지연 로더(M9) — ProgressScreen은 이 파일 import 1줄 + 렌더 1줄만 갖는다
 * (M10 등 다른 모듈도 같은 화면에 섹션을 더하므로 삽입을 최소로). 카드 본체·최소대립쌍 데이터는 따로 받는 청크.
 */
import dynamic from 'next/dynamic';

const SoundAxisLazy = dynamic(() => import('./SoundAxisCard'), { ssr: false });
export default SoundAxisLazy;
