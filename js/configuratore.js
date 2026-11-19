// configuratore.js – la scena 3D del visore e la prova con la telecamera
// Viene caricato come modulo: per questo può usare "import".

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. il contenitore: il div #visore della pagina
const visore = document.getElementById('visore');

// 2. la scena: lo "spazio" in cui mettiamo gli oggetti
const scena = new THREE.Scene();
// niente sfondo: il canvas è trasparente e si vede il colore del visore (lo cambia GSAP)

// 3. la camera: da dove guardiamo la scena
const camera = new THREE.PerspectiveCamera(45, visore.clientWidth / visore.clientHeight, 0.1, 100);
camera.position.set(0, 0, 5); // davanti all'occhiale: la camera non gira mai, gira l'occhiale

// 4. il renderer: disegna la scena dentro un <canvas> (alpha: trasparente)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
// sugli schermi molto fitti (2x, 3x) disegnare ogni pixel pesa troppo: ci fermiamo a 1.5
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(visore.clientWidth, visore.clientHeight);
visore.innerHTML = '';                 // toglie la scritta segnaposto
visore.appendChild(renderer.domElement);

// 5. le luci: senza luce un materiale "standard" resta nero
scena.add(new THREE.AmbientLight('#ffffff', 0.6));
const luce = new THREE.DirectionalLight('#ffffff', 2);
luce.position.set(5, 5, 5);
scena.add(luce);

// 5b. l'ambiente: una "stanza" finta che le superfici lucide riflettono.
const pmrem = new THREE.PMREMGenerator(renderer);
scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// 6. il perno: un gruppo vuoto al centro della scena. Dentro ci mettiamo l'occhiale:
//    ruotando il perno col mouse ruota lui.
const perno = new THREE.Group();
scena.add(perno);

const loader = new GLTFLoader(); // legge i file .glb (modelli 3D)

// 6a. l'occhiale: un modello 3D della cartella "modelli_occhiali_glbxweb".
//     Le parti colorabili sono raggruppate in 4 sezioni, le stesse del data-parte del pannello.
const contenitore = new THREE.Group(); // il contenitore dell'occhiale dentro il perno
perno.add(contenitore);

// le 4 sezioni colorabili, le stesse del data-parte del pannello
const sezioni = ['montatura', 'lenti', 'aste', 'ponte'];

// LeonardZaharia.glb non ha nomi: le parti si riconoscono dal numero (ordine nel file).
// 0 e 1 sono due linee minuscole senza senso: si nascondono.
// Per i file senza mappa le parti si riconoscono da sole (passo 6b).
const mappeFisse = {
    'LeonardZaharia.glb': { montatura: [3], lenti: [5], aste: [6, 7], ponte: [2, 4] }
};

// un materiale per sezione: colorarlo colora tutte le parti della sezione
const materialiSezioni = {
    montatura: new THREE.MeshStandardMaterial({ roughness: 0.3 }),
    aste:      new THREE.MeshStandardMaterial({ roughness: 0.3 }),
    ponte:     new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.8 }), // metallo
    lenti:     new THREE.MeshStandardMaterial({
        roughness: 0.05,
        transparent: true, // lenti colorate ma si vede attraverso
        opacity: 0.6,
        side: THREE.DoubleSide
    })
};

// 6b. riconoscere le parti di un modello qualsiasi.
//     Ogni studente ha chiamato le parti a modo suo (o non le ha chiamate).
//     Per ogni pezzo proviamo, in ordine:
//       1. il nome del pezzo e dei gruppi che lo contengono ("lente", "stanghetta sx"...)
//       2. il nome del materiale
//       3. se è trasparente → lenti
//       4. la forma: lungo e di lato → asta, piccolo al centro → ponte, il resto → montatura
const regole = [
    { sezione: 'nascondi', parole: /quot|tavol|curve|silhouette|nascost|testo/ }, // disegni tecnici, non occhiali
    { sezione: 'lenti',    parole: /lent|lens|glass/ },
    { sezione: 'aste',     parole: /\baste?\b|asta|stang|temple|elastic/ },
    { sezione: 'ponte',    parole: /pont|nas|bridge|gomma|ferrament|ganci|appoggio|cernier|hinge|testa/ },
    { sezione: 'montatura',parole: /montat|struttur|frame|davanti|dietro|frontal/ }
];

function sezioneDalNome(nome) {
    nome = (nome || '').toLowerCase();
    for (const regola of regole) {
        if (regola.parole.test(nome)) return regola.sezione;
    }
    return null;
}

function sezioneDalleParole(pezzo) {
    // prima il pezzo, poi i gruppi che lo contengono, dal più vicino al più lontano
    for (let o = pezzo; o; o = o.parent) {
        const s = sezioneDalNome(o.name);
        if (s) return s;
    }
    const materiale = pezzo.material;
    let s = sezioneDalNome(materiale.name);
    if (!s && /metal/i.test(materiale.name)) s = 'ponte';
    if (!s && (materiale.transparent || materiale.opacity < 0.95 || materiale.transmission > 0)) s = 'lenti';
    return s;
}

// trova i tre assi degli occhiali: larghezza, altezza, profondità (e dov'è il davanti)
function trovaAssi(pezzi, globale) {
    const misure = globale.getSize(new THREE.Vector3()).toArray();
    const centro = globale.getCenter(new THREE.Vector3()).toArray();
    // l'altezza è la misura più piccola (gli occhiali sono "bassi")
    const h = misure.indexOf(Math.min(...misure));
    const altri = [0, 1, 2].filter(function(a) { return a !== h; });

    // un'asta è lunga in profondità, stretta, e sta di lato
    function sembraAsta(p, w, d) {
        const m = p.misure.toArray(), c = p.centro.toArray();
        return m[d] > 0.45 * misure[d] && m[w] < 0.3 * misure[w] &&
               Math.abs(c[w] - centro[w]) > 0.25 * misure[w];
    }
    // larghezza = l'asse che rende "aste" il maggior numero di pezzi
    function punti(w, d) {
        return pezzi.filter(function(p) {
            return p.sezione === 'aste' ? Math.abs(p.centro.getComponent(w) - centro[w]) > 0.2 * misure[w]
                                        : !p.sezione && sembraAsta(p, w, d);
        }).length;
    }
    let w = altri[0], d = altri[1];
    if (punti(altri[1], altri[0]) > punti(altri[0], altri[1])) { w = altri[1]; d = altri[0]; }

    // il davanti è dalla parte opposta alle aste
    let somma = 0, conta = 0;
    pezzi.forEach(function(p) {
        if (p.sezione === 'aste' || (!p.sezione && sembraAsta(p, w, d))) {
            somma += p.centro.getComponent(d) - centro[d];
            conta++;
        }
    });
    const verso = conta && somma > 0 ? -1 : 1;
    return { w: w, h: h, d: d, verso: verso, sembraAsta: sembraAsta };
}

// 6c. caricare un modello nel visore
const avviso = document.createElement('p');
avviso.className = 'visore-avviso';
visore.appendChild(avviso);

let partiModello = [];  // i pezzi da muovere nell'esplosione (passo 7e)
let scalaBase = 1;      // la scala che porta il modello a 2.2 di larghezza
let fattoreMisura = 1;  // la misura scelta nel pannello (M · 51 mm = 1)
let richiesta = 0;      // se clicchi due modelli di fila, vince l'ultimo

function caricaModello(percorso, nome) {
    const questa = ++richiesta;
    avviso.textContent = 'Caricamento…';
    avviso.style.display = 'block';

    loader.load(percorso, function(gltf) {
        if (questa !== richiesta) return; // nel frattempo ne hai scelto un altro
        const pronto = preparaModello(gltf, percorso);
        if (!pronto) { avviso.textContent = 'Modello vuoto'; return; }
        const orientato = pronto.orientato, pezzi = pronto.pezzi, dimensioni = pronto.dimensioni;

        // l'esplosione: per ogni pezzo, dove va e in che direzione (nelle misure del suo gruppo)
        const L = dimensioni.x;
        partiModello = pezzi.map(function(p) {
            const centro = new THREE.Box3().setFromObject(p.oggetto).getCenter(new THREE.Vector3());
            let s = new THREE.Vector3();
            if (p.sezione === 'lenti') s.set(0, 0, 0.6 * L);                              // in avanti
            if (p.sezione === 'ponte') s.set(0, 0.35 * L, 0);                             // in alto
            if (p.sezione === 'aste')  s.set(Math.sign(centro.x || 1) * 0.3 * L, 0, -0.2 * L); // di lato e indietro
            // la direzione va tradotta nelle misure del gruppo che contiene il pezzo
            const inversa = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(p.oggetto.parent.matrixWorld).invert());
            return { oggetto: p.oggetto, base: p.oggetto.position.clone(), spostamento: s.applyMatrix3(inversa) };
        });

        // via il modello vecchio, dentro quello nuovo, tutto torna in posizione
        contenitore.clear();
        scalaBase = 2.2 / Math.max(dimensioni.x, dimensioni.z);
        contenitore.scale.setScalar(scalaBase * fattoreMisura);
        contenitore.add(orientato);
        perno.rotation.set(0, 0, 0);
        esplosione = { valore: 0, partenza: 0, arrivo: 0, inizio: 0 };
        bottoneEsplodi.textContent = 'Esplodi';
        bottoneEsplodi.classList.remove('selected');

        // ogni elemento con data-nome mostra il nome dell'occhiale
        document.querySelectorAll('[data-nome]').forEach(function(el) { el.textContent = nome; });
        avviso.style.display = 'none';
    }, undefined, function() {
        if (questa === richiesta) avviso.textContent = 'Impossibile caricare il modello';
    });
}

// prepara un modello appena letto: riconosce le parti, le colora, lo raddrizza e lo centra.
// Restituisce { orientato, pezzi, dimensioni } (o null se non c'è niente da mostrare).
// Lo usano sia il visore sia la prova con la telecamera.
function preparaModello(gltf, percorso) {
        const modello = gltf.scene;
        modello.updateMatrixWorld(true);

        const file = decodeURIComponent(percorso.split('/').pop());
        const mappa = mappeFisse[file];

        // tutti i pezzi visibili, con la loro scatola (misure e centro)
        const pezzi = [];
        modello.traverse(function(o) {
            if (o.isLine || o.isPoints) { o.visible = false; return; } // linee: non fanno parte degli occhiali
            if (!o.isMesh) return;
            let sezione = null;
            if (mappa) {
                // con la mappa fissa conta il numero della parte principale che contiene il pezzo
                let radice = o;
                while (radice.parent !== modello) radice = radice.parent;
                const numero = modello.children.indexOf(radice);
                sezione = sezioni.find(function(s) { return mappa[s].includes(numero); }) || 'nascondi';
            } else {
                sezione = sezioneDalleParole(o);
            }
            if (sezione === 'nascondi') { o.visible = false; return; }
            const scatola = new THREE.Box3().setFromObject(o);
            if (scatola.isEmpty()) return;
            pezzi.push({
                oggetto: o, sezione: sezione,
                misure: scatola.getSize(new THREE.Vector3()),
                centro: scatola.getCenter(new THREE.Vector3())
            });
        });
        if (!pezzi.length) return null;

        const globale = new THREE.Box3();
        pezzi.forEach(function(p) { globale.expandByPoint(p.centro.clone().addScaledVector(p.misure, 0.5)); globale.expandByPoint(p.centro.clone().addScaledVector(p.misure, -0.5)); });

        // raddrizziamo il modello: larghezza = x, altezza = y, davanti = verso di noi (z)
        const orientato = new THREE.Group();
        orientato.add(modello);
        const assi = trovaAssi(pezzi, globale);
        if (!mappa) {
            const asse = function(i, segno) { return new THREE.Vector3().setComponent(i, segno); };
            const su = asse(assi.h, 1);
            const avanti = asse(assi.d, assi.verso);
            const destra = new THREE.Vector3().crossVectors(su, avanti);
            const base = new THREE.Matrix4().makeBasis(destra, su, avanti);
            orientato.quaternion.setFromRotationMatrix(base.transpose());
        }

        // misure globali dopo il raddrizzamento, per i pezzi senza nome
        const misureG = globale.getSize(new THREE.Vector3()).toArray();
        const centroG = globale.getCenter(new THREE.Vector3()).toArray();
        pezzi.forEach(function(p) {
            if (p.sezione) return;
            const c = p.centro.toArray(), m = p.misure.toArray();
            if (assi.sembraAsta(p, assi.w, assi.d)) p.sezione = 'aste';
            else if (m[assi.w] < 0.3 * misureG[assi.w] && Math.abs(c[assi.w] - centroG[assi.w]) < 0.12 * misureG[assi.w]) p.sezione = 'ponte';
            else p.sezione = 'montatura';
        });

        // ogni pezzo prende il materiale della sua sezione: così i campioni lo colorano
        pezzi.forEach(function(p) { p.oggetto.material = materialiSezioni[p.sezione]; });

        // centriamo e portiamo a una buona grandezza (larghi circa 2.2)
        orientato.updateMatrixWorld(true);
        const scatola = new THREE.Box3();
        pezzi.forEach(function(p) { scatola.expandByObject(p.oggetto); });
        const dimensioni = scatola.getSize(new THREE.Vector3());
        orientato.position.sub(scatola.getCenter(new THREE.Vector3()));
        orientato.updateMatrixWorld(true);

        return { orientato: orientato, pezzi: pezzi, dimensioni: dimensioni };
}

// l'occhiale del sito: uno solo, quello di Leonard Zaharia
const percorsoScelto = 'modelli_occhiali_glbxweb/modelli_occhiali_glbxweb/LeonardZaharia.glb';
const nomeScelto = 'Leonard Zaharia';

caricaModello(percorsoScelto, nomeScelto);

// i tasti per provare l'occhiale con la telecamera (possono essere più di uno)
document.querySelectorAll('.apri-prova').forEach(function(tastoProva) {
    tastoProva.addEventListener('click', function() {
        apriProva(percorsoScelto, nomeScelto);
    });
});

// colore iniziale di ogni sezione: quello del campione già selezionato nel pannello
document.querySelectorAll('.campioni').forEach(function(gruppo) {
    const scelto = gruppo.querySelector('.campione.selected');
    materialiSezioni[gruppo.dataset.parte].color.set(scelto.dataset.color);
});

// 7. i controlli della camera: servono solo per lo zoom con la rotella
const controlli = new OrbitControls(camera, renderer.domElement);
controlli.enableRotate = false; // la rotazione la facciamo noi sulla figura (passo 7b)
controlli.enablePan = false;    // così la figura non esce mai dal centro
controlli.enableDamping = true;

// nella home il visore resta fermo mentre la pagina scorre (data-scorri="pagina"):
// la rotella deve far scorrere la pagina, non fare zoom
const visoreInPagina = visore.dataset.scorri === 'pagina';
if (visoreInPagina) controlli.enableZoom = false;

// 7b. ruotare la figura: tieni premuto e trascina in qualsiasi direzione
const tela = renderer.domElement;
tela.style.cursor = 'grab';
// su telefono il dito in orizzontale ruota la figura, in verticale fa ancora scorrere la pagina
// (altrimenti il visore, grande quasi quanto lo schermo, bloccherebbe lo scorrimento)
tela.style.touchAction = 'pan-y';

let staTrascinando = false;
let ultimaX = 0;
let ultimaY = 0;
const velocita = 0.01; // quanto ruota la figura per ogni pixel di trascinamento

tela.addEventListener('pointerdown', function(e) {
    if (transizione) return; // durante la transizione tra viste il mouse non gira l'occhiale
    staTrascinando = true;
    togliVistaSelezionata(); // girata a mano: non è più una vista precisa
    ultimaX = e.clientX;
    ultimaY = e.clientY;
    tela.setPointerCapture(e.pointerId); // continua a ruotare anche se esci dal riquadro
    tela.style.cursor = 'grabbing';
});

tela.addEventListener('pointermove', function(e) {
    if (!staTrascinando) return;
    const dx = e.clientX - ultimaX;
    const dy = e.clientY - ultimaY;
    ultimaX = e.clientX;
    ultimaY = e.clientY;

    // gli assi sono presi "dal punto di vista" della camera, così la figura segue sempre il mouse
    const asseVerticale = new THREE.Vector3(0, 1, 0);
    const asseDestra = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); // orizzontale dello schermo

    // muovi il mouse a destra/sinistra → la figura gira attorno all'asse verticale
    perno.rotateOnWorldAxis(asseVerticale, dx * velocita);
    // muovi il mouse su/giù → la figura si ribalta verso di te o all'indietro
    perno.rotateOnWorldAxis(asseDestra, dy * velocita);
});

function fineTrascinamento() {
    staTrascinando = false;
    tela.style.cursor = 'grab';
}
tela.addEventListener('pointerup', fineTrascinamento);
tela.addEventListener('pointercancel', fineTrascinamento);

// doppio clic nel visore: la figura torna dritta
tela.addEventListener('dblclick', function() {
    perno.rotation.set(0, 0, 0);
});

// 7c. i bottoni del pannello: stessa logica per Forma e Colore.
//     Al clic: legge le etichette data-*, aggiorna il testo accanto al titolo
//     e sposta la classe "selected" sul bottone cliccato.
function collegaBottoni(selettore, quandoClicchi) {
    const bottoni = document.querySelectorAll(selettore);
    const valore = bottoni[0].closest('.opzione').querySelector('.opzione-valore');

    bottoni.forEach(function(bottone) {
        bottone.addEventListener('click', function() {
            quandoClicchi(bottone);
            valore.textContent = bottone.dataset.name;

            bottoni.forEach(function(b) {
                b.classList.remove('selected');
            });
            bottone.classList.add('selected');
        });
    });
}

// i campioni colore: una fila per sezione. data-parte dice quale sezione, data-color il colore
sezioni.forEach(function(sezione) {
    collegaBottoni('.campioni[data-parte="' + sezione + '"] .campione', function(bottone) {
        materialiSezioni[sezione].color.set(bottone.dataset.color);
        // colore scelto a mano: nessun abbinamento è più quello attivo
        document.querySelectorAll('.abbinamento').forEach(function(b) { b.classList.remove('selected'); });
        document.querySelector('.abbinamento').closest('.opzione').querySelector('.opzione-valore').textContent = 'Personale';
    });
});

// gli abbinamenti: per ogni sezione "clicchiamo" noi il campione con quel nome,
// così colori, scritte e bottoni selezionati si aggiornano da soli
collegaBottoni('.abbinamento', function(bottone) {
    sezioni.forEach(function(sezione) {
        const nome = bottone.dataset[sezione];
        document.querySelector('.campioni[data-parte="' + sezione + '"] .campione[data-name="' + nome + '"]').click();
    });
});

// le misure: data-size è il calibro in mm; la misura selezionata all'inizio è la grandezza normale
const misuraIniziale = document.querySelector('.misura.selected');
const MISURA_BASE = misuraIniziale ? Number(misuraIniziale.dataset.size) : 50;
collegaBottoni('.misura', function(bottone) {
    fattoreMisura = Number(bottone.dataset.size) / MISURA_BASE;
    contenitore.scale.setScalar(scalaBase * fattoreMisura);
});

// 7d. le viste: la camera resta ferma davanti, è l'occhiale che gira su se stesso
//     fino a mostrare il lato giusto. Ogni vista è una rotazione dell'occhiale:
//     x = inclinazione verso di noi (positivo = ci mostra la parte sopra), y = giro attorno all'asse verticale.
const gradi = THREE.MathUtils.degToRad;
function rotazione(x, y, z) {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(gradi(x), gradi(y), gradi(z || 0)));
}
const viste = {
    fronte:      rotazione(0, 0),
    'tre-quarti':rotazione(12, -35),
    lato:        rotazione(0, -90),
    alto:        rotazione(70, 0),
    sotto:       rotazione(-65, 30)
};
const DISTANZA = 5;  // distanza della camera nelle viste
const DURATA = 3000; // millisecondi della transizione
const asseY = new THREE.Vector3(0, 1, 0);

let transizione = null; // quando non è null, contiene da dove si parte e dove si arriva

// opzioni: giro = fa un giro completo durante il viaggio, durata in millisecondi
function vaiAllaVista(nome, opzioni) {
    if (!viste[nome]) return;
    opzioni = opzioni || {};
    transizione = {
        inizio: performance.now(),
        durata: opzioni.durata || DURATA,
        giro: opzioni.giro !== false,
        rotazioneIniziale: perno.quaternion.clone(),
        rotazioneFinale: viste[nome],
        distanzaIniziale: camera.position.distanceTo(controlli.target) // se avevi zoomato, si torna alla distanza giusta
    };
    staTrascinando = false;
    controlli.enabled = false; // niente zoom con la rotella durante la transizione
}

// rallenta all'inizio e alla fine: il movimento sembra più naturale
function morbido(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function aggiornaTransizione(adesso) {
    const t = Math.min((adesso - transizione.inizio) / transizione.durata, 1); // da 0 a 1
    const k = morbido(t);

    // l'occhiale passa dalla rotazione di partenza a quella della vista...
    const verso = new THREE.Quaternion().slerpQuaternions(transizione.rotazioneIniziale, transizione.rotazioneFinale, k);
    // ...e intanto (se richiesto) fa un giro completo su se stesso (a fine transizione 360° = 0°)
    const giro = new THREE.Quaternion().setFromAxisAngle(asseY, transizione.giro ? k * Math.PI * 2 : 0);
    perno.quaternion.copy(giro).multiply(verso);

    // la camera non gira: si avvicina o allontana soltanto, restando davanti all'occhiale
    const distanza = THREE.MathUtils.lerp(transizione.distanzaIniziale, DISTANZA, k);
    camera.position.set(0, 0, distanza).add(controlli.target);

    if (t === 1) {
        transizione = null;
        controlli.enabled = true;
    }
}

function togliVistaSelezionata() {
    document.querySelectorAll('.vista').forEach(function(b) { b.classList.remove('selected'); });
    document.querySelector('.vista').closest('.opzione').querySelector('.opzione-valore').textContent = 'Libera';
}

// i bottoni Vista: data-vista dice dove andare
collegaBottoni('.vista', function(bottone) {
    vaiAllaVista(bottone.dataset.vista);
});

// 7e. l'esplosione: ogni pezzo si allontana nella direzione della sua sezione
//     (lenti in avanti, ponte in alto, aste di lato e indietro, montatura ferma).
//     Le direzioni le calcola caricaModello (passo 6c) e stanno in partiModello.
const DURATA_ESPLOSIONE = 1200; // millisecondi

let esplosione = { valore: 0, partenza: 0, arrivo: 0, inizio: 0 }; // valore: 0 = chiuso, 1 = esploso

function aggiornaEsplosione(adesso) {
    const t = Math.min((adesso - esplosione.inizio) / DURATA_ESPLOSIONE, 1);
    esplosione.valore = THREE.MathUtils.lerp(esplosione.partenza, esplosione.arrivo, morbido(t));

    partiModello.forEach(function(p) {
        p.oggetto.position.copy(p.base).addScaledVector(p.spostamento, esplosione.valore);
    });
}

const bottoneEsplodi = document.querySelector('.esplodi');

// apri = true separa le parti, false le rimette insieme
function impostaEsplosione(apri) {
    if ((esplosione.arrivo === 1) === apri) return; // è già così
    // parte da dove si trova adesso: se cambi idea a metà, torna indietro senza scatti
    esplosione.partenza = esplosione.valore;
    esplosione.arrivo = apri ? 1 : 0;
    esplosione.inizio = performance.now();
    bottoneEsplodi.textContent = apri ? 'Ricomponi' : 'Esplodi';
    bottoneEsplodi.classList.toggle('selected', apri);
}
bottoneEsplodi.addEventListener('click', function() {
    impostaEsplosione(esplosione.arrivo === 0);
});

// 7f. i comandi per le animazioni della pagina (animazioni.js, con GSAP):
//     mentre scorri, ogni capitolo porta l'occhiale in una vista e può esploderlo
window.occhiale = {
    vista: function(nome, opzioni) {
        togliVistaSelezionata();
        const bottone = document.querySelector('.vista[data-vista="' + nome + '"]');
        if (bottone) {
            bottone.classList.add('selected');
            bottone.closest('.opzione').querySelector('.opzione-valore').textContent = bottone.dataset.name;
        }
        vaiAllaVista(nome, opzioni);
    },
    esplodi: impostaEsplosione
};
document.dispatchEvent(new Event('occhiale:pronto'));

// 8. il ciclo di animazione: ridisegna la scena a ogni fotogramma
function anima(adesso) {
    aggiornaEsplosione(adesso);
    if (transizione) {
        aggiornaTransizione(adesso);
    } else {
        controlli.update();
    }
    renderer.render(scena, camera);
}
// il visore si ridisegna solo quando si vede: se scorri più in basso, o se è aperta
// la prova con la telecamera, si ferma e lascia lavorare il resto della pagina
let visoreVisibile = true;
function aggiornaCiclo() {
    renderer.setAnimationLoop(visoreVisibile && prova.hidden ? anima : null);
}
new IntersectionObserver(function(voci) {
    visoreVisibile = voci[0].isIntersecting;
    aggiornaCiclo();
}).observe(visore);

// 9. se il visore cambia dimensione (finestra, telefono girato...), adattiamo camera e canvas
function adattaVisore() {
    if (!visore.clientWidth || !visore.clientHeight) return;
    camera.aspect = visore.clientWidth / visore.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(visore.clientWidth, visore.clientHeight);
}
new ResizeObserver(adattaVisore).observe(visore);
window.addEventListener('resize', function() {
    if (!prova.hidden) adattaPalco();
});


// 10. PROVA CON LA TELECAMERA
//     La telecamera riprende la faccia. MediaPipe (una libreria di Google) trova
//     478 punti sulla faccia a ogni fotogramma. Da tre coppie di punti capiamo
//     dove sono gli occhi, quanto è grande la faccia e come è girata:
//     l'occhiale segue questi dati. Tutto resta nel browser: nessuna immagine esce dal pc.
const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODELLO_FACCIA = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// i numeri dei punti della faccia che ci servono
const PUNTO = {
    occhioDestro: 33,    // angolo esterno dell'occhio destro
    occhioSinistro: 263, // angolo esterno dell'occhio sinistro
    naso: 168,           // radice del naso, tra gli occhi
    fronte: 10,
    mento: 152
};
const OCCHIALE_SU_OCCHI = 1.45; // la montatura è circa 1.45 volte la distanza tra gli angoli degli occhi

const prova = document.getElementById('prova');
const palco = prova.querySelector('.prova-palco');
const provaVideo = prova.querySelector('.prova-video');
const provaTela = prova.querySelector('.prova-tela');
const provaAvviso = prova.querySelector('.prova-avviso');
const provaNome = prova.querySelector('.prova-nome');

let provaRenderer = null, provaScena, provaCamera;
const MAX_FACCE = 4;    // quante persone insieme al massimo
// una "testa" per ogni persona: un gruppo che segue la sua faccia, con dentro l'occhiale.
// primaVolta: al primo fotogramma l'occhiale "salta" al posto giusto, poi si muove morbido
let teste = [];         // [{ gruppo, primaVolta }]
let occhialeProva = null; // l'occhiale preparato: ogni testa ne ha una copia
let rilevatore = null;  // il Face Landmarker di MediaPipe (si carica una volta sola)
let flusso = null;      // il flusso della telecamera
let ultimoTempo = -1;
let richiestaProva = 0;

// la scena della prova: si crea al primo clic su "Prova"
function preparaScenaProva() {
    if (provaRenderer) return;
    provaRenderer = new THREE.WebGLRenderer({ canvas: provaTela, antialias: true, alpha: true }); // alpha: si vede il video sotto
    provaRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    provaScena = new THREE.Scene();
    provaScena.add(new THREE.AmbientLight('#ffffff', 0.8));
    const luceProva = new THREE.DirectionalLight('#ffffff', 2);
    luceProva.position.set(0, 1, 2);
    provaScena.add(luceProva);
    provaScena.environment = new THREE.PMREMGenerator(provaRenderer).fromScene(new RoomEnvironment(), 0.04).texture;

    // camera "ortografica": 1 unità = 1 pixel del video, così i punti della faccia vanno messi così come sono
    provaCamera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 40000);
    provaCamera.position.z = 20000;

    // una "testa invisibile": non si vede ma copre le aste dietro le orecchie.
    // colorWrite false = non disegna colore, ma nasconde quello che le sta dietro.
    // Forma e materiale sono gli stessi per tutte le teste.
    const formaTesta = new THREE.SphereGeometry(1, 32, 16);
    const materialeTesta = new THREE.MeshBasicMaterial({ colorWrite: false });

    for (let i = 0; i < MAX_FACCE; i++) {
        const gruppo = new THREE.Group();
        gruppo.visible = false;
        provaScena.add(gruppo);

        const occlusore = new THREE.Mesh(formaTesta, materialeTesta);
        occlusore.position.set(0, -0.1, -0.78); // misure in "larghezze di montatura"
        occlusore.scale.set(0.46, 0.65, 0.7);
        occlusore.renderOrder = -1;             // si disegna prima dell'occhiale
        gruppo.add(occlusore);

        teste.push({ gruppo: gruppo, primaVolta: true, occhiale: null });
    }
}

function caricaRilevatore() {
    if (!rilevatore) {
        rilevatore = import(MEDIAPIPE + '/vision_bundle.mjs').then(async function(vision) {
            const file = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE + '/wasm');
            return vision.FaceLandmarker.createFromOptions(file, {
                baseOptions: { modelAssetPath: MODELLO_FACCIA, delegate: 'GPU' },
                runningMode: 'VIDEO',
                numFaces: MAX_FACCE
            });
        });
        rilevatore.catch(function() { rilevatore = null; }); // se fallisce, al prossimo clic si riprova
    }
    return rilevatore;
}

// il palco ha le stesse proporzioni del video e sta tutto dentro lo schermo
function adattaPalco() {
    const vw = provaVideo.videoWidth, vh = provaVideo.videoHeight;
    if (!vw || !provaRenderer) return;
    const larghezza = Math.min(window.innerWidth, window.innerHeight * vw / vh);
    const altezza = larghezza * vh / vw;
    palco.style.width = larghezza + 'px';
    palco.style.height = altezza + 'px';
    provaRenderer.setSize(larghezza, altezza);
    provaCamera.right = vw;
    provaCamera.bottom = -vh;
    provaCamera.updateProjectionMatrix();
}

// mette l'occhiale preparato dentro ogni testa, con il centro della montatura nell'origine
// e la montatura larga 1: così la scala della testa = larghezza della montatura in pixel
function mettiOcchiale(pronto) {
    const davanti = new THREE.Box3(); // montatura, lenti e ponte, senza le aste
    pronto.pezzi.forEach(function(p) {
        if (p.sezione !== 'aste') davanti.expandByObject(p.oggetto);
    });
    if (davanti.isEmpty()) davanti.setFromObject(pronto.orientato);
    const centro = davanti.getCenter(new THREE.Vector3());
    const larghezza = davanti.getSize(new THREE.Vector3()).x || pronto.dimensioni.x;

    pronto.orientato.position.sub(centro);
    occhialeProva = new THREE.Group();
    occhialeProva.scale.setScalar(1 / larghezza);
    occhialeProva.add(pronto.orientato);

    // ogni testa riceve una copia. clone() copia la struttura ma usa le stesse
    // forme e gli stessi materiali: così i colori del pannello valgono per tutti
    teste.forEach(function(t) {
        if (t.occhiale) t.gruppo.remove(t.occhiale);
        t.occhiale = occhialeProva.clone();
        t.gruppo.add(t.occhiale);
    });
}

async function apriProva(percorso, nome) {
    const questa = ++richiestaProva;
    prova.hidden = false;
    aggiornaCiclo(); // il visore della pagina si ferma: lavora solo la prova
    document.body.style.overflow = 'hidden'; // la pagina sotto non scorre
    provaNome.textContent = nome;
    provaAvviso.textContent = 'Avvio della telecamera…';
    provaAvviso.style.display = 'block';
    teste.forEach(function(t) { t.gruppo.visible = false; t.primaVolta = true; });

    try {
        preparaScenaProva();
        if (!flusso) {
            flusso = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
        }
        if (questa !== richiestaProva) return;
        provaVideo.srcObject = flusso;
        await provaVideo.play();
        adattaPalco();

        provaAvviso.textContent = 'Caricamento dell\'occhiale…';
        const risultati = await Promise.all([loader.loadAsync(percorso), caricaRilevatore()]);
        if (questa !== richiestaProva) return;
        const pronto = preparaModello(risultati[0], percorso);
        if (!pronto) throw new Error('modello vuoto');
        mettiOcchiale(pronto);

        provaAvviso.textContent = 'Guarda la telecamera';
        provaRenderer.setAnimationLoop(cicloProva);
    } catch (errore) {
        if (questa !== richiestaProva) return;
        provaAvviso.textContent = errore.name === 'NotAllowedError'
            ? 'Permesso per la telecamera negato. Consentilo dal lucchetto nella barra degli indirizzi.'
            : 'Qualcosa non va: ' + errore.message;
    }
}

function chiudiProva() {
    richiestaProva++;
    if (provaRenderer) provaRenderer.setAnimationLoop(null);
    if (flusso) flusso.getTracks().forEach(function(traccia) { traccia.stop(); }); // spegne la telecamera
    flusso = null;
    provaVideo.srcObject = null;
    anteprimaFoto.hidden = true;
    prova.hidden = true;
    aggiornaCiclo(); // il visore della pagina riparte
    document.body.style.overflow = '';
}

prova.querySelector('.prova-chiudi').addEventListener('click', chiudiProva);

// 10b. la foto: in un canvas 2D disegniamo il video e sopra l'occhiale,
//      tutti e due a specchio (come li vedi), poi lo trasformiamo in un'immagine PNG
//      che si scarica sul dispositivo con il tasto "Salva". La foto non esce mai dal browser.
const tastoScatta = prova.querySelector('.prova-scatta');
const anteprimaFoto = prova.querySelector('.prova-foto');
const linkSalva = prova.querySelector('.prova-salva');
let indirizzoFoto = null; // l'indirizzo temporaneo (blob:) dell'ultima foto

tastoScatta.addEventListener('click', function() {
    if (!provaRenderer || !provaVideo.videoWidth) return;
    const vw = provaVideo.videoWidth, vh = provaVideo.videoHeight;
    const foto = document.createElement('canvas');
    foto.width = vw;
    foto.height = vh;
    const pennello = foto.getContext('2d');
    pennello.translate(vw, 0);
    pennello.scale(-1, 1); // specchio
    pennello.drawImage(provaVideo, 0, 0, vw, vh);
    // ridisegniamo l'occhiale proprio adesso: il canvas 3D va copiato subito dopo il render
    provaRenderer.render(provaScena, provaCamera);
    pennello.drawImage(provaTela, 0, 0, vw, vh);

    // toBlob: trasforma il canvas in un file PNG; createObjectURL gli dà un indirizzo da scaricare
    foto.toBlob(function(file) {
        if (indirizzoFoto) URL.revokeObjectURL(indirizzoFoto); // libera la memoria della foto precedente
        indirizzoFoto = URL.createObjectURL(file);
        anteprimaFoto.querySelector('img').src = indirizzoFoto;
        linkSalva.href = indirizzoFoto;
        linkSalva.download = 'occhiale ' + provaNome.textContent + '.png';
        anteprimaFoto.hidden = false;
    }, 'image/png');

    // un lampo bianco, come una macchina fotografica
    prova.classList.remove('lampo');
    void prova.offsetWidth; // fa ripartire l'animazione
    prova.classList.add('lampo');
});

prova.querySelector('.prova-scarta').addEventListener('click', function() {
    anteprimaFoto.hidden = true;
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !prova.hidden) chiudiProva();
});

// da una faccia di MediaPipe a { posizione, rotazione, scala } dell'occhiale
const matriceFaccia = new THREE.Matrix4();

function posaDellaFaccia(punti) {
    const vw = provaVideo.videoWidth, vh = provaVideo.videoHeight;
    // da coordinate MediaPipe (0..1, y in giù, z verso lo schermo) a pixel (y in su, z verso di noi)
    const p = function(i) { return new THREE.Vector3(punti[i].x * vw, -punti[i].y * vh, -punti[i].z * vw); };

    // asse destra: da un occhio all'altro. Asse su: dal mento alla fronte. Asse avanti: il terzo
    const destra = p(PUNTO.occhioSinistro).sub(p(PUNTO.occhioDestro));
    const distanzaOcchi = destra.length();
    destra.normalize();
    const su = p(PUNTO.fronte).sub(p(PUNTO.mento));
    su.addScaledVector(destra, -su.dot(destra)).normalize();
    const avanti = new THREE.Vector3().crossVectors(destra, su);

    return {
        // l'occhiale sta sulla radice del naso, appena più in basso
        posizione: p(PUNTO.naso).addScaledVector(su, -0.05 * distanzaOcchi),
        rotazione: new THREE.Quaternion().setFromRotationMatrix(matriceFaccia.makeBasis(destra, su, avanti)),
        scala: distanzaOcchi * OCCHIALE_SU_OCCHI
    };
}

// a ogni fotogramma: trova le facce e sposta un occhiale su ognuna
async function cicloProva() {
    const faccia = await rilevatore;
    if (provaVideo.currentTime !== ultimoTempo) {
        ultimoTempo = provaVideo.currentTime;
        const risultato = faccia.detectForVideo(provaVideo, performance.now());
        const pose = risultato.faceLandmarks.map(posaDellaFaccia);

        // MediaPipe non dice "questa è sempre la stessa persona": le facce possono
        // arrivare in ordine diverso. Allora ogni faccia prende la testa che era
        // più vicina al fotogramma prima; così l'occhiale non salta da una persona all'altra.
        const libere = teste.slice();
        const coppie = [];
        pose.forEach(function(posa) {
            let migliore = null, distanzaMigliore = Infinity;
            libere.forEach(function(t) {
                if (!t.gruppo.visible) return; // le teste spente le usiamo dopo
                const d = t.gruppo.position.distanceTo(posa.posizione);
                if (d < distanzaMigliore && d < posa.scala) { migliore = t; distanzaMigliore = d; }
            });
            coppie.push({ posa: posa, testa: migliore });
            if (migliore) libere.splice(libere.indexOf(migliore), 1);
        });
        // le facce nuove (senza testa vicina) prendono una testa libera, che parte da zero
        coppie.forEach(function(c) {
            if (c.testa || !libere.length) return;
            c.testa = libere.shift();
            c.testa.primaVolta = true;
        });

        coppie.forEach(function(c) {
            const g = c.testa.gruppo;
            // morbido: a ogni fotogramma fa metà strada, così non trema
            const k = c.testa.primaVolta ? 1 : 0.5;
            g.position.lerp(c.posa.posizione, k);
            g.quaternion.slerp(c.posa.rotazione, k);
            g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, c.posa.scala, k));
            g.visible = true;
            c.testa.primaVolta = false;
        });
        // le teste rimaste libere: nessuna faccia, si spengono
        libere.forEach(function(t) { t.gruppo.visible = false; t.primaVolta = true; });

        if (pose.length) {
            provaAvviso.style.display = 'none';
        } else {
            provaAvviso.textContent = 'Nessuna faccia trovata';
            provaAvviso.style.display = 'block';
        }
    }
    provaRenderer.render(provaScena, provaCamera);
}
