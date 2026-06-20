# Preply English Coach — Next.js 버전 (오프라인 PWA + 음성 인식)

기존 `voice-assistant/index.html`(8000줄+ 단일 HTML SPA)을 Next.js 스택으로 단계적으로
이전하는 프로젝트입니다. 루트 정적 배포(Vercel)와 충돌하지 않도록 `next-app/` 안에
격리되어 있고, 마이그레이션이 끝나기 전까지 기존 vanilla JS 앱은 그대로 서비스됩니다.

## 마이그레이션 현황

| 탭 | 상태 | 비고 |
|---|---|---|
| 📖 레슨(study) | ✅ 실데이터 이전 완료 | `data/lessons.json`(원본 LESSONS/MASTER_LESSONS/SCENARIO_LIBRARY 1:1 추출) 기반. 섹션/포인트/예문/대화문/프리토킹/숙제 렌더링. TTS는 Web Speech API만(Groq/MMS 고급 음성 미포팅) |
| 🔁 드릴(drill) | 🟡 v1 — 레슨 예문 기반 STT 연습만 | 쉐도잉/미니멀 페어 등 원본의 풍부한 드릴 모드는 미포팅 |
| 🏠 홈 / 🗣 회화 / 🎬 영상 / 📝 복습 / 📊 진도 / 🧰 기능 | ⬜ 미착수 | `ComingSoon` 플레이스홀더, 기존 앱으로 안내 |

## 구성

| 파일 | 설명 |
|---|---|
| `next.config.js` | `next-pwa` 설정 — 서비스워커 + 런타임 캐싱 + 오프라인 폴백 |
| `data/lessons.json` | 원본 커리큘럼 데이터(레슨/마스터코스/시나리오) 1:1 추출본 |
| `lib/lessons.ts` | 레슨 타입 + `lessonLabel`/`cefrOf`/`gseMid` 등 헬퍼 포팅 |
| `lib/storage.ts` | `idb` 기반 IndexedDB 유틸(아직 미연동, 추후 진도 캐싱용) |
| `hooks/useOfflineLessons.ts` | 온라인→API/오프라인→IndexedDB 자동 전환 Hook(아직 미연동) |
| `store/useLessonStore.ts` | Zustand 스토어 — `currentSentence` / `userSpeech` / `accuracyScore` |
| `components/StudyScreen.tsx` | 레슨 학습 화면(섹션/예문/대화문/프리토킹/숙제) |
| `components/DrillScreen.tsx` | 레슨 예문 기반 말하기 드릴 v1 |
| `components/SpeakingPractice.tsx` | Web Speech API 실시간 STT → 스토어 반영 + 정확도 평가 |
| `components/NavBar.tsx` | 기존 8탭 하단 네비게이션 |
| `app/page.tsx` | 앱 셸 — 탭 상태 관리 + 화면 전환 |

## 실행

```bash
cd next-app
npm install
npm run dev      # http://localhost:3000

npm run build && npm start   # PWA(서비스워커)는 프로덕션 빌드에서만 활성화
```

## 메모

- PWA는 `NODE_ENV=development`에서 비활성화됩니다(디버깅 편의). 오프라인 테스트는
  `npm run build && npm start` 후 DevTools → Network → Offline 으로 확인하세요.
- `public/icons/icon-192.png`, `icon-512.png` 아이콘 파일은 별도로 추가해야 합니다.
- 음성 인식(`SpeechRecognition`)은 Chrome/Edge 등 일부 브라우저만 지원합니다.
