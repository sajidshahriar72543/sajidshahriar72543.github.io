(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var sidebar = document.getElementById('sidebar');
  var toggleBtn = document.getElementById('collapse-btn');
  var nav = document.getElementById('side-nav');
  var progress = document.getElementById('progress');

  /* ===========================================================
     1. Local clock and calendar

     Everything here is derived from the visitor's own Date
     object, which already carries their system time and zone.
     No network calls, no stored offset.
     =========================================================== */
  var clockEl = document.getElementById('clock');
  var dateEl = document.getElementById('clock-date');
  var zoneEl = document.getElementById('clock-zone');
  var calEl = document.getElementById('cal');
  var monthEl = document.getElementById('cal-month');

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* Two-letter weekday initials, indexed by Date#getDay (0 = Sunday) */
  var DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  var renderedKey = null;

  function renderCalendar(now) {
    var year = now.getFullYear();
    var month = now.getMonth();
    var today = now.getDate();

    /* Month heading, in the visitor's own locale */
    monthEl.textContent = now.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    });

    var firstDow = new Date(year, month, 1).getDay();
    var dayCount = new Date(year, month + 1, 0).getDate();

    var html = '';

    for (var w = 0; w < 7; w++) {
      html += '<span class="cal__dow">' + DOW[w] + '</span>';
    }

    /* Blank cells so the 1st lands under the right weekday */
    for (var b = 0; b < firstDow; b++) {
      html += '<span class="cal__day is-empty"></span>';
    }

    for (var d = 1; d <= dayCount; d++) {
      var dow = (firstDow + d - 1) % 7;
      var cls = 'cal__day';

      if (d === today) {
        cls += ' is-today';
      } else if (dow === 0 || dow === 6) {
        cls += ' is-weekend';
      }

      html += '<span class="' + cls + '">' + d + '</span>';
    }

    calEl.innerHTML = html;
  }

  function renderZone(now) {
    var tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {
      tz = '';
    }

    /* "Asia/Dhaka" → "Dhaka" */
    var city = tz ? tz.split('/').pop().replace(/_/g, ' ') : '';

    var offsetMin = -now.getTimezoneOffset();
    var sign = offsetMin < 0 ? '−' : '+';
    var abs = Math.abs(offsetMin);
    var hh = Math.floor(abs / 60);
    var mm = abs % 60;

    var offset = 'GMT' + sign + hh + (mm ? ':' + pad2(mm) : '');

    zoneEl.textContent = city ? city + ' · ' + offset : offset;
  }

  function tick() {
    if (!clockEl) return;

    var now = new Date();

    clockEl.textContent =
      pad2(now.getHours()) + ':' +
      pad2(now.getMinutes()) + ':' +
      pad2(now.getSeconds());

    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    /* Rebuild the grid only when the day actually changes */
    var key = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate();

    if (key !== renderedKey) {
      renderedKey = key;
      renderCalendar(now);
      renderZone(now);
    }
  }

  if (clockEl && calEl) {
    tick();
    setInterval(tick, 1000);
  }

  /* ===========================================================
     2. Reveal on scroll
     =========================================================== */
  var REVEAL_SELECTOR = [
    '.section__head',
    '.interests li',
    '.entry',
    '.pub',
    '.card',
    '.row',
    '.scores li',
    '.contact__links .btn'
  ].join(', ');

  var revealEls = Array.prototype.slice.call(
    document.querySelectorAll(REVEAL_SELECTOR)
  );

  if (!reduceMotion && revealEls.length && 'IntersectionObserver' in window) {

    /* Cascade elements that share a parent, capped so the last
       card in a grid never waits too long. */
    var seen = new Map();

    revealEls.forEach(function (el) {
      var parent = el.parentElement;
      var n = seen.get(parent) || 0;
      seen.set(parent, n + 1);
      el.style.setProperty('--d', Math.min(n, 6) * 55 + 'ms');
      el.classList.add('reveal');
    });

    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -6% 0px',
      threshold: 0.06
    });

    revealEls.forEach(function (el) { revealObserver.observe(el); });

  } else {
    /* Nothing to animate — make sure everything is simply visible */
    revealEls.forEach(function (el) { el.classList.add('reveal', 'is-in'); });
  }

  /* ===========================================================
     3. Scroll progress bar
     =========================================================== */
  function updateProgress() {
    if (!progress || reduceMotion) return;

    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? window.scrollY / max : 0;

    progress.style.transform =
      'scaleX(' + Math.min(1, Math.max(0, ratio)) + ')';
  }

  /* ===========================================================
     4. Collapsible sidebar
     =========================================================== */
  var COLLAPSE_KEY = 'mss-sidebar-collapsed';

  function applyCollapsed(isCollapsed) {
    if (!sidebar || !toggleBtn) return;

    sidebar.classList.toggle('is-collapsed', isCollapsed);

    var label = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
    toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.setAttribute('title', label);
  }

  if (sidebar && toggleBtn) {
    var saved = null;
    try { saved = localStorage.getItem(COLLAPSE_KEY); } catch (e) { /* private mode */ }

    applyCollapsed(saved === '1');

    toggleBtn.addEventListener('click', function () {
      var next = !sidebar.classList.contains('is-collapsed');
      applyCollapsed(next);
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch (e) { /* ignore */ }
    });
  }

  /* ===========================================================
     5. Scroll-spy
     =========================================================== */
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));

  var items = links.map(function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = id ? document.getElementById(id) : null;
    return section ? { link: link, section: section } : null;
  }).filter(Boolean);

  if (!items.length) return;

  var HERO_GUARD = 60;
  var BOTTOM_SNAP = 10;
  var SETTLE_MS = 700;

  var LAST = items.length - 1;

  var active = null;
  var pinned = false;
  var releaseTimer = null;

  function getOffset() {
    if (!sidebar || window.innerWidth > 900) return 24;
    return sidebar.getBoundingClientRect().height + 14;
  }

  function setActive(item) {
    if (item === active) return;
    active = item;

    for (var i = 0; i < items.length; i++) {
      var on = items[i] === item;
      items[i].link.classList.toggle('is-active', on);
      if (on) {
        items[i].link.setAttribute('aria-current', 'true');
      } else {
        items[i].link.removeAttribute('aria-current');
      }
    }
  }

  function updateSpy() {
    if (pinned) return;

    var y = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var docH = document.documentElement.scrollHeight;
    var maxY = docH - vh;

    if (y < HERO_GUARD) {
      setActive(null);
      return;
    }

    if (maxY > BOTTOM_SNAP && maxY - y <= BOTTOM_SNAP) {
      setActive(items[LAST]);
      return;
    }

    var bandTop = y + getOffset();
    var bandBottom = y + vh;

    var best = null;
    var bestArea = 0;

    for (var i = 0; i < items.length; i++) {
      var rect = items[i].section.getBoundingClientRect();
      var top = rect.top + y;
      var bottom = (i === LAST) ? docH : rect.bottom + y;

      var visTop = top > bandTop ? top : bandTop;
      var visBottom = bottom < bandBottom ? bottom : bandBottom;
      var area = visBottom - visTop;

      if (area > bestArea) {
        bestArea = area;
        best = items[i];
      }
    }

    setActive(best);
  }

  function unpin() {
    if (!pinned) return;
    pinned = false;
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
  }

  items.forEach(function (item) {
    item.link.addEventListener('click', function () {
      pinned = true;
      setActive(item);
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = null;
    });
  });

  ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'].forEach(function (type) {
    window.addEventListener(type, unpin, { passive: true });
  });

  /* ===========================================================
     Scroll handler — one rAF pass drives both the bar and the spy
     =========================================================== */
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(function () {
      ticking = false;

      updateProgress();

      if (pinned) {
        if (releaseTimer) clearTimeout(releaseTimer);
        releaseTimer = setTimeout(function () {
          pinned = false;
          releaseTimer = null;
        }, SETTLE_MS);
        return;
      }

      updateSpy();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('resize', function () {
    unpin();
    updateProgress();
    updateSpy();
  });

  /* Sidebar width changes move the content — re-measure once the
     transition has finished so the spy stays honest. */
  if (sidebar) {
    sidebar.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'width' || e.propertyName === 'flex-basis') {
        unpin();
        updateSpy();
      }
    });
  }

  window.addEventListener('load', function () {
    updateProgress();
    updateSpy();
  });

  updateProgress();
  updateSpy();
})();
