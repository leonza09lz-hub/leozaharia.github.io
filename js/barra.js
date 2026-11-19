// barra.js – il menu della barra in alto su telefono e tablet
// Il tasto con le due righe apre e chiude la lista dei link (classe "aperta" sulla barra).

const barra = document.querySelector('.barra');
const tastoMenu = barra.querySelector('.barra-menu');

function apriMenu(aperto) {
    barra.classList.toggle('aperta', aperto);
    tastoMenu.setAttribute('aria-expanded', aperto);
    tastoMenu.setAttribute('aria-label', aperto ? 'Chiudi il menu' : 'Apri il menu');
}

tastoMenu.addEventListener('click', function() {
    apriMenu(!barra.classList.contains('aperta'));
});

// scelto un link, il menu si chiude
barra.querySelectorAll('.barra-link a').forEach(function(link) {
    link.addEventListener('click', function() { apriMenu(false); });
});

// si chiude anche con Esc, toccando fuori dalla barra o allargando la finestra
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') apriMenu(false);
});
document.addEventListener('click', function(e) {
    if (!barra.contains(e.target)) apriMenu(false);
});
matchMedia('(min-width: 901px)').addEventListener('change', function(e) {
    if (e.matches) apriMenu(false);
});
