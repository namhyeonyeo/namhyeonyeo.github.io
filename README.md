# NamHyeon Yeo · 여남현 — Engineering Portfolio

Source for **https://namhyeonyeo.github.io**.

Kubernetes 플랫폼 구축·운영 경험, Architecture Migration, GitOps, Observability, 운영 정책, Troubleshooting RCA와 공개 가능한 sanitized evidence를 정리합니다.

## Structure

- `content/` — portfolio content
- `evidence/` — sanitized YAML / scripts / Markdown evidence
- `assets/` — style
- `.github/workflows/deploy.yml` — GitHub Pages deployment
- `build.mjs` — static-site generator

## Local preview

```bash
node build.mjs
python3 -m http.server 8000 -d dist
```

## Security

`evidence/`는 public입니다. 고객사 식별자, 실제 내부 IP/FQDN, credential, token, kubeconfig, private key, 원본 production log는 commit하지 않습니다.
