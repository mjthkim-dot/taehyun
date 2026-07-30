/**
 * IT 영업 미팅 스크립트 — 어휘를 '실제 대화'로 굴리기 위한 상황별 대본.
 *
 * 각 상황은 ① 언제 쓰는지 ② 이 대화의 목표 ③ 단계별 목적과 핵심 표현
 * ④ 한국인이 자주 하는 실수 ⑤ 모범 대화 ⑥ AI 롤플레이용 상대 역할 지시로 구성된다.
 * talkPrompt는 회화 탭 핸드오프에 그대로 실려, 같은 상황을 AI와 연습하게 한다.
 */

export interface ScriptLine {
  en: string;
  kr: string;
  /** 왜 이렇게 말하는지 — 표현 선택의 이유 */
  note?: string;
}

export interface ScriptStep {
  label: string;
  /** 이 단계에서 달성해야 하는 것 */
  purpose: string;
  lines: ScriptLine[];
}

export interface SalesScenario {
  key: string;
  label: string;
  icon: string;
  situation: string;
  goal: string;
  steps: ScriptStep[];
  /** 흔한 실수 — 표현보다 이쪽이 실전에서 더 자주 발목을 잡는다 */
  pitfalls: string[];
  dialogue: { sp: string; en: string; kr: string }[];
  /** AI가 맡을 상대 역할 지시(회화 탭으로 전달) */
  talkPrompt: string;
}

export const SALES_SCENARIOS: SalesScenario[] = [
  {
    "key": "opening",
    "label": "고객 미팅 오프닝",
    "icon": "👋",
    "situation": "첫 고객 미팅의 처음 5분. 아이스브레이킹부터 아젠다 합의, 종료 시간 확인까지.",
    "goal": "본론에 들어가기 전에 분위기를 풀고, 오늘 다룰 범위와 시간을 상대와 합의한다.",
    "steps": [
      {
        "label": "아이스브레이킹",
        "purpose": "날씨·이동·근황 한두 마디로 시작한다. 길게 끌지 않는 것이 핵심이다.",
        "lines": [
          {
            "en": "Thanks for making the time today.",
            "kr": "오늘 시간 내주셔서 감사합니다.",
            "note": "가장 안전한 첫 문장입니다. Thank you for your time보다 자연스럽고 부담이 없습니다."
          },
          {
            "en": "Did you have any trouble finding the office?",
            "kr": "사무실 찾아오시는 데 불편은 없으셨나요?",
            "note": "대면 미팅의 정석 오프너입니다. 온라인이면 Can everyone hear me okay?로 바꿉니다."
          },
          {
            "en": "How has your week been so far?",
            "kr": "이번 주는 어떻게 보내고 계세요?",
            "note": "How are you?보다 대답할 거리를 주는 질문이라 대화가 이어집니다."
          }
        ]
      },
      {
        "label": "아젠다 합의",
        "purpose": "오늘 무엇을 다루는지 먼저 말하고 상대에게 추가할 것을 묻는다.",
        "lines": [
          {
            "en": "Let me quickly walk you through today's agenda.",
            "kr": "오늘 아젠다를 간단히 안내드리겠습니다.",
            "note": "walk you through는 '차근차근 설명하다'는 뜻의 영업 필수 표현입니다."
          },
          {
            "en": "Is there anything you'd like to add to the agenda?",
            "kr": "아젠다에 추가하고 싶으신 부분이 있을까요?",
            "note": "이 한 문장이 미팅의 주도권을 부드럽게 잡아줍니다."
          },
          {
            "en": "I'd like to spend most of the time on your current setup.",
            "kr": "현재 환경 이야기에 시간을 가장 많이 쓰고 싶습니다.",
            "note": "시간 배분을 미리 선언하면 논의가 흩어지지 않습니다."
          }
        ]
      },
      {
        "label": "시간·종료 확인",
        "purpose": "끝나는 시간을 먼저 못 박으면 상대가 편안해진다.",
        "lines": [
          {
            "en": "We have thirty minutes — does that still work for you?",
            "kr": "30분 잡혀 있는데, 지금도 괜찮으신가요?",
            "note": "상대 일정이 바뀌었을 수 있으니 반드시 확인합니다."
          },
          {
            "en": "I'll keep an eye on the time so we finish on schedule.",
            "kr": "시간을 보면서 제시간에 마치겠습니다.",
            "note": "keep an eye on the time은 프로페셔널하게 들리는 관용구입니다."
          },
          {
            "en": "Feel free to jump in anytime if you have questions.",
            "kr": "질문 있으시면 언제든 말씀해 주세요.",
            "note": "일방적 발표가 아니라 대화라는 신호를 줍니다."
          }
        ]
      }
    ],
    "pitfalls": [
      "아이스브레이킹을 3분 넘게 끌면 오히려 준비가 없어 보입니다 — 두세 마디면 충분합니다.",
      "Nice to meet you는 초면에만 씁니다. 구면이면 Good to see you again이 맞습니다.",
      "'회의를 시작하겠습니다'를 Let's start the meeting으로만 말하면 딱딱합니다 — Shall we get started?가 자연스럽습니다."
    ],
    "dialogue": [
      {
        "sp": "A",
        "en": "Thanks for making the time today. Did you have any trouble finding us?",
        "kr": "오늘 시간 내주셔서 감사합니다. 찾아오시는 데 어려움은 없으셨어요?"
      },
      {
        "sp": "B",
        "en": "Not at all. The directions were clear.",
        "kr": "전혀요. 안내가 명확했습니다."
      },
      {
        "sp": "A",
        "en": "Great. Shall we get started? We have thirty minutes.",
        "kr": "좋습니다. 시작할까요? 30분 잡혀 있습니다."
      },
      {
        "sp": "B",
        "en": "That works. I may need to leave five minutes early, though.",
        "kr": "괜찮습니다. 다만 5분 정도 일찍 나가야 할 수도 있어요."
      },
      {
        "sp": "A",
        "en": "Noted. Let me quickly walk you through today's agenda.",
        "kr": "알겠습니다. 오늘 아젠다를 간단히 안내드릴게요."
      },
      {
        "sp": "B",
        "en": "Sounds good. I'd like to cover the migration timeline as well.",
        "kr": "좋아요. 이관 일정도 함께 다뤘으면 합니다."
      },
      {
        "sp": "A",
        "en": "Absolutely — I'll add that. Feel free to jump in anytime.",
        "kr": "물론입니다, 추가하겠습니다. 언제든 말씀 주세요."
      },
      {
        "sp": "B",
        "en": "Will do. Let's get into it.",
        "kr": "그럴게요. 시작하시죠."
      }
    ],
    "talkPrompt": "당신은 한국 IT 기업의 인프라 담당 팀장입니다. 오늘 클라우드 도입을 검토하기 위해 파트너사 영업 담당(학습자)과 첫 미팅을 합니다. 학습자가 오프닝을 이끌도록 두고, 짧게 응답하며 아젠다에 '이관 일정'을 추가해 달라고 요청하세요. 지나치게 협조적이지 말고 현실적인 톤을 유지하세요."
  },
  {
    "key": "discovery",
    "label": "현황 파악 질문",
    "icon": "🔍",
    "situation": "고객의 현재 환경과 문제를 캐는 디스커버리 단계. 제안 전에 반드시 거쳐야 하는 대화.",
    "goal": "현재 구성·불편·영향·의사결정 구조를 질문으로 끌어내고, 마지막에 요약해 확인받는다.",
    "steps": [
      {
        "label": "현재 환경 파악",
        "purpose": "무엇을 쓰고 있는지 사실부터 확인한다.",
        "lines": [
          {
            "en": "Could you walk me through your current setup?",
            "kr": "현재 구성을 간단히 설명해 주실 수 있을까요?",
            "note": "디스커버리를 여는 표준 질문입니다."
          },
          {
            "en": "Which workloads are running on-premises today?",
            "kr": "현재 온프레미스에서 돌고 있는 워크로드는 무엇인가요?",
            "note": "system 대신 workload를 쓰면 전문성이 드러납니다."
          },
          {
            "en": "How is that managed today — in-house or with a partner?",
            "kr": "지금은 어떻게 운영되고 있나요, 내부인가요 파트너와 함께인가요?",
            "note": "운영 주체를 알면 제안 구조가 달라집니다."
          }
        ]
      },
      {
        "label": "문제와 영향 캐기",
        "purpose": "불편을 넘어 '그래서 무엇이 손해인가'까지 물어야 예산이 생긴다.",
        "lines": [
          {
            "en": "What's the biggest pain point with the current setup?",
            "kr": "현재 구성에서 가장 큰 어려움은 무엇인가요?",
            "note": "pain point는 영업에서 그대로 쓰는 표준 용어입니다."
          },
          {
            "en": "How much time does your team spend on that each month?",
            "kr": "그 일에 팀이 매달 얼마나 시간을 쓰나요?",
            "note": "시간을 물으면 비용으로 환산할 근거가 생깁니다."
          },
          {
            "en": "What happens if that isn't solved this year?",
            "kr": "올해 안에 해결되지 않으면 어떻게 되나요?",
            "note": "문제의 긴급도(urgency)를 재는 질문입니다."
          }
        ]
      },
      {
        "label": "의사결정 구조 확인",
        "purpose": "누가·언제·어떤 절차로 결정하는지 모르면 딜은 흐릅니다.",
        "lines": [
          {
            "en": "Who else would be involved in a decision like this?",
            "kr": "이런 결정에는 또 어떤 분들이 관여하시나요?",
            "note": "decision maker를 직접 묻는 것보다 훨씬 부드럽습니다."
          },
          {
            "en": "What does the approval process usually look like?",
            "kr": "보통 승인 절차는 어떻게 진행되나요?",
            "note": "품의·결재 흐름을 영어로 묻는 표준 표현입니다."
          },
          {
            "en": "Is there a budget set aside for this, or is it still being scoped?",
            "kr": "이 건에 예산이 잡혀 있나요, 아니면 아직 범위를 잡는 단계인가요?",
            "note": "예산을 단도직입적으로 묻지 않으면서 확인하는 방법입니다."
          }
        ]
      },
      {
        "label": "요약해 확인받기",
        "purpose": "들은 것을 되짚어 확인하면 신뢰가 크게 오릅니다.",
        "lines": [
          {
            "en": "Let me make sure I've got this right.",
            "kr": "제가 제대로 이해했는지 확인해 보겠습니다.",
            "note": "요약 전에 붙이는 관용 표현입니다."
          },
          {
            "en": "So the main issue is scaling during promotions — is that fair?",
            "kr": "그러니까 핵심 문제는 프로모션 기간 확장성이라는 거죠, 맞을까요?",
            "note": "is that fair?는 상대에게 정정할 여지를 주는 부드러운 확인입니다."
          },
          {
            "en": "What did I miss?",
            "kr": "제가 놓친 부분이 있을까요?",
            "note": "짧지만 매우 효과적인 마무리 질문입니다."
          }
        ]
      }
    ],
    "pitfalls": [
      "질문을 던지고 바로 제품 설명으로 넘어가면 디스커버리가 아니라 발표가 됩니다 — 답을 끝까지 듣고 한 번 더 파고드세요.",
      "Do you have a budget?처럼 직접 묻는 것은 무례하게 들립니다 — is it still being scoped?로 완충하세요.",
      "'담당자'를 person in charge로 옮기지 말고 who else would be involved로 물으면 자연스럽습니다."
    ],
    "dialogue": [
      {
        "sp": "A",
        "en": "Could you walk me through your current setup?",
        "kr": "현재 구성을 설명해 주실 수 있을까요?"
      },
      {
        "sp": "B",
        "en": "Most of it is on-premises. We moved only the web tier to the cloud.",
        "kr": "대부분 온프레미스입니다. 웹 계층만 클라우드로 옮겼어요."
      },
      {
        "sp": "A",
        "en": "What's the biggest pain point with that today?",
        "kr": "지금 그 구성에서 가장 큰 어려움은 무엇인가요?"
      },
      {
        "sp": "B",
        "en": "Scaling. During promotions we have to add servers manually.",
        "kr": "확장성이요. 프로모션 때 서버를 수동으로 붙여야 합니다."
      },
      {
        "sp": "A",
        "en": "How much time does your team spend on that each month?",
        "kr": "팀이 매달 거기에 얼마나 시간을 쓰나요?"
      },
      {
        "sp": "B",
        "en": "Maybe two full days, sometimes more.",
        "kr": "꼬박 이틀 정도요, 더 걸릴 때도 있고요."
      },
      {
        "sp": "A",
        "en": "Let me make sure I've got this right — the main issue is manual scaling. Is that fair?",
        "kr": "제대로 이해했는지 확인할게요, 핵심은 수동 확장이라는 거죠. 맞을까요?"
      },
      {
        "sp": "B",
        "en": "Yes, and the cost spikes that come with it.",
        "kr": "네, 그리고 그에 따르는 비용 급증도요."
      }
    ],
    "talkPrompt": "당신은 이커머스 회사의 인프라 팀장입니다. 현재 대부분 온프레미스이고 프로모션 기간마다 수동으로 서버를 늘려 힘들어합니다. 예산은 아직 확정되지 않았고, 결정에는 CTO와 재무팀이 관여합니다. 학습자(영업 담당)의 질문에 사실적으로 답하되, 먼저 정보를 다 주지 말고 질문받은 것만 답하세요."
  },
  {
    "key": "architecture",
    "label": "아키텍처·솔루션 설명",
    "icon": "🏗",
    "situation": "기술 구성을 비기술 의사결정자에게 설명하는 자리. 용어를 늘어놓으면 실패한다.",
    "goal": "구조를 세 덩어리로 요약하고, 각 요소를 고객의 문제와 연결해 설명한다.",
    "steps": [
      {
        "label": "큰 그림 먼저",
        "purpose": "세부보다 전체 구조를 먼저 세 덩어리로 제시한다.",
        "lines": [
          {
            "en": "At a high level, there are three parts to this.",
            "kr": "크게 보면 세 부분으로 나뉩니다.",
            "note": "At a high level은 비기술 청중에게 설명을 시작하는 표준 표현입니다."
          },
          {
            "en": "I'll keep this non-technical — stop me if you want more detail.",
            "kr": "기술적인 부분은 덜어내고 말씀드릴게요, 더 궁금하시면 말씀해 주세요.",
            "note": "상대의 수준을 존중하면서 통제권을 주는 문장입니다."
          },
          {
            "en": "Think of it as a front door, a workspace, and a vault.",
            "kr": "현관, 작업 공간, 금고라고 생각하시면 됩니다.",
            "note": "비유는 비기술 임원에게 가장 잘 통하는 설명 도구입니다."
          }
        ]
      },
      {
        "label": "문제와 연결",
        "purpose": "각 구성 요소를 아까 들은 문제와 붙여서 말한다.",
        "lines": [
          {
            "en": "This directly addresses the manual scaling you mentioned.",
            "kr": "이 부분이 아까 말씀하신 수동 확장 문제를 바로 해결합니다.",
            "note": "address는 '문제를 다룬다'는 뜻으로 제안서에서 자주 쓰입니다."
          },
          {
            "en": "Autoscaling handles the spikes so no one has to be on standby.",
            "kr": "오토스케일링이 급증을 처리해서 누구도 대기할 필요가 없습니다.",
            "note": "기능이 아니라 사람의 부담이 줄어드는 결과로 말합니다."
          },
          {
            "en": "The trade-off is a slightly higher baseline cost.",
            "kr": "대신 기본 비용이 조금 올라가는 트레이드오프가 있습니다.",
            "note": "단점을 먼저 말하면 신뢰가 올라갑니다."
          }
        ]
      },
      {
        "label": "이해 확인·질문 유도",
        "purpose": "설명 중간에 확인하지 않으면 끝에서 무너집니다.",
        "lines": [
          {
            "en": "Does that make sense so far?",
            "kr": "여기까지 이해되셨을까요?",
            "note": "Do you understand?는 상대를 시험하는 느낌이라 피합니다."
          },
          {
            "en": "Happy to go deeper on any of these.",
            "kr": "어느 부분이든 더 자세히 들어갈 수 있습니다.",
            "note": "깊이 조절권을 상대에게 넘깁니다."
          },
          {
            "en": "Let me put that in a diagram and send it over.",
            "kr": "그 부분은 도식으로 정리해서 보내드리겠습니다.",
            "note": "즉답이 어려울 때 자연스럽게 다음 접점을 만듭니다."
          }
        ]
      }
    ],
    "pitfalls": [
      "Do you understand?는 상대를 낮춰 보는 인상을 줍니다 — Does that make sense?를 쓰세요.",
      "약어를 연달아 쓰면(HA, DR, RTO, VPC…) 비기술 청중은 곧바로 이해를 포기합니다 — 하나 쓰면 한 번 풀어주세요.",
      "장점만 말하면 오히려 의심을 삽니다 — trade-off를 먼저 꺼내면 신뢰가 올라갑니다."
    ],
    "dialogue": [
      {
        "sp": "A",
        "en": "At a high level, there are three parts to this.",
        "kr": "크게 보면 세 부분으로 나뉩니다."
      },
      {
        "sp": "B",
        "en": "Please keep it simple — I'm not on the technical side.",
        "kr": "간단히 부탁드려요, 저는 기술 쪽이 아니라서요."
      },
      {
        "sp": "A",
        "en": "Of course. Think of it as a front door, a workspace, and a vault.",
        "kr": "물론입니다. 현관, 작업 공간, 금고라고 생각하시면 됩니다."
      },
      {
        "sp": "B",
        "en": "And which part solves our scaling problem?",
        "kr": "그중 어느 부분이 저희 확장 문제를 해결하나요?"
      },
      {
        "sp": "A",
        "en": "The workspace. Autoscaling handles the spikes automatically.",
        "kr": "작업 공간입니다. 오토스케일링이 급증을 자동으로 처리합니다."
      },
      {
        "sp": "B",
        "en": "Is there a downside?",
        "kr": "단점은 없나요?"
      },
      {
        "sp": "A",
        "en": "The trade-off is a slightly higher baseline cost.",
        "kr": "기본 비용이 조금 올라가는 트레이드오프가 있습니다."
      },
      {
        "sp": "B",
        "en": "Understood. Could you send that as a diagram?",
        "kr": "알겠습니다. 도식으로 보내주실 수 있을까요?"
      }
    ],
    "talkPrompt": "당신은 고객사 CFO입니다. 기술 배경이 없고 비용과 위험에만 관심이 있습니다. 학습자가 아키텍처를 설명하면 어려운 용어가 나올 때마다 쉽게 설명해 달라고 요청하고, 단점과 비용 영향을 반드시 되물으세요."
  },
  {
    "key": "objection",
    "label": "가격 반론 대응",
    "icon": "💰",
    "situation": "비싸다, 경쟁사가 더 싸다, 지금은 예산이 없다 — 가격 반론이 나왔을 때의 대화.",
    "goal": "반론을 방어하지 않고 먼저 인정한 뒤, 기준을 가격에서 총비용·위험으로 옮긴다.",
    "steps": [
      {
        "label": "먼저 인정하고 되묻기",
        "purpose": "반박부터 하면 대화가 닫힙니다. 인정 → 질문 순서를 지킵니다.",
        "lines": [
          {
            "en": "That's a fair point — thanks for being direct.",
            "kr": "타당한 지적이십니다, 솔직히 말씀해 주셔서 감사합니다.",
            "note": "반론을 인정하는 것이 대화를 여는 가장 빠른 길입니다."
          },
          {
            "en": "When you say it's expensive, what are you comparing it to?",
            "kr": "비싸다고 하실 때, 무엇과 비교하고 계신가요?",
            "note": "비교 기준을 드러내야 반론의 실체가 보입니다."
          },
          {
            "en": "Is it the total number, or the monthly commitment?",
            "kr": "총액이 문제인가요, 아니면 월 약정이 부담인가요?",
            "note": "가격 반론의 절반은 실제로는 현금흐름 문제입니다."
          }
        ]
      },
      {
        "label": "기준 옮기기",
        "purpose": "단가에서 총소유비용·위험·시간으로 프레임을 이동시킵니다.",
        "lines": [
          {
            "en": "If we look at the three-year TCO, the gap narrows considerably.",
            "kr": "3년 총소유비용으로 보면 격차가 상당히 줄어듭니다.",
            "note": "가격(price)이 아니라 TCO로 기준을 옮기는 핵심 문장입니다."
          },
          {
            "en": "That figure includes the operations work your team no longer does.",
            "kr": "그 수치에는 팀이 더 이상 하지 않아도 되는 운영 업무가 반영돼 있습니다.",
            "note": "인건비를 비용에 넣어야 비교가 공정해집니다."
          },
          {
            "en": "The cheaper option leaves the scaling risk with you.",
            "kr": "더 저렴한 안은 확장 리스크를 고객사가 그대로 안게 됩니다.",
            "note": "가격 차이를 리스크 이전 비용으로 재정의합니다."
          }
        ]
      },
      {
        "label": "조건부 양보",
        "purpose": "그냥 깎아주면 가치가 무너집니다. 반드시 교환 조건을 붙입니다.",
        "lines": [
          {
            "en": "I'd rather not discount the scope — could we adjust the term instead?",
            "kr": "범위를 깎기보다는 계약 기간을 조정해 보면 어떨까요?",
            "note": "할인 대신 조건을 바꾸는 표준 협상 화법입니다."
          },
          {
            "en": "If you can commit for two years, we could revisit the pricing.",
            "kr": "2년 약정이 가능하시면 가격을 다시 볼 수 있습니다.",
            "note": "If you ..., we could ... 구조가 교환 조건의 정형구입니다."
          },
          {
            "en": "Would a phased start help with this year's budget?",
            "kr": "단계적으로 시작하면 올해 예산에 도움이 될까요?",
            "note": "예산 문제는 시점 조정으로 풀리는 경우가 많습니다."
          }
        ]
      }
    ],
    "pitfalls": [
      "가격 반론에 곧바로 할인으로 답하면 이후 모든 숫자의 신뢰가 무너집니다 — 반드시 조건과 교환하세요.",
      "It's not expensive처럼 정면 부정하면 대화가 닫힙니다 — That's a fair point으로 열고 기준을 물으세요.",
      "경쟁사를 깎아내리지 마세요. 리스크가 어디에 남는지만 사실로 짚으면 충분합니다."
    ],
    "dialogue": [
      {
        "sp": "B",
        "en": "Honestly, your quote is about 20% higher than the other vendor.",
        "kr": "솔직히 견적이 다른 업체보다 20%쯤 높습니다."
      },
      {
        "sp": "A",
        "en": "That's a fair point — thanks for being direct. What are you comparing?",
        "kr": "타당한 지적이십니다, 솔직히 말씀해 주셔서 감사합니다. 무엇과 비교하고 계신가요?"
      },
      {
        "sp": "B",
        "en": "Their monthly figure for the same environment.",
        "kr": "같은 환경 기준 월 금액이요."
      },
      {
        "sp": "A",
        "en": "If we look at the three-year TCO, the gap narrows considerably.",
        "kr": "3년 총소유비용으로 보면 격차가 상당히 줄어듭니다."
      },
      {
        "sp": "B",
        "en": "Why is that?",
        "kr": "왜 그렇죠?"
      },
      {
        "sp": "A",
        "en": "That figure includes the operations work your team no longer does.",
        "kr": "그 수치에는 팀이 더 이상 하지 않아도 되는 운영 업무가 반영돼 있습니다."
      },
      {
        "sp": "B",
        "en": "Still, I need something to take to finance.",
        "kr": "그래도 재무팀에 가져갈 근거가 필요합니다."
      },
      {
        "sp": "A",
        "en": "If you can commit for two years, we could revisit the pricing.",
        "kr": "2년 약정이 가능하시면 가격을 다시 볼 수 있습니다."
      }
    ],
    "talkPrompt": "당신은 고객사 구매 담당자입니다. 경쟁사 견적이 20% 낮다는 점을 근거로 가격을 압박합니다. 학습자가 총소유비용이나 리스크로 설득하려 하면 쉽게 수긍하지 말고 재무팀을 설득할 근거를 계속 요구하세요. 다만 합리적인 교환 조건을 제시하면 검토하겠다고 답하세요."
  },
  {
    "key": "poc",
    "label": "PoC 제안 & 성공 기준 합의",
    "icon": "🧪",
    "situation": "검증(PoC)을 제안하고, 기간·범위·성공 기준을 못 박는 대화. 여기서 애매하면 딜이 늘어진다.",
    "goal": "PoC의 목적·기간·측정 기준·다음 단계를 한 번의 대화에서 합의한다.",
    "steps": [
      {
        "label": "PoC 제안하기",
        "purpose": "리스크를 줄여주는 제안으로 프레이밍합니다.",
        "lines": [
          {
            "en": "Rather than deciding on a deck, why don't we prove it on your data?",
            "kr": "자료만 보고 결정하시기보다, 실제 데이터로 검증해 보시면 어떨까요?",
            "note": "제안을 요청이 아니라 고객의 리스크 감소로 바꿉니다."
          },
          {
            "en": "We'd scope it to one workload so it stays lightweight.",
            "kr": "워크로드 하나로 범위를 좁혀 가볍게 진행하겠습니다.",
            "note": "범위를 먼저 좁혀야 시작 문턱이 낮아집니다."
          },
          {
            "en": "Two weeks should be enough to get a clear signal.",
            "kr": "2주면 분명한 결과를 보기에 충분합니다.",
            "note": "기간을 먼저 제시해 무한정 늘어지는 것을 막습니다."
          }
        ]
      },
      {
        "label": "성공 기준 합의",
        "purpose": "무엇이 성공인지 숫자로 정하지 않으면 PoC는 절대 끝나지 않습니다.",
        "lines": [
          {
            "en": "Let's agree on the success criteria before we start.",
            "kr": "시작 전에 성공 기준부터 합의하시죠.",
            "note": "이 대화 전체에서 가장 중요한 한 문장입니다."
          },
          {
            "en": "What number would make this a clear success for you?",
            "kr": "어떤 수치가 나오면 명확한 성공이라고 보시겠어요?",
            "note": "기준을 고객 입으로 말하게 만드는 질문입니다."
          },
          {
            "en": "So we're targeting sub-200ms latency and zero manual scaling.",
            "kr": "그러면 200ms 미만 지연과 수동 확장 제로를 목표로 하겠습니다.",
            "note": "합의를 즉시 요약해 못 박습니다."
          }
        ]
      },
      {
        "label": "다음 단계 못 박기",
        "purpose": "끝나고 무엇을 하는지까지 합의해야 딜이 굴러갑니다.",
        "lines": [
          {
            "en": "Who would be our main point of contact during the PoC?",
            "kr": "검증 기간 중 주 담당자는 어느 분이 되실까요?",
            "note": "PoC(검증)와 point of contact(담당자)를 구분해 말한 예입니다."
          },
          {
            "en": "If we hit those numbers, what would the next step look like?",
            "kr": "그 수치를 달성하면 다음 단계는 어떻게 될까요?",
            "note": "성공 시의 경로를 미리 합의해 두는 것이 핵심입니다."
          },
          {
            "en": "I'll send a one-page scope document by Thursday.",
            "kr": "목요일까지 한 장짜리 범위 문서를 보내드리겠습니다.",
            "note": "구두 합의를 문서로 굳히는 마무리입니다."
          }
        ]
      }
    ],
    "pitfalls": [
      "성공 기준 없이 시작한 PoC는 '조금 더 보자'가 반복되며 분기를 넘깁니다 — 숫자로 못 박으세요.",
      "PoC를 무료 컨설팅처럼 넓게 잡으면 리소스만 소진됩니다 — 워크로드 하나로 좁히세요.",
      "PoC라고 말할 때 POC(담당자)와 헷갈릴 수 있으니, 담당자는 point of contact로 풀어 말하세요."
    ],
    "dialogue": [
      {
        "sp": "A",
        "en": "Rather than deciding on a deck, why don't we prove it on your data?",
        "kr": "자료만 보고 결정하시기보다 실제 데이터로 검증해 보시면 어떨까요?"
      },
      {
        "sp": "B",
        "en": "How long would that take?",
        "kr": "얼마나 걸릴까요?"
      },
      {
        "sp": "A",
        "en": "Two weeks, scoped to one workload.",
        "kr": "2주면 됩니다, 워크로드 하나로 범위를 좁혀서요."
      },
      {
        "sp": "B",
        "en": "And what would we need to provide?",
        "kr": "저희는 무엇을 제공해야 하나요?"
      },
      {
        "sp": "A",
        "en": "Read access to one environment and a point of contact on your side.",
        "kr": "환경 하나에 대한 읽기 권한과 그쪽 담당자 한 분이면 됩니다."
      },
      {
        "sp": "A",
        "en": "Let's agree on the success criteria before we start.",
        "kr": "시작 전에 성공 기준부터 합의하시죠."
      },
      {
        "sp": "B",
        "en": "Latency under 200 milliseconds would convince me.",
        "kr": "지연이 200밀리초 미만이면 저는 납득할 것 같습니다."
      },
      {
        "sp": "A",
        "en": "Then if we hit that, what would the next step look like?",
        "kr": "그럼 그걸 달성하면 다음 단계는 어떻게 될까요?"
      }
    ],
    "talkPrompt": "당신은 고객사 기술 리더입니다. PoC에는 관심이 있지만 팀 리소스가 부족해 부담을 느낍니다. 기간·필요 리소스·성공 기준을 구체적으로 캐물으세요. 학습자가 성공 기준을 숫자로 합의하려 하면 협조하되, 다음 단계 확약은 신중하게 답하세요."
  },
  {
    "key": "exec",
    "label": "임원 보고 · QBR",
    "icon": "📊",
    "situation": "분기 리뷰나 경영진 보고. 시간이 짧고 청중은 결론부터 원한다.",
    "goal": "결론 → 근거 3개 → 요청 사항 순서로 압축해 전달하고, 반론에 헤징으로 대응한다.",
    "steps": [
      {
        "label": "결론 먼저",
        "purpose": "임원 보고는 두괄식이 아니면 시간을 잃습니다.",
        "lines": [
          {
            "en": "I'll start with the headline: we're ahead of plan on cost, behind on adoption.",
            "kr": "결론부터 말씀드리면, 비용은 계획을 앞섰고 도입률은 뒤처져 있습니다.",
            "note": "좋은 소식과 나쁜 소식을 한 문장에 담는 전형적인 두괄식입니다."
          },
          {
            "en": "Three things drove that, and I'll take each in turn.",
            "kr": "세 가지 요인이 있었고 차례로 말씀드리겠습니다.",
            "note": "구조를 미리 예고하면 청중이 따라오기 쉽습니다."
          },
          {
            "en": "I have one ask at the end.",
            "kr": "마지막에 한 가지 요청이 있습니다.",
            "note": "요청이 있다고 미리 알리면 끝까지 집중도가 유지됩니다."
          }
        ]
      },
      {
        "label": "근거를 숫자로",
        "purpose": "형용사 대신 숫자로 말합니다.",
        "lines": [
          {
            "en": "Cost per environment came down 18% quarter over quarter.",
            "kr": "환경당 비용이 전 분기 대비 18% 감소했습니다."
          },
          {
            "en": "Adoption is at 62% against an 80% target.",
            "kr": "도입률은 목표 80% 대비 62%입니다."
          },
          {
            "en": "The gap is concentrated in two business units.",
            "kr": "격차는 두 개 사업부에 집중돼 있습니다.",
            "note": "'전반적으로 저조하다'보다 훨씬 실행 가능한 정보입니다."
          }
        ]
      },
      {
        "label": "반론 대응과 요청",
        "purpose": "완곡한 표현으로 여지를 남기되 요청은 분명히 합니다.",
        "lines": [
          {
            "en": "That could well be a factor, though I'd want to verify it.",
            "kr": "그것도 요인일 수 있습니다만, 확인이 필요합니다.",
            "note": "단정하지 않으면서 반론을 받는 헤징 표현입니다."
          },
          {
            "en": "I see your point, although the timing was outside our control.",
            "kr": "말씀하신 취지는 알겠습니다만, 시점은 저희 통제 밖이었습니다."
          },
          {
            "en": "My ask is two more engineers for one quarter.",
            "kr": "제 요청은 한 분기 동안 엔지니어 두 명입니다.",
            "note": "요청은 반드시 숫자와 기간으로 말합니다."
          }
        ]
      }
    ],
    "pitfalls": [
      "배경 설명부터 시작하면 임원은 이미 다음 안건을 생각합니다 — 첫 문장에 결론을 넣으세요.",
      "'많이 개선됐습니다' 같은 형용사는 근거로 인정되지 않습니다 — 숫자와 비교 대상을 함께 말하세요.",
      "요청을 '지원이 필요합니다'로 뭉개면 아무 일도 일어나지 않습니다 — 인원·기간·금액으로 특정하세요."
    ],
    "dialogue": [
      {
        "sp": "A",
        "en": "I'll start with the headline: ahead of plan on cost, behind on adoption.",
        "kr": "결론부터 말씀드리면 비용은 계획을 앞섰고 도입률은 뒤처져 있습니다."
      },
      {
        "sp": "B",
        "en": "How far behind?",
        "kr": "얼마나 뒤처졌습니까?"
      },
      {
        "sp": "A",
        "en": "62% against an 80% target, concentrated in two business units.",
        "kr": "목표 80% 대비 62%이고, 두 개 사업부에 집중돼 있습니다."
      },
      {
        "sp": "B",
        "en": "Isn't that a training issue?",
        "kr": "그건 교육 문제 아닌가요?"
      },
      {
        "sp": "A",
        "en": "That could well be a factor, though I'd want to verify it.",
        "kr": "그것도 요인일 수 있습니다만, 확인이 필요합니다."
      },
      {
        "sp": "B",
        "en": "What do you need from us?",
        "kr": "우리에게 필요한 건 뭡니까?"
      },
      {
        "sp": "A",
        "en": "My ask is two more engineers for one quarter.",
        "kr": "제 요청은 한 분기 동안 엔지니어 두 명입니다."
      },
      {
        "sp": "B",
        "en": "Come back with the numbers behind that, and we'll consider it.",
        "kr": "근거 숫자를 가져오시면 검토하겠습니다."
      }
    ],
    "talkPrompt": "당신은 시간이 없는 임원(C-level)입니다. 배경 설명이 길어지면 결론을 물어 끊고, 형용사로 말하면 숫자를 요구하세요. 학습자가 요청을 뭉뚱그리면 인원·기간·금액을 특정하라고 되물으세요. 답변은 짧고 직설적으로 하세요."
  }
];
