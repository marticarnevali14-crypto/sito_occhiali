// prova.js – l'ultima sezione: prova gli occhiali con la fotocamera
// La fotocamera si accende solo quando si preme il bottone.
// MediaPipe Face Landmarker (di Google) trova il volto, e gli occhiali 3D vengono messi
// sul naso, all'altezza delle pupille, larghi quanto il viso, girati come la testa.
// A destra: foto, misura, colori della lente e della montatura.
//
// ATTENZIONE: la fotocamera funziona solo con Live Server ("localhost" è considerato sicuro).

(function() {

    const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const MODELLO_VOLTO = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

    const schermo = document.querySelector('#prova-schermo');
    const video = document.querySelector('#prova-video');
    const canvas = document.querySelector('#prova-canvas');
    const messaggio = document.querySelector('#prova-messaggio');
    const bottoneAccendi = document.querySelector('#prova-accendi');
    const bottoneSpegni = document.querySelector('#prova-spegni');
    const bottoneFoto = document.querySelector('#prova-foto');
    const slider = document.querySelector('#prova-misura');
    const valoreMisura = document.querySelector('#prova-valore-misura');
    const campioniLente = document.querySelector('#prova-lenti');
    const campioniMontatura = document.querySelector('#prova-montature');
    const nomeLente = document.querySelector('#prova-nome-lente');
    const nomeMontatura = document.querySelector('#prova-nome-montatura');
    const scatto = document.querySelector('#prova-scatto');
    const anteprima = document.querySelector('#prova-anteprima');
    const scarica = document.querySelector('#prova-scarica');


    // ===== 1. la scena 3D sopra il video =====
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    const scena = new THREE.Scene();
    Occhiali.luci(scena, renderer);

    // camera "ortografica" grande quanto il video, in pixel: (0,0) in basso a sinistra.
    // Così un pixel del video = un'unità della scena e niente viene deformato.
    const camera = new THREE.OrthographicCamera(0, 640, 480, 0, -5000, 5000);

    const sulVolto = new THREE.Group();   // segue la testa
    sulVolto.visible = false;
    scena.add(sulVolto);

    // una testa invisibile: copre le aste quando girano dietro la testa
    const testa = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
    testa.scale.set(0.44, 0.7, 0.62);
    testa.position.set(0, -0.1, -0.74);
    testa.renderOrder = -1;
    sulVolto.add(testa);

    let modello = null;   // quello che restituisce Occhiali.carica (con materiali e lente)


    // ===== 2. carica gli occhiali e li prepara per il volto =====
    Occhiali.carica(3).then(function(o) {
        modello = o;
        const occhiale = new THREE.Group();
        occhiale.add(o.gruppo);
        occhiale.updateMatrixWorld(true);

        // misuriamo solo il FRONTALE (lente e montatura), non le aste che vanno indietro
        const box = new THREE.Box3().setFromObject(occhiale);
        const profondita = box.max.z - box.min.z;
        const frontale = new THREE.Box3();
        o.gruppo.traverse(function(p) {
            if (!p.isMesh) return;
            const b = new THREE.Box3().setFromObject(p);
            if ((b.min.z + b.max.z) / 2 >= box.max.z - profondita * 0.35) frontale.union(b);
        });
        if (frontale.isEmpty()) frontale.copy(box);

        // il centro del frontale va nel punto zero, e la sua larghezza diventa 1.
        // La stessa scala su tutti gli assi: gli occhiali non si deformano mai
        const s = 1 / (frontale.max.x - frontale.min.x);
        const centro = frontale.getCenter(new THREE.Vector3());
        // il frontale (la parte più avanti) un filo davanti al punto zero
        o.gruppo.position.set(-centro.x, -centro.y, -(box.max.z - 0.06));
        occhiale.scale.setScalar(s);
        sulVolto.add(occhiale);

        creaCampioni();
    }).catch(function(errore) {
        console.error(errore);
        mostraMessaggio('Apri il sito con Live Server per vedere il modello.');
    });


    // ===== 3. i colori: icone per la lente e per la montatura =====
    function creaCampioni() {
        Occhiali.LENTI.forEach(function(scelta, i) {
            const b = document.createElement('button');
            b.className = 'campione' + (i === 0 ? ' scelto' : '');
            b.style.background = 'linear-gradient(135deg, ' + scelta.colori.join(', ') + ')';
            if (scelta.trasparente) b.classList.add('campione-trasparente');
            b.title = scelta.nome;
            b.setAttribute('aria-label', 'Lente ' + scelta.nome);
            b.addEventListener('click', function() {
                Occhiali.coloraLente(modello.lente, modello.pezziLente, scelta);
                segna(campioniLente, b);
                nomeLente.textContent = scelta.nome;
            });
            campioniLente.appendChild(b);
        });

        Occhiali.MONTATURE.forEach(function(scelta, i) {
            const b = document.createElement('button');
            b.className = 'campione' + (i === 0 ? ' scelto' : '');
            b.style.background = scelta.tartaruga
                ? 'radial-gradient(circle at 30% 35%, #170a04 0 18%, transparent 30%), radial-gradient(circle at 70% 65%, #170a04 0 14%, transparent 26%), radial-gradient(circle at 65% 25%, #5e300d 0 12%, transparent 22%), #9e5c1f'
                : scelta.colore;
            b.title = scelta.nome;
            b.setAttribute('aria-label', 'Montatura ' + scelta.nome);
            b.addEventListener('click', function() {
                Occhiali.coloraMontatura(modello.montatura, scelta);
                segna(campioniMontatura, b);
                nomeMontatura.textContent = scelta.nome;
            });
            campioniMontatura.appendChild(b);
        });
    }

    // usato dalla sezione Acquista: mette nella prova la lente e la montatura scelte
    // (clicca per noi le icone giuste, così si aggiornano anche i nomi a destra)
    window.ProvaTina = {
        applica: function(nomeLente, nomeMontatura) {
            const l = campioniLente.querySelector('[aria-label="Lente ' + nomeLente + '"]');
            const m = campioniMontatura.querySelector('[aria-label="Montatura ' + nomeMontatura + '"]');
            if (l) l.click();
            if (m) m.click();
        }
    };

    function segna(gruppo, bottone) {
        gruppo.querySelectorAll('.campione').forEach(function(x) { x.classList.remove('scelto'); });
        bottone.classList.add('scelto');
    }


    // ===== 4. la misura =====
    let misura = 1;
    slider.addEventListener('input', function() {
        misura = slider.value / 100;
        valoreMisura.textContent = slider.value + '%';
    });


    // ===== 5. accendi e spegni la fotocamera =====
    let flusso = null;
    let accesa = false;
    let riconoscitore = null;
    let promessaRiconoscitore = null;

    function mostraMessaggio(testo) {
        messaggio.textContent = testo;
        messaggio.style.display = testo ? 'block' : 'none';
    }

    bottoneAccendi.addEventListener('click', accendi);
    bottoneSpegni.addEventListener('click', spegni);

    function accendi() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            mostraMessaggio('Da qui il browser non può usare la fotocamera: apri il sito con Live Server.');
            return;
        }
        bottoneAccendi.style.display = 'none';
        mostraMessaggio('Accensione della fotocamera…');

        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
            .then(function(stream) {
                flusso = stream;
                video.srcObject = stream;
                return video.play();
            })
            .then(function() {
                accesa = true;
                schermo.classList.add('accesa');
                bottoneSpegni.disabled = false;
                bottoneFoto.disabled = false;
                // la scena 3D prende la misura vera del video
                const w = video.videoWidth, h = video.videoHeight;
                renderer.setSize(w, h, false);
                camera.right = w;
                camera.top = h;
                camera.updateProjectionMatrix();
                mostraMessaggio('Caricamento del riconoscimento del volto…');
                return preparaRiconoscitore();
            })
            .then(function() {
                if (accesa) mostraMessaggio('Guarda la fotocamera.');
            })
            .catch(function(errore) {
                console.error(errore);
                if (errore && errore.name === 'NotAllowedError') {
                    mostraMessaggio('Per provare gli occhiali serve il permesso di usare la fotocamera.');
                } else if (flusso && !riconoscitore) {
                    mostraMessaggio('Non riesco a caricare il riconoscimento del volto (serve internet).');
                } else {
                    mostraMessaggio('Non riesco ad accendere la fotocamera.');
                }
                if (!flusso) bottoneAccendi.style.display = '';
            });
    }

    function spegni() {
        accesa = false;
        if (flusso) flusso.getTracks().forEach(function(t) { t.stop(); });
        flusso = null;
        video.srcObject = null;
        sulVolto.visible = false;
        schermo.classList.remove('accesa');
        bottoneAccendi.style.display = '';
        bottoneSpegni.disabled = true;
        bottoneFoto.disabled = true;
        mostraMessaggio('');
    }

    function preparaRiconoscitore() {
        if (!promessaRiconoscitore) {
            promessaRiconoscitore = import(MEDIAPIPE + '/vision_bundle.mjs').then(function(mp) {
                return mp.FilesetResolver.forVisionTasks(MEDIAPIPE + '/wasm').then(function(fileset) {
                    function crea(delegate) {
                        return mp.FaceLandmarker.createFromOptions(fileset, {
                            baseOptions: { modelAssetPath: MODELLO_VOLTO, delegate: delegate },
                            runningMode: 'VIDEO',
                            numFaces: 1,
                            outputFacialTransformationMatrixes: true   // anche la rotazione della testa
                        });
                    }
                    return crea('GPU').catch(function() { return crea('CPU'); });
                });
            }).then(function(r) { riconoscitore = r; return r; });
        }
        return promessaRiconoscitore;
    }


    // ===== 6. ogni fotogramma: trova il volto e mette gli occhiali =====
    const punto = new THREE.Vector3();
    const misuraVettore = new THREE.Vector3();
    const rotazione = new THREE.Quaternion();
    const matrice = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3(), tmpScala = new THREE.Vector3();
    let ultimoTempoVideo = -1;
    let senzaVolto = 0;
    let primaVolta = true;

    function media(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }; }

    function anima() {
        requestAnimationFrame(anima);
        if (!accesa) return;

        if (riconoscitore && video.readyState >= 2 && video.currentTime !== ultimoTempoVideo) {
            ultimoTempoVideo = video.currentTime;
            const risultato = riconoscitore.detectForVideo(video, performance.now());
            const w = video.videoWidth, h = video.videoHeight;

            if (risultato.faceLandmarks && risultato.faceLandmarks.length > 0) {
                const p = risultato.faceLandmarks[0];
                // i punti del volto (MediaPipe ne trova 478):
                //   168 = la radice del naso, dove appoggia il ponte
                //   468 e 473 = il centro delle pupille (se mancano: tra gli angoli degli occhi)
                //   127 e 356 = i lati del viso alle tempie, dove passano le aste
                const naso = p[168];
                const occhioA = p[468] || media(p[33], p[133]);
                const occhioB = p[473] || media(p[263], p[362]);
                const latoA = p[127], latoB = p[356];

                // centro: in orizzontale sul naso, in verticale all'altezza delle pupille
                punto.set(naso.x * w, (1 - (occhioA.y + occhioB.y) / 2) * h, 0);

                // larghezza = larghezza del viso alle tempie (anche in profondità: non cambia girando la testa)
                const larghezzaViso = Math.hypot((latoA.x - latoB.x) * w, (latoA.y - latoB.y) * h, (latoA.z - latoB.z) * w);
                const larghezza = larghezzaViso * 1.02 * misura;
                misuraVettore.set(larghezza, larghezza, larghezza);   // uguale su tutti gli assi

                if (risultato.facialTransformationMatrixes && risultato.facialTransformationMatrixes.length > 0) {
                    matrice.fromArray(risultato.facialTransformationMatrixes[0].data);
                    matrice.decompose(tmpPos, rotazione, tmpScala);
                }

                // movimento morbido, senza scatti
                const k = primaVolta ? 1 : 0.5;
                sulVolto.position.lerp(punto, k);
                sulVolto.scale.lerp(misuraVettore, k);
                sulVolto.quaternion.slerp(rotazione, k);
                primaVolta = false;

                sulVolto.visible = !!modello;
                senzaVolto = 0;
                if (messaggio.style.display !== 'none') mostraMessaggio('');
            } else if (++senzaVolto > 10) {
                sulVolto.visible = false;
                primaVolta = true;
                mostraMessaggio('Guarda la fotocamera.');
            }
        }
        renderer.render(scena, camera);
    }
    anima();


    // ===== 7. la foto: video + occhiali, girati come uno specchio (come ti vedi) =====
    bottoneFoto.addEventListener('click', function() {
        if (!accesa || !video.videoWidth) return;
        const w = video.videoWidth, h = video.videoHeight;
        const foto = document.createElement('canvas');
        foto.width = w;
        foto.height = h;
        const ctx = foto.getContext('2d');
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.drawImage(canvas, 0, 0, w, h);

        const dati = foto.toDataURL('image/png');
        anteprima.src = dati;
        scarica.href = dati;
        scatto.classList.add('pronta');

        schermo.classList.remove('lampo');
        void schermo.offsetWidth;
        schermo.classList.add('lampo');
    });

})();
