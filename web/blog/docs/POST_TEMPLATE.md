---
# Required metadata
# Use this frontmatter block at the top of every post
# File name should be: YYYY-MM-DD-your-title.md
# Example: 2025-10-02-welcome-to-minicycle-blog.md

title: Your Post Title
date: Oct 2, 2025
excerpt: 1–2 sentence summary that will show on the blog index.
tags: [Workflow, Productivity]
# Place images in web/blog/assets and reference as ../assets/filename.ext
cover: assets/example-cover.jpg  # optional; displayed above the article title
# readMins: 4                   # optional; if omitted, auto-estimated
---

# Introduction

Write your content in plain Markdown. Standard links and images “just work.”

- Keep paragraphs short
- Use headings to break up content
- Prefer concrete examples

## Links

Inline: [miniCycle](https://minicycle.app)

Relative to your site (recommended):

- Product page: [/product.html](../product.html)
- App: [/miniCycle.html](../miniCycle.html)

Tip: Use root-relative paths (/product.html) in production, or ../product.html for local file viewing.

## Images

Place blog images in: web/blog/assets/

Reference them from Markdown posts as ../assets/<file> so they resolve from posts/*.html.

Markdown image:

![An illustrative workflow](../assets/workflow.png "Optional title")

Figure with caption:

<figure>
  <img src="../assets/workflow.png" alt="Workflow example" />
  <figcaption>Weekly cycle visual.</figcaption>
</figure>

## SoundCloud audio

Embed the SoundCloud player using the shortcode on its own line:

{{soundcloud: https://soundcloud.com/USER/TRACK}}

- The build will convert it into an embedded SoundCloud player.
- Works anywhere in your Markdown.

## Code blocks

```js
function cycle() {
  return 'repeat';
}
```

## Lists and quotes

- Bullet 1
- Bullet 2

> Systems beat willpower.

## Frontmatter reference

- title: string (required)
- date: string (recommended)
- excerpt: string (recommended)
- tags: array of strings (optional)
- cover: string path relative to web/blog/ (e.g., assets/cover.jpg) (optional)
- readMins: number (optional; auto-calculated if omitted)

## Tags

- Add tags as an array in frontmatter, e.g.:

  tags: [Workflow Design, Productivity]

- Recommendations:
  - Use 1–3 tags per post to keep filtering useful
  - Be consistent with spelling and capitalization (filters match tag text)
  - Prefer succinct names: "Routines", "Systems", "Focus"
  - Spaces are fine in tag names (e.g., "Workflow Design")

How they’re used:
- The blog index builds clickable tag chips from your post tags
- Clicking a tag filters the list; "All" clears the filter
- Tag chips show counts based on how many posts use the tag

## File naming

- Use: YYYY-MM-DD-your-title.md
- Hyphenated, lowercase recommended (used for slug generation)

## Build your post

From the blog folder:

```bash
cd web/blog
npm install   # first time only
npm run build
```

This generates an HTML file next to your Markdown in web/blog/posts/*.html.

Finally, add or update a card link in web/blog.html to point at blog/posts/your-slug.html.

### Troubleshooting installs (macOS)

If you see an npm EACCES (permission) error during install, your npm cache may have root-owned files. Fix it by reclaiming your cache, then install from the blog folder:

```bash
sudo chown -R "$(id -u)":"$(id -g)" ~/.npm/
cd web/blog
npm install
```

Tips:
- Run installs inside web/blog (where package.json lives), not in the site root
- Requires Node 18+ (for ES modules)
- If problems persist: `npm cache verify` or `rm -rf ~/.npm` to reset the cache (npm recreates it)
