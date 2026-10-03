/**
 * 드라마 홈 카드용 경량 색인 — 홈이 원고 전체(data/dramaSeed.json)를 끌어오지 않고도 '오늘의 에피소드'
 * 카드를 첫 화면과 같은 프레임에 그리게 한다(감사 v1.31 성능 G26). 원고와 어긋나지 않는지는
 * tests/unit/dramaIndex.test.ts가 필드별로 확인한다 — 원고를 고치면 여기도 함께 고친다.
 */
export const SERIES_NAME = "Taco at Nimbus";
export const SEED_COUNT = 7;

export interface EpisodeLite {
  no: number;
  titleKr: string;
  cliff: string;
}

export const SEED_INDEX: EpisodeLite[] = [
  {
    "no": 1,
    "titleKr": "첫날부터 멈춘 엘리베이터",
    "cliff": "엘리베이터에서 만난 Diane이 CEO였다! 10시 미팅, 태오는 무사할까?"
  },
  {
    "no": 2,
    "titleKr": "커피 주문 대참사",
    "cliff": "전 담당자를 울렸다는 고객 Mr. Grant. 태오의 첫 고객 통화가 시작된다."
  },
  {
    "no": 3,
    "titleKr": "첫 고객 통화",
    "cliff": "Grant가 계약 해지를 검토 중이다. 금요일, 태오는 고객을 지킬 수 있을까?"
  },
  {
    "no": 4,
    "titleKr": "빨간 폴더의 비밀",
    "cliff": "서버를 만든 사람은 바로 Jun이었다. 태오는 이걸 누구에게 말해야 할까?"
  },
  {
    "no": 5,
    "titleKr": "Jun의 비밀",
    "cliff": "Maya가 아프다. 내일, 태오는 까다로운 Grant를 혼자 만나야 한다."
  },
  {
    "no": 6,
    "titleKr": "혼자 만난 고객",
    "cliff": "'누가 실수했죠?' Grant의 질문. 태오는 Jun의 이름을 말할까?"
  },
  {
    "no": 7,
    "titleKr": "우리는 한 팀",
    "cliff": "CEO Diane의 '제안'은 무엇일까? 입사 첫 주를 마친 태오에게 새로운 기회가 온다."
  }
];

/** 출연진 아이콘(카드 머리의 얼굴들) */
export const CAST_ICONS: Record<string, string> = {"taeo": "🧑‍💼", "maya": "👩‍💼", "jun": "😎", "diane": "👩‍🦰", "grant": "🧔"};
