(function() {
    var el = document.getElementById('loader-tip');
    if (!el) return;
    var text = el.querySelector('.loader-tip-text');
    if (!text) return;
    fetch('./modules/labels/loading-tips.json')
      .then(function(r) { return r.json(); })
      .then(function(tips) {
        if (!tips || !tips.length) return;
        var i = Math.floor(Math.random() * tips.length);
        text.textContent = tips[i];
        el.classList.add('visible');
        setInterval(function() {
          el.classList.remove('visible');
          setTimeout(function() {
            i = (i + 1) % tips.length;
            text.textContent = tips[i];
            el.classList.add('visible');
          }, 400);
        }, 4000);
      })
      .catch(function() {});
  })();
