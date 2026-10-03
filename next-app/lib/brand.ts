/**
 * 앱 브랜드 상수 — 상용화 Phase 0 리브랜딩.
 *
 * 기존 이름 "Preply English Coach"는 실제 튜터링 플랫폼 Preply의 등록 상표라
 * 상용 배포 시 상표권 침해가 된다. 사용자에게 보이는 모든 브랜드 문자열을
 * 이 파일 하나로 모아, 정식 브랜드명이 정해지면 여기만 바꾸면 되게 한다.
 *
 * 현재 값은 서술형 플레이스홀더(상표 충돌 위험 최소) — 정식 네이밍 전까지 사용.
 * ⚠️ public/manifest.json은 정적 파일이라 import를 못 쓴다 — 이름을 바꿀 때
 * manifest.json의 name/short_name도 함께 수정할 것.
 */
export const APP_NAME_EN = 'My English Coach';
export const APP_NAME_KO = '내 영어 코치';
/** 홈 히어로 등 마케팅성 타이틀 */
export const APP_TAGLINE_KO = 'AI 스피킹 코치';
