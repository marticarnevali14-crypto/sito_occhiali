// comune.js – quello che serve a tutte le sezioni del sito:
//  - carica il modello degli occhiali (una sola volta da internet, poi una copia nuova per ogni sezione)
//  - lo mette dritto (nel file è sotto sopra) e lo centra
//  - i materiali: montatura (anche tartaruga) e lente cromata sfumata
//  - riconosce le parti (lente, montatura, aste, nasello, terminali, cerniere) per l'esploso
//  - le luci, uguali in tutte le scene
//
// ATTENZIONE: il sito va aperto con Live Server (il browser non legge i .glb con il doppio clic).

window.Occhiali = (function() {

    const URL_MODELLO = 'modelli/martinacarnevali.glb';


    // ===== i colori proposti =====
    const LENTI = [
        { nome: 'Fuoco',    colori: ['#ff2bd6', '#ff6a00', '#ffe600'] },
        { nome: 'Oceano',   colori: ['#00e5ff', '#3d5afe', '#b026ff'] },
        { nome: 'Aurora',   colori: ['#39ff14', '#00e5ff', '#ff2bd6'] },
        { nome: 'Lime',     colori: ['#e6ff00', '#39ff14', '#00c2ff'] },
        { nome: 'Tramonto', colori: ['#b026ff', '#ff2bd6', '#ff6a00'] },
        { nome: 'Trasparente', colori: ['#ffffff', '#ffffff', '#ffffff'], trasparente: true }
    ];

    const MONTATURE = [
        { nome: 'Rosso',     colore: '#8f1d1d' },
        { nome: 'Nero',      colore: '#1c1c1e' },
        { nome: 'Tartaruga', colore: '#6b4a2f', tartaruga: true },
        { nome: 'Avorio',    colore: '#e8dcc4' },
        { nome: 'Blu notte', colore: '#1b2a4a' }
    ];


    // ===== le luci (uguali in tutte le scene) =====
    function luci(scena, renderer) {
        if (THREE.RoomEnvironment) {
            const pmrem = new THREE.PMREMGenerator(renderer);
            scena.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
        }
        scena.add(new THREE.HemisphereLight(0xffffff, 0x4a4540, 0.6));
        const luce = new THREE.DirectionalLight(0xffffff, 0.9);
        luce.position.set(4, 6, 4);
        scena.add(luce);
        const riempimento = new THREE.DirectionalLight(0xffffff, 0.3);
        riempimento.position.set(-5, 2, -3);
        scena.add(riempimento);
        const basso = new THREE.DirectionalLight(0xfff4e6, 0.3);
        basso.position.set(1, -5, 3);
        scena.add(basso);
        return luce;
    }


    // ===== il materiale della montatura (con il pattern tartaruga) =====
    // Il pattern lo disegna la scheda video con un "rumore" (noise): macchie scure e ambrate.
    const codiceRumore = `
        uniform float uTartaruga;
        varying vec3 vPosModello;
        float caso(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float rumore(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(caso(i), caso(i + vec3(1.0,0.0,0.0)), f.x),
                           mix(caso(i + vec3(0.0,1.0,0.0)), caso(i + vec3(1.0,1.0,0.0)), f.x), f.y),
                       mix(mix(caso(i + vec3(0.0,0.0,1.0)), caso(i + vec3(1.0,0.0,1.0)), f.x),
                           mix(caso(i + vec3(0.0,1.0,1.0)), caso(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
        }
        float rumoreFine(vec3 p) {
            float r = 0.0, a = 0.5;
            for (int k = 0; k < 4; k++) { r += a * rumore(p); p *= 2.1; a *= 0.5; }
            return r;
        }
    `;
    const codiceTartaruga = `
        if (uTartaruga > 0.5) {
            vec3 p = vPosModello * vec3(90.0, 220.0, 90.0);
            float n = rumoreFine(p + rumoreFine(p * 0.7) * 1.5);
            vec3 c = mix(vec3(0.36, 0.18, 0.05), vec3(0.17, 0.075, 0.02), smoothstep(0.32, 0.46, n));
            c = mix(c, vec3(0.025, 0.01, 0.004), smoothstep(0.46, 0.56, n));
            diffuseColor.rgb = c;
        }
    `;
    let contatore = 0;

    function materialeMontatura(colore) {
        const mat = new THREE.MeshPhysicalMaterial({
            color: colore, roughness: 0.4, metalness: 0,
            clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.6,
            side: THREE.DoubleSide
        });
        mat.userData.tartaruga = { value: 0 };
        const chiave = 'montatura-' + (contatore++);
        mat.customProgramCacheKey = function() { return chiave; };   // ogni montatura ha il suo interruttore
        mat.onBeforeCompile = function(shader) {
            shader.uniforms.uTartaruga = mat.userData.tartaruga;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\n varying vec3 vPosModello;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\n vPosModello = position;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\n' + codiceRumore)
                .replace('#include <color_fragment>', '#include <color_fragment>\n' + codiceTartaruga);
        };
        return mat;
    }

    function coloraMontatura(mat, scelta) {
        mat.color.set(scelta.colore);
        mat.userData.tartaruga.value = scelta.tartaruga ? 1 : 0;
    }


    // ===== il materiale della lente: cromata (a specchio) e sfumata =====
    // La sfumatura è fatta con i "vertex colors": ogni punto della lente ha il suo colore.
    function materialeLente() {
        const mat = new THREE.MeshPhysicalMaterial({
            color: '#ffffff', vertexColors: true,
            metalness: 0.75, roughness: 0.08,
            clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3,
            emissive: '#ffffff', emissiveIntensity: 0.35,
            transparent: true, opacity: 0.88, depthWrite: false,
            side: THREE.DoubleSide
        });
        // la luce propria prende il colore della sfumatura (così i colori restano fluo)
        mat.onBeforeCompile = function(shader) {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;'
            );
        };
        return mat;
    }

    // scelta = uno dei LENTI
    function coloraLente(mat, pezzi, scelta) {
        mat.metalness = scelta.trasparente ? 0 : 0.75;
        mat.opacity = scelta.trasparente ? 0.3 : 0.88;
        mat.emissiveIntensity = scelta.trasparente ? 0 : 0.35;
        mat.envMapIntensity = scelta.trasparente ? 0.7 : 1.3;

        const c = scelta.colori.map(function(x) { return new THREE.Color(x); });
        const box = new THREE.Box3();
        pezzi.forEach(function(p) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); });
        const larghezza = box.max.x - box.min.x, altezza = box.max.y - box.min.y;
        const tinta = new THREE.Color();

        pezzi.forEach(function(pezzo) {
            const pos = pezzo.geometry.attributes.position;
            const colori = new Float32Array(pos.count * 3);
            for (let i = 0; i < pos.count; i++) {
                // dall'alto in basso (70%) e un po' in diagonale (30%)
                const t = 0.7 * (pos.getY(i) - box.min.y) / altezza + 0.3 * (pos.getX(i) - box.min.x) / larghezza;
                if (t < 0.5) tinta.copy(c[0]).lerp(c[1], t * 2);
                else tinta.copy(c[1]).lerp(c[2], (t - 0.5) * 2);
                colori[i * 3] = tinta.r; colori[i * 3 + 1] = tinta.g; colori[i * 3 + 2] = tinta.b;
            }
            pezzo.geometry.setAttribute('color', new THREE.BufferAttribute(colori, 3));
        });
    }


    // ===== le aste nelle cerniere: un gruppo vuoto nel punto dove l'asta si attacca =====
    function mettiInCerniera(grezzo, asta, lato) {
        const box = new THREE.Box3().setFromObject(asta);
        const perno = new THREE.Vector3(
            lato > 0 ? box.max.x - 0.0015 : box.min.x + 0.0015,
            (box.min.y + box.max.y) / 2,
            box.max.z - 0.0015
        );
        const cerniera = new THREE.Group();
        cerniera.position.copy(perno);
        grezzo.add(cerniera);
        asta.position.sub(perno);
        cerniera.add(asta);
        return cerniera;
    }


    // ===== carica: ogni chiamata dà una copia nuova e indipendente degli occhiali =====
    let datiPromessa = null;
    function scaricaDati() {
        if (!datiPromessa) {
            datiPromessa = new Promise(function(ok, ko) {
                const l = new THREE.FileLoader();
                l.setResponseType('arraybuffer');
                l.load(URL_MODELLO, ok, undefined, ko);
            });
        }
        return datiPromessa;
    }

    function carica(larghezza) {
        return scaricaDati().then(function(dati) {
            return new Promise(function(ok, ko) {
                new THREE.GLTFLoader().parse(dati, '', function(gltf) { ok(prepara(gltf.scene, larghezza || 3)); }, ko);
            });
        });
    }

    function prepara(grezzo, larghezza) {
        const lente = materialeLente();
        const montatura = materialeMontatura('#8f1d1d');
        const metallo = new THREE.MeshStandardMaterial({ color: '#b9b4aa', metalness: 0.8, roughness: 0.35, envMapIntensity: 0.6 });
        const pezziLente = [];

        grezzo.traverse(function(p) {
            if (!p.isMesh) return;
            p.castShadow = true;
            p.receiveShadow = true;
            const nome = p.material.name;
            if (nome === 'Plastic') {
                p.material = lente;
                p.castShadow = false;
                p.renderOrder = 1;
                pezziLente.push(p);
            } else if (nome === 'stanghette') {
                if (p.material.normalMap && !montatura.normalMap) {
                    montatura.normalMap = p.material.normalMap;   // il rilievo leggero del file
                    montatura.normalScale.set(0.1, 0.1);
                }
                p.material = montatura;
            } else {
                p.material = metallo;
                p.userData.metallo = true;
            }
        });

        // ----- riconosce le parti dalla loro forma (nel file non hanno nome) -----
        const boxLente = new THREE.Box3();
        pezziLente.forEach(function(p) { boxLente.expandByObject(p); });
        const centroLente = boxLente.getCenter(new THREE.Vector3());

        const parti = grezzo.children.slice().map(function(oggetto) {
            const box = new THREE.Box3().setFromObject(oggetto);
            const m = box.getSize(new THREE.Vector3());
            const c = box.getCenter(new THREE.Vector3());
            let haLente = false, tuttoMetallo = true;
            oggetto.traverse(function(p) {
                if (p.isMesh) {
                    if (p.material === lente) haLente = true;
                    if (!p.userData.metallo) tuttoMetallo = false;
                }
            });
            const dx = c.x - centroLente.x;
            let categoria;
            if (haLente) categoria = 'lente';
            else if (m.z > 0.08) categoria = 'asta';
            else if (m.x > 0.12) categoria = 'montatura';
            else if (tuttoMetallo) categoria = 'vite';
            else if (Math.abs(dx) < 0.025) categoria = 'nasello';
            else if (m.y < 0.03) categoria = 'cerniera';
            else categoria = 'terminale';
            return { oggetto: oggetto, categoria: categoria, box: box, centro: c, lato: dx > 0 ? 1 : -1 };
        });

        // le aste dentro le loro cerniere (la parte che si muove diventa la cerniera)
        const cerniere = {};
        parti.filter(function(p) { return p.categoria === 'asta'; }).forEach(function(p) {
            const cerniera = mettiInCerniera(grezzo, p.oggetto, p.lato);
            p.asta = p.oggetto;
            p.oggetto = cerniera;
            if (p.lato > 0) cerniere.destra = cerniera; else cerniere.sinistra = cerniera;
        });

        // ----- dritti e centrati -----
        grezzo.rotation.z = Math.PI;   // nel file sono sotto sopra: mezzo giro, il frontale resta davanti
        const corpo = new THREE.Group();
        corpo.add(grezzo);
        corpo.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(corpo);
        const scala = larghezza / (box.max.x - box.min.x);
        corpo.scale.setScalar(scala);
        corpo.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scala);
        const gruppo = new THREE.Group();
        gruppo.add(corpo);

        // colori di partenza: montatura rossa, lente cromata "Fuoco"
        coloraMontatura(montatura, MONTATURE[0]);
        coloraLente(lente, pezziLente, LENTI[0]);

        return {
            gruppo: gruppo,               // da mettere nella scena: dritto, centrato, largo "larghezza"
            grezzo: grezzo,               // il modello nelle misure del file (in metri)
            parti: parti,
            cerniere: cerniere,
            lente: lente, pezziLente: pezziLente,
            montatura: montatura
        };
    }

    return {
        LENTI: LENTI,
        MONTATURE: MONTATURE,
        luci: luci,
        carica: carica,
        coloraMontatura: coloraMontatura,
        coloraLente: coloraLente
    };
})();
