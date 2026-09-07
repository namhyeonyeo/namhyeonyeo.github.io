#!/usr/bin/env node
/**
 * Portfolio static site generator.
 *
 * 의존성 없음. Node 18+ 에서 `node build.mjs` 로 실행합니다.
 * content/ 아래 JSON 만 수정하면 UI 코드를 건드리지 않고 페이지가 갱신됩니다.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(ROOT, 'content');
const OUT = join(ROOT, 'dist');

/* ---------------------------------------------------------------- content */

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const readDir = (name) => {
  const dir = join(CONTENT, name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f)))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
};

const site = readJson(join(CONTENT, 'site.json'));
if (!site.githubUsername || site.githubUsername === 'CHANGE_ME') {
  console.error('✗ GitHub username is not configured. Run: node configure.mjs <github-username>');
  process.exit(2);
}
const experience = readJson(join(CONTENT, 'experience.json'));
const about = readJson(join(CONTENT, 'about.json'));
const projects = readDir('projects');
const cases = readDir('troubleshooting');
const practices = readDir('practices');
const tools = readDir('tools');

rmSync(OUT, { recursive: true, force: true });

const BASE = site.baseHref.endsWith('/') ? site.baseHref : site.baseHref + '/';
const url = (p = '') => (BASE + p.replace(/^\//, '')).replace(/\/{2,}/g, '/');
const abs = (p = '') => site.siteUrl.replace(/\/$/, '') + url(p);

/* ----------------------------------------------------------------- render */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 본문에서 `code` 표기만 인라인 코드로 변환합니다.
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

// Evidence Markdown is rendered as HTML instead of being served as raw text.
// This intentionally supports the subset used by this portfolio: headings,
// paragraphs, lists, tables, blockquotes, fenced code and Mermaid diagrams.
const markdownToHtml = (source) => {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const isTableDivider = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const special = (line, next = '') =>
    /^\s*$/.test(line) || /^```/.test(line) || /^#{1,6}\s+/.test(line) || /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line) || /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    (line.includes('|') && isTableDivider(next));

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    const fence = line.match(/^```\s*([^\s]*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i += 1; }
      if (i < lines.length) i += 1;
      if (lang.toLowerCase() === 'mermaid') {
        out.push(`<div class="mermaid">${esc(body.join('\n'))}</div>`);
      } else {
        out.push(`<pre class="code"><code${lang ? ` data-language="${esc(lang)}"` : ''}>${esc(body.join('\n'))}</code></pre>`);
      }
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].replace(/\s+#+\s*$/, '');
      const id = text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${level} id="${esc(id)}">${inline(text)}</h${level}>`);
      i += 1; continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>'); i += 1; continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i += 1; }
      out.push(`<div class="table-wrap"><table><thead><tr>${headers.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${headers.map((_, idx) => `<td>${inline(r[idx] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      out.push(`<blockquote>${q.map((x) => `<p>${inline(x)}</p>`).join('')}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i += 1; }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i += 1; }
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`);
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && !special(lines[i], lines[i + 1] || '')) {
      paragraph.push(lines[i].trim()); i += 1;
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
};

// Extensions that get rendered as a standalone syntax-readable code page
// instead of being linked to as a raw static file.
const CODE_EXTENSIONS = ['.yaml', '.yml', '.sh', '.json'];
const isCodeEvidence = (p) => CODE_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext));

const evidenceRoute = (p) => {
  if (!p) return p;
  if (p.toLowerCase().endsWith('.md')) {
    if (/\/README\.md$/i.test(p)) return p.replace(/README\.md$/i, '');
    return p.replace(/\.md$/i, '/');
  }
  if (isCodeEvidence(p)) return p + '/';
  return p;
};

const isNeedData = (s) => typeof s === 'string' && s.trim().startsWith('NEED_DATA');

const needTag = (s) => `<span class="need">${esc(s)}</span>`;

const para = (s) => (isNeedData(s) ? `<p>${needTag(s)}</p>` : `<p>${inline(s)}</p>`);

const paras = (v) => (Array.isArray(v) ? v.map(para).join('') : v ? para(v) : '');

const bullets = (v) => {
  if (!v || !v.length) return '';
  return `<ul class="bullets">${v
    .map((i) => `<li>${isNeedData(i) ? needTag(i) : inline(i)}</li>`)
    .join('')}</ul>`;
};

const notes = (v) => {
  if (!v || !v.length) return '';
  return `<div class="notes">${v
    .map(
      (n) =>
        `<div class="note"><p class="note-label">${inline(n.label)}</p><p>${inline(n.text)}</p></div>`
    )
    .join('')}</div>`;
};

const diagram = (t) => (t ? `<pre class="diagram" aria-label="architecture diagram">${esc(t)}</pre>` : '');

// Generic project architecture renderer. Reads whatever shape the content
// JSON provides — no project slug/filename is ever hardcoded here.
//   { asIs: {...}, toBe: {...} }  -> side-by-side AS-IS / TO-BE comparison
//   { flow: {...} }               -> single data-flow / overview diagram
//   { diagram: "...", notes: [] } -> legacy plain-text diagram (fallback)
// Each panel object is { label, mermaid, caption }.
const archPanel = (panel, kind) => {
  if (!panel || !panel.mermaid) return '';
  const label = panel.label || (kind === 'as-is' ? 'AS-IS' : kind === 'to-be' ? 'TO-BE' : '');
  const a11y = esc(panel.caption || label || 'architecture diagram');
  return `<figure class="arch-panel arch-${kind}">
  <figcaption class="arch-label"><span class="arch-tag">${esc(label)}</span></figcaption>
  <div class="mermaid" role="img" aria-label="${a11y}">${esc(panel.mermaid)}</div>
  ${panel.caption ? `<figcaption class="arch-caption">${inline(panel.caption)}</figcaption>` : ''}
</figure>`;
};

const archField = (arch) => {
  if (!arch) return '';
  if (arch.asIs && arch.toBe) {
    return `<div class="arch-compare">${archPanel(arch.asIs, 'as-is')}${archPanel(arch.toBe, 'to-be')}</div>${bullets(arch.notes)}`;
  }
  if (arch.flow) {
    return `<div class="arch-compare arch-single">${archPanel(arch.flow, 'flow')}</div>${bullets(arch.notes)}`;
  }
  return diagram(arch.diagram) + bullets(arch.notes);
};

const tags = (v) =>
  !v || !v.length ? '' : `<ul class="tags">${v.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

const evidenceLinks = (v) => !v || !v.length ? '' : `<ul class="bullets evidence-links">${v.map((e) => `<li><a href="${url(evidenceRoute(e.path))}">${esc(e.label)}</a></li>`).join('')}</ul>`;

// 왼쪽 모노 라벨 + 오른쪽 본문. 이 사이트의 기본 조판 단위입니다.
const field = (label, body) => (body ? `<section class="field"><h2>${esc(label)}</h2><div class="field-body">${body}</div></section>` : '');

const NAV = [
  ['Home', ''],
  ['Experience · 경력', 'experience/'],
  ['Projects · 프로젝트', 'projects/'],
  ['Troubleshooting · 장애 분석', 'troubleshooting/'],
  ['Practices · 운영·검증', 'practices/'],
  ['Tools · 자동화', 'tools/'],
  ['About · 소개', 'about/'],
];

const pages = [];

function page({ path, title, description, main, wide = false }) {
  const fullTitle = path === '' ? `${site.name} — ${site.role}` : `${title} · ${site.name}`;
  const desc = description || site.tagline;
  const nav = NAV.map(
    ([label, href]) =>
      `<a href="${url(href)}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>(function(){try{var t=localStorage.getItem('portfolio-theme');if(t!=='light'&&t!=='dark'){t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(path)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:image" content="${abs('assets/og-card.png')}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${url('assets/style.css')}">
<link rel="stylesheet" href="${url('assets/theme.css')}">
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="masthead">
  <a class="wordmark" href="${url('')}">
    <span class="wordmark-name">${esc(site.name)}</span>
    <span class="wordmark-role">${esc(site.role)}</span>
  </a>
  <nav aria-label="주요 메뉴">${nav}</nav>
  <button type="button" id="theme-toggle" class="theme-toggle" aria-label="라이트/다크 테마 전환" aria-pressed="false">
    <span class="theme-toggle-icon" aria-hidden="true"></span>
    <span class="theme-toggle-text" aria-hidden="true">Theme</span>
  </button>
</header>
<main id="main" class="${wide ? 'wide' : ''}">
${main}
</main>
<footer>
  <p>${esc(site.name)} · ${esc(site.nameKo)}</p>
  <p class="footer-links">
    <a href="${esc(site.contact.github)}">GitHub</a>
    ${site.contact.engineeringNotes ? `<a href="${esc(site.contact.engineeringNotes)}">Engineering Notes</a>` : ''}
    <a href="mailto:${esc(site.contact.email)}">Email</a>
  </p>
  <p class="footer-note">Production 사례의 고객사 정보와 네트워크 식별자는 모두 제거했습니다.</p>
</footer>
<script>(function(){
  var btn = document.getElementById('theme-toggle');
  if(!btn) return;
  var root = document.documentElement;
  function sync(){ btn.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark' ? 'true' : 'false'); }
  sync();
  btn.addEventListener('click', function(){
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('portfolio-theme', next); } catch (e) {}
    sync();
  });
})();</script>
${main.includes('class="mermaid"') ? `<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'; mermaid.initialize({startOnLoad:true,theme:'neutral',securityLevel:'strict'});</script>` : ''}
</body>
</html>`;

  const dir = join(OUT, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  pages.push(path);
}

/* ------------------------------------------------------------------ pages */

// Home
{
  const highlights = site.highlights
    .map((h) => `<div class="stat"><p class="stat-value">${esc(h.value)}</p><p class="stat-label">${esc(h.label)}</p></div>`)
    .join('');

  const featuredProjects = projects
    .slice(0, 4)
    .map(
      (p) =>
        `<li><a href="${url('projects/' + p.slug + '/')}"><span class="idx-cat">${esc(p.type)}</span><span class="idx-title">${esc(p.title)}</span><span class="idx-sum">${esc(p.summary)}</span></a></li>`
    )
    .join('');

  const featuredCases = cases
    .slice(0, 3)
    .map(
      (c) =>
        `<li><a href="${url('troubleshooting/' + c.slug + '/')}"><span class="idx-cat">${esc(c.category)}</span><span class="idx-title">${esc(c.title)}</span></a></li>`
    )
    .join('');

  const availability = site.availability ? `
  <div class="availability">
    <b>${esc(site.availability.status)}</b>
    <span>${esc(site.availability.note)}</span>
    <span>${esc(site.availability.interest)}</span>
    <span>${esc(site.availability.location)}</span>
  </div>` : '';

  const platformScope = site.platformScope ? `
<section class="platform-scope">
  <div class="section-kicker"><h2>${esc(site.platformScope.title)}</h2></div>
  <p class="scope-lead">${inline(site.platformScope.lead)}</p>
  <div class="scope-counts">
    ${site.platformScope.counts.map((c) => `<div class="scope-count"><span>${esc(c.label)}</span><strong>${esc(c.value)}</strong><span>${esc(c.detail)}</span></div>`).join('')}
  </div>
  <div class="scope-grid">
    ${site.platformScope.zones.map((z) => `<div class="scope-zone"><h3>${esc(z.name)}</h3><p>${esc(z.environments.join(' · '))}</p><p>${esc(z.note)}</p></div>`).join('')}
  </div>
  <div class="table-wrap">
    <table class="scope-table">
      <thead><tr><th>구성</th><th>역할 / 구조</th><th>규모</th></tr></thead>
      <tbody>${site.platformScope.clusters.map((c) => `<tr><td>${esc(c.env)}</td><td>${esc(c.structure)}</td><td>${esc(c.detail)}</td></tr>`).join('')}</tbody>
    </table>
  </div>
  ${site.platformScope.diagram ? `<img class="scope-diagram" src="${url(site.platformScope.diagram)}" alt="망분리 Kubernetes 플랫폼 토폴로지">` : ''}
  <p class="scope-lead">${inline(site.platformScope.implication)}</p>
</section>` : '';

  const readingGuide = site.readingGuide ? `
<section class="reading-guide">
  <h2>${esc(site.readingGuide.title)}</h2>
  <ul class="reading-guide-list">${site.readingGuide.items.map((i) =>
    `<li><a href="${url(i.href)}"><strong>${esc(i.label)}</strong><span>${esc(i.text)}</span></a></li>`).join('')}</ul>
</section>` : '';

  const main = `
<section class="hero">
  <p class="eyebrow">${esc(site.roleSecondary)}</p>
  <p class="hero-name">${esc(site.name)}</p>
  <h1>${esc(site.role)}</h1>
  <p class="hero-lead">${inline(site.tagline)}</p>
  ${site.heroSecondary ? `<p class="hero-intro">${inline(site.heroSecondary)}</p>` : ''}
  <ul class="tags hero-tags">${site.coreTechnologies.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  <p class="cta">
    <a class="cta-primary" href="${url('projects/')}">프로젝트 보기</a>
    <a href="${url('troubleshooting/')}">장애 분석</a>
    <a href="${esc(site.contact.github)}">GitHub</a>
    <a href="mailto:${esc(site.contact.email)}">Email</a>
  </p>
  ${availability}
</section>
<section class="stats">${highlights}</section>
${platformScope}
${readingGuide}
<section class="home-section">
  <div class="section-kicker"><h2>Core Expertise / 핵심 역량</h2></div>
  <div class="skills">${site.skills.map((g) => `<div class="skill-group"><h3>${esc(g.group)}</h3>${tags(g.items)}</div>`).join('')}</div>
</section>
<section class="home-section">
  <div class="section-kicker"><h2>주요 프로젝트 / Selected Engineering Work</h2></div>
  <ul class="index-list large featured-grid">${featuredProjects}</ul>
  <p class="more"><a href="${url('projects/')}">모든 프로젝트 보기</a></p>
</section>
<section class="home-section">
  <div class="section-kicker"><h2>장애 분석 / Troubleshooting Casebook</h2></div>
  <ul class="index-list rca-list">${featuredCases}</ul>
  <p class="more"><a href="${url('troubleshooting/')}">모든 사례 보기</a></p>
</section>
<section class="home-section resume-snapshot">
  <div class="section-kicker"><h2>경력 요약 / Experience</h2></div>
  ${field('Profile / 소개', para(site.resume.summary))}
  ${field('Experience / 경력', `<p class="entry-meta"><strong>${esc(experience.positions[0].company)}</strong> · ${esc(experience.positions[0].role)} · ${esc(experience.positions[0].period)}</p>${bullets(experience.positions[0].responsibilities.slice(0, 5))}<p class="more"><a href="${url('experience/')}">상세 경력 보기</a></p>`)}
</section>
<section class="home-section">
  <div class="section-kicker"><h2>Practices · 운영·검증</h2></div>
  <ul class="index-list">${practices.map((p) => `<li><a href="${url('practices/#' + p.slug)}"><span class="idx-cat">${esc(p.label)}</span><span class="idx-title">${esc(p.title)}</span></a></li>`).join('')}</ul>
  <p class="more"><a href="${url('practices/')}">Practices 전체 보기</a></p>
</section>
<section class="home-section">
  <div class="section-kicker"><h2>Tools · 자동화</h2></div>
  <ul class="index-list">${tools.map((t) => `<li><a href="${url('tools/#' + t.slug)}"><span class="idx-cat">${esc(t.category)}</span><span class="idx-title">${esc(t.name)}</span><span class="idx-sum">${esc(t.problem)}</span></a></li>`).join('')}</ul>
  <p class="more"><a href="${url('tools/')}">Tools 전체 보기</a></p>
</section>
<section class="home-section">
  <div class="section-kicker"><h2>Education · Certification · Contact</h2></div>
  ${field('Certification / 자격', `<ul class="bullets">${experience.certifications.map((c) => `<li>${esc(c.name)} · ${esc(c.date)}</li>`).join('')}</ul><p class="more"><a href="${url('experience/')}">Education 전체 보기</a></p>`)}
  ${field('Contact / 연락처', `<ul class="bullets"><li>Email · <a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></li><li>GitHub · <a href="${esc(site.contact.github)}">${esc(site.contact.github)}</a></li></ul>`)}
</section>`;
  page({ path: '', title: 'Home', main });
}

// Experience
{
  const positions = experience.positions
    .map(
      (p) => `
<article class="entry">
  <h2>${esc(p.company)}</h2>
  <p class="entry-meta">${esc(p.role)}${p.team ? ' · ' + esc(p.team) : ''}</p>
  <p class="entry-meta">${isNeedData(p.period) ? needTag(p.period) : esc(p.period)}</p>
  ${p.companyNote ? `<p class="entry-meta">${inline(p.companyNote)}</p>` : ''}
  ${para(p.summary)}
  ${p.scale ? `<section class="platform-scope compact"><h3>${esc(p.scale.title)}</h3><p class="scope-lead">${inline(p.scale.lead)}</p>${bullets(p.scale.items)}${para(p.scale.note)}</section>` : ''}
  <h3>Key responsibilities / 주요 역할</h3>
  ${bullets(p.responsibilities)}
  <h3>Clients / 환경</h3>
  ${para(p.clients)}
  <h3>Representative projects / 대표 프로젝트</h3>
  <ul class="index-list">${p.projectRefs
    .map((slug) => {
      const proj = projects.find((x) => x.slug === slug);
      return proj
        ? `<li><a href="${url('projects/' + slug + '/')}"><span class="idx-cat">${esc(proj.type)}</span><span class="idx-title">${esc(proj.title)}</span></a></li>`
        : '';
    })
    .join('')}</ul>
</article>`
    )
    .join('');

  const certs = experience.certifications
    .map((c) => `<li>${esc(c.name)} — ${esc(c.issuer)} · ${isNeedData(c.date) ? needTag(c.date) : esc(c.date)}</li>`)
    .join('');
  const edu = experience.education
    .map((e) => `<li>${isNeedData(e.name) ? needTag(e.name) : esc(e.name)} · ${isNeedData(e.period) ? needTag(e.period) : esc(e.period)}${e.note ? ` · ${esc(e.note)}` : ''}</li>`)
    .join('');

  const main = `
<header class="page-head"><h1>Experience</h1><p>상세 내용은 각 프로젝트 페이지에 있습니다.</p></header>
${positions}
${field('Certification', `<ul class="bullets">${certs}</ul>`)}
${field('Education', `<ul class="bullets">${edu}</ul>`)}`;
  page({ path: 'experience/', title: 'Experience', main });
}

// Projects index + detail
{
  const list = projects
    .map(
      (p) => `
<li>
  <a href="${url('projects/' + p.slug + '/')}">
    <span class="idx-cat">${esc(p.type)}</span>
    <span class="idx-title">${esc(p.title)}</span>
    <span class="idx-sum">${esc(p.summary)}</span>
  </a>
</li>`
    )
    .join('');

  page({
    path: 'projects/',
    title: 'Projects / 프로젝트',
    description: 'Production Kubernetes 플랫폼 구축·운영 프로젝트',
    main: `<header class="page-head"><h1>Projects / 프로젝트</h1><p>실제 운영 환경에서 수행한 대표 프로젝트입니다. 무엇을 설치했는지보다 어떤 제약 아래에서 어떤 구조를 골랐는지를 적었습니다.</p></header>
<ul class="index-list large">${list}</ul>`,
  });

  for (const p of projects) {
    const related = (p.related_cases || [])
      .map((slug) => {
        const c = cases.find((x) => x.slug === slug);
        return c ? `<li><a href="${url('troubleshooting/' + slug + '/')}">${esc(c.title)}</a></li>` : '';
      })
      .join('');

    const main = `
<header class="page-head detail">
  <p class="eyebrow">${esc(p.type)} · ${isNeedData(p.period) ? needTag(p.period) : esc(p.period)}</p>
  <h1>${esc(p.title)}</h1>
  <p class="lede">${inline(p.summary)}</p>
</header>
${field('Context', paras(p.context))}
${field('Problem', bullets(p.problem))}
${field('Constraints', bullets(p.constraints))}
${field('My role', bullets(p.role))}
${field('Architecture', archField(p.architecture))}
${field('Engineering decisions', notes(p.decisions))}
${field('Implementation', bullets(p.implementation))}
${field('Validation', bullets(p.validation))}
${field('Outcome', bullets(p.outcome))}
${field('Tech stack', tags(p.technologies))}
${field('Evidence', evidenceLinks(p.evidence_links))}
${field('Related cases', related ? `<ul class="bullets">${related}</ul>` : '')}
${field('Repository', p.related_repository ? `<p><a href="https://github.com/${esc(site.githubUsername)}/${esc(p.related_repository)}">${esc(p.related_repository)}</a></p>` : '')}
<p class="back"><a href="${url('projects/')}">← Projects</a></p>`;
    page({ path: `projects/${p.slug}/`, title: p.title, description: p.summary, main });
  }
}

// Troubleshooting index + detail
{
  const list = cases
    .map(
      (c) => `
<li>
  <a href="${url('troubleshooting/' + c.slug + '/')}">
    <span class="idx-cat">${esc(c.category)}</span>
    <span class="idx-title">${esc(c.title)}</span>
    <span class="idx-sum">${esc(c.root_cause.slice(0, 90))}…</span>
  </a>
</li>`
    )
    .join('');

  page({
    path: 'troubleshooting/',
    title: 'Troubleshooting / 장애 분석',
    description: 'Kubernetes 운영 장애 분석 casebook',
    main: `<header class="page-head"><h1>Troubleshooting Casebook</h1><p>운영 중 실제로 겪은 장애를 관측 → 가설 → 검증 → 제거 → 원인 순서로 정리했습니다. 처음부터 답을 알고 쓴 글이 아니라, 그때 어디를 헤맸는지도 남겼습니다.</p></header>
<ul class="index-list large rca-list">${list}</ul>`,
  });

  for (const c of cases) {
    const main = `
<header class="page-head detail rca-detail">
  <p class="eyebrow">${esc(c.category)} · ${isNeedData(c.date) ? needTag(c.date) : esc(c.date)}</p>${c.evidence_status ? `<p class="evidence-status">${esc(c.evidence_status)}</p>` : ''}
  <h1>${esc(c.title)}</h1>
  <p class="lede">${inline(c.root_cause)}</p>
</header>
${field('Environment / 환경', tags(c.environment))}
${field('Symptoms / 현상', bullets(c.symptoms))}
${field('Architecture / 구조', diagram(c.architecture))}
${field('Investigation / 조사', bullets(c.investigation))}
${field('Hypotheses / 가설', notes(c.hypotheses))}
${field('Evidence / 근거', bullets(c.evidence))}
${field('Root Cause / 원인', para(c.root_cause))}
${field('Resolution / 조치', bullets(c.resolution))}
${field('Validation / 검증', bullets(c.validation))}
${field('Prevention / 재발 방지', bullets(c.prevention))}
${field('Lessons / 배운 점', bullets(c.lessons))}
${field('Evidence / 관련 파일', evidenceLinks(c.evidence_links))}
<p class="back"><a href="${url('troubleshooting/')}">← 장애 분석 목록</a></p>`;
    page({ path: `troubleshooting/${c.slug}/`, title: c.title, description: c.symptoms[0], main });
  }
}

// Practices
{
  const items = practices
    .map(
      (l) => `
<article class="entry" id="${esc(l.slug)}">
  <p class="eyebrow"><span class="label">${esc(l.label)}</span> ${esc(l.category)} · ${esc(l.status)}</p>
  <h2>${esc(l.title)}</h2>
  ${para(l.objective)}
  <h3>Environment / 환경</h3>${tags(l.environment)}
  <h3>Implementation / 구현</h3>${bullets(l.implementation)}
  <h3>Validation / 검증</h3>${bullets(l.validation)}
  <h3>Lessons / 배운 점</h3>${bullets(l.lessons)}
  ${evidenceLinks(l.evidence_links)}${l.repository ? `<p class="more"><a href="https://github.com/${esc(site.githubUsername)}/${esc(l.repository.replace('CHANGE_ME', site.githubUsername))}">Repository</a></p>` : ''}
</article>`
    )
    .join('');

  page({
    path: 'practices/',
    title: 'Practices / 운영·검증',
    description: '운영 적용, 사전 검증, Self Study를 사실 관계에 따라 구분한 기록',
    main: `<header class="page-head"><h1>Platform Practices / 운영·검증</h1><p>운영 환경에 실제 적용한 정책·기능, Production 반영 전 검증, Self Study를 같은 섹션에 모으되 각 항목의 라벨로 범위를 명확히 구분합니다.</p></header>
${items}`,
  });

  // /labs/ was the pre-v6 route name; keep a static redirect so old links and
  // bookmarks still resolve instead of 404ing.
  const labsRedirectDir = join(OUT, 'labs');
  mkdirSync(labsRedirectDir, { recursive: true });
  writeFileSync(
    join(labsRedirectDir, 'index.html'),
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${esc(url('practices/'))}"><link rel="canonical" href="${esc(abs('practices/'))}"><title>Redirecting… · ${esc(site.name)}</title></head><body><p>이 페이지는 <a href="${esc(url('practices/'))}">Practices · 운영·검증</a>으로 이동했습니다.</p></body></html>`
  );
}

// Tools
{
  const items = tools
    .map(
      (t) => `
<article class="entry" id="${esc(t.slug)}">
  <p class="eyebrow">${esc(t.category)} · ${esc(t.language)}</p>
  <h2>${esc(t.name)}</h2>
  <h3>Problem</h3>${para(t.problem)}
  <h3>Why I built it</h3>${para(t.purpose)}
  <h3>Usage</h3><pre class="code">${esc(t.usage)}</pre>
  <h3>Example output</h3><pre class="code">${esc(t.example)}</pre>
  <h3>Safety considerations</h3>${bullets(t.safety)}
  ${evidenceLinks(t.evidence_links)}${t.repository ? `<p class="more"><a href="https://github.com/${esc(site.githubUsername)}/${esc(t.repository.replace('CHANGE_ME', site.githubUsername))}">Repository</a></p>` : ''}
</article>`
    )
    .join('');

  page({
    path: 'tools/',
    title: 'Tools / 자동화',
    description: '운영 중 만든 점검·자동화 스크립트',
    main: `<header class="page-head"><h1>Tools / 자동화</h1><p>운영하면서 같은 확인을 세 번 이상 반복하게 되면 스크립트로 만들었습니다. 실제 운영 스크립트에서 자격증명과 내부 식별정보를 제거한 공개본입니다.</p></header>
${items}`,
  });
}

// About
{
  const body = about.sections
    .map((s) => `<section class="field"><h2>${esc(s.heading)}</h2><div class="field-body">${paras(s.body)}</div></section>`)
    .join('');
  page({ path: 'about/', title: 'About / 소개', main: `<header class="page-head"><h1>About / 소개</h1></header>${body}` });
}



/* ---------------------------------------------------------- evidence pages */
// Every Markdown / YAML / Shell file under evidence/ gets rendered as its own
// readable HTML page (not just linked to as a raw file), so evidence_links
// in content/*.json can point straight at a rendered, scrollable page.
{
  const evidenceRoot = join(ROOT, 'evidence');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

  if (existsSync(evidenceRoot)) {
    const files = walk(evidenceRoot).filter(
      (f) => f.toLowerCase().endsWith('.md') || isCodeEvidence(f)
    );
    for (const sourcePath of files) {
      const relFs = sourcePath.slice(evidenceRoot.length + 1).replace(/\\/g, '/');
      const publicSourcePath = `evidence/${relFs}`;
      const route = evidenceRoute(publicSourcePath);
      const isMarkdown = sourcePath.toLowerCase().endsWith('.md');
      const source = readFileSync(sourcePath, 'utf8');
      const fileName = relFs.split('/').pop();
      const githubSource = `https://github.com/${site.githubUsername}/${site.githubUsername}.github.io/blob/main/${publicSourcePath}`;

      let title, body, lede;
      if (isMarkdown) {
        title = source.match(/^#\s+(.+)$/m)?.[1] || fileName.replace(/\.md$/i, '');
        body = `<article class="markdown-body">${markdownToHtml(source)}</article>`;
        lede = 'Sanitized technical evidence connected to the portfolio project.';
      } else {
        title = fileName;
        const lang = fileName.split('.').pop().toLowerCase();
        body = `<pre class="code evidence-code"><code data-language="${esc(lang)}">${esc(source)}</code></pre>`;
        lede = 'Sanitized configuration / script evidence connected to the portfolio project.';
      }

      const main = `
<header class="page-head detail evidence-head">
  <p class="eyebrow">Engineering Evidence</p>
  <h1>${esc(title)}</h1>
  <p class="lede">${lede}</p>
  <p class="evidence-source"><a href="${esc(githubSource)}">${isMarkdown ? 'Markdown' : 'Raw'} source on GitHub</a></p>
</header>
${body}
<p class="back"><a href="${url('projects/')}">← Portfolio</a></p>`;
      page({ path: route, title, description: `${title} — engineering evidence`, main, wide: true });
    }
  }
}

/* --------------------------------------------------------------- 부가 파일 */

if (existsSync(join(ROOT, 'assets'))) {
  cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
}
// .md/.yaml/.yml/.sh/.json evidence files are rendered as pages above; only
// remaining evidence assets (if any) are copied through as static files.
if (existsSync(join(ROOT, 'evidence'))) {
  cpSync(join(ROOT, 'evidence'), join(OUT, 'evidence'), {
    recursive: true,
    filter: (src) => statSync(src).isDirectory() || (!src.toLowerCase().endsWith('.md') && !isCodeEvidence(src)),
  });
}
writeFileSync(join(OUT, '.nojekyll'), '');
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${abs('sitemap.xml')}\n`);
writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${abs(p)}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);
writeFileSync(
  join(OUT, '404.html'),
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script>(function(){try{var t=localStorage.getItem('portfolio-theme');if(t!=='light'&&t!=='dark'){t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script><title>404 · ${esc(site.name)}</title><link rel="stylesheet" href="${url('assets/style.css')}"><link rel="stylesheet" href="${url('assets/theme.css')}"></head><body><main><header class="page-head"><h1>404</h1><p>이 주소에는 페이지가 없습니다. <a href="${url('')}">처음으로 돌아가기</a></p></header></main></body></html>`
);

const needData = [];
const scan = (obj, where) => {
  if (typeof obj === 'string') {
    if (isNeedData(obj)) needData.push(`${where}: ${obj}`);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => scan(v, `${where}[${i}]`));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) scan(v, `${where}.${k}`);
  }
};
scan({ site, experience, projects, cases, practices, tools, about }, 'content');

console.log(`✓ ${pages.length} pages → dist/`);
if (needData.length) {
  console.log(`\n⚠ NEED_DATA ${needData.length}건 — 아래 항목은 실제 값으로 채워야 합니다.`);
  needData.forEach((n) => console.log(`  · ${n}`));
}
