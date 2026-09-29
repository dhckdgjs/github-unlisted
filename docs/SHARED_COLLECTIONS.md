# 공유 목록 운영 안내

## 어디에서 수정하나요?

- 웹사이트 기능과 디자인: 이 `github-unlisted` 저장소의 소스코드. 운영 브랜치 배포로 변경합니다.
- 목록 제목·설명·표시 순서·포함할 리포: 운영 사이트의 `/app/collections` (로그인 필요). 여기에서 저장하면 기존 공유 주소에 바로 반영됩니다. 코드 수정이나 재배포가 필요하지 않습니다.
- 각 리포의 README와 Release: 해당 원본 GitHub 리포에서 수정합니다. 공유 목록은 파일을 복사하지 않고 기존 공유 뷰어로 연결합니다.

## 새로운 리포 추가

1. GitHub의 Installed GitHub Apps 설정에서 이 앱에 해당 저장소의 읽기 권한을 부여합니다. 모든 저장소 권한을 줄 필요는 없습니다.
2. `/app`에서 해당 리포의 개별 공유 링크를 만듭니다. 브랜치·Release·다운로드 공개 범위를 확인합니다.
3. `/app/collections`에서 목록을 선택하고 해당 공유 링크를 추가한 뒤 저장합니다.

목록은 `/collections/<임의의 식별자>` 주소 하나로 공유됩니다. 기존 목록을 수정하면 주소가 유지됩니다. 새 목록을 만들면 별도 주소가 생성됩니다.

## 공개 범위와 중단

- 실제 리포 목록과 공유 식별자는 Redis에 저장합니다. 실제 목록/주소를 공개 README, 소스, 빌드 환경변수의 NEXT_PUBLIC 값에 적지 마세요.
- 홈과 검색용 sitemap에는 목록 주소를 추가하지 않습니다. 목록 페이지는 noindex, no-referrer, no-store이며 방문 분석 수집 대상에서 제외됩니다.
- 이는 링크 소지자 공유입니다. 링크를 전달받은 누구나 볼 수 있고 재전달·다운로드·복사한 내용까지 회수할 수는 없습니다.
- 목록 공개를 중단해도 개별 리포 공유 링크 자체는 계속 유효합니다. 개별 접근도 중단하려면 `/app`에서 그 리포 링크를 Revoke해야 합니다.
- 만료·폐기되거나 앱의 접근 권한을 잃은 리포 공유 링크는 목록에서 숨깁니다.
- 목록에서 항목을 제거하는 것만으로 개별 공유 링크가 폐기되지는 않습니다.

## 개발자 경로

- 관리 화면: `src/app/app/collections/page.tsx`, `src/components/collection-manager.tsx`
- 수신자 목록: `src/app/collections/[id]/page.tsx`, `src/styles/collections.css`
- 관리 API: `src/app/api/collections/route.ts`
- 서버 저장·검증: `src/lib/collection-store.ts`, `src/lib/collection-service.ts`

이 기능은 기존 개별 리포의 공개 범위를 넓히지 않습니다. 기본 공유 뷰어가 허용한 파일과 Release만 그대로 연결합니다.
