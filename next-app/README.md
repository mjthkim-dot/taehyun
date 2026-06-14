# Preply English Coach — Next.js 버전 (오프라인 PWA + 음성 인식)

기존 `voice-assistant/index.html`(단일 HTML SPA)을 Next.js 스택으로 이전하기 위한
스캐폴드입니다. 루트 정적 배포(Vercel)와 충돌하지 않도록 `next-app/` 안에 격리되어 있습니다.

## 구성

| 프롬프트 | 파일 | 설명 |
|---|---|---|
| 2 | `next.config.js` | `next-pwa` 설정 — 서비스워커 + 런타임 캐싱 + 오프라인 폴백 |
| 2 | `lib/storage.ts` | `idb` 기반 IndexedDB 유틸 — `saveLessonsToLocal`, `getLessonsFromLocal` |
| 2 | `hooks/useOfflineLessons.ts` | 온라인→API/오프라인→IndexedDB 자동 전환 Hook |
| 3 | `store/useLessonStore.ts` | Zustand 스토어 — `currentSentence` / `userSpeech` / `accuracyScore` |
| 3 | `components/SpeakingPractice.tsx` | Web Speech API 실시간 STT → 스토어 반영 + 정확도 평가 |
| — | `app/*` | 데모 페이지 / 샘플 `/api/lessons` / 오프라인 폴백 |

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
