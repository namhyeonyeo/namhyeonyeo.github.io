# NamHyeon Yeo · 여남현 — Engineering Portfolio

Source for **https://namhyeonyeo.github.io**.

Kubernetes 플랫폼 구축·운영 경험, Architecture Migration, GitOps, Observability, 운영 정책, Troubleshooting RCA와 공개 가능한 sanitized evidence를 정리합니다.

## Structure

- `content/` — portfolio content
  - `projects/`, `troubleshooting/`, `practices/`, `tools/` — 각 JSON 하나가 카드/상세 페이지 하나
- `evidence/` — sanitized YAML / scripts / Markdown evidence
  - `07-operations-toolkit/` — 운영 스크립트 공개본과 사용 기록
- `assets/` — `style.css`(레이아웃) + `theme.css`(디자인 토큰)
- `.github/workflows/deploy.yml` — GitHub Pages deployment
- `build.mjs` — static-site generator

## Content 규칙

- Tools는 `featured: true`면 상세 카드, `featured: false`면 More Utilities 표에 들어갑니다.
- `homeOrder`가 있는 Tool만 Home에 노출됩니다.
- Project의 `architecture`는 `asIs`/`toBe`(비교) 또는 `flow`(단일) 형태의 Mermaid 소스를 읽습니다.
- 값이 확정되지 않은 필드는 `NEED_DATA —`로 시작하는 문자열로 두면 빌드가 목록으로 알려줍니다.

## Local preview

```bash
node build.mjs
python3 -m http.server 8000 -d dist
```

## Security

`evidence/`는 public입니다. 고객사 식별자, 실제 내부 IP/FQDN, credential, token, kubeconfig, private key, 원본 production log는 commit하지 않습니다.
