// intro.js – la prima schermata
// Gli occhiali entrano dall'alto, scendono nella parte bassa, fanno un giro e tornano in alto,
// lasciando dietro una scia di colori cromati. Quando passano in basso esce la scritta TINA;
// quando si fermano la scia si ritira e sparisce.

(function() {

    const sezione = document.querySelector('#intro');
    const canvas = document.querySelector('#intro-canvas');
    const bottoneRivedi = document.querySelector('#intro-rivedi');


    // ===== 1. scena, camera, renderer =====
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scena = new THREE.Scene();
    Occhiali.luci(scena, renderer);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    function ridimensiona() {
        const w = sezione.clientWidth, h = sezione.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // su schermi stretti (telefono) la camera si allontana, così gli occhiali entrano tutti
        camera.position.set(0, 0, camera.aspect < 1 ? 10 / camera.aspect * 0.75 : 10);
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', ridimensiona);
    ridimensiona();

    // il "perno" si muove lungo la spirale; dentro ci sono gli occhiali
    const perno = new THREE.Group();
    scena.add(perno);
    let occhiali = null;


    // ===== 2. la scia cromata =====
    // È un nastro: ad ogni fotogramma salviamo dove sono i due lati degli occhiali,
    // e uniamo i punti salvati con dei triangoli. Più un punto è vecchio, più è trasparente.
    const MAX = 90;   // quanti fotogrammi ricorda la scia
    const posizioni = new Float32Array(MAX * 2 * 3);
    const lunghezza = new Float32Array(MAX * 2);   // 0 = vicino agli occhiali, 1 = coda
    const lato = new Float32Array(MAX * 2);        // 0 = un bordo del nastro, 1 = l'altro
    const indici = [];
    for (let i = 0; i < MAX - 1; i++) {
        const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
        indici.push(a, b, c, b, d, c);
    }
    for (let i = 0; i < MAX; i++) { lato[i * 2] = 0; lato[i * 2 + 1] = 1; }

    const geoScia = new THREE.BufferGeometry();
    geoScia.setAttribute('position', new THREE.BufferAttribute(posizioni, 3));
    geoScia.setAttribute('aLunghezza', new THREE.BufferAttribute(lunghezza, 1));
    geoScia.setAttribute('aLato', new THREE.BufferAttribute(lato, 1));
    geoScia.setIndex(indici);

    // i colori li calcola la scheda video: un arcobaleno "cromato" che scorre,
    // con righe chiare come i riflessi del metallo
    const materialeScia = new THREE.ShaderMaterial({
        uniforms: { uTempo: { value: 0 }, uSvanire: { value: 1 } },
        vertexShader: `
            attribute float aLunghezza;
            attribute float aLato;
            varying float vLunghezza;
            varying float vLato;
            void main() {
                vLunghezza = aLunghezza;
                vLato = aLato;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTempo;
            uniform float uSvanire;
            varying float vLunghezza;
            varying float vLato;
            vec3 arcobaleno(float t) {   // rosa, arancio, giallo, azzurro, viola...
                return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67)));
            }
            void main() {
                float t = vLunghezza * 1.4 + vLato * 0.35 - uTempo * 0.6;
                vec3 colore = arcobaleno(t);
                // riflessi chiari che attraversano il nastro
                float riflesso = pow(abs(sin(vLunghezza * 18.0 + vLato * 4.0 - uTempo * 3.0)), 24.0);
                colore = mix(colore, vec3(1.0), riflesso * 0.7);
                // i bordi del nastro sfumano, la coda sparisce
                float bordi = smoothstep(0.0, 0.25, vLato) * smoothstep(1.0, 0.75, vLato);
                float alfa = pow(1.0 - vLunghezza, 1.6) * bordi * uSvanire;
                gl_FragColor = vec4(colore, alfa * 0.9);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending   // i colori si sommano: la scia "brilla"
    });

    const scia = new THREE.Mesh(geoScia, materialeScia);
    scia.frustumCulled = false;
    scena.add(scia);

    const storia = [];   // i punti salvati: { a, b } = i due bordi del nastro
    const bordoA = new THREE.Vector3(-1.25, 0, 0);
    const bordoB = new THREE.Vector3(1.25, 0, 0);

    function aggiornaScia() {
        const n = storia.length;
        for (let i = 0; i < MAX; i++) {
            const punto = storia[Math.max(0, n - 1 - Math.min(i, n - 1))] || { a: new THREE.Vector3(), b: new THREE.Vector3() };
            posizioni.set([punto.a.x, punto.a.y, punto.a.z], i * 6);
            posizioni.set([punto.b.x, punto.b.y, punto.b.z], i * 6 + 3);
            const l = n > 1 ? Math.min(i / (n - 1), 1) : 1;
            lunghezza[i * 2] = l;
            lunghezza[i * 2 + 1] = l;
        }
        geoScia.attributes.position.needsUpdate = true;
        geoScia.attributes.aLunghezza.needsUpdate = true;
        geoScia.setDrawRange(0, Math.max(0, n - 1) * 6);
    }


    // ===== 3. la sceneggiatura =====
    const DURATA_ENTRATA = 3.8;   // secondi
    const ALTEZZA_FINALE = 1.05;  // dove si fermano: nella parte alta, sopra il titolo
    const ALTEZZA_TITOLO = -0.9;  // quando passano più in basso di così, esce la scritta
    let fase = 'attesa';           // attesa → entrata → svanisce → fermo
    let tempoFase = 0;

    // il percorso: entrano dall'alto, scendono a sinistra, passano in basso (sopra il titolo)
    // da sinistra a destra, risalgono a destra, fanno il giro in alto e si fermano al centro.
    // CatmullRomCurve3 = una curva morbida che passa per tutti questi punti
    const percorso = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.4, 7.5, -1.0),    // fuori dallo schermo, in alto
        new THREE.Vector3(-2.7, 2.2, 0.4),    // scende a sinistra
        new THREE.Vector3(-1.6, -1.6, 1.2),   // in basso a sinistra
        new THREE.Vector3(1.6, -1.6, 1.0),    // in basso a destra (qui esce la scritta)
        new THREE.Vector3(2.8, 0.6, 0.0),     // risale a destra
        new THREE.Vector3(1.0, 2.3, -0.9),    // il giro passa in alto
        new THREE.Vector3(-0.6, 1.6, -0.3),
        new THREE.Vector3(0, ALTEZZA_FINALE, 0)   // si ferma al centro, in alto
    ], false, 'centripetal');

    // veloce all'inizio, rallenta nel giro e arriva piano
    function ritmo(x) { return 1 - Math.pow(1 - x, 2.4); }

    function partenza() {
        storia.length = 0;
        materialeScia.uniforms.uSvanire.value = 1;
        scia.visible = true;
        sezione.classList.remove('mostra');   // il titolo si nasconde
        fase = 'entrata';
        tempoFase = 0;
    }

    const tangente = new THREE.Vector3();

    function posizionaInEntrata(p) {
        percorso.getPointAt(p, perno.position);
        percorso.getTangentAt(Math.min(p, 0.999), tangente);
        // girano su se stessi (due giri e mezzo, finiscono di fronte)
        // e si inclinano nelle curve come un aereo
        occhiali.rotation.set(
            -tangente.y * 0.5 * (1 - p),
            (1 - p) * Math.PI * 5,
            -tangente.x * 0.6 * (1 - p)
        );
    }


    // ===== 4. carica gli occhiali e parti =====
    Occhiali.carica(3).then(function(o) {
        occhiali = o.gruppo;
        perno.add(occhiali);
        posizionaInEntrata(0);
        // parte quando l'intro è visibile (se la pagina si apre più in basso, aspetta)
        new IntersectionObserver(function(voci, osservatore) {
            if (voci[0].isIntersecting) { partenza(); osservatore.disconnect(); }
        }, { threshold: 0.3 }).observe(sezione);
    }).catch(function(errore) {
        console.error(errore);
        sezione.classList.add('mostra');   // almeno il titolo si vede
    });

    bottoneRivedi.addEventListener('click', function() { if (occhiali) partenza(); });

    // gli occhiali seguono un poco il mouse quando sono fermi
    const mouse = { x: 0, y: 0 };
    sezione.addEventListener('pointermove', function(e) {
        const r = sezione.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / r.width * 2 - 1;
        mouse.y = (e.clientY - r.top) / r.height * 2 - 1;
    });


    // ===== 5. un passo dell'animazione (dt = secondi passati dal passo prima) =====
    let tempo = 0;

    function passo(dt) {
        tempo += dt;
        materialeScia.uniforms.uTempo.value = tempo;

        if (occhiali && fase === 'entrata') {
            tempoFase += dt;
            const p = ritmo(Math.min(tempoFase / DURATA_ENTRATA, 1));
            posizionaInEntrata(p);
            perno.updateMatrixWorld(true);

            // salva dove sono adesso i due bordi della scia
            storia.push({ a: occhiali.localToWorld(bordoA.clone()), b: occhiali.localToWorld(bordoB.clone()) });
            if (storia.length > MAX) storia.shift();

            // passano nella parte bassa: esce la scritta (le lettere entrano da sinistra a destra, come loro)
            if (perno.position.y < ALTEZZA_TITOLO) sezione.classList.add('mostra');

            if (tempoFase >= DURATA_ENTRATA) { fase = 'svanisce'; tempoFase = 0; }
        } else if (fase === 'svanisce') {
            // gli occhiali sono fermi: la scia si ritira verso di loro e sbiadisce
            tempoFase += dt;
            storia.splice(0, 3);
            materialeScia.uniforms.uSvanire.value = Math.max(0, 1 - tempoFase * 1.4);
            if (storia.length < 2 || materialeScia.uniforms.uSvanire.value <= 0) {
                storia.length = 0;
                scia.visible = false;
                fase = 'fermo';
                tempoFase = 0;
                sezione.classList.add('mostra');   // per sicurezza (di solito la scritta è già uscita)
            }
        } else if (occhiali && fase === 'fermo') {
            // fermi: galleggiano piano e guardano verso il mouse
            tempoFase += dt;
            perno.position.y = ALTEZZA_FINALE + Math.sin(tempoFase * 1.2) * 0.06;
            occhiali.rotation.y += (mouse.x * 0.35 - occhiali.rotation.y) * 0.05;
            occhiali.rotation.x += (mouse.y * 0.15 - occhiali.rotation.x) * 0.05;
            occhiali.rotation.z *= 0.9;
        }
    }


    // ===== 6. ogni fotogramma: un passo e poi il disegno =====
    const orologio = new THREE.Clock();

    function anima() {
        requestAnimationFrame(anima);
        passo(Math.min(orologio.getDelta(), 0.05));
        aggiornaScia();
        renderer.render(scena, camera);
    }
    anima();

})();
