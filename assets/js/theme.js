(() => {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  if (!button) return;

  const updateButton = () => {
    const dark = root.dataset.theme === 'dark';
    button.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
    if (themeMeta) themeMeta.content = dark ? '#111315' : '#f7f8fa';
  };

  button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', root.dataset.theme);
    updateButton();
  });

  updateButton();
})();
