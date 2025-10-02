miniCycle Blog Authoring Guide

Overview
- Write posts in Markdown under web/blog/posts
- Include YAML frontmatter at the top for metadata
- Images live in web/blog/assets
- Use a SoundCloud shortcode to embed audio players
- Run the build script to generate HTML pages next to your Markdown

Folder layout
- web/blog/
  - posts/               # your .md files here
  - assets/              # images/covers used by posts
  - styles/blog.css      # shared CSS for index + posts
  - scripts/prefs.js     # theme + text size toggle (shared)
  - scripts/build.mjs    # Markdown → HTML + SoundCloud embed
  - package.json         # local build dependencies

Create a post
1) Copy posts/POST_TEMPLATE.md to posts/YYYY-MM-DD-your-title.md
2) Fill in frontmatter:
---
title: Your Post Title
date: Oct 2, 2025
excerpt: 1–2 sentences that show on the index.
tags: [Workflow, Productivity]
cover: assets/cover.jpg
---

3) Write your article in Markdown.
   - Links: [miniCycle](https://minicycle.app)
   - Relative links (local): [/product.html] or ../product.html
   - Images: place under web/blog/assets and reference as ../assets/img.png
   - Captions (optional):
     <figure>
       <img src="../assets/img.png" alt="desc" />
       <figcaption>Caption text.</figcaption>
     </figure>
   - SoundCloud audio:
     {{soundcloud: https://soundcloud.com/USER/TRACK}}

Build posts
- From web/blog:
  - npm install  # first time only
  - npm run build
- Outputs web/blog/posts/*.html alongside your .md files

Link from index
- Edit web/blog.html and set the card link to blog/posts/your-slug.html

Tips
- Keep titles under ~65 chars for good SEO
- Use a short excerpt (140–200 chars) to help readers scan
- Use descriptive alt text for all images
- Prefer lossless PNG or optimized JPEG/WebP under ~200–400 KB

Troubleshooting
- If images don’t appear, check the path: posts pages are at web/blog/posts/, so images should be referenced as ../assets/<file>
- If SoundCloud doesn’t load, confirm the track URL works in a browser and is public
- If build fails, ensure Node 18+ and that npm install succeeded
