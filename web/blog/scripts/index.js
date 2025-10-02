(function(){
  const POSTS_INDEX_URL = 'blog/posts/index.json';
  const listEl = document.querySelector('.posts');
  const searchInput = document.getElementById('blog-search');
  const tagsBar = document.getElementById('tags-bar');

  let allPosts = [];
  let activeTag = '';
  let query = '';

  function htmlEscape(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  function renderPosts(posts){
    if (!listEl) return;
    listEl.innerHTML = posts.map(p => `
      <article class="post-card" role="listitem">
        <h2 class="post-title"><a href="${htmlEscape(p.path)}">${htmlEscape(p.title)}</a></h2>
        <div class="meta">
          ${p.date ? `<span><i class=\"fa-regular fa-calendar\"></i> ${htmlEscape(p.date)}</span>` : ''}
          ${p.text ? `<span><i class=\"fa-regular fa-clock\"></i> ${estimateRead(p.text)} min read</span>` : ''}
        </div>
        <p class="excerpt">${htmlEscape(p.excerpt || '')}</p>
        ${Array.isArray(p.tags) && p.tags.length ? `<div class="chips">${p.tags.map(t => `<button class=\"chip tag-chip\" data-tag=\"${htmlEscape(t)}\">${htmlEscape(t)}</button>`).join('')}</div>` : ''}
      </article>
    `).join('');

    // Hook tag chips
    listEl.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        setActiveTag(tag === activeTag ? '' : tag);
      });
    });
  }

  function estimateRead(text){
    const words = (text||'').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 225));
  }

  function renderTags(posts){
    if (!tagsBar) return;
    const counts = new Map();
    posts.forEach(p => (p.tags||[]).forEach(t => counts.set(t, (counts.get(t)||0)+1)) );
    const tags = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1]).map(([t,c])=>({t,c}));

    const chips = [`<button class="chip ${activeTag?'':'active'}" data-tag="">All</button>`]
      .concat(tags.map(({t,c}) => `<button class="chip ${t===activeTag?'active':''}" data-tag="${htmlEscape(t)}">${htmlEscape(t)} (${c})</button>`));

    tagsBar.innerHTML = chips.join(' ');
    tagsBar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        setActiveTag(btn.getAttribute('data-tag') || '');
      });
    });
  }

  function setActiveTag(tag){
    activeTag = tag;
    applyFilters();
  }

  function setQuery(q){
    query = q.toLowerCase();
    applyFilters();
  }

  function applyFilters(){
    let posts = allPosts.slice();
    if (activeTag) posts = posts.filter(p => (p.tags||[]).includes(activeTag));
    if (query) posts = posts.filter(p => (p.title||'').toLowerCase().includes(query) || (p.text||'').toLowerCase().includes(query));
    renderTags(allPosts);
    renderPosts(posts);
  }

  async function init(){
    try {
      const res = await fetch(POSTS_INDEX_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('failed to load index.json');
      allPosts = await res.json();
      // Respect preselected tag from URL
      const params = new URLSearchParams(location.search);
      const t = params.get('tag') || '';
      if (t) activeTag = t;
      const q = params.get('q') || '';
      if (q && searchInput) { searchInput.value = q; query = q.toLowerCase(); }
      renderTags(allPosts);
      applyFilters();
    } catch (e){
      console.error('Blog index load failed:', e);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => setQuery(e.target.value));
  }

  init();
})();
