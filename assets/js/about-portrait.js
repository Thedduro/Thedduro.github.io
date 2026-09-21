(() => {
  const button = document.querySelector('.about-portrait-toggle');
  if (!button) return;

  const front = button.querySelector('.about-portrait-front');
  const back = button.querySelector('.about-portrait-back');

  button.addEventListener('click', () => {
    const flipped = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(flipped));
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
  });
})();
