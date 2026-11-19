// vendita.js – l'ultima sezione: lo stesso modello in quattro colori, con il carrello
// Le foto dei prodotti le "scatta" la pagina dal modello 3D: per ogni versione
// colora gli occhiali e fa due foto (tre quarti e di fronte).
// Il carrello è solo dimostrativo: non c'è nessun pagamento.

(function() {

    // le versioni in vendita: i nomi di lente e montatura sono quelli di comune.js
    const VERSIONI = [
        { nome: 'Eclisse',  montatura: 'Nero',      lente: 'Oceano',   prezzo: 189 },
        { nome: 'Miele',    montatura: 'Tartaruga', lente: 'Fuoco',    prezzo: 199 },
        { nome: 'Ghiaccio', montatura: 'Avorio',    lente: 'Aurora',   prezzo: 189 },
        { nome: 'Laguna',   montatura: 'Blu notte', lente: 'Lime',     prezzo: 189 }
    ];

    const griglia = document.querySelector('#prodotti');
    const lista = document.querySelector('#carrello-lista');
    const vuoto = document.querySelector('#carrello-vuoto');
    const totale = document.querySelector('#carrello-totale');
    const conta = document.querySelector('#conta-carrello');
    const cassa = document.querySelector('#carrello-cassa');
    const nota = document.querySelector('#carrello-nota');

    function euro(n) { return n.toLocaleString('it-IT') + ' €'; }


    // ===== 1. le schede dei prodotti (prima con la scritta "caricamento", poi con le foto) =====
    const schede = VERSIONI.map(function(v, i) {
        const scheda = document.createElement('article');
        scheda.className = 'prodotto';
        scheda.innerHTML =
            '<div class="prodotto-foto"><p class="attesa">Caricamento…</p></div>' +
            '<div class="prodotto-testo">' +
                '<h3></h3>' +
                '<p class="prodotto-colori"></p>' +
                '<p class="prodotto-prezzo"></p>' +
            '</div>' +
            '<div class="prodotto-bottoni">' +
                '<button class="bottone bottone-pieno prodotto-compra">Aggiungi al carrello</button>' +
                '<button class="bottone prodotto-prova">Provali</button>' +
            '</div>';
        scheda.querySelector('h3').textContent = v.nome;
        scheda.querySelector('.prodotto-colori').textContent = 'Montatura ' + v.montatura + ' · Lente ' + v.lente;
        scheda.querySelector('.prodotto-prezzo').textContent = euro(v.prezzo);

        scheda.querySelector('.prodotto-compra').addEventListener('click', function(e) {
            aggiungi(i);
            // il bottone conferma per un momento
            const b = e.currentTarget;
            b.textContent = 'Aggiunto ✓';
            setTimeout(function() { b.textContent = 'Aggiungi al carrello'; }, 1200);
        });
        scheda.querySelector('.prodotto-prova').addEventListener('click', function() {
            if (window.ProvaTina) window.ProvaTina.applica(v.lente, v.montatura);
            document.querySelector('#prova').scrollIntoView({ behavior: 'smooth' });
        });

        griglia.appendChild(scheda);
        return scheda;
    });


    // ===== 2. le foto: un renderer "nascosto" che disegna e salva le immagini =====
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(640, 480, false);
    const scena = new THREE.Scene();
    Occhiali.luci(scena, renderer);
    const camera = new THREE.PerspectiveCamera(30, 640 / 480, 0.1, 100);

    function scatta(x, y, z) {
        camera.position.set(x, y, z);
        camera.lookAt(0, -0.05, 0);
        renderer.render(scena, camera);
        return renderer.domElement.toDataURL('image/png');
    }

    function trova(lista, nome) {
        return lista.filter(function(x) { return x.nome === nome; })[0];
    }

    // le foto si fanno quando la sezione sta per arrivare sullo schermo (così l'inizio della pagina è più veloce)
    new IntersectionObserver(function(voci, osservatore) {
        if (!voci[0].isIntersecting) return;
        osservatore.disconnect();

        Occhiali.carica(3).then(function(o) {
            scena.add(o.gruppo);
            VERSIONI.forEach(function(v, i) {
                Occhiali.coloraMontatura(o.montatura, trova(Occhiali.MONTATURE, v.montatura));
                Occhiali.coloraLente(o.lente, o.pezziLente, trova(Occhiali.LENTI, v.lente));

                const treQuarti = scatta(4.6, 1.9, 5.6);
                const fronte = scatta(0, 0.4, 7.4);

                // due immagini nello stesso posto: se ne vede sempre UNA sola.
                // Cliccando, quella di lato sparisce e appare quella di fronte (e viceversa)
                const foto = schede[i].querySelector('.prodotto-foto');
                foto.innerHTML = '';
                [treQuarti, fronte].forEach(function(src, k) {
                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = k === 0 ? v.nome + ' vista di lato' : v.nome + ' vista di fronte';
                    img.className = k === 0 ? 'foto-lato' : 'foto-fronte';
                    foto.appendChild(img);
                });
                foto.addEventListener('click', function() { foto.classList.toggle('di-fronte'); });
            });
            renderer.dispose();   // finite le foto, il renderer non serve più
        }).catch(function(errore) {
            console.error(errore);
            schede.forEach(function(s) { s.querySelector('.attesa').textContent = 'Apri il sito con Live Server.'; });
        });
    }, { rootMargin: '400px' }).observe(griglia);


    // ===== 3. il carrello =====
    const carrello = [];   // { indice, quantita }

    function aggiungi(i) {
        const riga = carrello.filter(function(r) { return r.indice === i; })[0];
        if (riga) riga.quantita++;
        else carrello.push({ indice: i, quantita: 1 });
        aggiorna();
    }

    function togli(i) {
        const k = carrello.findIndex(function(r) { return r.indice === i; });
        if (k < 0) return;
        carrello[k].quantita--;
        if (carrello[k].quantita <= 0) carrello.splice(k, 1);
        aggiorna();
    }

    function aggiorna() {
        lista.innerHTML = '';
        let somma = 0, pezzi = 0;
        carrello.forEach(function(r) {
            const v = VERSIONI[r.indice];
            somma += v.prezzo * r.quantita;
            pezzi += r.quantita;

            const li = document.createElement('li');
            li.innerHTML =
                '<span class="riga-nome"></span>' +
                '<span class="riga-quantita">' +
                    '<button class="riga-meno" aria-label="Togli uno">−</button>' +
                    '<span></span>' +
                    '<button class="riga-piu" aria-label="Aggiungi uno">+</button>' +
                '</span>' +
                '<span class="riga-prezzo"></span>';
            li.querySelector('.riga-nome').textContent = v.nome;
            li.querySelector('.riga-quantita span').textContent = r.quantita;
            li.querySelector('.riga-prezzo').textContent = euro(v.prezzo * r.quantita);
            li.querySelector('.riga-meno').addEventListener('click', function() { togli(r.indice); });
            li.querySelector('.riga-piu').addEventListener('click', function() { aggiungi(r.indice); });
            lista.appendChild(li);
        });

        totale.textContent = euro(somma);
        conta.textContent = pezzi;
        conta.classList.toggle('piena', pezzi > 0);
        vuoto.style.display = pezzi ? 'none' : 'block';
        cassa.disabled = pezzi === 0;
        nota.classList.remove('visibile');
    }

    document.querySelector('#carrello-svuota').addEventListener('click', function() {
        carrello.length = 0;
        aggiorna();
    });

    // sito dimostrativo: la cassa mostra solo un avviso, non chiede nessun dato
    cassa.addEventListener('click', function() {
        nota.classList.add('visibile');
    });

    aggiorna();

})();
