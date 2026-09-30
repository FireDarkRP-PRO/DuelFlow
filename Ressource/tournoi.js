/* Moteur de tournoi générique : phases de groupes, puis Upper/Lower Bracket.
   Les éléments sont des chaînes uniques (nom de musique, de Pokémon...).
   P = éléments par groupe, X = "Xème de finale" (le tableau démarre à X × 2),
   Y = points par victoire, Z = points perdus par défaite,
   tableau = false : pas d'Upper/Lower Bracket, les phases de groupes continuent jusqu'à un seul gagnant
   (avec P = 2 : 1 contre 1 pur). Sans tableau, le titre indique le stade (16ème, 8ème, quart, demi, finale).
   rapide = true : chaque groupe est affiché en entier et on clique sur le meilleur (pas de 1 contre 1 répétés).
   snapshot() donne l'état à sauvegarder : uniquement les éléments NON éliminés
   (liste unique en phase de groupes ; listes Upper et Lower séparées dans le tableau).
   Reprise : create(items, params, onEliminate, reprise) avec un ancien snapshot adapté. */
   const Tournoi = (() => {
    const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
    const stageName = s => s <= 2 ? 'Finale' : s === 4 ? 'Demi-finale' : s === 8 ? 'Quart de finale' : `${s / 2}ème de finale`;
    const split = (l, P) => { const g = Math.ceil(l.length / P), out = Array.from({ length: g }, () => []); l.forEach((x, i) => out[i % g].push(x)); return out; };
    const pairsOf = l => { const pairs = []; for (let i = 0; i + 1 < l.length; i += 2) pairs.push([l[i], l[i + 1]]); return { pairs, rest: l.length % 2 ? [l[l.length - 1]] : [] }; };
    const dropPairs = (lb, drops) => { const n = Math.min(lb.length, drops.length); return { pairs: Array.from({ length: n }, (_, i) => [lb[i], drops[i]]), rest: [...lb.slice(n), ...drops.slice(n)] }; };
  
    function create(items, { P = 4, X = 8, Y = 3, Z = 0, tableau = true, rapide = false } = {}, onEliminate = () => {}, reprise = null) {
      const dead = new Set();
      const elim = m => { dead.add(m); onEliminate(m); };
      let ck = { etape: 'groupes', phase: 1, gs: [[...items]], g0: 0, g: 0, winners: [] };
  
      function* play(pairs, meta) {
        const winners = [], losers = [];
        for (let i = 0; i < pairs.length; i++) {
          const [a, b] = pairs[i];
          const w = yield { ...meta, a, b, n: i + 1, total: pairs.length };
          winners.push(w); losers.push(w === a ? b : a);
        }
        return { winners, losers };
      }
  
      // Tous contre tous. Égalité en tête : les ex aequo rejouent entre eux (départage).
      function* group(members, ctx) {
        if (members.length === 1) return members[0];
        if (rapide) return yield { kind: 'group', ...ctx, membres: [...members], n: 1, total: 1 };
        const sc = Object.fromEntries(members.map(m => [m, 0]));
        const duels = [];
        members.forEach((a, i) => members.slice(i + 1).forEach(b => duels.push([a, b])));
        const list = shuffle(duels);
        for (let i = 0; i < list.length; i++) {
          const [a, b] = list[i];
          const w = yield { kind: 'group', ...ctx, a, b, n: i + 1, total: list.length, scores: { ...sc } };
          sc[w] += Y; sc[w === a ? b : a] -= Z;
        }
        const top = Math.max(...members.map(m => sc[m]));
        const tied = members.filter(m => sc[m] === top);
        return tied.length > 1 ? yield* group(tied, { ...ctx, tiebreak: true }) : tied[0];
      }
  
      function* lower(pairs, stage) {
        const res = yield* play(pairs, { kind: 'bracket', side: 'Lower Bracket', stage });
        res.losers.forEach(elim);
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
          while (reste || ((!tableau || pool.length > 2 * X) && pool.length > 1)) {
            let gs, winners, g0, debut;
            if (reste) { // reprise en plein milieu d'une phase : groupes déjà joués conservés
              gs = reste.restants.map(g => [...g]); winners = [...reste.gagnants]; g0 = winners.length; debut = reste.debut || winners.length + gs.flat().length; reste = null;
            } else { gs = split(pool, P); winners = []; g0 = 0; debut = pool.length; }
            const stade = !tableau && debut <= 32 ? stageName(pow2(debut)) : '';
            ck = { etape: 'groupes', phase, gs, g0, g: 0, winners, debut };
            for (let g = 0; g < gs.length; g++) {
              const w = yield* group(gs[g], { phase, g: g0 + g + 1, groups: g0 + gs.length, stade });
              gs[g].forEach(m => m !== w && elim(m));
              winners.push(w); ck.g = g + 1;
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
        elim(w === ub[0] ? lb[0] : ub[0]);
        return w;
      }
  
      const gen = run();
      let cur = gen.next();
      return {
        get duel() { return cur.done ? null : cur.value; },
        get champion() { return cur.done ? cur.value : null; },
        choose(gagnant) { cur = gen.next(gagnant); },
        snapshot() {
          if (cur.done) return { etape: 'termine', champion: cur.value };
          if (ck.etape === 'groupes') {
            const restants = ck.gs.slice(ck.g).map(g => [...g]), gagnants = [...ck.winners];
            return { etape: 'groupes', phase: ck.phase, debut: ck.debut, gagnants, restants, musiques: [...gagnants, ...restants.flat()] };
          }
          return { etape: 'bracket', upper: [...ck.ub], lower: [...ck.lb], r: ck.r };
        }
      };
    }
  
    const libelle = d => d.kind === 'group'
      ? `${d.stade ? d.stade + ' · ' : ''}Phase d'élimination · Phase ${d.phase}, Groupe ${d.g} sur ${d.groups}${d.tiebreak ? ' · Départage' : ''}`
      : `${d.side}${d.stage ? ' · ' + d.stage : ''}`;
  
    return { create, libelle };
  })();
  
  /* Export / import d'une sauvegarde JSON */
  const Sauvegarde = {
    exporter(type, data, nomFichier) {
      const blob = new Blob([JSON.stringify({ type, version: 2, date: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
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