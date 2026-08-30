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

  /* The opening plays once per visit, not once per page. sessionStorage is
     the right shelf for that: it is emptied when the tab closes, so the next
     visit gets it again and this visit does not get it twice. It is set
     before the first paint or the class would arrive after the frame it is
     meant to animate. */
  try {
    if (!window.sessionStorage.getItem('ummahti:seen')) {
      window.sessionStorage.setItem('ummahti:seen', '1');
      document.documentElement.classList.add('is-first');
    }
  } catch (e) {
    /* No storage: every page gets the opening, which is wrong but not broken.
       Better that than a page that will not render. */
    document.documentElement.classList.add('is-first');
  }
})();
