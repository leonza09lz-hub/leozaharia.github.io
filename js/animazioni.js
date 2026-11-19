// animazioni.js – i movimenti della pagina, fatti con GSAP (gsap.com)
//   gsap.to / gsap.from  → anima qualcosa da/verso dei valori
//   ScrollTrigger        → fa partire (o guida) un'animazione mentre scorri
//   SplitText            → divide un titolo in lettere o righe da animare una per una
// La scena 3D sta in configuratore.js: qui le diamo solo dei comandi (window.occhiale).

gsap.registerPlugin(ScrollTrigger, SplitText);

// le animazioni infinite lavorano solo quando la loro sezione è sullo schermo:
// fuori dallo schermo si mettono in pausa, così la pagina resta leggera
function soloQuandoSiVede(sezione, animazioni) {
    ScrollTrigger.create({
        trigger: sezione,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: function(self) {
            animazioni.forEach(function(a) { self.isActive ? a.play() : a.pause(); });
        }
    });
}

// chi ha chiesto al computer "meno movimento" vede la pagina ferma
const movimento = gsap.matchMedia();
const CON_MOVIMENTO = '(prefers-reduced-motion: no-preference)';


// 1. LA PRIMA SCHERMATA
//    Le lettere del titolo salgono una alla volta, gli occhiali si disegnano da soli.
document.fonts.ready.then(function() {
    movimento.add(CON_MOVIMENTO, function() {
        const lettere = SplitText.create('.hero-titolo .dividi', { type: 'chars' });
        const entrata = gsap.timeline({ defaults: { ease: 'expo.out' } });

        entrata
            .from(lettere.chars, { yPercent: 90, rotation: 8, autoAlpha: 0, duration: 1.2, stagger: 0.035 })
            .from('.hero-titolo .rivela', { clipPath: 'inset(0 100% 0 0)', duration: 1.4 }, 0.5)
            // le linee degli occhiali: stroke-dash le "disegna" dall'inizio alla fine
            .from('.hero-occhiali .traccia', {
                strokeDasharray: function(i, el) { return el.getTotalLength(); },
                strokeDashoffset: function(i, el) { return el.getTotalLength(); },
                duration: 1.4, stagger: 0.12, ease: 'power2.inOut'
            }, 0.3)
            .from('.hero-occhiali .lente', { scale: 0, transformOrigin: 'center', duration: 0.9, stagger: 0.1, ease: 'back.out(2)' }, 1.1)
            .from('.hero-occhiali .pupilla', { scale: 0, transformOrigin: 'center', duration: 0.6, stagger: 0.1, ease: 'back.out(3)' }, 1.4)
            .from('.fluttua', { scale: 0, rotation: -90, duration: 1.2, stagger: 0.1, ease: 'back.out(1.6)' }, 0.6)
            .from('.hero-basso > *, .hero-scorri', { y: 30, autoAlpha: 0, duration: 1, stagger: 0.1 }, 1);

        return function() { lettere.revert(); };
    });
});

// le pupille seguono il mouse (quickTo: un'animazione pronta da richiamare a ogni movimento)
const pupille = gsap.utils.toArray('.hero-occhiali .pupilla').map(function(p) {
    return { x: gsap.quickTo(p, 'x', { duration: 0.5, ease: 'power3' }),
             y: gsap.quickTo(p, 'y', { duration: 0.5, ease: 'power3' }) };
});
window.addEventListener('pointermove', function(e) {
    const dx = (e.clientX / window.innerWidth - 0.5) * 2;  // da -1 a 1
    const dy = (e.clientY / window.innerHeight - 0.5) * 2;
    pupille.forEach(function(p) { p.x(dx * 12); p.y(dy * 10); });
});

movimento.add(CON_MOVIMENTO, function() {
    // le forme galleggiano su e giù, ognuna col suo ritmo (solo finché la prima schermata si vede)
    const galleggia = gsap.utils.toArray('.fluttua').map(function(forma, i) {
        return gsap.to(forma, {
            y: gsap.utils.random(-30, 30), x: gsap.utils.random(-20, 20),
            rotation: gsap.utils.random(-25, 25),
            duration: gsap.utils.random(3, 5), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.3
        });
    });
    soloQuandoSiVede('.hero', galleggia);

    // scorrendo, il titolo si allontana e le forme volano via a velocità diverse (parallasse)
    gsap.to('.hero-titolo', {
        yPercent: -18, opacity: 0.2, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.utils.toArray('.fluttua').forEach(function(forma, i) {
        gsap.to(forma, {
            yPercent: -150 - i * 80, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        });
    });
});


// 2. IL NASTRO DI PAROLE
//    Il contenuto viene copiato una volta: quando la prima metà è uscita, si riparte da capo
//    senza che si veda il salto. Si muove solo quando il nastro è sullo schermo.
const nastri = gsap.utils.toArray('.nastro-riga').map(function(riga) {
    const dentro = riga.querySelector('.nastro-dentro');
    riga.appendChild(dentro.cloneNode(true));
    const pezzi = riga.querySelectorAll('.nastro-dentro');
    const inverso = riga.classList.contains('nastro-inverso');
    return gsap.fromTo(pezzi, { xPercent: inverso ? -100 : 0 }, {
        xPercent: inverso ? 0 : -100, duration: 28, ease: 'none', repeat: -1,
        paused: true // parte quando il nastro arriva sullo schermo
    });
});
movimento.add(CON_MOVIMENTO, function() {
    soloQuandoSiVede('.nastro', nastri);
});
movimento.add('(prefers-reduced-motion: reduce)', function() {
    nastri.forEach(function(n) { n.pause(); });
});


// 3. I TITOLI DELLE SEZIONI: ogni riga sale da sotto quando entra nello schermo
document.fonts.ready.then(function() {
    movimento.add(CON_MOVIMENTO, function() {
        gsap.utils.toArray('.rivela-righe').forEach(function(titolo) {
            const righe = SplitText.create(titolo, { type: 'lines' });
            gsap.from(righe.lines, {
                yPercent: 70, autoAlpha: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out',
                scrollTrigger: { trigger: titolo, start: 'top 85%' }
            });
        });
        gsap.utils.toArray('.etichetta, .sezione-testa > p').forEach(function(el) {
            gsap.from(el, { y: 24, autoAlpha: 0, duration: 0.9, ease: 'power3.out',
                scrollTrigger: { trigger: el, start: 'top 90%' } });
        });
    });
});


// 4. IL CONFIGURATORE A CAPITOLI
//    Il visore resta fermo (position: sticky). Quando un capitolo arriva a metà schermo:
//    - l'occhiale gira nella vista del capitolo (data-vista)
//    - il visore cambia colore (data-tinta)
//    - nel capitolo "Smonta" (data-esplodi) le parti si separano
const capitoli = gsap.utils.toArray('.capitolo');
const visore = document.getElementById('visore');
const numero = document.querySelector('.palco-numero');
const nomeCapitolo = document.querySelector('.palco-capitolo');
let ultimoComando = null; // se la scena 3D non è ancora pronta, lo ripetiamo appena lo è

function comandaOcchiale(capitolo) {
    ultimoComando = capitolo;
    if (!window.occhiale) return;
    window.occhiale.vista(capitolo.dataset.vista, { giro: false, durata: 1400 });
    window.occhiale.esplodi(capitolo.hasAttribute('data-esplodi'));
}
document.addEventListener('occhiale:pronto', function() {
    if (ultimoComando) comandaOcchiale(ultimoComando);
});

function attivaCapitolo(capitolo) {
    if (capitolo.classList.contains('attivo')) return;
    capitoli.forEach(function(c) { c.classList.toggle('attivo', c === capitolo); });
    gsap.to(visore, { backgroundColor: capitolo.dataset.tinta, duration: 0.8, ease: 'power2.out' });

    // il contatore in alto nel visore: il numero esce verso l'alto e rientra da sotto
    gsap.timeline()
        .to([numero, nomeCapitolo], { yPercent: -100, autoAlpha: 0, duration: 0.2 })
        .call(function() {
            numero.textContent = capitolo.querySelector('.capitolo-num').textContent;
            nomeCapitolo.textContent = capitolo.dataset.titolo;
        })
        .fromTo([numero, nomeCapitolo], { yPercent: 100 }, { yPercent: 0, autoAlpha: 1, duration: 0.3 });

    comandaOcchiale(capitolo);
}

capitoli.forEach(function(capitolo) {
    ScrollTrigger.create({
        trigger: capitolo,
        // su telefono il visore copre la metà alta dello schermo: il capitolo conta quando è più in basso
        start: function() { return window.innerWidth <= 900 ? 'top 75%' : 'top 55%'; },
        end: function() { return window.innerWidth <= 900 ? 'bottom 75%' : 'bottom 55%'; },
        onToggle: function(self) { if (self.isActive) attivaCapitolo(capitolo); }
    });
});

// all'inizio è acceso il primo capitolo (senza comandare l'occhiale: lo fa lo scroll)
if (capitoli.length) {
    capitoli[0].classList.add('attivo');
    ultimoComando = capitoli[0];
}

movimento.add(CON_MOVIMENTO, function() {
    // il contenuto di ogni capitolo entra dal basso, un pezzo alla volta
    capitoli.forEach(function(capitolo) {
        gsap.from(capitolo.children, {
            y: 50, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out',
            scrollTrigger: { trigger: capitolo, start: 'top 80%' }
        });
    });
    // il visore entra un po' più piccolo e si allarga
    gsap.from('.storia-palco', {
        scale: 0.9, autoAlpha: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: '.storia', start: 'top 85%' }
    });
});

// nel blocco dei colori: passando sopra una parte (o toccandola) l'occhiale gira
// per mostrarla (data-vista-parte: montatura → fronte, aste → lato, ponte → alto...)
document.querySelectorAll('.riga-colore').forEach(function(riga) {
    function mostraParte() {
        if (window.occhiale) window.occhiale.vista(riga.dataset.vistaParte, { giro: false, durata: 1000 });
    }
    riga.addEventListener('pointerenter', mostraParte);
    riga.addEventListener('focusin', mostraParte); // anche con la tastiera (Tab)
});

// un piccolo "salto" quando scegli un colore
document.querySelectorAll('.campione, .forma, .misura').forEach(function(bottone) {
    bottone.addEventListener('click', function() {
        gsap.fromTo(bottone, { scale: 0.85 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', clearProps: 'scale' });
    });
});


// 5. L'INVITO ALLA PROVA: il riquadro si allarga mentre arriva, le bolle colorate si muovono
movimento.add(CON_MOVIMENTO, function() {
    gsap.from('.invito', {
        scale: 0.88, borderRadius: 80, ease: 'none',
        scrollTrigger: { trigger: '.invito', start: 'top bottom', end: 'top 30%', scrub: true }
    });
    soloQuandoSiVede('.invito', [
        gsap.to('.invito-bolla-1', { xPercent: 40, yPercent: 30, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }),
        gsap.to('.invito-bolla-2', { xPercent: -40, yPercent: -20, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true })
    ]);

    // il marchio nel piede sale lentamente
    gsap.from('.piede-marchio', {
        yPercent: 40, ease: 'none',
        scrollTrigger: { trigger: '.piede', start: 'top bottom', end: 'bottom bottom', scrub: true }
    });
});

// i link della barra (#configura, #prova-invito...) scorrono morbidi invece di saltare
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
        const id = link.getAttribute('href');
        const meta = id === '#' ? 0 : document.querySelector(id);
        if (meta === null) return;
        e.preventDefault();
        const y = meta === 0 ? 0 : meta.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: y, behavior: matchMedia(CON_MOVIMENTO).matches ? 'smooth' : 'auto' });
    });
});
