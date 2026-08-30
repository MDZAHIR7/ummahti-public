/* ==========================================================================
   Ummahti Quran — ummahtiofficial.com

   The reader's chosen theme, put on the document before the first paint.

   This is a separate file rather than three lines inline because the site's
   CSP allows 'self' scripts and no inline ones, and it is not deferred
   because a deferred restore is a flash of the wrong theme. It is the only
   render-blocking script on the page; keep it this small.

   The name is validated against the shipped list rather than trusted, so a
   hand-edited localStorage value cannot put an arbitrary attribute on <html>.
   ========================================================================== */

(function () {
  'use strict';

  var THEMES = [
    'obsidian', 'warm-cream', 'crisp-light', 'madinah', 'ottoman',
    'andalusian', 'persian', 'sheikh-zayed', 'haramain'
  ];

  try {
    var name = window.localStorage.getItem('ummahti:theme');
    if (THEMES.indexOf(name) > -1) {
      document.documentElement.setAttribute('data-theme', name);
    }
  } catch (e) {
    /* Private mode, or storage denied. The page keeps its default theme. */
  }
})();
