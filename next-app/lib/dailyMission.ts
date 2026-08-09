'use client';

/**
 * 오늘의 비즈니스 미션 — "앱을 열면 오늘 할 딱 한 가지"의 핵심 데이터/로직.
 *
 * 실무(클라우드 세일즈·고객 미팅·발표·이메일 구두 표현) 상황을 큐레이션한 미션을
 * 날짜 기준으로 매일 하나씩 돌려서 보여준다(매일 새로움 + 항상 관련 있음). 정적
 * 데이터라 키·네트워크 없이도 즉시 동작한다. 완료는 날짜로 기록해 하루 1회 판정.
 */
import { load, store } from './state';
import { groqKoJson, hasHangul } from './aiGuard';

export interface MissionPhrase {
  en: string;
  kr: string;
}

export interface MissionDialogueLine {
  sp: 'A' | 'B';
  en: string;
  kr: string;
}

export interface BusinessMission {
  key: string;
  /** 상황 제목(한국어) */
  title: string;
  /** 오늘 목표 한 줄 */
  goal: string;
  /** 바로 쓰는 핵심 표현 5개 */
  phrases: MissionPhrase[];
  /** 실전 대화(A=상대/고객, B=나) */
  dialogue: { title: string; lines: MissionDialogueLine[] };
  /** AI와 자유 대화용 상황 설명 */
  talkPrompt: string;
}

export const BUSINESS_MISSIONS: BusinessMission[] = [
  {
    key: 'kickoff',
    title: '고객 미팅 열기 — 아이스브레이킹 & 아젠다',
    goal: '미팅 도입부를 자연스럽게 열고 오늘 다룰 내용을 정리해 말하기',
    phrases: [
      { en: 'Thanks for making the time today.', kr: '오늘 시간 내주셔서 감사합니다.' },
      { en: "Before we dive in, how has your week been?", kr: '본론에 들어가기 전에, 이번 주는 어떻게 보내셨어요?' },
      { en: "Let me quickly walk you through today's agenda.", kr: '오늘 아젠다를 간단히 안내해 드릴게요.' },
      { en: "Feel free to jump in anytime if you have questions.", kr: '질문 있으시면 언제든 편하게 말씀해 주세요.' },
      { en: "Does that work for you?", kr: '그렇게 진행해도 괜찮으실까요?' },
    ],
    dialogue: {
      title: '고객 미팅 시작 (Meeting Kickoff)',
      lines: [
        { sp: 'A', en: "Hi, good to see you. How have you been?", kr: '안녕하세요, 반갑습니다. 그동안 어떻게 지내셨어요?' },
        { sp: 'B', en: "Doing well, thanks. Thanks for making the time today.", kr: '잘 지냈습니다, 감사합니다. 오늘 시간 내주셔서 고마워요.' },
        { sp: 'A', en: "Of course. So, what's on the agenda?", kr: '물론이죠. 그래서 오늘 아젠다가 어떻게 되죠?' },
        { sp: 'B', en: "Let me quickly walk you through it. First, a status update, then next steps.", kr: '간단히 안내해 드릴게요. 먼저 진행 상황, 그다음 다음 단계입니다.' },
        { sp: 'A', en: 'Sounds good. Go ahead.', kr: '좋아요. 시작하시죠.' },
        { sp: 'B', en: "Great. Feel free to jump in anytime if you have questions.", kr: '감사합니다. 질문 있으시면 언제든 말씀해 주세요.' },
      ],
    },
    talkPrompt: '고객사와의 온라인 미팅을 막 시작하는 상황. 가볍게 안부를 묻고 오늘 아젠다를 소개하며 대화를 열어보세요.',
  },
  {
    key: 'status-update',
    title: '진행 상황 공유하기',
    goal: '프로젝트/제안 진행 상황을 명확하고 자신 있게 업데이트하기',
    phrases: [
      { en: "Here's where things stand right now.", kr: '현재 상황은 이렇습니다.' },
      { en: "We're on track to finish by the end of the month.", kr: '이달 말까지 마무리하는 일정으로 잘 진행되고 있어요.' },
      { en: "One thing I want to flag is the timeline for testing.", kr: '한 가지 짚어두고 싶은 건 테스트 일정입니다.' },
      { en: "We've made solid progress on the migration.", kr: '마이그레이션은 상당히 진척이 있었습니다.' },
      { en: "Let me know if you'd like more detail on any of this.", kr: '이 중 더 자세히 보고 싶은 부분 있으면 말씀해 주세요.' },
    ],
    dialogue: {
      title: '주간 진행 공유 (Status Update)',
      lines: [
        { sp: 'A', en: "Can you give me a quick update on where we are?", kr: '지금 어디까지 왔는지 간단히 업데이트해 줄 수 있어요?' },
        { sp: 'B', en: "Sure. Here's where things stand right now.", kr: '네. 현재 상황은 이렇습니다.' },
        { sp: 'A', en: 'Are we still on schedule?', kr: '일정은 아직 괜찮은가요?' },
        { sp: 'B', en: "Yes, we're on track to finish by the end of the month.", kr: '네, 이달 말까지 마무리하는 일정으로 잘 가고 있어요.' },
        { sp: 'A', en: 'Any risks I should know about?', kr: '알아둬야 할 리스크가 있나요?' },
        { sp: 'B', en: 'One thing I want to flag is the timeline for testing.', kr: '한 가지 짚어둘 건 테스트 일정입니다.' },
      ],
    },
    talkPrompt: '고객 또는 매니저에게 프로젝트 진행 상황을 보고하는 상황. 진척과 리스크를 함께 전달해 보세요.',
  },
  {
    key: 'demo',
    title: '솔루션/제품 데모 설명하기',
    goal: '우리 솔루션의 가치를 고객 입장에서 쉽게 설명하기',
    phrases: [
      { en: "Let me show you how this works in practice.", kr: '실제로 어떻게 동작하는지 보여드릴게요.' },
      { en: "The key benefit here is that it saves your team hours every week.", kr: '핵심 이점은 팀의 시간을 매주 몇 시간씩 아껴준다는 점입니다.' },
      { en: "This is where it gets interesting.", kr: '여기서부터가 흥미로운 부분이에요.' },
      { en: "Think of it as a single dashboard for everything.", kr: '모든 걸 한 대시보드에서 본다고 생각하시면 돼요.' },
      { en: "How does this compare to what you use today?", kr: '지금 쓰시는 것과 비교하면 어떠세요?' },
    ],
    dialogue: {
      title: '제품 데모 (Product Demo)',
      lines: [
        { sp: 'A', en: "Can you show me what it actually does?", kr: '실제로 뭘 하는 건지 보여줄 수 있어요?' },
        { sp: 'B', en: 'Absolutely. Let me show you how this works in practice.', kr: '물론이죠. 실제로 어떻게 동작하는지 보여드릴게요.' },
        { sp: 'A', en: 'Okay, walk me through it.', kr: '좋아요, 하나씩 설명해 주세요.' },
        { sp: 'B', en: "The key benefit here is that it saves your team hours every week.", kr: '핵심 이점은 팀의 시간을 매주 몇 시간씩 아껴준다는 거예요.' },
        { sp: 'A', en: "That's useful. What about reporting?", kr: '유용하네요. 리포팅은 어떤가요?' },
        { sp: 'B', en: 'Think of it as a single dashboard for everything.', kr: '모든 걸 한 대시보드에서 본다고 생각하시면 됩니다.' },
      ],
    },
    talkPrompt: '고객에게 우리 솔루션을 데모하며 핵심 가치를 설명하는 상황. 기능이 아니라 고객이 얻는 이점 중심으로 말해보세요.',
  },
  {
    key: 'objection',
    title: '고객 우려·이견에 대응하기',
    goal: '반대 의견을 방어하지 않고 침착하게 풀어가기',
    phrases: [
      { en: "That's a fair point.", kr: '충분히 일리 있는 말씀이에요.' },
      { en: "I understand the concern. Let me address that.", kr: '우려 이해합니다. 그 부분 말씀드릴게요.' },
      { en: "A lot of our customers felt the same way at first.", kr: '많은 고객분들이 처음엔 같은 생각을 하셨어요.' },
      { en: "Can I ask what's driving that concern?", kr: '어떤 점 때문에 그 우려가 생기는지 여쭤봐도 될까요?' },
      { en: "Would it help if we ran a small pilot first?", kr: '먼저 작게 파일럿을 해보면 도움이 될까요?' },
    ],
    dialogue: {
      title: '이견 대응 (Handling Objections)',
      lines: [
        { sp: 'A', en: "Honestly, I'm worried this might be too complex for us.", kr: '솔직히 저희한테 너무 복잡한 건 아닐까 걱정돼요.' },
        { sp: 'B', en: "That's a fair point. I understand the concern.", kr: '충분히 일리 있는 말씀이에요. 우려 이해합니다.' },
        { sp: 'A', en: "We've had bad experiences with migrations before.", kr: '예전에 마이그레이션에서 안 좋은 경험이 있었거든요.' },
        { sp: 'B', en: 'A lot of our customers felt the same way at first.', kr: '많은 고객분들이 처음엔 같은 생각을 하셨어요.' },
        { sp: 'A', en: 'So how do you handle that?', kr: '그럼 그건 어떻게 해결하나요?' },
        { sp: 'B', en: 'Would it help if we ran a small pilot first?', kr: '먼저 작게 파일럿을 해보면 도움이 될까요?' },
      ],
    },
    talkPrompt: '고객이 도입을 망설이며 우려를 표하는 상황. 방어하지 말고 공감한 뒤 해결책을 제시해 보세요.',
  },
  {
    key: 'pricing',
    title: '가격·견적 논의하기',
    goal: '가격 이야기를 자신 있고 명확하게 다루기',
    phrases: [
      { en: "Let me break down the pricing for you.", kr: '가격 구성을 하나씩 설명해 드릴게요.' },
      { en: "This option gives you the best value for your scale.", kr: '이 옵션이 지금 규모에는 가장 합리적입니다.' },
      { en: "I hear you on the budget.", kr: '예산 부분, 충분히 이해합니다.' },
      { en: "We have some flexibility if we adjust the scope.", kr: '범위를 조정하면 어느 정도 조율의 여지가 있어요.' },
      { en: "What kind of budget were you working with?", kr: '어느 정도 예산을 생각하고 계셨어요?' },
    ],
    dialogue: {
      title: '가격 논의 (Talking Pricing)',
      lines: [
        { sp: 'A', en: 'To be honest, it looks a bit over our budget.', kr: '솔직히 저희 예산보다 조금 높아 보여요.' },
        { sp: 'B', en: 'I hear you on the budget. Let me break down the pricing.', kr: '예산 이해합니다. 가격 구성을 설명해 드릴게요.' },
        { sp: 'A', en: 'What are we actually paying for here?', kr: '정확히 어디에 비용이 드는 건가요?' },
        { sp: 'B', en: 'This option gives you the best value for your scale.', kr: '이 옵션이 지금 규모엔 가장 합리적이에요.' },
        { sp: 'A', en: 'Is there any room to bring it down?', kr: '조금 낮출 여지는 있나요?' },
        { sp: 'B', en: 'We have some flexibility if we adjust the scope.', kr: '범위를 조정하면 어느 정도 조율의 여지가 있어요.' },
      ],
    },
    talkPrompt: '고객이 가격에 부담을 느끼는 상황. 가치를 설명하고 예산에 공감하며 대안을 제시해 보세요.',
  },
  {
    key: 'scheduling',
    title: '미팅 일정 조율하기',
    goal: '이메일 대신 말로 일정을 매끄럽게 잡기',
    phrases: [
      { en: "When works best for you next week?", kr: '다음 주 중 언제가 가장 편하세요?' },
      { en: "Would Tuesday afternoon suit you?", kr: '화요일 오후 괜찮으실까요?' },
      { en: "Let's pencil it in for now.", kr: '일단 가예약해 두죠.' },
      { en: "I'll send a calendar invite right after this.", kr: '이거 끝나고 바로 캘린더 초대 보내드릴게요.' },
      { en: "If something comes up, just let me know.", kr: '혹시 일이 생기면 편히 말씀해 주세요.' },
    ],
    dialogue: {
      title: '일정 잡기 (Scheduling)',
      lines: [
        { sp: 'A', en: 'We should set up a follow-up call.', kr: '후속 통화를 잡는 게 좋겠어요.' },
        { sp: 'B', en: 'Agreed. When works best for you next week?', kr: '동의합니다. 다음 주 중 언제가 가장 편하세요?' },
        { sp: 'A', en: "I'm fairly open, maybe midweek?", kr: '거의 비어 있어요, 주중쯤 어떨까요?' },
        { sp: 'B', en: 'Would Tuesday afternoon suit you?', kr: '화요일 오후 괜찮으실까요?' },
        { sp: 'A', en: 'Tuesday works. Around 3?', kr: '화요일 좋아요. 3시쯤?' },
        { sp: 'B', en: "Perfect. I'll send a calendar invite right after this.", kr: '좋습니다. 이거 끝나고 바로 초대 보내드릴게요.' },
      ],
    },
    talkPrompt: '고객과 다음 미팅 일정을 잡는 상황. 후보 시간을 제안하고 조율해 확정해 보세요.',
  },
  {
    key: 'followup',
    title: '팔로업 — 다음 단계 정리하기',
    goal: '미팅을 마무리하며 합의된 다음 단계를 명확히 하기',
    phrases: [
      { en: "Let me quickly recap what we agreed on.", kr: '합의한 내용을 간단히 정리할게요.' },
      { en: "So the next step on our side is to send a proposal.", kr: '저희 쪽 다음 단계는 제안서를 보내는 것입니다.' },
      { en: "On your end, would you be able to loop in your team?", kr: '그쪽에서는 팀을 함께 참여시켜 주실 수 있을까요?' },
      { en: "I'll follow up with a summary by tomorrow.", kr: '내일까지 요약 정리해서 보내드릴게요.' },
      { en: "Does that all sound right to you?", kr: '이 정도면 맞게 이해한 걸까요?' },
    ],
    dialogue: {
      title: '미팅 마무리 (Wrap-up & Next Steps)',
      lines: [
        { sp: 'B', en: 'Before we wrap up, let me quickly recap what we agreed on.', kr: '마치기 전에, 합의한 내용을 간단히 정리할게요.' },
        { sp: 'A', en: 'Good idea.', kr: '좋아요.' },
        { sp: 'B', en: 'So the next step on our side is to send a proposal.', kr: '저희 쪽 다음 단계는 제안서를 보내는 것입니다.' },
        { sp: 'A', en: 'And what do you need from us?', kr: '저희 쪽에서는 뭐가 필요할까요?' },
        { sp: 'B', en: 'On your end, would you be able to loop in your team?', kr: '그쪽에서는 팀을 함께 참여시켜 주실 수 있을까요?' },
        { sp: 'A', en: "Sure, I'll set that up.", kr: '네, 그렇게 준비할게요.' },
      ],
    },
    talkPrompt: '미팅을 마무리하며 합의 사항과 다음 단계를 정리하는 상황. 서로의 액션 아이템을 확인해 보세요.',
  },
  {
    key: 'presentation',
    title: '발표 오프닝 & 클로징',
    goal: '발표를 강하게 열고 인상적으로 닫기',
    phrases: [
      { en: "Thanks, everyone, for being here.", kr: '이 자리에 함께해 주셔서 감사합니다.' },
      { en: "Today I want to focus on one big question.", kr: '오늘은 하나의 큰 질문에 집중하려고 합니다.' },
      { en: "Let me leave you with one key takeaway.", kr: '마지막으로 핵심 하나만 남기겠습니다.' },
      { en: "So, where do we go from here?", kr: '그럼 여기서 어디로 가야 할까요?' },
      { en: "I'd love to hear your thoughts.", kr: '여러분의 생각을 꼭 듣고 싶습니다.' },
    ],
    dialogue: {
      title: '발표 오프닝 (Presentation Open)',
      lines: [
        { sp: 'B', en: 'Thanks, everyone, for being here.', kr: '이 자리에 함께해 주셔서 감사합니다.' },
        { sp: 'B', en: 'Today I want to focus on one big question.', kr: '오늘은 하나의 큰 질문에 집중하려고 합니다.' },
        { sp: 'A', en: 'Please go ahead.', kr: '네, 시작하세요.' },
        { sp: 'B', en: 'How do we help your teams move faster without adding risk?', kr: '어떻게 하면 리스크 없이 팀이 더 빠르게 움직이게 할 수 있을까요?' },
        { sp: 'A', en: "That's exactly what we're struggling with.", kr: '저희가 딱 고민하는 지점이에요.' },
        { sp: 'B', en: "Great. Let me leave you with one key takeaway at the end.", kr: '좋습니다. 마지막에 핵심 하나를 꼭 남기겠습니다.' },
      ],
    },
    talkPrompt: '고객 앞에서 발표를 시작하는 상황. 청중의 관심을 끄는 오프닝을 말하고, 핵심 메시지로 마무리해 보세요.',
  },
  {
    key: 'opinion',
    title: '회의에서 의견 제시 & 정중히 반대하기',
    goal: '내 의견을 분명히 말하되 상대를 존중하며 반대하기',
    phrases: [
      { en: "From my perspective, the bigger risk is timing.", kr: '제 관점에서는 더 큰 리스크는 타이밍입니다.' },
      { en: "I see it a little differently.", kr: '저는 조금 다르게 봅니다.' },
      { en: "That said, I do agree on the goal.", kr: '그렇긴 해도, 목표에는 저도 동의해요.' },
      { en: "Can we consider another option?", kr: '다른 옵션도 검토해 볼 수 있을까요?' },
      { en: "What if we tried it the other way around?", kr: '반대로 해보면 어떨까요?' },
    ],
    dialogue: {
      title: '의견 & 정중한 반대 (Speaking Up)',
      lines: [
        { sp: 'A', en: 'I think we should launch everything at once.', kr: '전부 한 번에 출시해야 한다고 봐요.' },
        { sp: 'B', en: 'I see it a little differently.', kr: '저는 조금 다르게 봅니다.' },
        { sp: 'A', en: 'Oh? Why is that?', kr: '오? 왜 그렇게 보세요?' },
        { sp: 'B', en: 'From my perspective, the bigger risk is timing.', kr: '제 관점에서는 더 큰 리스크가 타이밍이에요.' },
        { sp: 'A', en: "That's a fair concern.", kr: '충분히 일리 있는 걱정이네요.' },
        { sp: 'B', en: 'That said, I do agree on the goal. What if we phased it?', kr: '그렇긴 해도 목표엔 동의해요. 단계적으로 하면 어떨까요?' },
      ],
    },
    talkPrompt: '회의에서 다른 사람의 제안에 정중히 반대하며 대안을 제시하는 상황. 존중하는 톤으로 내 의견을 말해보세요.',
  },
  {
    key: 'small-talk',
    title: '콘퍼런스 네트워킹 스몰토크',
    goal: '처음 만난 사람과 자연스럽게 대화를 트고 이어가기',
    phrases: [
      { en: "What brings you to the conference?", kr: '이 콘퍼런스엔 어떻게 오셨어요?' },
      { en: "What do you do, if you don't mind me asking?", kr: '실례가 안 된다면, 어떤 일 하세요?' },
      { en: "Oh, that's interesting. How did you get into that?", kr: '오, 흥미롭네요. 어쩌다 그 일을 하게 되셨어요?' },
      { en: "We should stay in touch.", kr: '앞으로도 연락하고 지내면 좋겠어요.' },
      { en: "Here's my card — feel free to reach out anytime.", kr: '제 명함이에요 — 언제든 편히 연락 주세요.' },
    ],
    dialogue: {
      title: '네트워킹 (Networking Small Talk)',
      lines: [
        { sp: 'B', en: 'Hi, is this seat taken? What brings you to the conference?', kr: '안녕하세요, 여기 자리 있나요? 콘퍼런스엔 어떻게 오셨어요?' },
        { sp: 'A', en: "It's free. I'm here for the AI sessions.", kr: '비어 있어요. AI 세션 들으러 왔어요.' },
        { sp: 'B', en: "Nice. What do you do, if you don't mind me asking?", kr: '좋네요. 실례가 안 된다면 어떤 일 하세요?' },
        { sp: 'A', en: "I lead infrastructure at a fintech startup.", kr: '핀테크 스타트업에서 인프라를 맡고 있어요.' },
        { sp: 'B', en: "Oh, that's interesting. How did you get into that?", kr: '오, 흥미롭네요. 어쩌다 그 일을 하게 되셨어요?' },
        { sp: 'A', en: 'Long story! But I love it.', kr: '얘기하자면 길어요! 그래도 정말 좋아해요.' },
      ],
    },
    talkPrompt: '콘퍼런스에서 처음 만난 사람과 스몰토크를 나누는 상황. 질문으로 대화를 열고 자연스럽게 이어가 보세요.',
  },
  {
    key: 'apology',
    title: '이슈 사과 & 해결책 제시하기',
    goal: '문제가 생겼을 때 신뢰를 지키며 대응하기',
    phrases: [
      { en: "I want to apologize for the delay.", kr: '지연에 대해 사과드리고 싶습니다.' },
      { en: "Here's what happened, and here's what we're doing about it.", kr: '무슨 일이 있었는지, 그리고 어떻게 조치하고 있는지 말씀드릴게요.' },
      { en: "We take full responsibility for this.", kr: '이 부분은 전적으로 저희 책임입니다.' },
      { en: "To make it right, we'll prioritize your case.", kr: '바로잡기 위해 고객님 건을 최우선으로 처리하겠습니다.' },
      { en: "I'll personally keep you updated until it's resolved.", kr: '해결될 때까지 제가 직접 계속 업데이트드리겠습니다.' },
    ],
    dialogue: {
      title: '이슈 대응 (Owning a Problem)',
      lines: [
        { sp: 'A', en: 'The rollout was late and it caused us real problems.', kr: '롤아웃이 늦어서 저희가 실제로 곤란했어요.' },
        { sp: 'B', en: 'I want to apologize for the delay. We take full responsibility.', kr: '지연에 대해 사과드립니다. 전적으로 저희 책임입니다.' },
        { sp: 'A', en: 'So what now?', kr: '그래서 이제 어떻게 되나요?' },
        { sp: 'B', en: "Here's what happened, and here's what we're doing about it.", kr: '무슨 일이 있었는지, 어떻게 조치하는지 말씀드릴게요.' },
        { sp: 'A', en: 'I need this fixed fast.', kr: '빨리 해결돼야 해요.' },
        { sp: 'B', en: "To make it right, we'll prioritize your case.", kr: '바로잡기 위해 고객님 건을 최우선으로 처리하겠습니다.' },
      ],
    },
    talkPrompt: '납기 지연 등 문제가 생겨 고객이 화가 난 상황. 진심으로 사과하고 구체적인 해결책과 후속 조치를 제시해 보세요.',
  },
  {
    key: 'email-spoken',
    title: '이메일 내용을 말로 — 요청 & 리마인드',
    goal: '이메일로 쓸 요청/리마인드를 부드럽게 말로 전하기',
    phrases: [
      { en: "I just wanted to follow up on my last message.", kr: '지난번에 드린 메시지 관련해서 확인차 연락드려요.' },
      { en: "Whenever you get a chance, could you review the doc?", kr: '시간 되실 때, 문서 한번 검토해 주실 수 있을까요?' },
      { en: "No rush, but I'd love your feedback by Friday.", kr: '급하진 않지만, 금요일까지 피드백 주시면 좋겠어요.' },
      { en: "Just a gentle reminder about the deadline.", kr: '마감 관련해서 가볍게 리마인드드려요.' },
      { en: "Let me know if anything is unclear.", kr: '불명확한 부분 있으면 말씀해 주세요.' },
    ],
    dialogue: {
      title: '팔로업 요청 (Following Up)',
      lines: [
        { sp: 'B', en: 'Hi, I just wanted to follow up on my last message.', kr: '안녕하세요, 지난 메시지 관련 확인차 연락드려요.' },
        { sp: 'A', en: "Right, sorry — it's been a busy week.", kr: '아 맞다, 죄송해요 — 이번 주가 정신없었어요.' },
        { sp: 'B', en: "No worries. Whenever you get a chance, could you review the doc?", kr: '괜찮아요. 시간 되실 때 문서 한번 검토해 주실 수 있을까요?' },
        { sp: 'A', en: 'Sure, when do you need it?', kr: '그럼요, 언제까지 필요하세요?' },
        { sp: 'B', en: "No rush, but I'd love your feedback by Friday.", kr: '급하진 않지만 금요일까지 주시면 좋겠어요.' },
        { sp: 'A', en: "I'll get it to you by then.", kr: '그때까지 드릴게요.' },
      ],
    },
    talkPrompt: '답이 없는 상대에게 부드럽게 팔로업하며 검토/피드백을 요청하는 상황. 재촉하지 않되 명확하게 부탁해 보세요.',
  },
  {
    key: 'negotiation',
    title: '할인 요청 받아치기 — 조건 협상',
    goal: '가격을 깎아 달라는 요구에 가치를 지키면서 조건을 교환하기',
    phrases: [
      { en: "I hear you — budget matters. Let's see what we can do.", kr: '말씀 이해합니다 — 예산이 중요하죠. 어떻게 할 수 있을지 보시죠.' },
      { en: "If we adjust the scope, we can meet that number.", kr: '범위를 조정하면 그 금액에 맞출 수 있습니다.' },
      { en: "A discount is possible with a two-year commitment.", kr: '2년 약정이면 할인이 가능합니다.' },
      { en: "What matters more to you — price or timeline?", kr: '가격과 일정 중 어느 쪽이 더 중요하세요?' },
      { en: "Let me take this back and come back with options tomorrow.", kr: '가져가서 검토하고 내일 옵션을 들고 오겠습니다.' },
    ],
    dialogue: {
      title: '할인 협상 (Negotiating a Discount)',
      lines: [
        { sp: 'A', en: 'Honestly, we need at least 15% off to move forward.', kr: '솔직히, 진행하려면 최소 15%는 할인이 필요해요.' },
        { sp: 'B', en: "I hear you — budget matters. Let's see what we can do.", kr: '이해합니다 — 예산이 중요하죠. 어떻게 할 수 있을지 보시죠.' },
        { sp: 'A', en: 'Is that kind of discount even possible?', kr: '그 정도 할인이 가능하긴 한가요?' },
        { sp: 'B', en: 'A discount is possible with a two-year commitment.', kr: '2년 약정이면 할인이 가능합니다.' },
        { sp: 'A', en: 'Two years is a long time for us.', kr: '2년은 저희한테 좀 길어요.' },
        { sp: 'B', en: 'Then what matters more to you — price or flexibility?', kr: '그렇다면 가격과 유연성 중 어느 쪽이 더 중요하세요?' },
        { sp: 'A', en: 'Flexibility, probably. Can you draft both options?', kr: '아마 유연성이요. 두 옵션 다 정리해 주실 수 있나요?' },
        { sp: 'B', en: "Sure. Let me take this back and come back with options tomorrow.", kr: '네. 가져가서 검토하고 내일 옵션을 들고 오겠습니다.' },
      ],
    },
    talkPrompt: '고객이 강하게 할인을 요구하는 협상 상황. 바로 깎아주지 말고 약정·범위·조건과 교환하며 가치를 지켜보세요.',
  },
  {
    key: 'renewal-qbr',
    title: '갱신 미팅 — 1년 성과 정리',
    goal: '지난 계약 기간의 가치를 숫자로 정리하고 갱신 논의를 열기',
    phrases: [
      { en: "Let's look back at what we achieved together this year.", kr: '올해 함께 이룬 것들을 돌아보시죠.' },
      { en: 'Your incident count dropped from twelve to three.', kr: '장애 건수가 12건에서 3건으로 줄었습니다.' },
      { en: "That translates to roughly 20% lower operating costs.", kr: '대략 운영 비용 20% 절감에 해당합니다.' },
      { en: "For next year, I'd like to propose two improvements.", kr: '내년에는 두 가지 개선을 제안드리고 싶습니다.' },
      { en: 'Shall we walk through the renewal terms?', kr: '갱신 조건을 같이 보실까요?' },
    ],
    dialogue: {
      title: '갱신 미팅 (Renewal Review)',
      lines: [
        { sp: 'B', en: "Thanks for the time. Let's look back at what we achieved together this year.", kr: '시간 내주셔서 감사합니다. 올해 함께 이룬 것들을 돌아보시죠.' },
        { sp: 'A', en: 'Sounds good. How did the numbers turn out?', kr: '좋아요. 숫자는 어떻게 나왔나요?' },
        { sp: 'B', en: 'Your incident count dropped from twelve to three.', kr: '장애 건수가 12건에서 3건으로 줄었습니다.' },
        { sp: 'A', en: "That's better than I expected.", kr: '기대했던 것보다 좋네요.' },
        { sp: 'B', en: 'And that translates to roughly 20% lower operating costs.', kr: '그리고 그건 대략 운영 비용 20% 절감에 해당합니다.' },
        { sp: 'A', en: 'What are you thinking for next year?', kr: '내년은 어떻게 생각하세요?' },
        { sp: 'B', en: "I'd like to propose two improvements — and walk through the renewal terms.", kr: '두 가지 개선을 제안드리고, 갱신 조건도 같이 보고 싶습니다.' },
      ],
    },
    talkPrompt: '연간 계약 갱신을 앞둔 리뷰 미팅. 성과를 숫자로 말하고, 내년 제안과 갱신 조건 논의로 자연스럽게 넘어가 보세요.',
  },
  {
    key: 'escalation',
    title: '장애 상황 보고 — 신뢰 지키기',
    goal: '장애 사실·영향·조치를 숨김없이, 그러나 침착하게 전달하기',
    phrases: [
      { en: "I want to give you a transparent update on the incident.", kr: '장애 상황을 투명하게 공유드리려 합니다.' },
      { en: 'The impact was limited to the reporting module.', kr: '영향은 리포팅 모듈에 국한됐습니다.' },
      { en: 'Service was restored at 2:40 PM.', kr: '서비스는 오후 2시 40분에 복구됐습니다.' },
      { en: "Here's what we're changing so this doesn't happen again.", kr: '재발하지 않도록 이렇게 바꾸고 있습니다.' },
      { en: "I'll send a full report by tomorrow morning.", kr: '내일 오전까지 전체 보고서를 보내드리겠습니다.' },
    ],
    dialogue: {
      title: '장애 브리핑 (Incident Update)',
      lines: [
        { sp: 'B', en: 'Thanks for joining on short notice. I want to give you a transparent update on the incident.', kr: '급하게 시간 내주셔서 감사합니다. 장애 상황을 투명하게 공유드리려 합니다.' },
        { sp: 'A', en: 'How bad was it?', kr: '얼마나 심각했나요?' },
        { sp: 'B', en: 'The impact was limited to the reporting module — core operations were not affected.', kr: '영향은 리포팅 모듈에 국한됐고, 핵심 운영에는 영향이 없었습니다.' },
        { sp: 'A', en: 'Is it fixed now?', kr: '지금은 해결됐나요?' },
        { sp: 'B', en: 'Yes, service was restored at 2:40 PM.', kr: '네, 오후 2시 40분에 복구됐습니다.' },
        { sp: 'A', en: 'How do I know this won\'t happen again?', kr: '재발하지 않을 거라고 어떻게 믿죠?' },
        { sp: 'B', en: "Fair question. Here's what we're changing — and I'll send a full report by tomorrow morning.", kr: '당연한 질문입니다. 이렇게 바꾸고 있고, 내일 오전까지 전체 보고서를 드리겠습니다.' },
      ],
    },
    talkPrompt: '서비스 장애 후 화가 난 고객에게 상황을 브리핑하는 자리. 변명하지 말고 사실·영향·조치·재발 방지 순서로 신뢰를 지켜보세요.',
  },
  {
    key: 'networking',
    title: '컨퍼런스 네트워킹 — 처음 보는 사람에게 말 걸기',
    goal: '행사장에서 자연스럽게 대화를 열고 연락처를 교환하기',
    phrases: [
      { en: 'Mind if I join you? I loved that last session.', kr: '합석해도 될까요? 방금 세션 정말 좋았어요.' },
      { en: 'What brings you to the conference?', kr: '이번 컨퍼런스엔 어떤 일로 오셨어요?' },
      { en: 'We help companies move workloads to the cloud.', kr: '저희는 기업의 클라우드 전환을 돕고 있어요.' },
      { en: "That sounds like something we should talk more about.", kr: '그건 좀 더 얘기해 보면 좋겠는데요.' },
      { en: 'Can I connect with you on LinkedIn?', kr: '링크드인으로 연결해도 될까요?' },
    ],
    dialogue: {
      title: '행사장 스몰토크 (Conference Networking)',
      lines: [
        { sp: 'B', en: 'Mind if I join you? I loved that last session.', kr: '합석해도 될까요? 방금 세션 정말 좋았어요.' },
        { sp: 'A', en: 'Of course. Yeah, the AI cost part was interesting.', kr: '그럼요. 네, AI 비용 파트가 흥미롭더라고요.' },
        { sp: 'B', en: 'Right? What brings you to the conference?', kr: '그렇죠? 이번 컨퍼런스엔 어떤 일로 오셨어요?' },
        { sp: 'A', en: "We're looking into modernizing our data platform.", kr: '데이터 플랫폼 현대화를 검토 중이에요.' },
        { sp: 'B', en: 'Oh, we help companies with exactly that — moving workloads to the cloud.', kr: '오, 저희가 딱 그런 일을 해요 — 워크로드 클라우드 전환이요.' },
        { sp: 'A', en: 'Interesting. What kind of customers do you work with?', kr: '흥미롭네요. 어떤 고객사들과 일하세요?' },
        { sp: 'B', en: 'Mostly manufacturing and finance. That sounds like something we should talk more about — can I connect with you on LinkedIn?', kr: '주로 제조와 금융이요. 좀 더 얘기해 보면 좋겠는데요 — 링크드인으로 연결해도 될까요?' },
      ],
    },
    talkPrompt: '컨퍼런스 커피 브레이크에서 옆자리 참가자와 대화를 트는 상황. 세션 이야기로 시작해 상대의 관심사를 묻고 자연스럽게 연결까지 이어가 보세요.',
  },
  {
    key: 'cold-intro',
    title: '첫 연락 — 30초 안에 관심 얻기',
    goal: '처음 연락한 상대에게 짧고 명확하게 용건과 가치를 전하기',
    phrases: [
      { en: "Thanks for taking my call — I'll keep this short.", kr: '전화 받아주셔서 감사합니다 — 짧게 말씀드릴게요.' },
      { en: 'We recently helped a company like yours cut cloud costs by 30%.', kr: '최근 비슷한 회사의 클라우드 비용을 30% 줄여드렸습니다.' },
      { en: "I'm not asking you to buy anything today.", kr: '오늘 뭘 사시라는 게 아닙니다.' },
      { en: 'Would a 20-minute intro call next week make sense?', kr: '다음 주에 20분 소개 미팅 어떠실까요?' },
      { en: 'What would be the best way to follow up?', kr: '어떤 방식으로 후속 연락드리면 좋을까요?' },
    ],
    dialogue: {
      title: '콜드콜 (Cold Introduction)',
      lines: [
        { sp: 'B', en: "Hi, thanks for taking my call — I'll keep this short.", kr: '안녕하세요, 전화 받아주셔서 감사합니다 — 짧게 말씀드릴게요.' },
        { sp: 'A', en: "Okay, what's this about?", kr: '네, 무슨 일이시죠?' },
        { sp: 'B', en: 'We recently helped a manufacturer like yours cut cloud costs by 30%.', kr: '최근 비슷한 제조사의 클라우드 비용을 30% 줄여드렸습니다.' },
        { sp: 'A', en: "We already have a vendor for that.", kr: '저희는 이미 그쪽 업체가 있어요.' },
        { sp: 'B', en: "Totally understandable — I'm not asking you to buy anything today.", kr: '충분히 이해합니다 — 오늘 뭘 사시라는 게 아니에요.' },
        { sp: 'A', en: 'Then what are you asking?', kr: '그럼 뭘 원하시는 거죠?' },
        { sp: 'B', en: 'Just 20 minutes next week to share what worked for them. Would that make sense?', kr: '다음 주 20분만요 — 그 회사에 뭐가 통했는지 공유드리고 싶습니다. 어떠세요?' },
      ],
    },
    talkPrompt: '처음 연락하는 잠재 고객과의 짧은 통화. 상대는 바쁘고 회의적입니다. 30초 안에 관심을 얻고 다음 미팅 약속까지 만들어 보세요.',
  },
  {
    key: 'exec-brief',
    title: '임원에게 3분 브리핑',
    goal: '결론부터 말하고, 근거는 짧게, 요청은 명확하게',
    phrases: [
      { en: "Bottom line first: we're on track, with one risk to flag.", kr: '결론부터: 순조롭게 진행 중이고, 리스크 하나만 공유드립니다.' },
      { en: 'Three things drove this result.', kr: '이 결과를 만든 요인은 세 가지입니다.' },
      { en: 'The risk is vendor lock-in on the data layer.', kr: '리스크는 데이터 계층의 벤더 종속입니다.' },
      { en: 'My recommendation is to run a dual-vendor pilot.', kr: '제 권고는 듀얼 벤더 파일럿입니다.' },
      { en: 'I need your sign-off on the budget by Friday.', kr: '금요일까지 예산 승인이 필요합니다.' },
    ],
    dialogue: {
      title: '임원 브리핑 (Executive Briefing)',
      lines: [
        { sp: 'B', en: "Bottom line first: we're on track, with one risk to flag.", kr: '결론부터: 순조롭게 진행 중이고, 리스크 하나만 공유드립니다.' },
        { sp: 'A', en: "Good. What's the risk?", kr: '좋아요. 리스크가 뭐죠?' },
        { sp: 'B', en: 'Vendor lock-in on the data layer — switching costs grow every quarter.', kr: '데이터 계층의 벤더 종속입니다 — 전환 비용이 분기마다 커집니다.' },
        { sp: 'A', en: 'How do we get ahead of it?', kr: '어떻게 선제 대응하죠?' },
        { sp: 'B', en: 'My recommendation is to run a dual-vendor pilot next quarter.', kr: '다음 분기에 듀얼 벤더 파일럿을 돌리는 것을 권고드립니다.' },
        { sp: 'A', en: 'What do you need from me?', kr: '내가 뭘 해주면 되나요?' },
        { sp: 'B', en: 'Your sign-off on the budget by Friday.', kr: '금요일까지 예산 승인입니다.' },
      ],
    },
    talkPrompt: '바쁜 임원에게 3분 안에 브리핑하는 상황. 결론 → 근거 → 리스크 → 요청 순서를 지키고, 물으면 짧게 답해 보세요.',
  },
  {
    key: 'poc-kickoff',
    title: 'PoC 킥오프 — 기대치 맞추기',
    goal: '검증 범위·기간·성공 기준을 시작 전에 합의하기',
    phrases: [
      { en: "Today I'd like to align on scope, timeline, and success criteria.", kr: '오늘은 범위·일정·성공 기준을 맞추고 싶습니다.' },
      { en: 'We validate two workloads over two weeks.', kr: '2주 동안 워크로드 두 개를 검증합니다.' },
      { en: 'Success means query times under three seconds.', kr: '성공 기준은 쿼리 3초 이내입니다.' },
      { en: "Anything outside this scope, we park for phase two.", kr: '이 범위 밖의 것은 2단계로 미뤄 둡니다.' },
      { en: "Who will be our technical contact on your side?", kr: '귀사 쪽 기술 담당자는 누구실까요?' },
    ],
    dialogue: {
      title: 'PoC 킥오프 (PoC Kickoff)',
      lines: [
        { sp: 'B', en: "Today I'd like to align on scope, timeline, and success criteria.", kr: '오늘은 범위·일정·성공 기준을 맞추고 싶습니다.' },
        { sp: 'A', en: 'Sounds good. What exactly are we testing?', kr: '좋아요. 정확히 뭘 테스트하죠?' },
        { sp: 'B', en: 'We validate two workloads over two weeks — the ETL pipeline and the dashboard queries.', kr: '2주 동안 워크로드 두 개를 검증합니다 — ETL 파이프라인과 대시보드 쿼리요.' },
        { sp: 'A', en: 'And how do we call it a success?', kr: '성공은 어떻게 판단하나요?' },
        { sp: 'B', en: 'Success means query times under three seconds at your peak load.', kr: '피크 부하에서 쿼리 3초 이내면 성공입니다.' },
        { sp: 'A', en: 'Our team might want to add more tests along the way.', kr: '저희 팀이 중간에 테스트를 더 넣고 싶어할 수도 있어요.' },
        { sp: 'B', en: "Understood — anything outside this scope, we park for phase two. And who will be our technical contact on your side?", kr: '이해합니다 — 범위 밖의 것은 2단계로 미뤄 두시죠. 그리고 귀사 쪽 기술 담당자는 누구실까요?' },
      ],
    },
    talkPrompt: 'PoC 시작 미팅. 범위가 늘어나지 않게 성공 기준과 경계를 분명히 합의하고, 담당자와 일정도 확정해 보세요.',
  },
  {
    key: 'closing',
    title: '계약 마무리 — 다음 단계 확정',
    goal: '애매하게 끝내지 않고 서명까지의 단계와 날짜를 못 박기',
    phrases: [
      { en: "It sounds like we're aligned on the essentials.", kr: '핵심 사항에는 합의가 된 것 같습니다.' },
      { en: "What would stop us from moving forward this month?", kr: '이번 달 안에 진행하는 데 걸림돌이 있을까요?' },
      { en: "I'll send the final contract by Wednesday.", kr: '수요일까지 최종 계약서를 보내드리겠습니다.' },
      { en: 'Who else needs to sign off on your side?', kr: '귀사 쪽에서 또 누구의 승인이 필요할까요?' },
      { en: "Let's set the kickoff for the first week of next month.", kr: '킥오프는 다음 달 첫째 주로 잡으시죠.' },
    ],
    dialogue: {
      title: '클로징 (Closing the Deal)',
      lines: [
        { sp: 'B', en: "It sounds like we're aligned on the essentials.", kr: '핵심 사항에는 합의가 된 것 같습니다.' },
        { sp: 'A', en: 'I think so, yes.', kr: '네, 그런 것 같아요.' },
        { sp: 'B', en: 'Great. What would stop us from moving forward this month?', kr: '좋습니다. 이번 달 안에 진행하는 데 걸림돌이 있을까요?' },
        { sp: 'A', en: 'Honestly, just our legal review. It usually takes a week.', kr: '솔직히 법무 검토 정도요. 보통 일주일 걸려요.' },
        { sp: 'B', en: "Then I'll send the final contract by Wednesday so legal can start early.", kr: '그럼 법무가 빨리 시작할 수 있게 수요일까지 최종 계약서를 보내드릴게요.' },
        { sp: 'A', en: 'That works.', kr: '좋습니다.' },
        { sp: 'B', en: "Perfect. And who else needs to sign off on your side? I'd like to set the kickoff for the first week of next month.", kr: '완벽합니다. 귀사 쪽에서 또 누구 승인이 필요할까요? 킥오프는 다음 달 첫째 주로 잡고 싶습니다.' },
      ],
    },
    talkPrompt: '거의 다 온 딜을 마무리하는 미팅. 남은 장애물을 확인하고, 계약서 발송·승인자·킥오프 날짜까지 구체적으로 확정해 보세요.',
  },
  {
    key: 'stall',
    title: '결정이 미뤄질 때 — 다시 움직이게 하기',
    goal: '보류된 논의를 압박 없이 되살리고 진짜 이유를 찾기',
    phrases: [
      { en: "I wanted to check in — where do things stand on your side?", kr: '확인차 연락드렸어요 — 그쪽 상황은 어떻게 되어가고 있나요?' },
      { en: 'Has anything changed in your priorities?', kr: '우선순위에 변화가 있었나요?' },
      { en: "If timing is the issue, we can phase the rollout.", kr: '시기가 문제라면, 도입을 단계로 나눌 수 있습니다.' },
      { en: 'What would need to be true for this to move forward?', kr: '이게 진행되려면 어떤 조건이 충족되어야 할까요?' },
      { en: "Would it help if I presented to your leadership directly?", kr: '제가 직접 경영진께 설명드리면 도움이 될까요?' },
    ],
    dialogue: {
      title: '보류 딜 되살리기 (Reviving a Stalled Deal)',
      lines: [
        { sp: 'B', en: 'I wanted to check in — where do things stand on your side?', kr: '확인차 연락드렸어요 — 그쪽 상황은 어떻게 되어가고 있나요?' },
        { sp: 'A', en: "Honestly, it's been on hold. Other projects took over.", kr: '솔직히 보류 상태예요. 다른 프로젝트들이 우선이 됐어요.' },
        { sp: 'B', en: 'That happens. Has anything changed in your priorities?', kr: '그럴 수 있죠. 우선순위에 변화가 있었나요?' },
        { sp: 'A', en: "Mostly budget season. Nothing moves until it's over.", kr: '주로 예산 시즌 때문이에요. 끝날 때까진 아무것도 안 움직여요.' },
        { sp: 'B', en: 'If timing is the issue, we can phase the rollout — start small this quarter.', kr: '시기가 문제라면 도입을 단계로 나눌 수 있어요 — 이번 분기엔 작게 시작하고요.' },
        { sp: 'A', en: 'Hmm. That might actually work.', kr: '흠. 그건 가능할 수도 있겠네요.' },
        { sp: 'B', en: 'What would need to be true for this to move forward this month?', kr: '이번 달에 진행되려면 어떤 조건이 충족되어야 할까요?' },
      ],
    },
    talkPrompt: '몇 주째 답이 없던 고객과의 통화. 재촉하는 대신 상황 변화를 묻고, 작게 시작하는 옵션으로 논의를 되살려 보세요.',
  },
  {
    key: 'active-listening',
    title: '요구사항 경청 — 되묻고 확인하기',
    goal: '들은 것을 내 말로 요약해 확인하고, 애매한 부분을 파고들기',
    phrases: [
      { en: 'So if I understand correctly, the main pain is scaling.', kr: '제가 맞게 이해했다면, 핵심 문제는 확장성이군요.' },
      { en: 'When you say "slow", how slow are we talking?', kr: '"느리다"고 하실 때, 어느 정도로 느린 건가요?' },
      { en: 'Can you walk me through what happens today?', kr: '지금은 어떻게 처리하고 계신지 설명해 주시겠어요?' },
      { en: 'Who is most affected when this breaks?', kr: '이게 안 될 때 누가 가장 영향을 받나요?' },
      { en: 'Let me play that back to make sure I got it.', kr: '제대로 이해했는지 한번 정리해 볼게요.' },
    ],
    dialogue: {
      title: '요구사항 인터뷰 (Requirements Discovery)',
      lines: [
        { sp: 'A', en: 'Our batch jobs are just too slow these days.', kr: '요즘 배치 작업이 너무 느려요.' },
        { sp: 'B', en: 'When you say "slow", how slow are we talking?', kr: '"느리다"고 하실 때, 어느 정도로 느린 건가요?' },
        { sp: 'A', en: 'The nightly job used to take two hours. Now it takes six.', kr: '야간 작업이 원래 2시간이었는데 지금은 6시간 걸려요.' },
        { sp: 'B', en: 'Can you walk me through what happens when it overruns?', kr: '시간을 초과하면 어떤 일이 벌어지는지 설명해 주시겠어요?' },
        { sp: 'A', en: 'Morning reports are late, and the finance team escalates.', kr: '아침 리포트가 늦어지고, 재무팀이 난리가 나죠.' },
        { sp: 'B', en: 'So if I understand correctly — the real pain is the finance deadline, not the job itself.', kr: '제가 맞게 이해했다면 — 진짜 문제는 작업 자체가 아니라 재무팀 마감이군요.' },
        { sp: 'A', en: "Exactly. That's the pressure point.", kr: '정확해요. 그게 압박 지점이에요.' },
      ],
    },
    talkPrompt: '고객이 문제를 설명하는 디스커버리 미팅. 바로 해법을 팔지 말고, 수치를 되묻고 요약 확인하며 진짜 문제를 찾아보세요.',
  },
  {
    key: 'handover',
    title: '담당 변경 인사 — 새 담당자 소개',
    goal: '담당이 바뀌어도 신뢰가 이어지도록 소개와 인수인계를 매끄럽게',
    phrases: [
      { en: "I'd like to introduce Minji, who will be your main contact going forward.", kr: '앞으로 담당하실 민지 님을 소개드립니다.' },
      { en: 'She has led similar migrations for three years.', kr: '3년간 비슷한 마이그레이션을 이끌어 왔습니다.' },
      { en: "I've briefed her on everything we've discussed.", kr: '지금까지 논의한 내용은 모두 전달해 두었습니다.' },
      { en: "I'll stay involved through the transition.", kr: '전환 기간 동안은 저도 함께합니다.' },
      { en: 'Nothing changes on the commitments we made.', kr: '약속드린 사항은 그대로 유지됩니다.' },
    ],
    dialogue: {
      title: '담당자 인수인계 (Account Handover)',
      lines: [
        { sp: 'B', en: "I'd like to introduce Minji, who will be your main contact going forward.", kr: '앞으로 담당하실 민지 님을 소개드립니다.' },
        { sp: 'A', en: 'Nice to meet you. So you\'re leaving us?', kr: '반갑습니다. 그럼 떠나시는 건가요?' },
        { sp: 'B', en: "I'm moving to a new region, but I'll stay involved through the transition.", kr: '다른 리전을 맡게 됐지만, 전환 기간 동안은 함께합니다.' },
        { sp: 'A', en: 'Does she know about our custom setup?', kr: '저희 커스텀 구성에 대해 알고 계신가요?' },
        { sp: 'B', en: "Yes — I've briefed her on everything we've discussed, and she has led similar migrations for three years.", kr: '네 — 논의한 내용은 모두 전달했고, 3년간 비슷한 마이그레이션을 이끌어 온 분입니다.' },
        { sp: 'A', en: 'And our timeline commitments?', kr: '일정 약속은요?' },
        { sp: 'B', en: 'Nothing changes on the commitments we made.', kr: '약속드린 사항은 그대로 유지됩니다.' },
      ],
    },
    talkPrompt: '담당자 변경을 알리는 미팅. 고객의 불안(히스토리 유실·약속 변경)을 선제적으로 해소하며 새 담당자를 소개해 보세요.',
  },
  {
    key: 'disagree',
    title: '정중하게 반대하기 — 관계를 지키며 밀어붙이기',
    goal: '상대 의견에 동의하지 않을 때 부드럽지만 분명하게 말하기',
    phrases: [
      { en: 'I see it a bit differently — may I share why?', kr: '저는 조금 다르게 봅니다 — 이유를 말씀드려도 될까요?' },
      { en: "That's a fair point, and there's a trade-off to consider.", kr: '맞는 말씀이고, 고려할 트레이드오프가 있습니다.' },
      { en: 'In our experience, that approach struggles at scale.', kr: '저희 경험상 그 방식은 규모가 커지면 힘들어집니다.' },
      { en: 'What if we tested both and let the data decide?', kr: '둘 다 테스트해서 데이터로 결정하면 어떨까요?' },
      { en: "At the end of the day, it's your call — I just want you to have the full picture.", kr: '결정은 결국 그쪽 몫입니다 — 전체 그림을 보시길 바랄 뿐이에요.' },
    ],
    dialogue: {
      title: '기술 이견 조율 (Respectful Disagreement)',
      lines: [
        { sp: 'A', en: "We're planning to build the integration in-house.", kr: '연동은 자체 개발할 계획이에요.' },
        { sp: 'B', en: 'I see it a bit differently — may I share why?', kr: '저는 조금 다르게 봅니다 — 이유를 말씀드려도 될까요?' },
        { sp: 'A', en: 'Go ahead.', kr: '말씀하세요.' },
        { sp: 'B', en: 'In our experience, in-house integrations struggle at scale — maintenance eats the savings.', kr: '저희 경험상 자체 연동은 규모가 커지면 힘들어집니다 — 유지보수가 절감분을 잡아먹어요.' },
        { sp: 'A', en: 'Our engineers are confident they can handle it.', kr: '저희 엔지니어들은 감당할 수 있다고 자신해요.' },
        { sp: 'B', en: 'What if we tested both on one workload and let the data decide?', kr: '워크로드 하나로 둘 다 테스트해서 데이터로 결정하면 어떨까요?' },
        { sp: 'A', en: "Hmm, that's reasonable.", kr: '흠, 합리적이네요.' },
        { sp: 'B', en: "At the end of the day, it's your call — I just want you to have the full picture.", kr: '결정은 결국 그쪽 몫입니다 — 전체 그림을 보시길 바랄 뿐이에요.' },
      ],
    },
    talkPrompt: '고객의 기술 결정에 동의하지 않는 상황. 정면으로 부정하지 말고, 경험·데이터·검증 제안으로 관계를 지키며 설득해 보세요.',
  },
];

const DONE_KEY = 'va_mission_done'; // 마지막으로 완료한 날짜(YYYY-MM-DD)
const OFFSET_KEY = 'va_mission_offset'; // 사용자가 "다른 상황"으로 넘긴 오프셋

function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 에폭 기준 '오늘'의 일련번호 — 날짜가 바뀌면 자동으로 다른 미션이 뜬다. */
function dayNumber(d = new Date()): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

/** 오늘의 미션 — 날짜로 하나 고르고, 사용자가 '다른 상황'으로 넘긴 오프셋을 더한다. */
export function getTodayMission(): BusinessMission {
  const base = dayNumber();
  const offset = load<number>(OFFSET_KEY, 0);
  const idx = (((base + offset) % BUSINESS_MISSIONS.length) + BUSINESS_MISSIONS.length) % BUSINESS_MISSIONS.length;
  return BUSINESS_MISSIONS[idx];
}

/** '다른 상황 보기' — 다음 미션으로 넘긴다(그날 유지). */
export function nextMission(): BusinessMission {
  const offset = load<number>(OFFSET_KEY, 0);
  store(OFFSET_KEY, offset + 1);
  return getTodayMission();
}

export function isMissionDoneToday(): boolean {
  return load<string>(DONE_KEY, '') === todayStr();
}

/* ── ✨ AI 새 상황 생성 ──
 * 정적 미션 12종은 12일이면 한 바퀴 돈다. 키가 있으면 그날의 상황을 AI가
 * 새로 만들어 무한히 다양하게 쓸 수 있다. 생성한 미션은 날짜와 함께 저장해
 * 같은 날 다시 열어도 유지되고, 자정이 지나면 자연히 무시된다. */
const CUSTOM_KEY = 'va_mission_custom';

/** 오늘 생성해 둔 AI 미션이 있으면 반환(다른 날 것이면 null). */
export function getCustomMissionToday(): BusinessMission | null {
  const v = load<{ date: string; mission: BusinessMission } | null>(CUSTOM_KEY, null);
  if (!v || v.date !== todayStr() || !v.mission?.title || !Array.isArray(v.mission.phrases)) return null;
  return v.mission;
}

export function saveCustomMissionToday(m: BusinessMission) {
  store(CUSTOM_KEY, { date: todayStr(), mission: m });
}

export function clearCustomMission() {
  store(CUSTOM_KEY, null);
}

const GEN_SYSTEM = [
  '너는 한국인 클라우드 세일즈 실무자를 위한 비즈니스 영어 코치다. 실무에서 실제로 겪는',
  '영어 상황 미션 하나를 새로 만들어 아래 JSON 형식으로만 출력한다(코드블록·설명 없이):',
  '{',
  '  "title": "상황 제목 (한국어)",',
  '  "goal": "오늘 목표 한 줄 (한국어)",',
  '  "phrases": [ { "en": "실무에서 바로 쓰는 영어 표현", "kr": "자연스러운 한국어 뜻" } ],',
  '  "dialogue": { "title": "대화 제목", "lines": [ { "sp": "A", "en": "영어 대사", "kr": "한국어 뜻" } ] },',
  '  "talkPrompt": "AI와 자유 대화할 상황 설명 (한국어)"',
  '}',
  '',
  '규칙:',
  '- phrases는 정확히 5개. 원어민이 실제 비즈니스에서 쓰는 자연스러운 표현.',
  '- dialogue.lines는 6~8줄, A(상대/고객)와 B(나)가 번갈아 말한다.',
  '- 클라우드/IT 세일즈 맥락(고객 미팅·기술 논의·협상·사내 회의·출장 등)에서 고른다.',
  '- "피해야 할 제목" 목록과 겹치지 않는 새로운 상황을 만든다.',
].join('\n');

/** AI로 새 비즈니스 미션을 생성한다. 실패 시 GroqError/Error를 던진다. */
export async function generateAiMission(): Promise<BusinessMission> {
  const avoid = [...BUSINESS_MISSIONS.map((m) => m.title), getCustomMissionToday()?.title].filter(Boolean);
  const mission = await groqKoJson<BusinessMission>(
    [
      { role: 'system', content: GEN_SYSTEM },
      { role: 'user', content: `피해야 할 제목: ${avoid.join(' / ')}\n\n새로운 상황 미션 하나를 만들어줘.` },
    ],
    { temperature: 0.9, maxTokens: 1100 },
    (data) => {
      const p = (data ?? {}) as Partial<BusinessMission>;
      // kr(뜻)이 비었거나 영어인 표현은 버린다 — 빈 뜻이 리콜 카드와 표현장에
      // 그대로 저장되던 문제. 남은 수가 모자라면 응답 자체를 버리고 다시 묻는다.
      const phrases = Array.isArray(p.phrases)
        ? p.phrases
            .filter((x) => x && x.en && hasHangul(x.kr))
            .map((x) => ({ en: String(x.en).trim(), kr: String(x.kr || '').trim() }))
            .slice(0, 5)
        : [];
      const rawLines = Array.isArray(p.dialogue?.lines) ? p.dialogue!.lines : [];
      const lines = rawLines
        .filter((l) => l && (l as { en?: unknown }).en && hasHangul((l as { kr?: unknown }).kr))
        .slice(0, 8)
        .map((l, i) => {
          const sp = String((l as { sp?: unknown }).sp || '').trim().toUpperCase();
          return {
            sp: (sp === 'A' || sp === 'B' ? sp : i % 2 === 0 ? 'A' : 'B') as 'A' | 'B',
            en: String((l as { en?: unknown }).en).trim(),
            kr: String((l as { kr?: unknown }).kr || '').trim(),
          };
        });
      if (!p.title || !hasHangul(String(p.title)) || phrases.length < 3 || lines.length < 4) return null;
      const talkPrompt = String(p.talkPrompt || '').trim();
      return {
        key: `ai-${todayStr()}`,
        title: String(p.title).trim(),
        goal: String(p.goal || '').trim() || '오늘의 상황을 영어로 자신 있게 말해보기',
        phrases,
        dialogue: { title: String(p.dialogue?.title || p.title).trim(), lines },
        talkPrompt: hasHangul(talkPrompt) ? talkPrompt : `"${String(p.title).trim()}" 상황을 영어로 연습하는 대화.`,
      };
    }
  );
  if (!mission) throw new Error('미션 생성에 실패했어요. 다시 시도해주세요.');
  return mission;
}

/* ── 미션 → 회화 탭 핸드오프 ──
 * "이 상황으로 AI와 대화하기"를 누르면 미션 상황을 저장해 두고, 회화 화면이
 * 마운트될 때 한 번만 꺼내(one-shot) 그 상황을 시나리오로 쓴다. 이렇게 해야
 * 버튼의 약속("이 상황으로")이 실제로 지켜진다. */
const TALK_KEY = 'va_mission_talk';

export interface MissionTalkCtx {
  title: string;
  desc: string;
  examples: MissionPhrase[];
  /** 롤플레이 후 점검 기준(미팅 스크립트에서 넘어올 때만 채워진다) */
  checklist?: { key: string; label: string; hint: string }[];
}

export function setMissionTalkContext(m: BusinessMission) {
  setTalkContext({ title: m.title, desc: m.talkPrompt, examples: m.phrases.slice(0, 3) });
}

/**
 * 회화 탭으로 넘길 상황을 직접 지정한다(미션 외 화면에서도 쓰는 범용 진입점).
 * 미팅 스크립트 → AI 롤플레이 연습이 이 경로를 탄다.
 */
export function setTalkContext(ctx: MissionTalkCtx) {
  store(TALK_KEY, ctx);
}

/** 저장된 미션 상황을 꺼내고 비운다(한 번만 소비). 없으면 null. */
export function takeMissionTalkContext(): MissionTalkCtx | null {
  const v = load<MissionTalkCtx | null>(TALK_KEY, null);
  if (v) store(TALK_KEY, null);
  return v && v.title ? v : null;
}

export function markMissionDone() {
  store(DONE_KEY, todayStr());
}
