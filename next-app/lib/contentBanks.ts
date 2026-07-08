/**
 * 듣기/읽기/쓰기 콘텐츠 풀 — voice-assistant/index.html 의 LISTEN_BANK/READING_BANK/WRITE_PROMPTS를
 * 레벨별로 대폭 확장한 버전. 정적 데이터라 추가 API 호출 비용이 들지 않는다.
 */
import type { Cefr } from './lessons';

export const LISTEN_BANK: Record<Cefr, string[]> = {
  A1: [
    'I have two brothers.',
    'She is reading a book.',
    'We go to school by bus.',
    "It's very cold today.",
    'My favorite color is blue.',
    'They are playing soccer.',
    'He likes pizza very much.',
    'This is my new bag.',
    'My mother cooks dinner every night.',
    'The dog is under the table.',
    'I live in a small house.',
    'We have English class on Monday.',
    'She can swim very well.',
    'There is a cat in the garden.',
    'I usually walk to work.',
    'He is my best friend.',
    'The weather is nice today.',
    'I want a glass of water.',
  ],
  A2: [
    'I went to the beach last weekend.',
    'He is taller than his brother.',
    'We are going to visit Seoul next month.',
    'She has lived here for three years.',
    'Can you help me with my homework?',
    'I usually wake up at seven.',
    "I'm looking forward to the trip.",
    'She bought a new phone yesterday.',
    'We need to leave before it gets dark.',
    'He was watching TV when I called.',
    'I have never tried Indian food.',
    'They moved to a bigger apartment.',
    'My sister is studying for an exam.',
    'It took us two hours to get there.',
    "Let's meet at the coffee shop at noon.",
    'I forgot to bring my umbrella.',
    'She is good at playing the piano.',
    'We should book the tickets soon.',
  ],
  B1: [
    'I have already finished my report.',
    'If I were you, I would take the job.',
    "She's been studying English since 2020.",
    'The train was delayed because of the snow.',
    'You should have called me earlier.',
    'We need to cut down on plastic waste.',
    'I wish I had more free time these days.',
    'He apologized for being late to the meeting.',
    'The hotel was fully booked, so we stayed elsewhere.',
    'Most students find the final exam quite difficult.',
    "I'm not used to waking up this early.",
    'The company plans to expand into new markets.',
    'She decided to quit her job and travel instead.',
    'They are renovating the kitchen this weekend.',
    'I would rather stay home than go to the party.',
    'The flight was cancelled due to bad weather.',
    'He has been working overtime all week.',
    'We managed to finish the project on time.',
  ],
  B2: [
    'Had I known earlier, I would have acted differently.',
    'The committee postponed the decision until further notice.',
    'Despite the rain, the event went ahead as planned.',
    'He tends to underestimate how long tasks take.',
    'The proposal was met with considerable skepticism.',
    'They managed to resolve the issue without escalating it.',
    'The new policy has sparked widespread debate among employees.',
    'She insisted on reviewing the contract before signing it.',
    'Given the circumstances, the outcome was hardly surprising.',
    'The team is under pressure to deliver results quickly.',
    'It is worth noting that the figures were never verified.',
    'He reluctantly agreed to take on the extra workload.',
    'The merger is expected to take effect early next year.',
    'Critics argue that the reform falls short of expectations.',
    'She gradually built a reputation as a reliable consultant.',
    'The data suggests a clear shift in consumer behavior.',
    'They eventually reached a compromise after lengthy negotiations.',
    'The budget cuts have affected nearly every department.',
  ],
  C1: [
    'Her unwavering commitment ultimately paid off.',
    'The findings call into question our basic assumptions.',
    'He has a tendency to overcomplicate simple matters.',
    'Such measures, though controversial, proved effective.',
    'The negotiations reached an impasse late last night.',
    'We must weigh the benefits against the potential risks.',
    'The report was criticized for its lack of empirical rigor.',
    'His remarks were widely interpreted as a veiled criticism.',
    'The policy, while well-intentioned, had unintended consequences.',
    'She articulated her concerns with remarkable clarity.',
    'The committee deferred to the experts on this matter.',
    'It would be premature to draw any firm conclusions.',
    'The argument hinges on a rather questionable premise.',
    'They were reluctant to concede that the plan had failed.',
    'The disparity between expectations and outcomes was stark.',
    'His tone bordered on condescension throughout the meeting.',
    'The evidence, though compelling, remains largely circumstantial.',
    'The proposal was shelved indefinitely amid mounting criticism.',
  ],
  C2: [
    'The verdict set an unprecedented legal precedent.',
    'His prose is at once elegant and remarkably economical.',
    'They were inclined to dismiss the anomaly as negligible.',
    'The reform was, in hindsight, woefully inadequate.',
    'Her argument hinges on a rather tenuous assumption.',
    'The phenomenon defies any straightforward explanation.',
    'The treatise is replete with erudite, if occasionally impenetrable, prose.',
    'Such ostensibly minor concessions belied the gravity of the situation.',
    'The committee’s findings were, by any measure, equivocal at best.',
    'He spoke with a candor that bordered on the indiscreet.',
    'The juxtaposition of these two policies reveals a glaring inconsistency.',
    'Her critique, though scathing, was not without merit.',
    'The implications of this discovery are nothing short of profound.',
    'What seemed a trivial oversight proved to be consequential.',
    'The discourse surrounding the issue has grown increasingly polarized.',
    'His detractors dismissed the theory as little more than conjecture.',
    'The ramifications of the decision will reverberate for years.',
    'It is a paradox that prosperity often breeds complacency.',
  ],
};

export interface ReadingItem {
  title: string;
  text: string;
  qs: { q: string; o: string[]; a: number }[];
  vocab: { w: string; kr: string }[];
}

export const READING_BANK: Record<Cefr, ReadingItem[]> = {
  A1: [
    {
      title: 'My Morning',
      text: "I get up at seven o'clock. I drink a glass of water and eat some bread. My sister makes coffee. We go to school together. School starts at nine. I like my English class the best.",
      qs: [
        { q: 'What time does the writer get up?', o: ['Six', 'Seven', 'Nine'], a: 1 },
        { q: 'Who makes coffee?', o: ['The writer', 'The mother', 'The sister'], a: 2 },
        { q: 'Which class does the writer like best?', o: ['Math', 'English', 'Science'], a: 1 },
      ],
      vocab: [{ w: 'get up', kr: '일어나다' }, { w: 'together', kr: '함께' }, { w: 'the best', kr: '가장 좋아하는' }],
    },
    {
      title: 'My Pet Dog',
      text: 'I have a small dog. His name is Max. Max is brown and white. He likes to play in the garden. Every morning, I give him food and water. In the evening, we go for a walk. Max is my best friend.',
      qs: [
        { q: "What is the dog's name?", o: ['Rex', 'Max', 'Buddy'], a: 1 },
        { q: 'Where does Max like to play?', o: ['In the garden', 'In the kitchen', 'At school'], a: 0 },
        { q: 'When do they go for a walk?', o: ['In the morning', 'At noon', 'In the evening'], a: 2 },
      ],
      vocab: [{ w: 'garden', kr: '정원' }, { w: 'walk', kr: '산책' }, { w: 'best friend', kr: '가장 친한 친구' }],
    },
    {
      title: 'A Rainy Day',
      text: "Today it is raining outside. I cannot play in the park. I stay home and read a book. My little brother draws a picture. In the afternoon, we watch a movie together. It is a quiet, happy day.",
      qs: [
        { q: 'Why can’t the writer play outside?', o: ["It's raining", "It's too hot", "It's too late"], a: 0 },
        { q: 'What does the brother do?', o: ['Reads a book', 'Draws a picture', 'Plays soccer'], a: 1 },
        { q: 'What do they do in the afternoon?', o: ['Go shopping', 'Watch a movie', 'Visit a friend'], a: 1 },
      ],
      vocab: [{ w: 'outside', kr: '바깥에' }, { w: 'quiet', kr: '조용한' }, { w: 'draw', kr: '그리다' }],
    },
    {
      title: 'At the Supermarket',
      text: 'My father and I go to the supermarket on Saturdays. We buy milk, eggs, and bread. I like to push the cart. My father checks the shopping list. Today we also buy ice cream because it is hot. The cashier is very kind. We say thank you and go home.',
      qs: [
        { q: 'When do they go to the supermarket?', o: ['On Sundays', 'On Saturdays', 'Every day'], a: 1 },
        { q: 'Why do they buy ice cream today?', o: ['It is cheap', 'It is hot', 'It is a birthday'], a: 1 },
        { q: 'Who checks the shopping list?', o: ['The writer', 'The cashier', 'The father'], a: 2 },
      ],
      vocab: [{ w: 'cart', kr: '카트' }, { w: 'shopping list', kr: '장보기 목록' }, { w: 'cashier', kr: '계산원' }],
    },
    {
      title: 'My Birthday Party',
      text: 'Yesterday was my birthday. I am ten years old now. My friends came to my house at three. We ate pizza and chocolate cake. My mother gave me a blue bicycle. It is my favorite present. We played games until six. I was very happy.',
      qs: [
        { q: 'How old is the writer now?', o: ['Nine', 'Ten', 'Eleven'], a: 1 },
        { q: 'What present did the mother give?', o: ['A blue bicycle', 'A cake', 'A game'], a: 0 },
        { q: 'What time did the friends come?', o: ['At six', 'At three', 'At noon'], a: 1 },
      ],
      vocab: [{ w: 'present', kr: '선물' }, { w: 'favorite', kr: '가장 좋아하는' }, { w: 'until', kr: '~까지' }],
    },
  ],
  A2: [
    {
      title: 'A Trip to the Market',
      text: 'Last Saturday, I went to the local market with my friend. We wanted to buy fresh vegetables and fruit. The market was crowded, but the food looked delicious. I bought some tomatoes and apples. My friend chose a big watermelon. We were tired but happy on the way home.',
      qs: [
        { q: 'When did they go to the market?', o: ['Last Sunday', 'Last Saturday', 'Yesterday'], a: 1 },
        { q: 'What did the friend buy?', o: ['Tomatoes', 'Apples', 'A watermelon'], a: 2 },
        { q: 'How did they feel going home?', o: ['Tired but happy', 'Angry', 'Bored'], a: 0 },
      ],
      vocab: [{ w: 'crowded', kr: '붐비는' }, { w: 'fresh', kr: '신선한' }, { w: 'on the way home', kr: '집에 가는 길에' }],
    },
    {
      title: 'Learning to Cook',
      text: "Last month, I decided to learn how to cook. At first, it was difficult and I made a lot of mistakes. I burned the rice twice! But I kept practicing every weekend. Now I can make simple dishes like pasta and fried eggs. My family says my food is getting better.",
      qs: [
        { q: 'When did the writer start learning to cook?', o: ['Last week', 'Last month', 'Last year'], a: 1 },
        { q: 'What mistake did the writer make?', o: ['Burned the rice', 'Broke a plate', 'Forgot the salt'], a: 0 },
        { q: 'What can the writer make now?', o: ['Only rice', 'Pasta and fried eggs', 'A birthday cake'], a: 1 },
      ],
      vocab: [{ w: 'at first', kr: '처음에는' }, { w: 'practice', kr: '연습하다' }, { w: 'simple dish', kr: '간단한 요리' }],
    },
    {
      title: 'My New Neighborhood',
      text: 'We moved to a new neighborhood two weeks ago. At first, I missed my old friends a lot. But then I met a girl who lives next door, and we became friends quickly. There is a nice park nearby where we ride bikes. I am starting to like this place.',
      qs: [
        { q: 'How long ago did they move?', o: ['Two days ago', 'Two weeks ago', 'Two months ago'], a: 1 },
        { q: 'How did the writer make a new friend?', o: ['At school', 'A girl who lives next door', 'At the park'], a: 1 },
        { q: 'What do they do at the park?', o: ['Ride bikes', 'Play tennis', 'Read books'], a: 0 },
      ],
      vocab: [{ w: 'neighborhood', kr: '동네' }, { w: 'next door', kr: '바로 옆집' }, { w: 'nearby', kr: '근처에' }],
    },
    {
      title: 'A Weekend Hike',
      text: "Last Sunday, my brother and I went hiking on a mountain near our city. We started early in the morning because the weather gets hot in the afternoon. The trail was steep, so we took several breaks. At the top, the view was amazing — we could see the whole city. We took photos and ate sandwiches before coming down. My legs hurt the next day, but it was worth it.",
      qs: [
        { q: 'Why did they start early?', o: ['The bus leaves early', 'It gets hot in the afternoon', 'The mountain closes'], a: 1 },
        { q: 'What did they do at the top?', o: ['Slept', 'Took photos and ate', 'Called a friend'], a: 1 },
        { q: 'How did the writer feel about the hike?', o: ['It was worth it', 'It was boring', 'It was too easy'], a: 0 },
      ],
      vocab: [{ w: 'trail', kr: '등산로' }, { w: 'steep', kr: '가파른' }, { w: 'worth it', kr: '그럴 가치가 있는' }],
    },
    {
      title: 'An Online Order Problem',
      text: "Two weeks ago, I ordered a jacket online. When the package arrived, the jacket was the wrong size. I emailed the shop and explained the problem. They answered quickly and said sorry. They sent me the right size for free, and I didn't have to return the old one. I was surprised by their kind service. I will order from them again.",
      qs: [
        { q: 'What was the problem with the jacket?', o: ['Wrong color', 'Wrong size', 'It was broken'], a: 1 },
        { q: 'How did the writer contact the shop?', o: ['By phone', 'By email', 'By visiting'], a: 1 },
        { q: 'Why was the writer surprised?', o: ['The kind service', 'The high price', 'The slow delivery'], a: 0 },
      ],
      vocab: [{ w: 'package', kr: '소포, 택배' }, { w: 'explain', kr: '설명하다' }, { w: 'for free', kr: '무료로' }],
    },
  ],
  B1: [
    {
      title: 'Working from Home',
      text: 'Since the pandemic, many companies have allowed employees to work from home. This change has both advantages and disadvantages. On one hand, workers save time because they no longer commute. On the other hand, some people find it hard to separate work from their personal life. Experts suggest setting a fixed schedule and a dedicated workspace to stay productive.',
      qs: [
        { q: 'What is one advantage mentioned?', o: ['Higher salary', 'Saving commute time', 'More holidays'], a: 1 },
        { q: 'What problem do some people face?', o: ['Slow internet', 'Separating work and personal life', 'Noisy offices'], a: 1 },
        { q: 'What do experts recommend?', o: ['Working at night', 'A fixed schedule and workspace', 'Working less'], a: 1 },
      ],
      vocab: [{ w: 'commute', kr: '통근하다' }, { w: 'advantage', kr: '장점' }, { w: 'productive', kr: '생산적인' }],
    },
    {
      title: 'The Rise of Streaming Services',
      text: "Over the past decade, streaming services have changed the way people watch movies and TV shows. Instead of going to the cinema or buying DVDs, many people now subscribe to platforms that offer thousands of titles. This shift has made entertainment more convenient, but it has also created problems for traditional cinemas, which have seen a sharp drop in visitors. Some experts believe both formats will eventually coexist.",
      qs: [
        { q: 'How has streaming changed entertainment?', o: ['Made it more convenient', 'Made it more expensive', 'Made it disappear'], a: 0 },
        { q: 'What problem have cinemas faced?', o: ['Higher ticket prices', 'A sharp drop in visitors', 'Better movies'], a: 1 },
        { q: 'What do some experts predict?', o: ['Cinemas will close completely', 'Both formats will coexist', 'Streaming will end soon'], a: 1 },
      ],
      vocab: [{ w: 'subscribe', kr: '구독하다' }, { w: 'convenient', kr: '편리한' }, { w: 'coexist', kr: '공존하다' }],
    },
    {
      title: 'Why Sleep Matters',
      text: "Many people underestimate how important sleep is for their health. Lack of sleep can affect concentration, mood, and even the immune system. Researchers recommend that adults get between seven and nine hours of sleep each night. Simple habits, such as avoiding screens before bed and keeping a regular schedule, can significantly improve sleep quality.",
      qs: [
        { q: 'What can lack of sleep affect?', o: ['Only mood', 'Concentration, mood, and the immune system', 'Only appetite'], a: 1 },
        { q: 'How many hours do researchers recommend?', o: ['Five to six', 'Seven to nine', 'Ten to twelve'], a: 1 },
        { q: 'What habit is suggested?', o: ['Avoiding screens before bed', 'Sleeping during the day', 'Skipping breakfast'], a: 0 },
      ],
      vocab: [{ w: 'underestimate', kr: '과소평가하다' }, { w: 'immune system', kr: '면역 체계' }, { w: 'significantly', kr: '상당히' }],
    },
    {
      title: 'The Growth of Urban Gardens',
      text: "City rooftops and empty lots are slowly turning green. Urban gardens have become popular because they offer fresh vegetables, cleaner air, and a sense of community. People who have never met before now share tools, seeds, and advice. Some schools have joined the movement, teaching children where food actually comes from. Experts say these gardens will not feed entire cities, but they change how people think about food and waste. In that sense, their real harvest is awareness.",
      qs: [
        { q: 'Why have urban gardens become popular?', o: ['They are cheap to build', 'They offer food, air, and community', 'The government pays for them'], a: 1 },
        { q: 'What do schools teach through gardens?', o: ['How to sell vegetables', 'Where food comes from', 'How to cook'], a: 1 },
        { q: 'What is the "real harvest" of urban gardens?', o: ['Vegetables', 'Money', 'Awareness'], a: 2 },
      ],
      vocab: [{ w: 'empty lot', kr: '공터' }, { w: 'sense of community', kr: '공동체 의식' }, { w: 'awareness', kr: '인식' }],
    },
    {
      title: 'Why We Procrastinate',
      text: "Procrastination is often misunderstood as laziness, but researchers describe it as an emotional problem rather than a time-management one. When a task feels boring, difficult, or uncertain, our brain seeks short-term relief — checking messages, cleaning the desk, watching one more video. The relief is real, but it is borrowed from our future self, who must face the same task with less time. One proven strategy is to make the first step ridiculously small: instead of 'write the report', start with 'open the document and write one sentence'. Starting, not finishing, is usually the hardest part.",
      qs: [
        { q: 'How do researchers describe procrastination?', o: ['As laziness', 'As an emotional problem', 'As a memory problem'], a: 1 },
        { q: 'What does the brain seek when a task feels difficult?', o: ['Short-term relief', 'More information', 'A reward'], a: 0 },
        { q: 'What strategy does the passage suggest?', o: ['Work longer hours', 'Make the first step very small', 'Avoid all distractions'], a: 1 },
      ],
      vocab: [{ w: 'procrastination', kr: '미루기, 지연 행동' }, { w: 'relief', kr: '안도감' }, { w: 'proven', kr: '검증된' }],
    },
  ],
  B2: [
    {
      title: 'The Value of Failure',
      text: 'We often regard failure as something to be avoided at all costs. Yet many successful entrepreneurs argue that failure is an essential part of innovation. When a project collapses, it reveals flawed assumptions that would otherwise remain hidden. The key, they insist, is not to dwell on the setback but to extract lessons quickly and adapt. In this sense, resilience matters far more than an unbroken record of success.',
      qs: [
        { q: 'How do many entrepreneurs view failure?', o: ['As a disaster', 'As essential to innovation', 'As irrelevant'], a: 1 },
        { q: 'What does failure reveal?', o: ['Flawed assumptions', 'Hidden talent', 'Financial gain'], a: 0 },
        { q: 'What matters most, according to the text?', o: ['Resilience', 'Luck', 'Money'], a: 0 },
      ],
      vocab: [{ w: 'regard A as B', kr: 'A를 B로 여기다' }, { w: 'flawed', kr: '결함이 있는' }, { w: 'resilience', kr: '회복탄력성' }],
    },
    {
      title: 'The Hidden Cost of Multitasking',
      text: "Multitasking is often praised as a valuable skill in fast-paced workplaces, but research tells a different story. Studies show that switching between tasks repeatedly reduces overall efficiency and increases the likelihood of errors. The brain, it turns out, does not truly process two complex tasks simultaneously; instead, it rapidly shifts attention, incurring a cognitive cost each time. Experts now recommend single-tasking with scheduled breaks as a more sustainable approach to productivity.",
      qs: [
        { q: 'What does research say about multitasking?', o: ['It increases efficiency', 'It reduces efficiency and increases errors', 'It has no effect'], a: 1 },
        { q: 'What does the brain actually do?', o: ['Processes two tasks at once', 'Rapidly shifts attention', 'Shuts down temporarily'], a: 1 },
        { q: 'What do experts now recommend?', o: ['More multitasking', 'Single-tasking with breaks', 'Working without breaks'], a: 1 },
      ],
      vocab: [{ w: 'simultaneously', kr: '동시에' }, { w: 'cognitive cost', kr: '인지적 비용' }, { w: 'sustainable', kr: '지속 가능한' }],
    },
    {
      title: 'The Ethics of Artificial Intelligence',
      text: "As artificial intelligence systems become more capable, questions about their ethical use have grown more urgent. Critics worry that algorithms trained on biased data can perpetuate existing inequalities, often without anyone noticing. Proponents counter that AI, when carefully designed, can actually reduce human bias in decisions such as hiring or lending. The debate ultimately centers on accountability: who is responsible when an automated system makes a harmful mistake?",
      qs: [
        { q: 'What do critics worry about?', o: ['AI being too slow', 'Algorithms perpetuating bias', 'AI being too expensive'], a: 1 },
        { q: 'What do proponents argue?', o: ['AI can reduce human bias', 'AI should be banned', 'AI has no real use'], a: 0 },
        { q: 'What does the debate center on?', o: ['Cost', 'Accountability', 'Speed'], a: 1 },
      ],
      vocab: [{ w: 'perpetuate', kr: '지속시키다' }, { w: 'proponent', kr: '지지자' }, { w: 'accountability', kr: '책임 소재' }],
    },
    {
      title: 'The Psychology of Queues',
      text: "Standing in line is rarely about the minutes themselves; it is about how those minutes feel. Studies of airports and theme parks show that occupied time feels far shorter than unoccupied time, which is why mirrors near elevators and screens above queues reduce complaints without reducing waits. Uncertainty amplifies frustration: an unexplained delay of five minutes can feel longer than a predicted delay of fifteen. Perceived fairness matters as well — nothing enrages a queue like watching a latecomer served first. Companies that grasp these principles manage not the wait itself, but the story customers tell themselves about it.",
      qs: [
        { q: 'Why do mirrors near elevators reduce complaints?', o: ['They make people look better', 'Occupied time feels shorter', 'They make halls brighter'], a: 1 },
        { q: 'What amplifies frustration while waiting?', o: ['Uncertainty', 'Music', 'Crowds'], a: 0 },
        { q: 'What do smart companies actually manage?', o: ['The length of the wait', 'The number of staff', "The story customers tell themselves"], a: 2 },
      ],
      vocab: [{ w: 'occupied', kr: '(시간이) 채워진' }, { w: 'amplify', kr: '증폭시키다' }, { w: 'perceived fairness', kr: '체감 공정성' }],
    },
    {
      title: 'Remote Work and the Office Question',
      text: "The debate over remote work has hardened into two camps, yet the evidence supports neither extreme. Fully remote teams report higher focus and satisfaction but measurably weaker ties across departments — the casual collisions that spark unplanned collaboration largely disappear. Fully office-based teams preserve those ties at the cost of commuting hours and, increasingly, of talent that simply refuses to return. Hybrid arrangements attempt a compromise, though poorly designed ones combine the drawbacks of both: empty offices on some days, missed connections on others. The organizations that thrive are not those that chose the 'right' model, but those that redesigned their work — meetings, documentation, mentoring — to fit the model they chose.",
      qs: [
        { q: 'What do fully remote teams tend to lose?', o: ['Focus', 'Cross-department ties', 'Satisfaction'], a: 1 },
        { q: 'What problem do poorly designed hybrid models have?', o: ['They combine drawbacks of both models', 'They cost too much', 'They require new software'], a: 0 },
        { q: 'According to the passage, which organizations thrive?', o: ['Those choosing full remote', 'Those redesigning work to fit their model', 'Those with the biggest offices'], a: 1 },
      ],
      vocab: [{ w: 'harden into', kr: '~로 굳어지다' }, { w: 'casual collision', kr: '우연한 마주침' }, { w: 'drawback', kr: '단점' }],
    },
  ],
  C1: [
    {
      title: 'The Paradox of Choice',
      text: 'Conventional wisdom holds that more options lead to greater satisfaction. However, psychologist Barry Schwartz contends that an abundance of choice can be paralysing. When confronted with dozens of nearly identical products, consumers often experience anxiety and, paradoxically, less contentment with whatever they ultimately select. The phenomenon underscores a subtle truth: autonomy, while valuable, carries a cognitive cost that we rarely acknowledge.',
      qs: [
        { q: 'What is conventional wisdom about choice?', o: ['Fewer options are better', 'More options increase satisfaction', 'Choice is unimportant'], a: 1 },
        { q: 'What does Schwartz argue?', o: ['Choice can be paralysing', 'Choice is always good', 'Money buys happiness'], a: 0 },
        { q: 'What "cognitive cost" is implied?', o: ['Memory loss', 'Mental effort of deciding', 'Physical fatigue'], a: 1 },
      ],
      vocab: [{ w: 'conventional wisdom', kr: '통념' }, { w: 'contend', kr: '주장하다' }, { w: 'paradoxically', kr: '역설적이게도' }],
    },
    {
      title: 'The Erosion of Attention',
      text: "Contemporary digital environments are engineered, often deliberately, to capture and retain human attention. Notifications, infinite scrolls, and algorithmically curated feeds exploit well-documented cognitive vulnerabilities, fragmenting our capacity for sustained focus. Some neuroscientists warn that chronic exposure to such stimuli may be reshaping attentional habits at a population level, with implications for deep reading, reflective thought, and even interpersonal patience. Whether this trend is reversible remains a matter of considerable debate.",
      qs: [
        { q: 'How are digital environments often designed?', o: ['To minimize distraction', 'To capture and retain attention', 'To encourage reading'], a: 1 },
        { q: 'What do these designs exploit?', o: ['Physical strength', 'Cognitive vulnerabilities', 'Financial habits'], a: 1 },
        { q: 'What do some neuroscientists warn about?', o: ['Reshaping attentional habits', 'Improved memory', 'Faster reading speed'], a: 0 },
      ],
      vocab: [{ w: 'erosion', kr: '잠식, 침식' }, { w: 'fragment', kr: '분열시키다' }, { w: 'reversible', kr: '되돌릴 수 있는' }],
    },
    {
      title: 'Globalization and Cultural Homogenization',
      text: "Globalization has undeniably accelerated the exchange of goods, ideas, and cultural products across borders. Yet this exchange is rarely symmetrical: dominant economies tend to export their cultural output more successfully than they import others'. Critics argue that this asymmetry fosters a creeping homogenization, in which local traditions are gradually supplanted by globally dominant norms. Defenders counter that hybridization, not erasure, is the more accurate description of what actually occurs.",
      qs: [
        { q: 'Is cultural exchange under globalization symmetrical?', o: ['Yes, always', 'Rarely', 'Only in poor countries'], a: 1 },
        { q: 'What do critics argue happens?', o: ['Cultural homogenization', 'Cultural isolation', 'Cultural collapse'], a: 0 },
        { q: 'What do defenders say instead?', o: ['Erasure occurs', 'Hybridization occurs', 'Nothing changes'], a: 1 },
      ],
      vocab: [{ w: 'homogenization', kr: '동질화' }, { w: 'supplant', kr: '대체하다' }, { w: 'hybridization', kr: '혼종화' }],
    },
    {
      title: 'The Slow Death of Serendipity',
      text: "Recommendation engines promise discovery yet deliver something closer to refinement: an ever-narrower distillation of what we already are. The bookstore browser once stumbled upon a biography shelved beside the novel she came for; the algorithmic reader is shown another novel, uncannily similar to the last. Defenders note, correctly, that curation has always existed — editors, critics, librarians. The difference lies in the feedback loop. A librarian's misjudgment cost one recommendation; an algorithm's bias compounds with every click, training both the system and, more quietly, the user. Rebuilding serendipity may require deliberately inefficient design — a shelf, digital or otherwise, of things we did not ask for.",
      qs: [
        { q: 'What do recommendation engines actually deliver, per the author?', o: ['Genuine discovery', 'Refinement of existing tastes', 'Random suggestions'], a: 1 },
        { q: 'How does algorithmic curation differ from librarians?', o: ['Its bias compounds through feedback loops', 'It is less accurate', 'It costs more'], a: 0 },
        { q: 'What might rebuilding serendipity require?', o: ['Faster algorithms', 'Deliberately inefficient design', 'More user data'], a: 1 },
      ],
      vocab: [{ w: 'serendipity', kr: '우연한 발견' }, { w: 'distillation', kr: '증류, 정제' }, { w: 'compound', kr: '누적되다, 복리로 불어나다' }],
    },
    {
      title: 'Metaphors We Legislate By',
      text: "Public policy is drafted in metaphor long before it is drafted in law. Call addiction a 'war' and enforcement follows; call it an 'epidemic' and funding flows to treatment. The metaphor of the market as an 'invisible hand' has underwritten decades of deregulation, while 'the planet as our home' quietly reframes environmental cost as household neglect. These framings are not ornamental; they preselect which solutions appear reasonable and which seem absurd. A citizenry fluent in metaphor — able to ask what a given figure of speech reveals, conceals, and forecloses — possesses a form of literacy no less vital than the ability to read the statute itself.",
      qs: [
        { q: 'What happens when addiction is called an "epidemic"?', o: ['Enforcement increases', 'Funding flows to treatment', 'The issue is ignored'], a: 1 },
        { q: 'Why are policy metaphors not ornamental?', o: ['They preselect which solutions seem reasonable', 'They make speeches longer', 'They confuse voters'], a: 0 },
        { q: 'What "literacy" does the author advocate?', o: ['Reading statutes quickly', 'Fluency in what metaphors reveal and conceal', 'Writing legal documents'], a: 1 },
      ],
      vocab: [{ w: 'underwrite', kr: '뒷받침하다, 보증하다' }, { w: 'foreclose', kr: '(가능성을) 배제하다' }, { w: 'statute', kr: '법령' }],
    },
  ],
  C2: [
    {
      title: 'On Linguistic Relativity',
      text: 'The hypothesis that language shapes thought has long oscillated between fervent endorsement and outright dismissal. Strong formulations—claiming that speakers of different languages inhabit incommensurable conceptual worlds—have largely been discredited. Yet a more tempered version persists: that habitual linguistic categories subtly bias attention and memory. The contemporary consensus, insofar as one exists, is that language nudges cognition without imprisoning it.',
      qs: [
        { q: 'What has happened to strong formulations of the hypothesis?', o: ['They are widely accepted', 'They have been discredited', 'They were never proposed'], a: 1 },
        { q: 'What does the tempered version claim?', o: ['Language bias attention and memory', 'Language has no effect', 'Thought creates language'], a: 0 },
        { q: 'The phrase "nudges cognition without imprisoning it" means language…', o: ['controls thought completely', 'influences but does not determine thought', 'is unrelated to thought'], a: 1 },
      ],
      vocab: [{ w: 'oscillate', kr: '오가다, 진동하다' }, { w: 'incommensurable', kr: '통약 불가능한' }, { w: 'tempered', kr: '누그러진, 절제된' }],
    },
    {
      title: 'The Epistemology of Expertise',
      text: "What entitles an individual to be regarded as an expert is a question with surprisingly unstable answers. Credentialism presumes that formal qualification is a reliable proxy for competence, yet history is replete with credentialed authorities who were spectacularly wrong, and self-taught practitioners who were not. A more defensible criterion may be calibrated track record—the demonstrated correspondence between one's predictions and subsequent outcomes—though even this metric is vulnerable to selective memory and post hoc rationalization.",
      qs: [
        { q: 'What does credentialism presume?', o: ['Formal qualification predicts competence', 'Experience is irrelevant', 'Expertise cannot be measured'], a: 0 },
        { q: 'What counterexample does the text give?', o: ['Self-taught practitioners who were right', 'Experts who were always correct', 'No counterexamples exist'], a: 0 },
        { q: 'What is "calibrated track record"?', o: ['A formal degree', 'Correspondence between predictions and outcomes', 'Years of experience'], a: 1 },
      ],
      vocab: [{ w: 'credentialism', kr: '자격증주의' }, { w: 'replete with', kr: '~로 가득한' }, { w: 'post hoc rationalization', kr: '사후 합리화' }],
    },
    {
      title: 'The Tragedy of the Commons Revisited',
      text: "Garrett Hardin's classic formulation of the commons dilemma posited that individually rational actors, each maximizing private gain from a shared resource, would inexorably deplete it absent external regulation. Subsequent scholarship, notably by Elinor Ostrom, complicated this narrative by documenting numerous instances in which communities devised durable, self-governing institutions that averted such depletion without recourse to either privatization or state intervention. The lesson is not that Hardin was wrong, but that his model omitted a crucial variable: the capacity for endogenous institutional innovation.",
      qs: [
        { q: "What did Hardin's model predict?", o: ['Resources would be depleted absent regulation', 'Communities would self-regulate perfectly', 'Privatization always fails'], a: 0 },
        { q: "What did Ostrom's research show?", o: ['Self-governing institutions can avert depletion', 'Hardin was completely correct', 'Regulation always fails'], a: 0 },
        { q: 'What variable did Hardin’s model omit?', o: ['Population size', 'Endogenous institutional innovation', 'Climate change'], a: 1 },
      ],
      vocab: [{ w: 'inexorably', kr: '거침없이, 막을 수 없이' }, { w: 'recourse', kr: '의존, 수단' }, { w: 'endogenous', kr: '내생적인' }],
    },
    {
      title: 'The Rhetoric of Inevitability',
      text: "Few rhetorical moves are as quietly coercive as the declaration that a technology is 'inevitable'. Inevitability talk performs a double function: it flatters its proponents as realists while recasting dissent as nostalgia, a sentiment to be indulged rather than an argument to be answered. History, however, is littered with 'inevitable' futures that never arrived — the paperless office, the leisure society, nuclear-powered aviation — each abandoned not by fate but by accumulated human choices about cost, risk, and value. To insist that a technology's trajectory remains contingent is not to deny its momentum; it is to relocate the discussion from prophecy, where evidence is unnecessary, to policy, where it is obligatory.",
      qs: [
        { q: 'What double function does "inevitability talk" perform?', o: ['It flatters proponents and recasts dissent as nostalgia', 'It predicts and funds the future', 'It informs and entertains'], a: 0 },
        { q: 'Why does the author list the paperless office and leisure society?', o: ['As successful predictions', 'As "inevitable" futures that never arrived', 'As dangerous technologies'], a: 1 },
        { q: 'What does relocating discussion "from prophecy to policy" require?', o: ['Faith', 'Evidence', 'Consensus'], a: 1 },
      ],
      vocab: [{ w: 'coercive', kr: '강압적인' }, { w: 'recast A as B', kr: 'A를 B로 다시 규정하다' }, { w: 'contingent', kr: '우연에 좌우되는, 조건부의' }],
    },
    {
      title: 'On the Uses of Boredom',
      text: "Boredom has acquired the status of a design flaw — a gap in stimulation that any competent product team should engineer away. Yet phenomenologists have long distinguished between situational boredom, the restlessness of a delayed train, and profound boredom, the unsettling encounter with time itself that arises when distraction is unavailable. It is in the latter, arguably, that the mind performs its most consequential work: consolidating memory, auditing desires, and generating the unbidden associations we retroactively call creativity. A culture that treats every idle moment as a monetizable void may thus be conducting an uncontrolled experiment — eliminating not an inconvenience but a cognitive habitat, and with it, whatever species of thought can live nowhere else.",
      qs: [
        { q: 'How is boredom commonly treated, per the author?', o: ['As a design flaw to engineer away', 'As a virtue', 'As a medical condition'], a: 0 },
        { q: 'What happens during "profound boredom"?', o: ['Nothing useful', 'Consequential mental work like consolidating memory', 'Increased anxiety only'], a: 1 },
        { q: 'What is the "uncontrolled experiment" mentioned?', o: ['Testing new apps', 'Eliminating idle moments and their cognitive value', 'Studying phenomenology'], a: 1 },
      ],
      vocab: [{ w: 'unbidden', kr: '뜻하지 않은, 저절로 떠오르는' }, { w: 'retroactively', kr: '소급하여, 나중에 돌이켜' }, { w: 'habitat', kr: '서식지' }],
    },
  ],
};

export interface WritePrompt {
  p: string;
  min: number;
}

export const WRITE_PROMPTS: Record<Cefr, WritePrompt[]> = {
  A1: [
    { p: 'Introduce yourself in 3–4 sentences (name, age, job/school, hobby).', min: 25 },
    { p: 'Describe your family in a few simple sentences.', min: 25 },
    { p: 'Write about your favorite food and why you like it.', min: 25 },
    { p: 'Describe your bedroom in simple sentences.', min: 25 },
    { p: 'Write about your favorite day of the week and what you do.', min: 25 },
    { p: 'Describe the weather today and what you are wearing.', min: 25 },
    { p: 'Write about your school or workplace in simple sentences.', min: 25 },
    { p: 'Describe what you eat for breakfast, lunch, and dinner.', min: 25 },
  ],
  A2: [
    { p: 'Write about what you did last weekend (4–6 sentences, past tense).', min: 40 },
    { p: 'Describe your daily routine.', min: 40 },
    { p: 'Write about your best friend and what you like to do together.', min: 40 },
    { p: 'Describe a place you would like to visit and why.', min: 40 },
    { p: 'Write about a movie or TV show you watched recently. Did you like it?', min: 40 },
    { p: 'Describe your plans for next holiday (use going to / will).', min: 40 },
    { p: 'Write a short message apologizing to a friend for being late.', min: 40 },
    { p: 'Compare your life now with your life five years ago.', min: 40 },
  ],
  B1: [
    { p: 'Do you prefer living in a city or the countryside? Give reasons.', min: 70 },
    { p: 'Write an email to a friend inviting them to your birthday party.', min: 70 },
    { p: 'Describe a memorable trip you took and what made it special.', min: 70 },
    { p: 'Do you think students should wear school uniforms? Explain your opinion.', min: 70 },
    { p: 'Write a review of a restaurant or cafe you visited recently.', min: 70 },
    { p: 'A friend wants to learn English but has little time. Write advice on how to study.', min: 70 },
    { p: 'Describe a skill you have always wanted to learn and why.', min: 70 },
    { p: 'Write a complaint email about a product that arrived damaged.', min: 70 },
  ],
  B2: [
    { p: 'Some people think social media does more harm than good. Discuss both views and give your opinion.', min: 120 },
    { p: 'Describe a challenge you overcame and what you learned.', min: 120 },
    { p: 'Do the advantages of remote work outweigh the disadvantages? Discuss.', min: 120 },
    { p: 'Should governments invest more in public transportation than in roads? Give your opinion.', min: 120 },
    { p: 'Is it better to specialize deeply in one field or to develop broad general skills? Discuss.', min: 120 },
    { p: '"Failure teaches more than success." Do you agree? Support your view with examples.', min: 120 },
    { p: 'Should companies be required to disclose how they use customer data? Give your opinion.', min: 120 },
    { p: 'Describe how technology has changed the way people form friendships, for better or worse.', min: 120 },
  ],
  C1: [
    { p: '"Remote work will eventually replace the traditional office." To what extent do you agree?', min: 160 },
    { p: 'Analyse the impact of artificial intelligence on creative professions.', min: 160 },
    { p: 'To what extent should social media companies be held responsible for misinformation on their platforms?', min: 160 },
    { p: 'Discuss the trade-offs between economic growth and environmental sustainability.', min: 160 },
    { p: 'Evaluate whether universities still serve their purpose in an era of free online education.', min: 160 },
    { p: '"Cities should prioritize pedestrians and cyclists over private cars." Argue for or against.', min: 160 },
    { p: 'Discuss the ethical implications of algorithmic decision-making in hiring and lending.', min: 160 },
    { p: 'To what extent does language shape the way we think? Illustrate with examples.', min: 160 },
  ],
  C2: [
    { p: '"Economic growth and environmental protection are fundamentally incompatible." Critically evaluate this claim.', min: 200 },
    { p: 'Discuss whether objective truth is attainable in journalism.', min: 200 },
    { p: 'Critically assess the claim that meritocracy, as practiced, merely entrenches existing inequality.', min: 200 },
    { p: 'To what extent has the proliferation of AI-generated content undermined the value of human creative labor?', min: 200 },
    { p: '"Privacy is a transient historical anomaly, not a fundamental right." Critically examine this position.', min: 200 },
    { p: 'Assess whether international institutions remain fit for purpose in an age of resurgent nationalism.', min: 200 },
    { p: '"The humanities are a luxury that publicly funded education can no longer afford." Refute or defend.', min: 200 },
    { p: 'Critically evaluate the proposition that scientific consensus is itself a social construct.', min: 200 },
  ],
};
