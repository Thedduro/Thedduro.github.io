(() => {
  document.querySelectorAll('.about-project-toggle').forEach((button) => {
    const card = button.closest('.about-project-shell');
    const front = card.querySelector('.about-project-front');
    const back = card.querySelector('.about-project-back');

    button.addEventListener('click', () => {
      const flipped = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(flipped));
      card.classList.toggle('is-flipped', flipped);
      front.setAttribute('aria-hidden', String(flipped));
      back.setAttribute('aria-hidden', String(!flipped));
    });
  });
})();
