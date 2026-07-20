'use client';

/**
 * 오늘의 비즈니스 미션 — "앱을 열면 오늘 할 딱 한 가지"의 핵심 데이터/로직.
 *
 * 실무(클라우드 세일즈·고객 미팅·발표·이메일 구두 표현) 상황을 큐레이션한 미션을
 * 날짜 기준으로 매일 하나씩 돌려서 보여준다(매일 새로움 + 항상 관련 있음). 정적
 * 데이터라 키·네트워크 없이도 즉시 동작한다. 완료는 날짜로 기록해 하루 1회 판정.
 */
import { load, store } from './state';

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

export function markMissionDone() {
  store(DONE_KEY, todayStr());
}
