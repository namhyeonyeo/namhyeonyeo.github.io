# NamHyeon Yeo — GitHub Pages Portfolio

이 폴더 **안의 내용 전체**가 `<github-username>.github.io` 저장소의 root가 됩니다.

## 1. 최초 설정

```bash
node configure.mjs <github-username>
node build.mjs
```

`build.mjs`가 `dist/`를 만들고, GitHub Actions가 그 결과물을 Pages에 배포합니다.

## 2. 콘텐츠 구조

- `content/` — 사이트에 표시되는 구조화 데이터
- `evidence/` — 공개 가능한 YAML / Script / Runbook / Sanitized case evidence
- `docs/` — 수집 목록, 출처 매핑, 공개 전 체크리스트
- `assets/` — CSS
- `.github/workflows/deploy.yml` — GitHub Pages 자동 배포

새 프로젝트나 장애 사례를 추가할 때는 `content/` JSON과 필요한 `evidence/`만 추가하면 됩니다.

## 3. 로컬 확인

```bash
node build.mjs
python -m http.server 8000 -d dist
```

브라우저에서 `http://localhost:8000`을 엽니다.

## Security

`evidence/`는 공개 GitHub에 올라가는 파일입니다. 실제 Secret, Token, 내부 IP/FQDN, 고객 식별정보, 인증서 private key를 넣지 마세요. `docs/PUBLICATION-CHECKLIST.md`를 push 전에 확인하세요.
