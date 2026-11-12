# 출처와 이용 안내

## 이 예제가 걸어온 길

| 때 | 일 |
|---|---|
| 2026년 9~10월 | 처음 판. 강의 실습용 템플릿 「윤비서 템플릿」에서 로그인·계정·설치 뼈대를 가져와 출발했고, 그 위에 가계부를 만들었습니다 |
| 2026년 11월 | 템플릿에서 온 부분을 모두 새로 작성했습니다. 지금 이 저장소의 코드는 템플릿 코드를 포함하지 않습니다 |

가계부 기능 — 수입·지출·통장이동·할부·대출, 현금흐름, 통장내역, 통계, 수집함과 문자·알림 수집, 가계부용 DB 구조와 시험 — 은 처음부터 이 예제를 위해 새로 만든 것입니다.

처음 구상하는 데 「윤비서 템플릿」의 도움을 받았습니다. 템플릿을 만든 분께 감사드립니다.

## 사용한 오픈소스

이 예제는 아래 오픈소스 위에서 돌아갑니다. 각 라이선스의 전문은 해당 프로젝트에 있습니다. 저장소에 사본이 들어 있는 것은 shadcn/ui 하나이고, 그 허가문은 표 아래에 실었습니다. 나머지는 설치할 때(`npm install`) 받습니다.

| 이름 | 쓰임 | 라이선스 |
|---|---|---|
| Next.js · React | 앱 틀 | MIT |
| Supabase JS (`@supabase/supabase-js`, `@supabase/ssr`) | DB·로그인 연결 | MIT |
| shadcn/ui | `src/components/ui/` 의 부품 10개(공식 도구가 만든 파일이 저장소에 들어 있고, 일부는 이 예제에 맞게 고쳤습니다) | MIT |
| Radix UI | 위 부품의 바탕 | MIT |
| Tailwind CSS · tw-animate-css | 모양 | MIT |
| class-variance-authority | 부품 모양 갈래 | Apache-2.0 |
| clsx · tailwind-merge · cn | 클래스 이름 합치기 | MIT |
| lucide-react | 아이콘 | ISC |
| Recharts | 그래프 | MIT |
| sonner | 알림 | MIT |
| SheetJS (`xlsx`) | 엑셀 파일 읽기 | Apache-2.0 |
| Pretendard | 글꼴(저장소에 넣지 않고 불러 씁니다) | SIL OFL 1.1 |
| TypeScript · Playwright | 개발·시험 도구 | Apache-2.0 |
| ESLint · tsx | 개발·시험 도구 | MIT |

### shadcn/ui 의 저작권 표시와 허가문

`src/components/ui/` 의 파일(`badge` · `button` · `card` · `dialog` · `dropdown-menu` · `input` · `label` · `popover` · `sheet` · `tabs`)은 shadcn/ui(https://ui.shadcn.com)에서 온 것입니다.

```
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 들어 있는 자료

이 저장소의 인물·계좌·카드·대출·거래는 모두 가상입니다(김하늘·이바다 가족). 문자 예시는 실제 문자의 형식만 본뜨고 금액·상호·이름을 바꾼 것입니다.

## 이용 안내

개인 학습용으로 쓰세요. 고쳐서 자기 가계부로 쓰는 것은 자유입니다. 출처를 지우거나 이 예제를 다시 파는 일은 하지 말아 주세요.
