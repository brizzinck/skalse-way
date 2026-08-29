(function(){
  var THEME_KEY = 'pdr_theme';
  var btn = document.getElementById('theme-toggle');
  if(!btn) return;
  function currentTheme(){
    var stored = null;
    try{ stored = localStorage.getItem(THEME_KEY); }catch(e){}
    if(stored === 'light' || stored === 'dark') return stored;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function applyIcon(theme){
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Світла тема' : 'Темна тема');
  }
  applyIcon(currentTheme());
  btn.addEventListener('click', function(){
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
    applyIcon(next);
  });
})();
