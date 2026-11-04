// Step 0 (Nov 2026): the app lives at /app, and at /app/ every relative URL in
  // this page resolves under /app/ and 404s. Netlify matches /app and /app/ as one
  // path, so a redirect rule would loop; fix the slash here, before anything
  // loads. Native builds never have this path. ES5 (Contract 1).
  if (/\/app\/$/.test(location.pathname)) {
    location.replace(location.pathname.slice(0, -1) + location.search + location.hash);
  }
