(function () {
  var STORAGE_KEY = 'lang';
  var DEFAULT_LANG = 'es';
  var currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

  function applyLang(lang) {
    if (!window.translations) return;
    var t = window.translations[lang];
    if (!t) return;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (t[key] === undefined) return;
      if (el.hasAttribute('placeholder')) {
        el.placeholder = t[key];
      } else {
        el.textContent = t[key];
      }
    });

    // Actualizar estado visual del switch
    document.querySelectorAll('.lang-switch').forEach(function (sw) {
      sw.classList.toggle('en', lang === 'en');
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

  function init() {
    applyLang(currentLang);
    document.querySelectorAll('.lang-switch').forEach(function (sw) {
      sw.addEventListener('click', function () {
        setLang(currentLang === 'es' ? 'en' : 'es');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
