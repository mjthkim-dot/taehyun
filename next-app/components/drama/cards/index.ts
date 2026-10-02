/**
 * 엔딩 카드 import 목록(M2) — 카드 파일을 여기서 한 줄씩 import하면 모듈 로드 시 registerEndingCard가 돈다.
 * EndingExtras.tsx는 이 파일만 import한다(M5 리텔·M7 디코더·M9 HVPT·M10 D+7·M11 시즌이 더한다).
 *
 *   import './RetellCard';   // M5
 */
import './RetellCard'; // M5 — 이야기 다시 말하기 1회차(order 10) + 조금 더 2·3회차·교정(order 30)
import './RecallCard'; // M3 — 말로 떠올리기 3(order 20) + 조금 더 3(order 40)
import './DailyQuestionCard'; // M5 — 오늘 질문 1개(월·수·금, order 60)
export {};
