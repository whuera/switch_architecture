(function () {
  const STORAGE_KEY = 'lang';
  const DEFAULT_LANG = 'es';
  let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

  function applyLang(lang) {
    const t = translations[lang];
    if (!t) return;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.dataset.i18n;
      if (t[key] === undefined) return;
      if (el.hasAttribute('placeholder')) {
        el.placeholder = t[key];
      } else {
        el.textContent = t[key];
      }
    });

    // Update toggle button label
    document.querySelectorAll('.lang-toggle-btn').forEach(function (btn) {
      btn.textContent = lang === 'es' ? 'EN' : 'ES';
      btn.setAttribute('aria-label', lang === 'es' ? 'Switch to English' : 'Cambiar a Español');
    });

    document.documentElement.lang = lang;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function setLang(lang) {
    applyLang(lang);
  }

  window.i18n = {
    setLang: setLang,
    getCurrentLang: function () { return currentLang; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyLang(currentLang); });
  } else {
    applyLang(currentLang);
  }
})();
