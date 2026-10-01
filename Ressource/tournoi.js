/* Moteur de tournoi générique : phases de groupes, puis Upper/Lower Bracket.
   Les éléments sont des chaînes uniques (nom de musique, de Pokémon...).
   P = éléments par groupe, Q = qualifiés par groupe (1 à P-1),
   X = "Xème de finale" (le tableau démarre à X × 2 éléments EXACTEMENT : la dernière phase de groupes
   ajuste le nombre de qualifiés pour tomber pile sur X × 2),
   Y = points par victoire, Z = points perdus par défaite,
   tableau = false : pas d'Upper/Lower Bracket, les phases de groupes continuent jusqu'à un seul gagnant
   (avec P = 2 : 1 contre 1 pur). Sans tableau, le titre indique le stade (16ème, 8ème, quart, demi, finale).
   rapide = true : chaque groupe est affiché en entier et on clique sur le meilleur (puis le suivant s'il y a
   plusieurs qualifiés), pas de 1 contre 1 répétés.
   snapshot() donne l'état à sauvegarder : uniquement les éléments NON éliminés
   (liste unique en phase de groupes ; listes Upper et Lower séparées dans le tableau).
   podium : une fois le tournoi fini (tableau activé), { premier, deuxieme, troisieme } :
   1er = gagnant, 2e = perdant de la finale des finales, 3e = perdant de la finale du Lower Bracket.
   Reprise : create(items, params, onEliminate, reprise) avec un ancien snapshot adapté.
   Choix du tableau : si, à la dernière phase de groupes, les qualifiés prévus (Q par groupe) sont moins nombreux
   que les X × 2 éléments voulus, le moteur s'arrête sur un « duel » spécial { kind: 'choix', X, cible, naturel, options }.
   On répond avec t.choose({ action: 'monter' }) (on garde X et on qualifie des éléments en plus)
   ou t.choose({ action: 'changer', X: nouveauX }). t.X donne le X en cours (à sauvegarder avec les réglages).
   ChoixTableau.ouvrir(d, rappel) affiche le pop-up correspondant et appelle rappel(reponse). */
const Tournoi = (() => {
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
  const stageName = s => s <= 2 ? 'Finale' : s === 4 ? 'Demi-finale' : s === 8 ? 'Quart de finale' : `${s / 2}ème de finale`;
  const split = (l, P) => { const g = Math.ceil(l.length / P), out = Array.from({ length: g }, () => []); l.forEach((x, i) => out[i % g].push(x)); return out; };
  const pairsOf = l => { const pairs = []; for (let i = 0; i + 1 < l.length; i += 2) pairs.push([l[i], l[i + 1]]); return { pairs, rest: l.length % 2 ? [l[l.length - 1]] : [] }; };
  const dropPairs = (lb, drops) => { const n = Math.min(lb.length, drops.length); return { pairs: Array.from({ length: n }, (_, i) => [lb[i], drops[i]]), rest: [...lb.slice(n), ...drops.slice(n)] }; };

  function create(items, { P = 4, Q = 1, X = 8, Y = 3, Z = 0, tableau = true, rapide = false } = {}, onEliminate = () => {}, reprise = null) {
    const dead = new Set();
    const elim = m => { dead.add(m); onEliminate(m); };
    let cible = tableau ? 2 * X : 1; // nombre d'éléments voulus à la fin des phases de groupes (X peut changer via le pop-up)
    let troisieme = (reprise && reprise.troisieme) || null, deuxieme = (reprise && reprise.deuxieme) || null;
    let ck = { etape: 'groupes', phase: 1, gs: [[...items]], qs: [1], g0: 0, g: 0, winners: [] };

    // Qualifiés par groupe : Q (au plus taille-1). Si le total tombe SOUS la cible, on ajoute des qualifiés
    // (répartis entre les groupes) pour que le tableau démarre pile au stade choisi.
    const quotas = (gs, visee) => {
      const q = gs.map(g => Math.max(1, Math.min(Q, g.length - 1)));
      let manque = visee - q.reduce((a, b) => a + b, 0);
      while (manque > 0) {
        let bouge = false;
        for (let i = 0; i < q.length && manque > 0; i++) if (q[i] < gs[i].length) { q[i]++; manque--; bouge = true; }
        if (!bouge) break;
      }
      return q;
    };

    function* play(pairs, meta) {
      const winners = [], losers = [];
      for (let i = 0; i < pairs.length; i++) {
        const [a, b] = pairs[i];
        const w = yield { ...meta, a, b, n: i + 1, total: pairs.length };
        winners.push(w); losers.push(w === a ? b : a);
      }
      return { winners, losers };
    }

    // Tous contre tous ; renvoie les q premiers.
    // Égalité à la frontière des qualifiés : les ex aequo rejouent entre eux (départage) pour les places restantes.
    function* group(members, q, ctx) {
      if (q >= members.length) return [...members];
      if (rapide) {
        const rest = [...members], out = [];
        for (let i = 0; i < q; i++) {
          const w = yield { kind: 'group', ...ctx, membres: [...rest], n: i + 1, total: q };
          out.push(w); rest.splice(rest.indexOf(w), 1);
        }
        return out;
      }
      const sc = Object.fromEntries(members.map(m => [m, 0]));
      const duels = [];
      members.forEach((a, i) => members.slice(i + 1).forEach(b => duels.push([a, b])));
      const list = shuffle(duels);
      for (let i = 0; i < list.length; i++) {
        const [a, b] = list[i];
        const w = yield { kind: 'group', ...ctx, a, b, n: i + 1, total: list.length, scores: { ...sc } };
        sc[w] += Y; sc[w === a ? b : a] -= Z;
      }
      const niveaux = [...new Set(members.map(m => sc[m]))].sort((a, b) => b - a);
      const out = [];
      for (const v of niveaux) {
        const places = q - out.length;
        if (places <= 0) break;
        const egaux = members.filter(m => sc[m] === v);
        if (egaux.length <= places) out.push(...egaux);
        else out.push(...(yield* group(egaux, places, { ...ctx, tiebreak: true })));
      }
      return out;
    }

    function* lower(pairs, stage) {
      const res = yield* play(pairs, { kind: 'bracket', side: 'Lower Bracket', stage });
      res.losers.forEach(elim);
      if (res.losers.length) troisieme = res.losers[res.losers.length - 1]; // le dernier match du Lower = la finale du Lower
      return res;
    }

    function* run() {
      if (reprise && reprise.etape === 'termine') return reprise.champion;
      let ub, lb, r;
      if (reprise && reprise.etape === 'bracket') {
        ub = [...reprise.ub]; lb = [...reprise.lb]; r = reprise.r || 0;
      } else {
        let pool = shuffle(items), phase = (reprise && reprise.phase) || 1;
        let reste = reprise && reprise.etape === 'groupes' && reprise.restants ? reprise : null;
        while (reste || (pool.length > Math.max(cible, 1) && pool.length > 1)) {
          let gs, qs, winners, g0, debut;
          if (reste) { // reprise en plein milieu d'une phase : groupes déjà joués conservés
            gs = reste.restants.map(g => [...g]); winners = [...reste.gagnants];
            g0 = reste.fait != null ? reste.fait : winners.length;
            qs = reste.quotas ? [...reste.quotas] : quotas(gs, 0);
            debut = reste.debut || winners.length + gs.flat().length; reste = null;
          } else {
            gs = split(pool, P); winners = []; g0 = 0; debut = pool.length;
            qs = quotas(gs, 0); // qualifiés « naturels » : Q par groupe, sans complément
            const naturel = qs.reduce((a, b) => a + b, 0);
            if (tableau && naturel < cible) { // le tableau ne tomberait pas pile : on demande à l'utilisateur
              const options = [16, 8, 4, 2].filter(x => x !== X && 2 * x <= pool.length)
                .map(x => ({ X: x, cible: 2 * x, ecart: 2 * x - naturel }))
                .sort((a, b) => Math.abs(a.ecart) - Math.abs(b.ecart) || b.X - a.X);
              ck = { etape: 'groupes', phase, gs, qs, g0, g: 0, winners, debut };
              const rep = yield { kind: 'choix', X, cible, naturel, total: pool.length, options };
              if (rep && rep.action === 'changer' && rep.X) { X = rep.X; cible = 2 * X; }
            }
            qs = quotas(gs, cible);
          }
          const stade = !tableau && debut <= 32 ? stageName(pow2(debut)) : '';
          ck = { etape: 'groupes', phase, gs, qs, g0, g: 0, winners, debut };
          for (let g = 0; g < gs.length; g++) {
            const w = yield* group(gs[g], qs[g], { phase, g: g0 + g + 1, groups: g0 + gs.length, stade });
            gs[g].forEach(m => !w.includes(m) && elim(m));
            winners.push(...w); ck.g = g + 1;
          }
          pool = shuffle(winners); phase++;
        }
        if (pool.length === 1) return pool[0];
        ub = pool; lb = []; r = 0;
      }

      let stage;
      while (ub.length > 1) {
        ck = { etape: 'bracket', ub: [...ub], lb: [...lb], r };
        r++; stage = stageName(pow2(ub.length));
        let { pairs, rest } = pairsOf(ub);
        let res = yield* play(pairs, { kind: 'bracket', side: 'Upper Bracket', stage });
        ub = [...res.winners, ...rest];
        if (r === 1) lb = res.losers;
        else {
          const d = dropPairs(lb, [...res.losers].reverse());
          const r2 = yield* lower(d.pairs, stage);
          lb = [...r2.winners, ...d.rest];
        }
        if (ub.length > 1 && lb.length > 1) {
          ({ pairs, rest } = pairsOf(lb));
          res = yield* lower(pairs, stage);
          lb = [...res.winners, ...rest];
        }
      }
      while (lb.length > 1) {
        ck = { etape: 'bracket', ub: [...ub], lb: [...lb], r };
        const { pairs, rest } = pairsOf(lb);
        const res = yield* lower(pairs, 'Finale');
        lb = [...res.winners, ...rest];
      }
      ck = { etape: 'bracket', ub: [...ub], lb: [...lb], r };
      const w = yield { kind: 'bracket', side: 'Finale des finales', stage: '', a: ub[0], b: lb[0], n: 1, total: 1 };
      deuxieme = w === ub[0] ? lb[0] : ub[0];
      elim(deuxieme);
      return w;
    }

    const gen = run();
    let cur = gen.next();
    return {
      get duel() { return cur.done ? null : cur.value; },
      get X() { return X; },
      get champion() { return cur.done ? cur.value : null; },
      get podium() { return cur.done && deuxieme ? { premier: cur.value, deuxieme, troisieme } : null; },
      choose(gagnant) { cur = gen.next(gagnant); },
      snapshot() {
        if (cur.done) return { etape: 'termine', champion: cur.value, deuxieme, troisieme };
        if (ck.etape === 'groupes') {
          const restants = ck.gs.slice(ck.g).map(g => [...g]), gagnants = [...ck.winners];
          return { etape: 'groupes', phase: ck.phase, debut: ck.debut, fait: ck.g0 + ck.g, quotas: ck.qs.slice(ck.g), gagnants, restants, musiques: [...gagnants, ...restants.flat()] };
        }
        return { etape: 'bracket', upper: [...ck.ub], lower: [...ck.lb], r: ck.r, troisieme };
      }
    };
  }

  const libelle = d => d.kind === 'choix' ? 'Réglage du tableau' : d.kind === 'group'
    ? `${d.stade ? d.stade + ' · ' : ''}Phase d'élimination · Phase ${d.phase}, Groupe ${d.g} sur ${d.groups}${d.tiebreak ? ' · Départage' : ''}`
    : `${d.side}${d.stage ? ' · ' + d.stage : ''}`;

  return { create, libelle, stade: stageName };
})();

/* Export / import d'une sauvegarde JSON */
const Sauvegarde = {
  exporter(type, data, nomFichier) {
    const blob = new Blob([JSON.stringify({ type, version: 3, date: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nomFichier; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async importer(fichier, type) {
    const d = JSON.parse(await fichier.text());
    if (d.type !== type) throw new Error("Ce fichier n'est pas une sauvegarde de ce tournoi.");
    return d;
  }
};

/* Pop-up « le tableau ne tombe pas juste » : monter le nombre de qualifiés à X × 2, ou changer le stade de départ */
const ChoixTableau = {
  ouvrir(d, repondre) {
    document.querySelectorAll('dialog.popup').forEach(x => x.remove());
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const stade = x => Tournoi.stade(2 * x);
    const dlg = el('dialog', 'popup');
    dlg.setAttribute('aria-labelledby', 'popup-titre');
    dlg.addEventListener('cancel', e => e.preventDefault()); // pas de fermeture sans choisir
    const bouton = (cls, titre, detail, rep) => {
      const b = el('button', cls, titre); b.append(el('small', null, detail));
      b.onclick = () => { dlg.close(); dlg.remove(); repondre(rep); };
      return b;
    };
    const titre = el('h2', null, 'Le tableau ne tombe pas juste'); titre.id = 'popup-titre';
    const manque = d.cible - d.naturel;
    dlg.append(titre, el('p', null, `À la fin de cette phase, il y aurait ${d.naturel} qualifié(s), mais le ${stade(d.X)} démarre avec exactement ${d.cible} éléments. Que veux-tu faire ?`));
    const garder = el('div', 'choix');
    garder.append(bouton('principal', `Monter à ${d.cible} qualifiés`, `On garde le ${stade(d.X)} : ${manque} qualifié(s) de plus sont pris dans les groupes (les meilleurs suivants).`, { action: 'monter' }));
    dlg.append(garder);
    if (d.options.length) {
      const autres = el('div', 'choix');
      autres.append(el('h3', null, 'Ou changer le début du tableau'));
      d.options.forEach((o, i) => {
        const detail = o.ecart > 0 ? `${o.cible} éléments : ${o.ecart} qualifié(s) de plus sont pris dans les groupes.`
          : o.ecart === 0 ? `${o.cible} éléments : ça tombe pile, rien à ajouter.`
          : `${o.cible} éléments : une phase de groupes en plus sera jouée pour passer de ${d.naturel} à ${o.cible}.`;
        autres.append(bouton('', stade(o.X) + (i === 0 ? ' (le plus adapté)' : ''), detail, { action: 'changer', X: o.X }));
      });
      dlg.append(autres);
    }
    document.body.append(dlg);
    dlg.showModal();
  }
};