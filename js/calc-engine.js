/* ============================================================================
   DFC Combat Calculator engine
   ----------------------------------------------------------------------------
   A faithful vanilla-JS port of the Dropfleet Commander 2nd-edition damage
   calculator originally written in Python (Anvil/Skulpt) by the author of
   everlasting-flawless-engineering.anvil.app. The math is closed-form: every
   reachable combination of hits, crits, saves, shields, aegis dice and reroll
   allocations has its probability computed exactly and summed. No dice are
   simulated.

   All probabilities are exact rationals (Fr, a BigInt-backed fraction), so the
   output matches the reference engine to the exact rational number. Validated
   against scripts/calc-oracle.json (779 cases) plus the published acceptance
   tests. See scripts/test-calc-engine.mjs.

   Exposed as window.DFCCalc. Pure logic, no DOM.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- exact-rational arithmetic (BigInt) ---------------------------------- */
  function bgcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }

  class Fr {
    constructor(num = 0n, den = 1n) {
      num = BigInt(num); den = BigInt(den);
      if (den === 0n) throw new Error('Fr: zero denominator');
      if (den < 0n) { num = -num; den = -den; }
      const g = bgcd(num, den) || 1n;
      this.n = num / g;
      this.d = den / g;
    }
    static from(x) {
      if (x instanceof Fr) return x;
      if (typeof x === 'bigint') return new Fr(x, 1n);
      if (typeof x === 'number') {
        if (!Number.isInteger(x)) throw new Error('Fr.from: non-integer number ' + x);
        return new Fr(BigInt(x), 1n);
      }
      throw new Error('Fr.from: bad value ' + x);
    }
    add(o) { o = Fr.from(o); return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Fr.from(o); return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Fr.from(o); return new Fr(this.n * o.n, this.d * o.d); }
    div(o) { o = Fr.from(o); return new Fr(this.n * o.d, this.d * o.n); }
    pow(k) {
      k = Number(k);
      if (k < 0) throw new Error('Fr.pow: negative exponent');
      let bn = this.n, bd = this.d, rn = 1n, rd = 1n;
      while (k > 0) {
        if (k & 1) { rn *= bn; rd *= bd; }
        k >>= 1;
        if (k > 0) { bn *= bn; bd *= bd; }
      }
      return new Fr(rn, rd);
    }
    cmp(o) { o = Fr.from(o); const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : (l > r ? 1 : 0); }
    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    gt(o) { return this.cmp(o) > 0; }
    isZero() { return this.n === 0n; }
    toNumber() { return Number(this.n) / Number(this.d); }
    toString() { return this.d === 1n ? this.n.toString() : (this.n.toString() + '/' + this.d.toString()); }
    key() { return this.n.toString() + '/' + this.d.toString(); }
  }
  const FR0 = new Fr(0n, 1n);
  const FR1 = new Fr(1n, 1n);

  function frSum(arr) { let t = FR0; for (let i = 0; i < arr.length; i++) t = t.add(arr[i]); return t; }
  function frProd(arr) { let t = FR1; for (let i = 0; i < arr.length; i++) t = t.mul(arr[i]); return t; }
  // index of first maximum / minimum in an array of Fr (matches Python max/min + .index)
  function argmaxFirst(arr) { let bi = 0; for (let i = 1; i < arr.length; i++) if (arr[i].gt(arr[bi])) bi = i; return bi; }
  function argminFirst(arr) { let bi = 0; for (let i = 1; i < arr.length; i++) if (arr[i].lt(arr[bi])) bi = i; return bi; }

  /* ---- integer combinatorics ----------------------------------------------- */
  const _fact = [1n];
  function factorial(n) {
    n = Number(n);
    for (let i = _fact.length; i <= n; i++) _fact[i] = _fact[i - 1] * BigInt(i);
    return _fact[n];
  }
  function comb(n, k) {
    n = Number(n); k = Number(k);
    if (k < 0 || k > n) return 0n;
    return factorial(n) / (factorial(k) * factorial(n - k));
  }

  /* ---- memoization helpers ------------------------------------------------- */
  function memo(fn) {
    const cache = new Map();
    return function (...args) {
      const key = args.map(a => (a instanceof Fr) ? a.key() : String(a)).join('|');
      if (cache.has(key)) return cache.get(key);
      const v = fn.apply(null, args);
      cache.set(key, v);
      return v;
    };
  }

  /* ---- probability primitives (mirror Calculation_Module) ------------------ */
  const trinom = memo(function (x, y, n, p, q) {
    const coeff = new Fr(factorial(n), factorial(x) * factorial(y) * factorial(n - x - y));
    const rest = FR1.sub(p).sub(q);
    return coeff.mul(p.pow(x)).mul(q.pow(y)).mul(rest.pow(n - x - y));
  });

  const trinom_enumeration = memo(function (n, prob1, prob2) {
    const out = [];
    for (let c = 0; c <= n; c++) { out.push(new Array(n + 1).fill(FR0)); }
    for (let h = 0; h <= n; h++) {
      for (let c = 0; c <= n; c++) {
        if (h + c > n) continue;
        out[c][h] = trinom(h, c, n, prob1, prob2);
      }
    }
    return out;
  });

  const binom = memo(function (k, n, p) {
    return new Fr(comb(n, k), 1n).mul(p.pow(k)).mul(FR1.sub(p).pow(n - k));
  });

  const binom_enumeration = memo(function (n, prob) {
    const out = [];
    for (let k = 0; k <= n; k++) out.push(binom(k, n, prob));
    return out;
  });

  const n_unsaved = memo(function (n, save, extra_saves, reroll) {
    extra_saves = extra_saves || 0;
    let save_prob = new Fr(BigInt(save - 1), 6n);
    if (reroll) save_prob = save_prob.mul(save_prob);
    if (extra_saves < -n) extra_saves = -n;
    const outcomes = binom_enumeration(n + extra_saves, save_prob);
    if (extra_saves > 0) {
      const head = frSum(outcomes.slice(0, extra_saves + 1));
      return [head].concat(outcomes.slice(extra_saves + 1));
    } else {
      const pad = []; for (let i = 0; i < -extra_saves; i++) pad.push(FR0);
      return pad.concat(outcomes);
    }
  });

  const n_unsaved_expectation = memo(function (n, save, extra_saves) {
    return average(n_unsaved(n, save, extra_saves || 0, false));
  });

  const roll_distribution_options = memo(function (options, total) {
    if (options === 1) return [[total]];
    const result = [];
    for (let i = 0; i <= total; i++) {
      const sub = roll_distribution_options(options - 1, total - i);
      for (let j = 0; j < sub.length; j++) result.push([i].concat(sub[j]));
    }
    return result;
  });

  // reroll_distribution_options(*maxes, total) — maxes passed as an array here
  const _reroll_cache = new Map();
  function reroll_distribution_options(maxes, total) {
    const key = maxes.join(',') + '#' + total;
    if (_reroll_cache.has(key)) return _reroll_cache.get(key);
    const options = maxes.length;
    let distro = roll_distribution_options(options, total);
    distro = distro.filter(x => !maxes.some((m, i) => m < x[i]));
    if (distro.length === 0) distro = [maxes.slice()];
    _reroll_cache.set(key, distro);
    return distro;
  }

  function average(damage_probs) {
    let total = FR0;
    for (let i = 0; i < damage_probs.length; i++) total = total.add(damage_probs[i].mul(i));
    return total;
  }

  function distribution_add(a, b, mult) {
    mult = (mult === undefined) ? FR1 : Fr.from(mult);
    const out = new Array(a.length + b.length - 1).fill(FR0);
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        out[i + j] = out[i + j].add(a[i].mul(b[j]).div(mult));
      }
    }
    return out;
  }

  function distribution_sum(arr, mult) {
    let total = arr[0];
    for (let i = 1; i < arr.length; i++) total = distribution_add(total, arr[i], mult);
    return total;
  }

  function prob_sum(arr) {
    let maxLen = 0;
    for (const p of arr) if (p.length > maxLen) maxLen = p.length;
    const out = new Array(maxLen).fill(FR0);
    for (const probs of arr) for (let i = 0; i < probs.length; i++) out[i] = out[i].add(probs[i]);
    return out;
  }

  function cumulative_probs(damage_probs) {
    return damage_probs.map((_, i) => frSum(damage_probs.slice(i)));
  }

  // cartesian product of arrays of items -> array of tuples (mirrors itertools.product)
  function product(arrays) {
    let result = [[]];
    for (const arr of arrays) {
      const next = [];
      for (const combo of result) for (const item of arr) next.push(combo.concat([item]));
      result = next;
    }
    return result;
  }

  /* ---- Target -------------------------------------------------------------- */
  class Target {
    constructor(energy_save, kinetic_save, backup_save = 7, shield_save = 7, aegis = 0, fighters = 0, reinforced = false) {
      this.ES = energy_save;
      this.KS = kinetic_save;
      this.BS = backup_save;
      this.SS = shield_save;
      this.aegis = aegis;
      this.fighters = fighters;          // may be Infinity for full rerolls
      this.reinforced = reinforced ? 1 : 0;
      this.only_shields_E = this.SS <= this.ES;
      this.only_shields_K = this.SS <= this.KS;
      this.only_shields = this.only_shields_E && this.only_shields_K;
    }
    only_shields_reset() { this.only_shields = this.only_shields_E && this.only_shields_K; }
  }

  /* ---- _HitCase ------------------------------------------------------------ */
  class _HitCase {
    constructor(probability, hits, crits, hit_damage, crit_damage, hit_save, crit_save, skipped_save) {
      this.probability = probability;
      this.hits = hits;
      this.crits = crits;
      this.hit_damage = hit_damage;
      this.crit_damage = crit_damage;
      this.hit_save = hit_save;
      this.crit_save = crit_save;
      this.skipped_save = skipped_save;
      this.aegis_use_probs = [probability];
      this.aegis_on_hits = [0];
      const pe = [];
      for (let j = 0; j <= skipped_save; j++) {
        pe.push(
          n_unsaved_expectation(this.hits, this.hit_save, -(skipped_save - j)).mul(this.hit_damage)
            .add(n_unsaved_expectation(this.crits, this.crit_save, -j).mul(this.crit_damage))
        );
      }
      const idx = argmaxFirst(pe);
      this.expectation = pe[idx];
      this.skipped_crits = idx;
      this.skipped_hits = skipped_save - this.skipped_crits;
      this.expectation_aegis = [this.expectation];
      this.unsaved_hit_prob = null;
      this.unsaved_crit_prob = null;
    }

    generate_aegis_expectations(aegis_max) {
      if (this.aegis_use_probs.length !== 1) throw new Error('it appears this has already been run');
      this.aegis_use_probs = new Array(aegis_max + 1).fill(FR0);
      for (let i = 1; i <= aegis_max; i++) {
        const pe = [];
        for (let j = 0; j <= i; j++) {
          pe.push(
            n_unsaved_expectation(this.hits, this.hit_save, j - this.skipped_hits).mul(this.hit_damage)
              .add(n_unsaved_expectation(this.crits, this.crit_save, i - j - this.skipped_crits).mul(this.crit_damage))
          );
        }
        const idx = argminFirst(pe);
        this.expectation_aegis.push(pe[idx]);
        this.aegis_on_hits.push(idx);
      }
    }

    add_aegis_probability(probability, use_aegis) {
      this.aegis_use_probs[use_aegis] = this.aegis_use_probs[use_aegis].add(probability);
    }

    _run_saves(multiplier, full_rerolls) {
      multiplier = (multiplier === undefined) ? FR1 : Fr.from(multiplier);
      this.unsaved_hit_prob = this.aegis_use_probs.map((aprob, i) =>
        n_unsaved(this.hits, this.hit_save, this.aegis_on_hits[i] - this.skipped_hits, full_rerolls)
          .map(j => j.mul(aprob).mul(multiplier)));
      this.unsaved_crit_prob = this.aegis_use_probs.map((aprob, i) =>
        n_unsaved(this.crits, this.crit_save, i - this.aegis_on_hits[i] - this.skipped_crits, full_rerolls)
          .map(j => j.mul(aprob).mul(multiplier)));
    }
    run_saves(full_rerolls) { this._run_saves(FR1, full_rerolls); }
    sum_unsaved() { return [prob_sum(this.unsaved_hit_prob), prob_sum(this.unsaved_crit_prob)]; }
  }

  /* ---- _HitCaseShield ------------------------------------------------------ */
  class _HitCaseShield extends _HitCase {
    constructor(probability, hits, crits, hit_damage, crit_damage, hit_save, crit_save, shield, skipped_save) {
      super(probability, hits, crits, hit_damage, crit_damage, hit_save, crit_save, skipped_save);
      this.shield = new _HitCase(probability, hits, crits, hit_damage, crit_damage, shield, shield, skipped_save);
      this.no_shield_prob = FR0;
      this.shield_prob = FR0;
    }
    generate_aegis_expectations(aegis_max) {
      super.generate_aegis_expectations(aegis_max);
      this.shield.generate_aegis_expectations(aegis_max);
    }
    add_shield_probability(probability, use_shield) {
      if (use_shield) this.shield_prob = this.shield_prob.add(probability);
      else this.no_shield_prob = this.no_shield_prob.add(probability);
    }
    run_saves(full_rerolls) {
      const diff = this.no_shield_prob.add(this.shield_prob).sub(this.probability).toNumber();
      if (!(diff > -0.01 && diff < 0.01)) throw new Error('is shield calculation incomplete?');
      super._run_saves(this.no_shield_prob.div(this.probability), full_rerolls);
      this.shield._run_saves(this.shield_prob.div(this.probability), false);
    }
  }

  /* ---- _HitCaseReroll ------------------------------------------------------ */
  class _HitCaseReroll {
    constructor(probability, hits, crits, hit_damage, crit_damage, hit_save, crit_save, extra_hit_dice, extra_crit_dice) {
      this.probability = probability;
      this.hits = hits;
      this.crits = crits;
      this.hit_damage = hit_damage;
      this.crit_damage = crit_damage;
      this.hit_save = hit_save;
      this.crit_save = crit_save;
      this.extra_hit_dice = extra_hit_dice;
      this.extra_crit_dice = extra_crit_dice;
      this.expected_hits_reroll_value = [Fr.from(hit_damage).mul(n_unsaved_expectation(hits, hit_save, -hits))];
      for (let i = -hits + 1; i <= extra_hit_dice; i++)
        this.expected_hits_reroll_value.push(Fr.from(hit_damage).mul(n_unsaved_expectation(hits, hit_save, i)));
      this.expected_crits_reroll_value = [Fr.from(crit_damage).mul(n_unsaved_expectation(crits, crit_save, -crits))];
      for (let i = -crits + 1; i <= extra_crit_dice; i++)
        this.expected_crits_reroll_value.push(Fr.from(crit_damage).mul(n_unsaved_expectation(crits, crit_save, i)));
      this.hit_reroll_probs = new Array(this.expected_hits_reroll_value.length).fill(FR0);
      this.crit_reroll_probs = new Array(this.expected_crits_reroll_value.length).fill(FR0);
      this.unsaved_hit_prob = null;
      this.unsaved_crit_prob = null;
    }
    add_reroll_probability(probability, use_hit_rerolls, use_crit_rerolls) {
      this.hit_reroll_probs[use_hit_rerolls] = this.hit_reroll_probs[use_hit_rerolls].add(probability);
      this.crit_reroll_probs[use_crit_rerolls] = this.crit_reroll_probs[use_crit_rerolls].add(probability);
    }
    run_rerolls() {
      const dh = frSum(this.hit_reroll_probs).sub(this.probability).toNumber();
      const dc = frSum(this.crit_reroll_probs).sub(this.probability).toNumber();
      if (!(dh > -0.01 && dh < 0.01 && dc > -0.01 && dc < 0.01)) throw new Error('is reroll calculation incomplete?');
      this.unsaved_hit_prob = this.hit_reroll_probs.map((p, i) =>
        n_unsaved(this.hits, this.hit_save, -this.hits + i, false).map(j => j.mul(p)));
      this.unsaved_crit_prob = this.crit_reroll_probs.map((p, i) =>
        n_unsaved(this.crits, this.crit_save, -this.crits + i, false).map(j => j.mul(p)));
    }
    sum_unsaved() { return [prob_sum(this.unsaved_hit_prob), prob_sum(this.unsaved_crit_prob)]; }
  }

  /* ---- _HitSet ------------------------------------------------------------- */
  class _HitSet {
    constructor(probabilities, damage, save, shield = 7, reave = 0, critical = 0, penetrator = false, can_cripple = false, initial_crits = 0, skipped_save = 0) {
      if (reave === 0 && critical === 0 && !penetrator) {
        const pad = []; for (let i = 0; i < initial_crits; i++) pad.push(FR0);
        probabilities = pad.concat(probabilities);
        initial_crits = 0;
      }
      this.hit_damage = damage;
      this.crit_damage = damage + critical;
      if (save === 7) { this.hit_save = 7; this.crit_save = 7; }
      else {
        this.hit_save = save;
        this.crit_save = penetrator ? 7 : Math.min(save + reave, 6);
      }
      this.shield = shield;
      const cases = [];
      if (shield === 7) {
        for (let i = 0; i < probabilities.length; i++) {
          if (probabilities[i].isZero()) continue;
          cases.push(new _HitCase(probabilities[i], i, initial_crits, this.hit_damage, this.crit_damage, this.hit_save, this.crit_save, skipped_save));
        }
      } else {
        for (let i = 0; i < probabilities.length; i++) {
          if (probabilities[i].isZero()) continue;
          cases.push(new _HitCaseShield(probabilities[i], i, initial_crits, this.hit_damage, this.crit_damage, this.hit_save, this.crit_save, shield, skipped_save));
        }
      }
      this.can_cripple = can_cripple;
      this.skipped_save = skipped_save;
      this.total_probability = frSum(probabilities);
      this.cases = cases;
      this.reroll_cases = null;
    }

    finalise_saves(backup = 7) {
      const unsaved_hits = [], unsaved_crits = [];
      const src = this.reroll_cases === null ? this.cases : this.reroll_cases;
      for (const c of src) { const [h, cr] = c.sum_unsaved(); unsaved_hits.push(h); unsaved_crits.push(cr); }
      if (this.shield !== 7) {
        for (const c of this.cases) { const [h, cr] = c.shield.sum_unsaved(); unsaved_hits.push(h); unsaved_crits.push(cr); }
      }
      const uh = prob_sum(unsaved_hits);
      const uc = prob_sum(unsaved_crits);
      const final_hits = prob_sum(uh.map((p, i) => n_unsaved(i, backup, 0, false).map(j => p.mul(j))));
      const final_crits = prob_sum(uc.map((p, i) => n_unsaved(i, backup, 0, false).map(j => p.mul(j))));
      const hit_damage = new Array((final_hits.length - 1) * this.hit_damage + 1).fill(FR0);
      for (let i = 0; i < final_hits.length; i++) hit_damage[i * this.hit_damage] = hit_damage[i * this.hit_damage].add(final_hits[i]);
      const crit_damage = new Array((final_crits.length - 1) * this.crit_damage + 1).fill(FR0);
      for (let i = 0; i < final_crits.length; i++) crit_damage[i * this.crit_damage] = crit_damage[i * this.crit_damage].add(final_crits[i]);
      const damage_result = distribution_add(hit_damage, crit_damage, this.total_probability);
      const cripple_probability = this.can_cripple ? this.total_probability.sub(damage_result[0]) : FR0;
      return [damage_result, cripple_probability];
    }

    run_saves(may_reroll, full_rerolls) {
      for (const c of this.cases) c.run_saves(may_reroll && full_rerolls);
      if (may_reroll && !full_rerolls) {
        const cases = [];
        for (const c of this.cases) {
          for (let aegis = 0; aegis < c.aegis_use_probs.length; aegis++) {
            if (c.aegis_use_probs[aegis].isZero()) continue;
            for (let hits = 0; hits <= c.hits; hits++) {
              for (let crits = 0; crits <= c.crits; crits++) {
                const prob = c.unsaved_hit_prob[aegis][hits].mul(c.unsaved_crit_prob[aegis][crits]).div(c.probability);
                if (prob.isZero()) continue;
                cases.push(new _HitCaseReroll(prob, hits, crits, this.hit_damage, this.crit_damage, this.hit_save, this.crit_save,
                  c.aegis_on_hits[aegis] - c.skipped_hits, aegis - c.aegis_on_hits[aegis] - c.skipped_crits));
              }
            }
          }
        }
        this.reroll_cases = cases;
      }
    }
    run_rerolls() { for (const c of this.reroll_cases) c.run_rerolls(); }
  }

  /* ---- _Hit ---------------------------------------------------------------- */
  class _Hit {
    constructor(probabilities, target, damage, damage_type, burnthrough = 0, reave = 0, critical = 0, scald = 0, penetrator = false, crippling = false, need_crits = false, caw = false, skipped_save = 0) {
      this.probabilities = probabilities;
      this.damage = damage;
      if (target.only_shields) {
        this.save = target.SS;
        this.shield = 7;
        this.can_reroll = false;
        this.burnthrough = 0;
        this.reave = 0;
        this.penetrator = false;
      } else {
        if (damage_type === 'K') this.save = target.KS;
        else if (damage_type === 'E') this.save = target.ES;
        else this.save = 7;
        if (this.save < 6) this.save = Math.min(this.save + scald, 6);
        this.shield = target.SS;
        this.can_reroll = caw && target.fighters > 0;
        this.burnthrough = burnthrough;
        this.reave = reave;
        this.penetrator = penetrator;
      }
      this.critical = critical;
      this.crippling = crippling;
      this.backup = target.BS;
      this.need_crits = need_crits;
      this.caw = caw;
      this.skipped_save = skipped_save;
      this.cases = null;
    }

    generate_cases() {
      const cases = [];
      const P = this.probabilities;
      const sumCritsToHits = (from) => {
        const parts = [];
        for (let i = from; i < P.length; i++) { const pad = []; for (let k = 0; k < i; k++) pad.push(FR0); parts.push(pad.concat(P[i])); }
        return prob_sum(parts);
      };
      if (!this.need_crits) {
        cases.push(new _HitSet(P[0], this.damage, this.save, this.shield, 0, 0, false, false, 0, this.skipped_save));
      } else if (this.crippling && !(this.burnthrough > 0 || this.reave > 0 || this.critical > 0 || this.penetrator)) {
        cases.push(new _HitSet(P[0], this.damage, this.save, this.shield, 0, 0, false, false, 0, this.skipped_save));
        const critting = sumCritsToHits(1);
        cases.push(new _HitSet(critting, this.damage, this.save, this.shield, 0, 0, false, true, 0, this.skipped_save));
      } else if (((this.save === 6 && !this.penetrator) || this.save === 7) && this.critical === 0) {
        const critting = sumCritsToHits(0);
        cases.push(new _HitSet(critting, this.damage, this.save, this.shield, 0, 0, false, false, 0, this.skipped_save));
      } else if (this.burnthrough > 0 && !this.penetrator && this.critical === 0) {
        cases.push(new _HitSet(P[0], this.damage, this.save, this.shield, 0, 0, false, false, 0, this.skipped_save));
        const crits_to_cap = Math.ceil((6 - this.save) / this.burnthrough);
        for (let i = 1; i < Math.min(crits_to_cap + 1, P.length); i++) {
          const save = this.save === 7 ? 7 : Math.min(this.save + i * this.burnthrough, 6);
          cases.push(new _HitSet(P[i], this.damage, save, this.shield, this.reave, 0, false, this.crippling, i, this.skipped_save));
        }
        if (crits_to_cap + 1 < P.length) {
          const critting = sumCritsToHits(crits_to_cap + 1);
          cases.push(new _HitSet(critting, this.damage, 6, this.shield, 0, 0, false, this.crippling, 0, this.skipped_save));
        }
      } else {
        cases.push(new _HitSet(P[0], this.damage, this.save, this.shield, 0, 0, false, false, 0, this.skipped_save));
        for (let i = 1; i < P.length; i++) {
          const save = this.save === 7 ? 7 : Math.min(this.save + i * this.burnthrough, 6);
          cases.push(new _HitSet(P[i], this.damage, save, this.shield, this.reave, this.critical, this.penetrator, this.crippling, i, this.skipped_save));
        }
      }
      this.cases = cases;
    }

    list_cases() { const all = []; for (const cs of this.cases) all.push(...cs.cases); return all; }
    generate_aegis_expectations(aegis_max) { const cs = this.list_cases(); for (const c of cs) c.generate_aegis_expectations(aegis_max); return cs; }
    list_rerollable_cases() { const all = []; for (const cs of this.cases) all.push(...cs.reroll_cases); return all; }
    run_saves(full_rerolls) { for (const cs of this.cases) cs.run_saves(this.can_reroll, full_rerolls); }
    run_rerolls() { for (const cs of this.cases) cs.run_rerolls(); }

    finalise_saves() {
      const unsaved_damage = [];
      let cripple = FR0;
      for (const cs of this.cases) { const [d, cr] = cs.finalise_saves(this.backup); unsaved_damage.push(d); cripple = cripple.add(cr); }
      const final_damage = prob_sum(unsaved_damage);
      const s = frSum(final_damage).toNumber();
      if (!(s > 0.99 && s < 1.01)) throw new Error('Something seems to have gone wrong with a distribution');
      return [final_damage, cripple];
    }
  }

  /* ---- Weapon -------------------------------------------------------------- */
  class Weapon {
    constructor(attack, lock, damage, damage_type, burnthrough = 0, reave = 0, critical = 0, scald = 0, penetrator = false, crippling = false, caw = false, skipped_save = 0, telescope = false) {
      this.attack = attack;
      this.lock = lock < 2 ? 2 : lock;
      this.damage = damage;
      this.damage_type = damage_type;
      this.burnthrough = burnthrough;
      this.reave = reave;
      this.critical = critical;
      this.scald = scald;
      this.penetrator = penetrator;
      this.crippling = crippling;
      this.need_crits = burnthrough > 0 || reave > 0 || critical > 0 || penetrator || crippling;
      this.caw = caw;
      this.skipped_save = skipped_save;
      this.telescope = telescope ? 1 : 0;
    }
    copy() {
      return new Weapon(this.attack, this.lock, this.damage, this.damage_type, this.burnthrough, this.reave, this.critical, this.scald, this.penetrator, this.crippling, this.caw, this.skipped_save, !!this.telescope);
    }
    calculate_attack(target) {
      let need_crits = this.need_crits && ((this.critical > 0 || this.crippling) || !target.only_shields);
      let burnthrough, reave, scald, penetrator;
      if (target.only_shields) { burnthrough = 0; reave = 0; scald = 0; penetrator = false; }
      else { burnthrough = this.burnthrough; reave = this.reave; scald = this.scald; penetrator = this.penetrator; }
      const crit_requires = 2 - this.telescope + target.reinforced;
      let probabilities;
      if (need_crits && this.lock + crit_requires <= 6) {
        const hitP = new Fr(BigInt(crit_requires), 6n);
        const critP = new Fr(BigInt(7 - this.lock - crit_requires), 6n);
        probabilities = trinom_enumeration(this.attack, hitP, critP);
        need_crits = true;
      } else {
        const hitP = new Fr(BigInt(7 - this.lock), 6n);
        probabilities = [binom_enumeration(this.attack, hitP)];
        need_crits = false;
      }
      return new _Hit(probabilities, target, this.damage, this.damage_type, burnthrough, reave, this.critical, scald, penetrator, this.crippling, need_crits, this.caw, this.skipped_save);
    }
  }

  function compare_weapon(w1, w2, target) {
    if (w1.crippling || w2.crippling) return false;
    if ((w1.caw || w2.caw) && target.aegis > 0) return false;
    if (w1.skipped_save > 0 || w2.skipped_save > 0) return false;
    if (w1.lock !== w2.lock) return false;
    if (w1.damage !== w2.damage) return false;
    if (w1.critical !== w2.critical) return false;
    if (w1.telescope !== w2.telescope && w1.critical > 0) return false;
    if (target.only_shields) return true;
    if (w1.damage_type === 'C') {
      if (w2.damage_type === 'C') return true;
      if (w2.damage_type === 'E' && target.ES === 7) return true;
      if (w2.damage_type === 'K' && target.KS === 7) return true;
      return false;
    }
    if (w2.damage_type === 'C') {
      if (w1.damage_type === 'C') return true;
      if (w1.damage_type === 'E' && target.ES === 7) return true;
      if (w1.damage_type === 'K' && target.KS === 7) return true;
      return false;
    }
    if (w1.penetrator !== w2.penetrator) return false;
    if (target.ES === 6 && target.KS === 6) return true;
    if (w1.damage_type === w2.damage_type && w1.damage_type === 'E' && target.ES === 6) return true;
    if (w1.damage_type === w2.damage_type && w1.damage_type === 'K' && target.KS === 6) return true;
    if (w1.scald !== w2.scald) return false;
    if (w1.burnthrough !== w2.burnthrough) return false;
    if (w1.reave !== w2.reave) return false;
    if (w1.telescope !== w2.telescope && w1.need_crits) return false;
    if (target.ES === target.KS) return true;
    if (w1.damage_type === w2.damage_type && w1.damage_type === 'E') return true;
    if (w1.damage_type === w2.damage_type && w1.damage_type === 'K') return true;
    return false;
  }

  /* ---- Attack -------------------------------------------------------------- */
  class Attack {
    constructor(weapons, target, simplify = true) {
      if (target.only_shields_K && weapons.every(i => i.damage_type === 'K' || i.damage_type === 'C')) target.only_shields = true;
      if (target.only_shields_E && weapons.every(i => i.damage_type === 'E' || i.damage_type === 'C')) target.only_shields = true;
      if (simplify) {
        const combined = [];
        weapons = weapons.slice();
        this.divisions = [];
        for (let i = 0; i < weapons.length; i++) {
          if (weapons[i] === null) continue;
          combined.push(weapons[i].copy());
          const cur = combined[combined.length - 1];
          const group = [[i, cur.attack]];
          weapons[i] = null;
          for (let j = i + 1; j < weapons.length; j++) {
            if (weapons[j] === null) continue;
            if (compare_weapon(cur, weapons[j], target)) {
              group.push([j, weapons[j].attack]);
              cur.attack += weapons[j].attack;
              weapons[j] = null;
            }
          }
          this.divisions.push(group);
        }
        this.hits = combined.map(w => w.calculate_attack(target));
      } else {
        this.hits = weapons.map(w => w.calculate_attack(target));
        this.divisions = null;
      }
      this.target = target;
      this.aegis_hits = [];
      this.non_aegis_hits = [];
      for (const hit of this.hits) { if (hit.caw) this.aegis_hits.push(hit); else this.non_aegis_hits.push(hit); }
      this.rerollable_hits = this.hits.filter(h => h.can_reroll);
      let max_rerollable = 0;
      for (const hit of this.rerollable_hits) max_rerollable += hit.probabilities[0].length;
      this.full_rerolls = target.fighters >= max_rerollable;

      this.damage_results = [];
      this.cripple_results = [];
      this.individual_averages = [];
      this.summed_result = null;
      this.cumulative_result = null;
      this.average_result = null;
    }

    run() {
      for (const hit of this.hits) hit.generate_cases();
      const T = this.target;

      if (this.aegis_hits.length === 1 && T.aegis > 0) {
        if (T.SS !== 7) {
          const lists = this.aegis_hits.map(h => h.generate_aegis_expectations(T.aegis)).concat(this.non_aegis_hits.map(h => h.list_cases()));
          for (const cse of product(lists)) {
            const probability = frProd(cse.map(h => h.probability));
            let unshielded = cse[0].expectation_aegis[cse[0].expectation_aegis.length - 1];
            for (let k = 1; k < cse.length; k++) unshielded = unshielded.add(cse[k].expectation);
            let shielded = cse[0].shield.expectation_aegis[cse[0].shield.expectation_aegis.length - 1];
            for (let k = 1; k < cse.length; k++) shielded = shielded.add(cse[k].shield.expectation);
            if (unshielded.gt(shielded)) {
              for (const h of cse) { h.add_shield_probability(probability, true); h.shield.add_aegis_probability(probability, T.aegis); }
            } else {
              for (const h of cse) { h.add_shield_probability(probability, false); h.add_aegis_probability(probability, T.aegis); }
            }
          }
        } else {
          for (const c of this.aegis_hits[0].generate_aegis_expectations(T.aegis)) c.add_aegis_probability(c.probability, T.aegis);
        }
      } else if (T.aegis > 0 && this.aegis_hits.length > 0 && (T.SS === 7 || T.only_shields)) {
        const options = roll_distribution_options(this.aegis_hits.length, T.aegis);
        const lists = this.aegis_hits.map(h => h.generate_aegis_expectations(T.aegis));
        for (const cse of product(lists)) {
          const probability = frProd(cse.map(h => h.probability));
          const expectations = options.map(option => {
            let s = FR0; for (let i = 0; i < option.length; i++) s = s.add(cse[i].expectation_aegis[option[i]]); return s;
          });
          const choice = argminFirst(expectations);
          for (let i = 0; i < this.aegis_hits.length; i++) cse[i].add_aegis_probability(probability, options[choice][i]);
        }
      } else if (T.aegis === 0 && (T.SS !== 7 && !T.only_shields)) {
        const lists = this.hits.map(h => h.list_cases());
        for (const cse of product(lists)) {
          const probability = frProd(cse.map(h => h.probability));
          let unshielded = FR0; for (const h of cse) unshielded = unshielded.add(h.expectation);
          let shielded = FR0; for (const h of cse) shielded = shielded.add(h.shield.expectation);
          if (unshielded.gt(shielded)) for (const h of cse) h.add_shield_probability(probability, true);
          else for (const h of cse) h.add_shield_probability(probability, false);
        }
      } else if (T.aegis > 0 && this.aegis_hits.length > 0 && T.SS !== 7) {
        // Faithful port of the original's general shield+aegis branch (rarely reached;
        // the original references undefined attrs here, so this mirrors that behavior).
        const options = roll_distribution_options(this.aegis_hits.length, T.aegis);
        const lists = this.aegis_hits.map(h => h.generate_aegis_expectations(T.aegis)).concat(this.non_aegis_hits.map(h => h.list_cases()));
        for (const cse of product(lists)) {
          const probability = frProd(cse.map(h => h.probability));
          let unshielded = FR0; for (let k = this.aegis_hits.length; k < cse.length; k++) unshielded = unshielded.add(cse[k].expectation);
          let shielded = FR0; for (let k = this.aegis_hits.length; k < cse.length; k++) shielded = shielded.add(cse[k].shield.expectation);
          const unshielded_aegis = options.map(option => { let s = FR0; for (let i = 0; i < options.length; i++) s = s.add(cse[i].aegis_expectation[option[i]]); return s; });
          const shielded_aegis = options.map(option => { let s = FR0; for (let i = 0; i < options.length; i++) s = s.add(cse[i].shield.aegis_expectation[option[i]]); return s; });
          const ub = argminFirst(unshielded_aegis), sb = argminFirst(shielded_aegis);
          if (unshielded.add(unshielded_aegis[ub]).gt(shielded.add(shielded_aegis[sb]))) {
            for (let i = 0; i < this.aegis_hits.length; i++) cse[i].add_aegis_probability(probability, options[sb][i]);
            for (const h of cse) h.add_shield_probability(probability, true);
          } else {
            for (let i = 0; i < this.aegis_hits.length; i++) cse[i].add_aegis_probability(probability, options[ub][i]);
            for (const h of cse) h.add_shield_probability(probability, false);
          }
        }
      }

      for (const hit of this.hits) hit.run_saves(this.full_rerolls);

      if (this.rerollable_hits.length > 0 && T.fighters > 0 && !this.full_rerolls) {
        const n = this.rerollable_hits.length;
        const lists = this.rerollable_hits.map(h => h.list_rerollable_cases());
        for (const cse of product(lists)) {
          const maxes = cse.map(h => h.hit_reroll_probs.length - 1).concat(cse.map(c => c.crit_reroll_probs.length - 1));
          const options = reroll_distribution_options(maxes, T.fighters);
          const probability = frProd(cse.map(h => h.probability));
          const expectations = options.map(option => {
            let s = FR0;
            for (let i = 0; i < n; i++) s = s.add(cse[i].expected_hits_reroll_value[option[i]]);
            for (let i = n; i < option.length; i++) s = s.add(cse[i - n].expected_crits_reroll_value[option[i]]);
            return s;
          });
          const choice = argminFirst(expectations);
          for (let i = 0; i < n; i++) cse[i].add_reroll_probability(probability, options[choice][i], options[choice][i + n]);
        }
        for (const hit of this.rerollable_hits) hit.run_rerolls();
      }

      const main_damage_results = [];
      const main_cripple_results = [];
      for (const hit of this.hits) { const [d, c] = hit.finalise_saves(); main_damage_results.push(d); main_cripple_results.push(c); }
      if (this.divisions === null) {
        this.damage_results = main_damage_results;
        this.cripple_results = main_cripple_results;
        this.individual_averages = main_damage_results.map(average);
      } else {
        let length = 0; for (const d of this.divisions) length += d.length;
        this.cripple_results = new Array(length).fill(FR0);
        this.individual_averages = new Array(length).fill(FR0);
        for (let i = 0; i < this.divisions.length; i++) {
          let total = 0; for (const j of this.divisions[i]) total += j[1];
          for (const split of this.divisions[i]) {
            this.cripple_results[split[0]] = main_cripple_results[i];
            this.individual_averages[split[0]] = average(main_damage_results[i]).mul(new Fr(BigInt(split[1]), BigInt(total)));
          }
        }
      }
      this.summed_result = distribution_sum(main_damage_results);
      this.cumulative_result = cumulative_probs(this.summed_result);
      this.average_result = average(this.summed_result);
      this.target.only_shields_reset();
      return this;
    }
  }

  /* ---- rules layer (ported from Data_Module create_target / create_weapon) --
     Differs from the reference in one deliberate way: shields are kept as a real
     Shield save (SS) on the Target, so the engine's optimal shield/no-shield
     decision is used, rather than the original UI's "tick to convert armour to
     shield" collapse. Everything else (opal, defences-offline, grouped, and the
     full Lock stack: city/bombardment/atmosphere/mauler/calibre/calypso/
     impetuous, plus overcharge/fusillade/sustained/volley) matches verbatim. */

  // base: {weight, ES, KS, BS, SS, descent(bool), reinforced(bool), city(bool), station(bool)}
  // sit:  {aegis, fighters, opal(bool), defences_offline(bool), grouped(bool)}
  function createTarget(base, sit) {
    sit = sit || {};
    const off = sit.defences_offline ? 1 : 0;
    let es = (base.ES === 7 || base.ES === 6) ? base.ES : base.ES + off;
    let ks = (base.KS === 7 || base.KS === 6) ? base.KS : base.KS + off;
    let ss;
    if (base.SS === 7) ss = 7;
    else {
      ss = base.SS - (sit.opal ? 1 : 0);
      if (ss < 3) ss = 3;
      ss = ss + off;
      if (ss > 6) ss = 6;
    }
    let bs;
    if (base.BS === 7 && sit.grouped) bs = 6;
    else if (base.BS === 7 || base.BS === 6) bs = base.BS;
    else bs = base.BS + off;
    return new Target(es, ks, bs, ss, sit.aegis || 0, sit.fighters || 0, !!base.reinforced);
  }

  // pw:  parsed weapon {attack, lock, damage, damage_type, burnthrough, reave,
  //      critical, scald, penetrator, crippling, caw, a2a, bombardment,
  //      calibre:[], escape, fusillade, mauler, overcharge, entry, sustained}
  // base: the PresetTarget-style object (for city/station/descent/weight + base saves for mauler)
  // sit:  AttackSituation {WF, attacker_atmo, target_atmo, close, impetuous}
  // wsit: WeaponSituation {telescope, calypso, overcharging, number, sustaining}
  // returns an array of engine Weapon (length = number, for Volley)
  function buildWeapons(pw, base, sit, wsit) {
    sit = sit || {}; wsit = wsit || {};
    const number = Math.max(1, wsit.number || 1);
    const sustaining = wsit.sustaining ? 1 : 0;
    const WF = sit.WF ? 1 : 0;
    const attack = pw.attack * (1 + sustaining * (pw.sustained ? 1 : 0)) + WF * (pw.fusillade || 0);
    const damage = pw.damage * (1 + (wsit.overcharging ? 1 : 0) * (pw.overcharge ? 1 : 0));
    const caw = !!pw.caw;
    let lock;
    if (base.city && !pw.bombardment) lock = 6;
    else if (pw.bombardment && !sit.target_atmo && !base.station && !base.city) lock = 6;
    else if (sit.attacker_atmo && !sit.target_atmo && !pw.escape) lock = 6;
    else if (base.descent && sit.target_atmo && !(pw.bombardment || pw.a2a || pw.escape || pw.entry)) lock = 6;
    else {
      lock = pw.lock;
      if (pw.mauler) { if (pw.damage_type === 'K') lock = base.KS; else if (pw.damage_type === 'E') lock = base.ES; }
      if (pw.bombardment && base.city) lock -= 2;
      if (sit.target_atmo && !(pw.bombardment || pw.a2a || pw.entry)) lock += 1;
      if ((pw.calibre || []).indexOf(base.weight) !== -1 && !(base.city || base.station)) lock -= 1;
      lock += (wsit.calypso || 0);
      if (sit.impetuous) lock -= 1;
      if (lock > 6) lock = 6;
      if (lock < 2) lock = 2;
    }
    const scald = (pw.scald || 0) * (sit.close ? 1 : 0);
    const w = new Weapon(attack, lock, damage, pw.damage_type, pw.burnthrough || 0, pw.reave || 0, pw.critical || 0, scald, !!pw.penetrator, !!pw.crippling, caw, 0, !!wsit.telescope);
    const out = []; for (let i = 0; i < number; i++) out.push(w.copy());
    return out;
  }

  global.DFCCalc = {
    Fr, Target, Weapon, Attack, compare_weapon, createTarget, buildWeapons,
    // primitives exposed for testing
    _internal: { trinom, binom, n_unsaved, average, distribution_add, prob_sum, cumulative_probs }
  };
})(typeof window !== 'undefined' ? window : globalThis);
