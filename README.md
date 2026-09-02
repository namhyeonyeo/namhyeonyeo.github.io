# NamHyeon Yeo — Engineering Portfolio

Source for **https://namhyeonyeo.github.io**.

This portfolio presents production Kubernetes platform engineering, architecture migrations, troubleshooting cases, labs, and sanitized technical evidence.

## Structure

- `content/` — structured portfolio content
- `evidence/` — public, sanitized YAML / scripts / Markdown evidence
- `assets/` — site styling
- `.github/workflows/deploy.yml` — GitHub Pages deployment
- `build.mjs` — dependency-free static-site generator

## Local preview

```bash
node build.mjs
python3 -m http.server 8000 -d dist
```

Open `http://localhost:8000`.

## Evidence Markdown

Markdown files under `evidence/` are converted to styled HTML pages during build. Mermaid code blocks are rendered as diagrams on the published site. Non-Markdown artifacts such as YAML and shell scripts remain directly viewable.

## Security

Everything under `evidence/` is public. Never commit customer identifiers, real internal IP/FQDN values, credentials, tokens, kubeconfigs, private keys, or unsanitized production logs.
