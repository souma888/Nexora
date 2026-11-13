/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  reactorconversion: [
    'Compare mixing and plug flow for the same irreversible first-order reaction.',
    'At the same positive kτ, which ideal reactor gives greater conversion?',
    ['Plug flow', 'A single stirred tank', 'They are always equal'],
    'For first-order kinetics, 1−exp(−kτ) exceeds kτ/(1+kτ).',
    'At k=0.2 min⁻¹ and τ=5 min, CSTR conversion is 50% and PFR conversion is ' +
      '63.212%. With 2 L/min flow, either residence time requires 10 L.',
    'For A→products with −rA=kCA: XCSTR=kτ/(1+kτ), XPFR=1−exp(−kτ); CA,out=CA0(1−X), V=Qτ.',
    'Steady, isothermal, constant-density liquid, ideal mixing or ideal plug flow, ' +
      'single irreversible first-order reaction. No heat release, pressure drop, ' +
      'catalyst deactivation or residence-time dispersion. The plot varies residence ' +
      'time, not axial distance inside a CSTR.',
  ],
  arrhenius: [
    'Connect activation energy to rate changes using an explicitly labeled inverse-temperature plot.',
    'For positive activation energy, does increasing temperature increase k?',
    ['Yes', 'No', 'Only below the reference temperature'],
    'The Arrhenius exponent becomes less negative as absolute temperature rises.',
    'At kref=0.1 min⁻¹, Tref=300 K, Ea=50 kJ/mol and T=330 K, k is approximately ' +
      '0.619 min⁻¹, about 6.19 times the reference rate.',
    'k(T)=kref exp[−Ea/R(1/T−1/Tref)], R=8.314462618 J/(mol·K). For first-order ' +
      'decay, t½=ln2/k. The plotted logarithm uses natural log.',
    'A single constant activation energy over 250–450 K, fixed mechanism and no ' +
      'transport limitation. This is sensitivity analysis, not evidence that an actual ' +
      'material or reaction remains stable over that range. Temperature is absolute ' +
      'kelvin.',
  ],
  consecutive: [
    'Follow an intermediate that is both formed and consumed while total species ' +
      'concentration stays conserved.',
    'Can B increase forever in this closed consecutive reaction?',
    ['No, it is eventually consumed', 'Yes', 'Only when both rate constants are equal'],
    'After A is depleted, B continues to convert to C.',
    'For CA0=1, k1=0.2 and k2=0.1 min⁻¹, B peaks at ln(2)/0.1≈6.9315 min with concentration 0.5 mol/L.',
    'CA=CA0 exp(−k1t); CB=CA0 k1[exp(−k1t)−exp(−k2t)]/(k2−k1); CC=CA0−CA−CB. At ' +
      'k1=k2=k, CB=CA0 kt exp(−kt).',
    'Well-mixed isothermal constant-volume batch, irreversible first-order steps with ' +
      'unit molar stoichiometry and zero initial B/C. The equal-rate limit is handled ' +
      'explicitly. Peak metrics are bounded to the viewing interval.',
  ],
  mixingtank: [
    'Track a tracer concentration step through a constant-volume perfectly mixed tank.',
    'After one V/Q, what fraction of a zero-to-one concentration step has appeared?',
    ['About 63.2%', 'About 36.8%', '100%'],
    'The remaining difference from the inlet decays as exp(−t/(V/Q)).',
    'For V=100 L, Q=10 L/min and a step from 0 to 1 mol/L, τ=10 min and C(10 min)=1−e⁻¹≈0.63212 mol/L.',
    'V dC/dt=Q(Cin−C). C(t)=Cin+(C0−Cin)exp(−Qt/V). Accumulated outlet moles=VC0+QCin t−VC(t).',
    'Equal constant inflow/outflow, fixed volume, instantaneous uniform mixing, ' +
      'conserved nonreacting solute and a constant new inlet concentration. No ' +
      'transport delay, segregation or density change. The same balance covers washout ' +
      'when Cin=0.',
  ],
  langmuir: [
    'Relate equilibrium concentration, finite surface sites and adsorbed loading.',
    'At C=1/K, what fraction of the sites are occupied?',
    ['One half', 'All sites', 'One quarter'],
    'KC=1 gives θ=KC/(1+KC)=1/2.',
    'qmax=20 mg/g, K=0.5 L/mg and C=2 mg/L give θ=0.5 and q=10 mg/g. Ten grams of adsorbent hold 100 mg.',
    'θ=KC/(1+KC), q=qmaxθ, madsorbed=q·madsorbent. Half saturation occurs at C=1/K.',
    'Single-solute equilibrium on identical independent monolayer sites at fixed ' +
      'temperature. Dissolved equilibrium concentration is prescribed by a reservoir; a ' +
      'closed-batch liquid mass balance, adsorption kinetics and competing species are ' +
      'not modeled.',
  ],
  osmosis: [
    'Compare applied hydraulic pressure with a dilute-solution osmotic pressure difference.',
    'What is the net water flux when ΔP equals Δπ?',
    ['Zero', 'Maximum forward flux', 'Maximum reverse flux'],
    'The ideal linear driving force ΔP−Δπ vanishes.',
    'For 0.5 mol/L feed, zero permeate concentration, i=2 and T=298.15 K, Δπ≈24.79 ' +
      'bar. At 40 bar and Lp=1.5, forward flux is about 22.82 L/(m²·h).',
    'Δπ=iRT(Cfeed−Cpermeate), R=0.08314462618 L·bar/(mol·K). Jv=Lp(ΔP−Δπ), Qwater=Jv ' +
      'A. Positive flux is feed to permeate.',
    'Dilute ideal solution, prescribed uniform concentrations, fixed membrane ' +
      'permeability and no concentration polarization or pressure loss. Negative flux ' +
      'is deliberately retained as the opposite direction. This does not predict solute ' +
      'rejection, fouling or a real plant recovery ratio.',
  ],
};
