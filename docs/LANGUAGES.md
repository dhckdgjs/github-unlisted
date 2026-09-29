# 한국어 / English 화면 전환

- 모든 페이지 상단의 `한국어 / English` 버튼으로 화면 언어를 바꿉니다.
- 처음 방문하면 한국어이며, 선택은 현재 사이트의 `unlisted_locale` 쿠키에 1년간 저장됩니다. 로그인 정보나 공유 권한은 바뀌지 않습니다.
- 페이지를 이동하거나 새로고침해도 선택한 언어를 사용합니다. 언어 전환 시 공유 URL과 저장하지 않은 입력값은 유지됩니다.
- 메뉴·버튼·안내·날짜 표시만 번역합니다. 리포 이름, 브랜치, 파일 경로, README·릴리스 본문, 사용자가 입력한 소개문은 원본 그대로입니다.

## 문구를 수정하려면

- 각 화면의 `t("한국어", "English")` 두 문구를 함께 수정합니다.
- 클라이언트 컴포넌트는 `useLocale()`를, 서버 화면은 `getLocale()`와 `translator(locale)`를 사용합니다.
- 언어 선택·유지: `src/components/locale-provider.tsx`, `src/components/language-switcher.tsx`, `src/lib/locale-server.ts`
- 공통 버튼 스타일: `src/styles/language.css`
- 실행 확인: `npm test -- --maxWorkers=2`, `npm run build`

UI 언어 기능은 GitHub 앱 권한, 개별 공유 설정, 목록 공개 범위를 변경하지 않습니다.
