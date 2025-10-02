import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import slugify from 'slugify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BLOG_DIR = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(BLOG_DIR, 'posts');
const STYLES_PATH = path.relative(POSTS_DIR, path.join(BLOG_DIR, 'styles', 'blog.css'));
const PREFS_PATH = path.relative(POSTS_DIR, path.join(BLOG_DIR, 'scripts', 'prefs.js'));

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return `<pre><code class="hljs ${lang}">` + hljs.highlight(str, { language: lang }).value + '</code></pre>'; }
      catch (__) {}
    }
    return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

function estimateReadMins(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

function renderSoundCloud(url) {
  const encoded = encodeURIComponent(url.trim());
  const player = `https://w.soundcloud.com/player/?url=${encoded}&color=%2300a2ff&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=false`;
  return `<div class="embed soundcloud"><iframe scrolling="no" allow="autoplay" src="${player}"></iframe></div>`;
}

function preprocessMarkdown(raw) {
  return raw.replace(/\{\{\s*soundcloud:\s*(https?:\/\/[^\s}]+)\s*\}\}/gi, (_, url) => renderSoundCloud(url));
}

function pageTemplate({ html, meta }) {
  const title = meta.title || 'Post';
  const desc = meta.excerpt || 'A miniCycle blog post';
  const date = meta.date || '';
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const cover = meta.cover || '';
  const readMins = meta.readMins || estimateReadMins(html);

  const tagsHtml = tags.length
    ? `<div class="tags">${tags.map(t => `<a class="chip" href="../../blog.html?tag=${encodeURIComponent(t)}">${t}</a>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — miniCycle Blog</title>
  <meta name="description" content="${desc}" />
  <link rel="icon" type="image/png" href="../../assets/images/logo/logo.png" />
  <link rel="apple-touch-icon" href="../../assets/images/logo/logo.png" />
  <meta name="theme-color" content="#0b1220" />
  <link rel="stylesheet" href="${STYLES_PATH}" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
</head>
<body>
  <header class="site-header" role="banner">
    <nav class="nav" aria-label="Primary">
      <a class="brand" href="../../blog.html" title="miniCycle Home">
        <img src="../../assets/images/logo/app_name_miniCycle_top_half.png" alt="miniCycle" />
        <span>Blog</span>
      </a>
      <div class="nav-links">
        <a href="../../product.html">Home</a>
        <a href="../../miniCycle.html" class="cta">Open App</a>
      </div>
      <div class="pref-controls" role="group" aria-label="Preferences">
        <button id="themeToggle" class="control-btn" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
          <i id="themeIcon" class="fa-regular fa-moon"></i>
        </button>
        <div class="text-resize" role="group" aria-label="Text size">
          <button id="fontDec" class="control-btn" aria-label="Decrease text size" title="Decrease text size">A-</button>
          <span id="fontSizeLabel" class="size-indicator" aria-live="polite">100%</span>
          <button id="fontInc" class="control-btn" aria-label="Increase text size" title="Increase text size">A+</button>
        </div>
      </div>
    </nav>
  </header>

  <main class="post">
    <header class="post-header">
      <div class="post-meta">
        <span><i class="fa-regular fa-calendar"></i> ${date}</span>
        <span><i class="fa-regular fa-clock"></i> ${readMins} min read</span>
      </div>
  <h1 class="post-title">${title}</h1>
  ${tagsHtml}
      ${cover ? `<div class=\"cover\"><img src=\"../${cover}\" alt=\"${title}\" /></div>` : ''}
    </header>

    <article class="post-content">
      ${html}
    </article>
  </main>

  <footer>
    <div class="footer-inner">
      <div>© 2025 <a href="https://sparkincreations.com" target="_blank" rel="noopener noreferrer">sparkinCreations</a> • miniCycle</div>
      <div style="margin-top:8px;">
        <a href="../privacy.html">Privacy</a> •
        <a href="../terms.html">Terms</a>
      </div>
    </div>
  </footer>

  <script src="${PREFS_PATH}" defer></script>
</body>
</html>`;
}

async function build() {
  await fs.mkdir(POSTS_DIR, { recursive: true });
  const files = (await fs.readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No markdown posts found in', POSTS_DIR);
    return;
  }

  const indexEntries = [];

  for (const file of files) {
    const full = path.join(POSTS_DIR, file);
    const raw = await fs.readFile(full, 'utf8');
    const { data: fm, content } = matter(raw);

    const pre = preprocessMarkdown(content);
    const html = md.render(pre);

    const base = file.replace(/\.md$/i, '');
    const slug = slugify(base, { lower: true, strict: false });
    const outPath = path.join(POSTS_DIR, `${slug}.html`);

    const page = pageTemplate({
      html,
      meta: {
        title: fm.title || base,
        excerpt: fm.excerpt || '',
        date: fm.date || '',
        tags: fm.tags || [],
        cover: fm.cover || '',
        readMins: fm.readMins || undefined
      }
    });

    await fs.writeFile(outPath, page, 'utf8');
    console.log('Built', path.relative(BLOG_DIR, outPath));

    // Build index entry
    const dateStr = fm.date || '';
    const dateVal = Date.parse(dateStr) || 0;
    const excerpt = fm.excerpt || (content.trim().split(/\n+/)[0] || '').slice(0, 240);
    const tags = Array.isArray(fm.tags) ? fm.tags : [];
    const coverPath = fm.cover ? `blog/${fm.cover.replace(/^\/?/, '')}` : '';

    // lightweight plain text for search (strip markdown-ish chars)
    const plain = content
      .replace(/```[\s\S]*?```/g, ' ') // remove code blocks
      .replace(/`[^`]*`/g, ' ') // inline code
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // links
      .replace(/[#!>*_\-]+/g, ' ') // markdown syntax chars
      .replace(/\s+/g, ' ') // collapse spaces
      .trim();

    indexEntries.push({
      title: fm.title || base,
      path: `blog/posts/${slug}.html`,
      date: dateStr,
      dateValue: dateVal,
      excerpt,
      tags,
      cover: coverPath,
      text: plain.slice(0, 2000)
    });
  }

  // Sort newest first and write index.json
  indexEntries.sort((a, b) => (b.dateValue - a.dateValue));
  const indexPath = path.join(POSTS_DIR, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify(indexEntries, null, 2), 'utf8');
  console.log('Wrote posts/index.json with', indexEntries.length, 'entries');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
