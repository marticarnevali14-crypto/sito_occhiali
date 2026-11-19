// esploso.js – la terza sezione
// Gli occhiali si aprono pezzo per pezzo (esploso a strati), e ogni componente
// ha la sua scritta. Poi si ricompongono, chiudono le aste, le riaprono... e si ricomincia.

(function() {

    const visore = document.querySelector('#visore-esploso');
    const attesa = visore.querySelector('.attesa');
    const strato = document.querySelector('#etichette-esploso');   // il livello con le scritte


    // ===== 1. scena =====
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    visore.insertBefore(renderer.domElement, strato);
    const scena = new THREE.Scene();
    Occhiali.luci(scena, renderer);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(3.6, 2.0, 8.6);   // abbastanza lontana: da esplosi i pezzi occupano molto spazio

    const controlli = new THREE.OrbitControls(camera, renderer.domElement);
    controlli.enableDamping = true;
    controlli.enablePan = false;
    controlli.enableZoom = false;   // la rotella fa scorrere la pagina
    controlli.target.set(0, 0.1, 0.3);

    function ridimensiona() {
        const w = visore.clientWidth, h = visore.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        // su schermi stretti la camera si allontana
        camera.zoom = Math.min(1, camera.aspect / 1.4);
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', ridimensiona);
    ridimensiona();

    const contenitore = new THREE.Group();
    scena.add(contenitore);


    // ===== 2. le scritte di ogni componente =====
    // una per tipo di pezzo; "punto" dice dove attaccarla dentro il pezzo (in proporzione alla sua scatola)
    const SCRITTE = {
        lente:     { testo: 'Lente cromata a mascherina', punto: [0.35, 0.5, 1] },
        montatura: { testo: 'Montatura frontale',          punto: [0.7, 0.0, 0.5] },
        asta:      { testo: 'Aste',                        punto: [0.5, 0.5, 0.3] },
        nasello:   { testo: 'Nasello',                     punto: [0.5, 0.8, 0.5] },
        terminale: { testo: 'Terminali laterali',          punto: [0.5, 0.5, 0.5] },
        cerniera:  { testo: 'Cerniere',                    punto: [0.5, 0.5, 0.5] }
    };
    const etichette = [];   // { el, ancora }

    function creaEtichetta(parte, scritta) {
        // l'ancora è un punto invisibile attaccato al pezzo: si muove con lui
        const b = parte.box;
        const puntoFile = new THREE.Vector3(
            b.min.x + (b.max.x - b.min.x) * scritta.punto[0],
            b.min.y + (b.max.y - b.min.y) * scritta.punto[1],
            b.min.z + (b.max.z - b.min.z) * scritta.punto[2]
        );
        const ancora = new THREE.Object3D();
        // il pezzo ha la sua posizione: l'ancora va messa rispetto a lui
        // (all'inizio i pezzi non sono ruotati, quindi basta togliere la sua posizione)
        ancora.position.copy(puntoFile).sub(parte.oggetto.position);
        parte.oggetto.add(ancora);

        const el = document.createElement('div');
        el.className = 'etichetta';
        el.innerHTML = '<span class="etichetta-punto"></span><span class="etichetta-testo"></span>';
        el.querySelector('.etichetta-testo').textContent = scritta.testo;
        strato.appendChild(el);
        etichette.push({ el: el, ancora: ancora });
    }


    // ===== 3. carica e prepara l'esploso =====
    let cerniere = {};
    const componenti = [];

    Occhiali.carica(2.6).then(function(o) {
        contenitore.add(o.gruppo);
        cerniere = o.cerniere;
        attesa.style.display = 'none';

        // la spinta di ogni pezzo (in metri, le misure del file):
        // la lente esce in avanti, i pezzi del naso vanno indietro, aste e pezzi laterali di lato
        o.parti.forEach(function(p) {
            const spinta = new THREE.Vector3();
            switch (p.categoria) {
                case 'lente':     spinta.z = 0.09; break;
                case 'asta':      spinta.set(p.lato * 0.075, 0, -0.05); break;
                case 'nasello':   spinta.z = -0.065; break;
                case 'terminale':
                case 'cerniera':  spinta.set(p.lato * 0.045, 0, 0.02); break;
                case 'vite':      spinta.set(p.lato * 0.05, 0, 0.01); break;
            }
            componenti.push({ parte: p.oggetto, casa: p.oggetto.position.clone(), spinta: spinta });
        });

        // una scritta per tipo di pezzo (per le coppie: su quello di destra)
        Object.keys(SCRITTE).forEach(function(categoria) {
            const candidati = o.parti.filter(function(p) { return p.categoria === categoria; });
            if (!candidati.length) return;
            candidati.sort(function(a, b) { return b.centro.x - a.centro.x; });
            // le cerniere a sinistra, così non si sovrappongono ai terminali
            const scelto = categoria === 'cerniera' ? candidati[candidati.length - 1] : candidati[0];
            creaEtichetta(scelto, SCRITTE[categoria]);
        });

        orologio.start();
    }).catch(function(errore) {
        console.error(errore);
        attesa.textContent = 'Apri il sito con Live Server per vedere il modello.';
    });


    // ===== 4. la sceneggiatura (in secondi, poi ricomincia) =====
    //  0 – 1      montati e aperti
    //  1 – 3      si separano
    //  3 – 7      fermi, esplosi (si leggono le scritte)
    //  7 – 9      si ricompongono
    //  9 – 10.5   chiudono le aste
    //  10.5 – 12  fermi, chiusi
    //  12 – 13.5  riaprono le aste
    //  13.5 – 14  pausa
    const durata = 14;
    function tratto(t, inizio, fine) {
        const x = Math.min(Math.max((t - inizio) / (fine - inizio), 0), 1);
        return x * x * (3 - 2 * x);
    }
    const giroDestra = THREE.MathUtils.degToRad(63);
    const giroSinistra = THREE.MathUtils.degToRad(-57);

    const orologio = new THREE.Clock(false);
    const v = new THREE.Vector3();

    function anima() {
        requestAnimationFrame(anima);
        const tempo = orologio.getElapsedTime();
        const t = tempo % durata;

        const esplosione = tratto(t, 1, 3) - tratto(t, 7, 9);
        componenti.forEach(function(c) {
            c.parte.position.copy(c.casa).addScaledVector(c.spinta, esplosione);
        });

        const chiusura = tratto(t, 9, 10.5) - tratto(t, 12, 13.5);
        if (cerniere.destra) cerniere.destra.rotation.y = giroDestra * chiusura;
        if (cerniere.sinistra) cerniere.sinistra.rotation.y = giroSinistra * chiusura;

        contenitore.rotation.y = 0.35 * Math.sin(tempo * 0.25);

        controlli.update();
        renderer.render(scena, camera);

        // le scritte: dal punto 3D al punto sullo schermo
        const w = visore.clientWidth, h = visore.clientHeight;
        etichette.forEach(function(e) {
            e.ancora.getWorldPosition(v);
            v.project(camera);
            const x = (v.x + 1) / 2 * w;
            const y = (1 - v.y) / 2 * h;
            e.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
            e.el.style.opacity = (v.z < 1 ? esplosione : 0).toFixed(2);
        });
    }
    anima();

})();
