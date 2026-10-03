/**
 * 말하기 지표의 화면 문구 — A1 학습자가 알아듣는 쉬운 한국어로 한곳에 모은다(리뷰 B6).
 * WPM·필러·L1 간섭·회수율·청크 사용률·이해가능성 같은 전문용어를 화면에 그대로 쓰지 않는다.
 * 코드(필드 이름·저장 키)는 그대로 두고 **보이는 글자만** 이 상수를 쓴다.
 */

/** WPM 칩 이름 */
export const SPEED_LABEL = '말 속도';
/** 'WPM 42' → '말 속도 분당 42단어' */
export const wpmText = (n: number | string) => `${SPEED_LABEL} 분당 ${n}단어`;
/** 필러(um·uh) */
export const FILLER_LABEL = '음·어 같은 군말';
/** '필러 3' → '음·어 같은 군말 3번' */
export const fillerText = (n: number) => `${FILLER_LABEL} ${n}번`;
/** L1 간섭 */
export const L1_LABEL = '한국어식 표현';
/** 회수율(목표 문장 단어를 정확히 말한 비율) */
export const RECALL_LABEL = '정확히 말한 단어';
/** 청크 사용률(배운 표현을 실제로 쓴 비율) */
export const CHUNK_LABEL = '배운 표현 써먹기';
/** 이해가능성(힌트 없이 다시 받아쓴 일치율) */
export const INTELLIGIBLE_LABEL = '알아듣기 쉬움';
/** 유창성 축 이름 */
export const FLUENCY_LABEL = '말 속도·반응';
/** '지표 3축' 제목 */
export const METRICS_TITLE = '내 말하기 변화';
/** 튜터 점수와 방향 일치 */
export const TUTOR_AGREE_LABEL = '튜터 점수와 같은 쪽으로 움직였어요';
