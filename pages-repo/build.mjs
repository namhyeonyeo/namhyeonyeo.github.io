#!/usr/bin/env node
/**
 * Portfolio static site generator.
 *
 * 의존성 없음. Node 18+ 에서 `node build.mjs` 로 실행합니다.
 * content/ 아래 JSON 만 수정하면 UI 코드를 건드리지 않고 페이지가 갱신됩니다.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync, cpSync, existsSync } from 'node:fs';
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
const labs = readDir('labs');
const tools = readDir('tools');

rmSync(OUT, { recursive: true, force: true });

const BASE = site.baseHref.endsWith('/') ? site.baseHref : site.baseHref + '/';
const url = (p = '') => (BASE + p.replace(/^\//, '')).replace(/\/{2,}/g, '/');
const abs = (p = '') => site.siteUrl.replace(/\/$/, '') + url(p);

/* ----------------------------------------------------------------- render */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 본문에서 `code` 표기만 인라인 코드로 변환합니다.
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

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

const tags = (v) =>
  !v || !v.length ? '' : `<ul class="tags">${v.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

const evidenceLinks = (v) => !v || !v.length ? '' : `<ul class="bullets evidence-links">${v.map((e) => `<li><a href="${url(e.path)}">${esc(e.label)}</a></li>`).join('')}</ul>`;

// 왼쪽 모노 라벨 + 오른쪽 본문. 이 사이트의 기본 조판 단위입니다.
const field = (label, body) => (body ? `<section class="field"><h2>${esc(label)}</h2><div class="field-body">${body}</div></section>` : '');

const NAV = [
  ['Home', ''],
  ['Experience', 'experience/'],
  ['Projects', 'projects/'],
  ['Troubleshooting', 'troubleshooting/'],
  ['Labs', 'labs/'],
  ['Tools', 'tools/'],
  ['About', 'about/'],
  ['Resume', 'resume/'],
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
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(path)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="${url('assets/style.css')}">
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="masthead">
  <a class="wordmark" href="${url('')}">
    <span class="wordmark-name">${esc(site.name)}</span>
    <span class="wordmark-role">${esc(site.role)}</span>
  </a>
  <nav aria-label="주요 메뉴">${nav}</nav>
</header>
<main id="main" class="${wide ? 'wide' : ''}">
${main}
</main>
<footer>
  <p>${esc(site.name)} · ${esc(site.nameKo)}</p>
  <p class="footer-links">
    <a href="${esc(site.contact.github)}">GitHub</a>
    ${site.contact.engineeringNotes ? `<a href="${esc(site.contact.engineeringNotes)}">Engineering Notes</a>` : ''}
    <a href="${url('resume/')}">Resume</a>
  </p>
  <p class="footer-note">Production 사례의 고객사 정보와 네트워크 식별자는 모두 제거했습니다.</p>
</footer>
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

  const featured = cases
    .slice(0, 3)
    .map(
      (c) =>
        `<li><a href="${url('troubleshooting/' + c.slug + '/')}"><span class="idx-cat">${esc(c.category)}</span><span class="idx-title">${esc(c.title)}</span></a></li>`
    )
    .join('');

  const main = `
<section class="hero">
  <p class="eyebrow">${esc(site.role)}</p>
  <h1>${esc(site.tagline)}</h1>
  <p class="hero-intro">${inline(site.intro)}</p>
  <ul class="tags hero-tags">${site.coreTechnologies.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  <p class="cta">
    <a class="cta-primary" href="${url('projects/')}">View Projects</a>
    <a href="${url('troubleshooting/')}">Troubleshooting Casebook</a>
    <a href="${esc(site.contact.github)}">GitHub</a>
    <a href="${url('resume/')}">Resume</a>
  </p>
</section>
<section class="stats">${highlights}</section>
<section class="field">
  <h2>Selected cases</h2>
  <div class="field-body">
    <ul class="index-list">${featured}</ul>
    <p class="more"><a href="${url('troubleshooting/')}">전체 사례 보기 →</a></p>
  </div>
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
  ${para(p.summary)}
  <h3>Key responsibilities</h3>
  ${bullets(p.responsibilities)}
  <h3>Clients</h3>
  ${para(p.clients)}
  <h3>Representative projects</h3>
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
    .map((e) => `<li>${isNeedData(e.name) ? needTag(e.name) : esc(e.name)} · ${isNeedData(e.period) ? needTag(e.period) : esc(e.period)}</li>`)
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
    title: 'Projects',
    description: 'Production Kubernetes 플랫폼 구축·운영 프로젝트',
    main: `<header class="page-head"><h1>Projects</h1><p>실제 운영 환경에서 수행한 대표 프로젝트입니다. 무엇을 설치했는지보다 어떤 제약 아래에서 어떤 구조를 골랐는지를 적었습니다.</p></header>
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
${field('Architecture', diagram(p.architecture?.diagram) + bullets(p.architecture?.notes))}
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
    title: 'Troubleshooting',
    description: 'Kubernetes 운영 장애 분석 casebook',
    main: `<header class="page-head"><h1>Troubleshooting Casebook</h1><p>운영 중 실제로 겪은 장애를 관측 → 가설 → 검증 → 제거 → 원인 순서로 정리했습니다. 처음부터 답을 알고 쓴 글이 아니라, 그때 어디를 헤맸는지도 남겼습니다.</p></header>
<ul class="index-list large">${list}</ul>`,
  });

  for (const c of cases) {
    const main = `
<header class="page-head detail">
  <p class="eyebrow">${esc(c.category)} · ${isNeedData(c.date) ? needTag(c.date) : esc(c.date)}</p>${c.evidence_status ? `<p class="evidence-status">${esc(c.evidence_status)}</p>` : ''}
  <h1>${esc(c.title)}</h1>
  <p class="lede">${inline(c.root_cause)}</p>
</header>
${field('Environment', tags(c.environment))}
${field('Symptoms', bullets(c.symptoms))}
${field('Architecture', diagram(c.architecture))}
${field('Investigation', bullets(c.investigation))}
${field('Hypotheses', notes(c.hypotheses))}
${field('Evidence', bullets(c.evidence))}
${field('Root cause', para(c.root_cause))}
${field('Resolution', bullets(c.resolution))}
${field('Validation', bullets(c.validation))}
${field('Prevention', bullets(c.prevention))}
${field('Lessons learned', bullets(c.lessons))}
${field('Evidence files', evidenceLinks(c.evidence_links))}
<p class="back"><a href="${url('troubleshooting/')}">← Casebook</a></p>`;
    page({ path: `troubleshooting/${c.slug}/`, title: c.title, description: c.symptoms[0], main });
  }
}

// Labs
{
  const items = labs
    .map(
      (l) => `
<article class="entry">
  <p class="eyebrow"><span class="label">${esc(l.label)}</span> ${esc(l.category)} · ${esc(l.status)}</p>
  <h2>${esc(l.title)}</h2>
  ${para(l.objective)}
  <h3>Environment</h3>${tags(l.environment)}
  <h3>Implementation</h3>${bullets(l.implementation)}
  <h3>Validation</h3>${bullets(l.validation)}
  <h3>Lessons</h3>${bullets(l.lessons)}
  ${evidenceLinks(l.evidence_links)}${l.repository ? `<p class="more"><a href="https://github.com/${esc(site.githubUsername)}/${esc(l.repository.replace('CHANGE_ME', site.githubUsername))}">Repository →</a></p>` : ''}
</article>`
    )
    .join('');

  page({
    path: 'labs/',
    title: 'Labs',
    description: '자체 학습과 재현 실습 기록',
    main: `<header class="page-head"><h1>Labs</h1><p>여기 있는 항목은 실무 경험이 아니라 자체 학습입니다. Production 경험과 섞이지 않도록 라벨을 붙여 두었습니다.</p></header>
${items}`,
  });
}

// Tools
{
  const items = tools
    .map(
      (t) => `
<article class="entry">
  <p class="eyebrow">${esc(t.category)} · ${esc(t.language)}</p>
  <h2>${esc(t.name)}</h2>
  <h3>Problem</h3>${para(t.problem)}
  <h3>Why I built it</h3>${para(t.purpose)}
  <h3>Usage</h3><pre class="code">${esc(t.usage)}</pre>
  <h3>Example output</h3><pre class="code">${esc(t.example)}</pre>
  <h3>Safety considerations</h3>${bullets(t.safety)}
  ${evidenceLinks(t.evidence_links)}${t.repository ? `<p class="more"><a href="https://github.com/${esc(site.githubUsername)}/${esc(t.repository.replace('CHANGE_ME', site.githubUsername))}">Repository →</a></p>` : ''}
</article>`
    )
    .join('');

  page({
    path: 'tools/',
    title: 'Tools',
    description: '운영 중 만든 점검·자동화 스크립트',
    main: `<header class="page-head"><h1>Tools</h1><p>운영하면서 같은 확인을 세 번 이상 반복하게 되면 스크립트로 만들었습니다. 전부 <code>kubernetes-operations-toolkit</code> 저장소에 모아 두었습니다.</p></header>
${items}`,
  });
}

// About
{
  const body = about.sections
    .map((s) => `<section class="field"><h2>${esc(s.heading)}</h2><div class="field-body">${paras(s.body)}</div></section>`)
    .join('');
  page({ path: 'about/', title: 'About', main: `<header class="page-head"><h1>About</h1></header>${body}` });
}

// Resume
{
  const skills = site.skills
    .map((g) => `<div class="skill-group"><h3>${esc(g.group)}</h3>${tags(g.items)}</div>`)
    .join('');

  const projectLines = projects
    .map(
      (p) =>
        `<li><a href="${url('projects/' + p.slug + '/')}"><span class="idx-title">${esc(p.title)}</span><span class="idx-sum">${esc(p.summary)}</span></a></li>`
    )
    .join('');

  const pos = experience.positions[0];

  const main = `
<header class="page-head"><h1>Resume</h1><p>${esc(site.resume.downloadNote)}</p></header>
${field('Summary', para(site.resume.summary))}
${field('Core skills', `<div class="skills">${skills}</div>`)}
${field(
  'Experience',
  `<p class="entry-meta"><strong>${esc(pos.company)}</strong> · ${esc(pos.role)} · ${isNeedData(pos.period) ? needTag(pos.period) : esc(pos.period)}</p>${bullets(pos.responsibilities)}`
)}
${field('Selected work', `<ul class="index-list">${projectLines}</ul>`)}
${field(
  'Certification',
  `<ul class="bullets">${experience.certifications.map((c) => `<li>${esc(c.name)}</li>`).join('')}</ul>`
)}
${field(
  'Contact',
  `<ul class="bullets">
    <li>Email · ${isNeedData(site.contact.email) ? needTag(site.contact.email) : `<a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a>`}</li>
    <li>GitHub · <a href="${esc(site.contact.github)}">${esc(site.contact.github)}</a></li>
    ${site.contact.linkedin ? `<li>LinkedIn · <a href="${esc(site.contact.linkedin)}">${esc(site.contact.linkedin)}</a></li>` : ''}
  </ul>`
)}`;
  page({ path: 'resume/', title: 'Resume', main });
}

/* --------------------------------------------------------------- 부가 파일 */

mkdirSync(join(OUT, 'assets'), { recursive: true });
copyFileSync(join(ROOT, 'assets', 'style.css'), join(OUT, 'assets', 'style.css'));
if (existsSync(join(ROOT, 'evidence'))) cpSync(join(ROOT, 'evidence'), join(OUT, 'evidence'), { recursive: true });
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
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>404 · ${esc(site.name)}</title><link rel="stylesheet" href="${url('assets/style.css')}"></head><body><main><header class="page-head"><h1>404</h1><p>이 주소에는 페이지가 없습니다. <a href="${url('')}">처음으로 돌아가기</a></p></header></main></body></html>`
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
scan({ site, experience, projects, cases, labs, tools, about }, 'content');

console.log(`✓ ${pages.length} pages → dist/`);
if (needData.length) {
  console.log(`\n⚠ NEED_DATA ${needData.length}건 — 아래 항목은 실제 값으로 채워야 합니다.`);
  needData.forEach((n) => console.log(`  · ${n}`));
}
