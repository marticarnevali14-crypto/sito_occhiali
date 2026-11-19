// prospettive.js – la seconda sezione
// A destra: le miniature delle varie viste (le "scatta" la pagina dal modello 3D).
// A sinistra: il visore. Cliccando una vista la camera ci gira intorno fino a quel punto.

(function() {

    const visore = document.querySelector('#visore-prospettive');
    const attesa = visore.querySelector('.attesa');
    const elenco = document.querySelector('#vedute');

    const vedute = [
        { nome: 'Fronte',     pos: [0, 0.3, 7] },
        { nome: 'Tre quarti', pos: [4.6, 1.8, 5] },
        { nome: 'Lato',       pos: [7, 0.3, 0.01] },
        { nome: 'Dall\'alto', pos: [0, 7, 0.6] },
        { nome: 'Dietro',     pos: [-1.6, 1.2, -6.6] },
        { nome: 'Dal basso',  pos: [1.2, -6.4, 2.6] }
    ];


    // ===== 1. scena =====
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    visore.appendChild(renderer.domElement);
    const scena = new THREE.Scene();
    Occhiali.luci(scena, renderer);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.3, 7);

    const controlli = new THREE.OrbitControls(camera, renderer.domElement);
    controlli.enableDamping = true;
    controlli.enablePan = false;
    controlli.minDistance = 4;
    controlli.maxDistance = 12;

    function ridimensiona() {
        const w = visore.clientWidth, h = visore.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', ridimensiona);
    ridimensiona();


    // ===== 2. il viaggio della camera da una vista all'altra =====
    // Ci muoviamo "intorno" agli occhiali (coordinate sferiche: distanza e due angoli),
    // così la camera non li attraversa mai.
    let viaggio = null;

    function vaiA(pos) {
        const da = new THREE.Spherical().setFromVector3(camera.position);
        const a = new THREE.Spherical().setFromVector3(new THREE.Vector3(pos[0], pos[1], pos[2]));
        // l'angolo orizzontale prende la strada più corta
        let diff = a.theta - da.theta;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        viaggio = { da: da, a: a, diffTheta: diff, t: 0 };
        controlli.enabled = false;
    }

    function ritmo(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }


    // ===== 3. carica gli occhiali, scatta le miniature e crea l'elenco =====
    Occhiali.carica(3).then(function(o) {
        scena.add(o.gruppo);
        attesa.style.display = 'none';

        // le miniature: per ogni vista disegniamo la scena e la salviamo come immagine
        const fotocamera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 100);
        renderer.setSize(480, 360, false);
        vedute.forEach(function(v, i) {
            fotocamera.position.set(v.pos[0], v.pos[1], v.pos[2]);
            fotocamera.lookAt(0, 0, 0);
            renderer.render(scena, fotocamera);

            const bottone = document.createElement('button');
            bottone.className = 'veduta' + (i === 0 ? ' scelta' : '');
            const img = document.createElement('img');
            img.src = renderer.domElement.toDataURL('image/png');
            img.alt = '';
            const nome = document.createElement('span');
            nome.textContent = v.nome;
            bottone.appendChild(img);
            bottone.appendChild(nome);
            bottone.addEventListener('click', function() {
                elenco.querySelectorAll('.veduta').forEach(function(b) { b.classList.remove('scelta'); });
                bottone.classList.add('scelta');
                vaiA(v.pos);
            });
            elenco.appendChild(bottone);
        });
        ridimensiona();
    }).catch(function(errore) {
        console.error(errore);
        attesa.textContent = 'Apri il sito con Live Server per vedere il modello.';
    });


    // ===== 4. ogni fotogramma =====
    let ultimo = performance.now();
    function anima(adesso) {
        requestAnimationFrame(anima);
        const dt = Math.min((adesso - ultimo) / 1000, 0.05);
        ultimo = adesso;

        if (viaggio) {
            viaggio.t = Math.min(viaggio.t + dt / 1.1, 1);
            const k = ritmo(viaggio.t);
            const s = new THREE.Spherical(
                viaggio.da.radius + (viaggio.a.radius - viaggio.da.radius) * k,
                viaggio.da.phi + (viaggio.a.phi - viaggio.da.phi) * k,
                viaggio.da.theta + viaggio.diffTheta * k
            );
            camera.position.setFromSpherical(s);
            camera.lookAt(0, 0, 0);
            if (viaggio.t >= 1) { viaggio = null; controlli.enabled = true; }
        }
        controlli.update();
        renderer.render(scena, camera);
    }
    requestAnimationFrame(anima);

})();
