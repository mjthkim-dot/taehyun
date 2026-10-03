# Design v3 — "Tactile Depth" (v1.23.0)

> "앱의 디자인은 3D 기반의 앱 베스트 프랙티스 레퍼런스를 웹에서 참고하여 대대적인 개편"

## 참고한 레퍼런스

| 출처 | 가져온 원칙 |
|---|---|
| Apple HIG — Materials / WWDC25 *Get to know the new design system* (Liquid Glass) | 글래스는 **기능 평면(탭·툴바)에만**. "Don't use Liquid Glass in the content layer" — 콘텐츠는 불투명 표면. 크롬은 콘텐츠 위에 떠서 뒤를 비친다 |
| Apple WWDC23 *Design for spatial user interfaces* (visionOS) | 깊이 평면으로 위계를 만든다(중요할수록 앞으로), 떠 있는 것은 **접지 그림자**, 타깃 크기 여유 |
| Duolingo 디자인 시스템(Apple *Behind the Design* 인터뷰 포함) | 흐림 없는 단색 **3D 립**(자기 색의 더 어두운 톤)으로 버튼 두께, 누르면 립 높이만큼 내려가는 **키 트래블 150ms**, 한 화면 한 행동 |
| Material 3 Expressive | **스프링 모션**(오버슈트는 축하·등장에만), 모양·모션으로 주의 유도 |
| Liquid Glass 비평(uxdesign.cc) · Meta Horizon Hands UI | 과한 굴절·움직임은 멀미·가독성 문제 → **Reduce Motion/Transparency 대응이 기본값**, 누름 상태는 항상 시각 피드백 |

## 적용 — 세 개의 깊이 평면

```
기능 평면   글래스 헤더 · 떠 있는 탭 캡슐(오비터)     backdrop-filter, 반투명, 스페큘러 림
─────────────────────────────────────────────────────
콘텐츠 평면  카드·버튼·플래시카드                      불투명, 위에서 빛 받는 그라디언트, 3층 그림자
─────────────────────────────────────────────────────
배경 평면   앰비언트 오브 2~3개 + 원근 그리드 바닥     fixed, 합성만(스크롤 비용 0)
```

### 표면 조명 모델(한 방향 광원)
- 윗변 **스페큘러 하이라이트** `inset 0 1px 0`
- **접지 그림자** 1~2px + **앰비언트 그림자** 20~40px(아래로 퍼짐)
- 라이트/다크 각각 토큰(`--lit-top`, `--shadow-card`, `--surface-hi/lo`)

### 촉각형 3D 버튼
- 주 행동: `box-shadow: 0 5px 0 var(--lip-primary)` — 다크는 민트의 짙은 톤 `#0c8f63`, 라이트는 잉크 블랙의 `#000`
- `:active` → `translateY(5px)` + 립 0 (150ms, 표준 감속)
- 보조 버튼·칩·보기: 테두리 톤 립 2~4px, 같은 키 트래블

### 3D 요소
- **플립 카드**(단어): `perspective 1200px` + `preserve-3d` + `rotateY(180deg)`, 스프링 700ms, 앞면 단어는 `translateZ(40px)`로 카드에서 떠 있음
- **카드 덱**(상황 팩): 뒤로 두 장이 기울어 겹친 두께 — "남은 단어가 쌓인 덱" 메타포
- **포인터 틸트**(`DepthFX`): 마우스 기기에서만, 최대 5°, CSS 변수만 갱신(레이아웃 무영향). 터치 기기는 스크롤과 싸우지 않도록 끄고 키 트래블이 대신
- **원형 진행 링**: `rotateX(14deg)` 원근 + 드롭섀도

### 접근성
- `prefers-reduced-motion`: 틸트·플립 회전·등장 애니메이션·그리드 바닥 제거, 플립은 즉시 교체
- `prefers-reduced-transparency`: 크롬을 불투명 표면으로
- 탭 높이 52px, 칩·토글 36px+, 보기 54px

## 구현
- `app/globals.css` 끝의 **DESIGN v3 레이어** — 기존 클래스 구조는 그대로, 토큰과 핵심 표면만 덮어써서 38개 화면이 함께 바뀐다
- `components/DepthFX.tsx` — 이벤트 위임 1개로 `[data-tilt]` 전부 처리
