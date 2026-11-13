/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  bernoulli: [
    'Trade pressure, velocity, and elevation along an ideal water streamline.',
    'At fixed flow, what does a smaller outlet do to its speed?',
    ['It increases speed', 'It reduces speed', 'It fixes speed at zero'],
    'Continuity gives v = Q/A; area decreases with the square of diameter.',
    'At 5 L/s, a 100 mm inlet has speed 0.6366 m/s; a 50 mm outlet has speed 2.5465 ' +
      'm/s. With a 2 m rise, 150 kPa falls to about 127.34 kPa.',
    'p/(ρg) + v²/(2g) + z = constant; v = Q/A. Pressure is gauge, elevation rises from inlet to outlet.',
    'Steady incompressible water, ρ=1000 kg/m³, no friction, pump or turbine. A ' +
      'cavitation warning uses 101.325 kPa atmospheric and approximately 2.34 kPa vapor ' +
      'pressure at 20°C.',
  ],
  venturi: [
    'Infer water flow from the pressure decrease through a Venturi throat.',
    'If pressure difference quadruples, what happens to flow?',
    ['It doubles', 'It quadruples', 'It halves'],
    'The inferred flow is proportional to the square root of the pressure difference.',
    'For 100/50 mm diameters, Δp=10 kPa and Cd=0.98, flow is approximately 8.8876 L/s.',
    'Q = Cd At √[2Δp/(ρ(1−β⁴))], β=Dt/D. The reference curve uses Cd=1.',
    'Horizontal, incompressible water at ρ=1000 kg/m³. Cd is prescribed; this lab ' +
      'does not model its Reynolds-number dependence or instrument uncertainty.',
  ],
  pipeloss: [
    'Connect Reynolds number, roughness, friction factor, and pumping demand.',
    'In laminar flow, does roughness enter the friction-factor formula?',
    ['No', 'Yes, linearly', 'Only at zero velocity'],
    'The fully developed laminar Darcy factor is 64/Re.',
    'At 2 L/s through a 50 mm, 20 m pipe with water viscosity 1 mPa·s, Re≈50,930. ' +
      'Haaland predicts a pressure loss near 4.8 kPa.',
    'Δp = f(L/D)ρv²/2. Laminar f=64/Re; turbulent 1/√f=−1.8 log10[(ε/(3.7D))^1.11+6.9/Re]. Power = Δp Q.',
    'Steady fully developed water flow. Minor losses and elevation are excluded. ' +
      'Between Re=2300 and 4000 the factors are blended for continuity and flagged as ' +
      'uncertain.',
  ],
  wall: [
    'Follow the temperature drop across two thermal resistances in series.',
    'Which layer takes the larger temperature drop?',
    ['The layer with larger L/k', 'Always the thicker layer', 'Always the hotter layer'],
    'The same heat flux passes through both layers; each drop equals q″ L/k.',
    'For L1=0.1 m, k1=1, L2=0.05 m, k2=0.5 and 100/20°C boundaries, q″=400 W/m² and ' +
      'the interface is 60°C.',
    'R″ = L1/k1 + L2/k2; q″=(Th−Tc)/R″; Ti=Th−q″L1/k1.',
    'One-dimensional steady conduction, constant conductivity, perfect contact, and ' +
      'no internal generation. Boundary temperatures are prescribed; convection/contact ' +
      'resistances are excluded.',
  ],
  cooling: [
    'Cool a uniform-temperature solid and check whether the lumped assumption is plausible.',
    'After one time constant, what fraction of the initial excess remains?',
    ['About 37%', 'About 63%', 'None'],
    'The temperature excess decays as exp(−t/τ).',
    'A 1 kg body with cp=900 J/(kg·K), h=20 and A=0.1 m² has τ=450 s. At 450 s, 100°C ' +
      'in 20°C air falls to 49.43°C.',
    'T(t)=T∞+(Ti−T∞)exp(−t/τ); τ=mcp/(hA). Bi=hLc/k, Lc=m/(ρA).',
    'Constant properties, uniform convection, no radiation. Density is fixed at 2700 ' +
      'kg/m³ for the Biot estimate. Bi≥0.1 triggers a warning: internal gradients may ' +
      'invalidate lumped cooling.',
  ],
  exchanger: [
    'Compare parallel and counterflow using ε–NTU and resolved temperature profiles.',
    'Can a counterflow cold outlet be hotter than the hot outlet?',
    ['Yes', 'Never', 'Only if heat flows backward'],
    'Opposite flow directions allow this while maintaining a positive local temperature difference.',
    'With 80/20°C inlets, Ch=1000, Cc=500 W/K and UA=1000 W/K, counterflow gives ' +
      'ε≈77.46%, Q≈23.24 kW, and outlets near 56.76/66.48°C.',
    'NTU=UA/Cmin; Cr=Cmin/Cmax; Q=ε Cmin(Thi−Tci). Outlet changes are Q/Ch and Q/Cc. ' +
      'Counterflow ε=(1−e^(−NTU(1−Cr)))/(1−Cr e^(−NTU(1−Cr))).',
    'Steady two-stream exchanger with constant UA and heat capacities, no loss to ' +
      'ambient or phase change. Cr=1 uses ε=NTU/(1+NTU). Cold flow runs right-to-left ' +
      'in counterflow.',
  ],
  gasprocess: [
    'Compare pressure–volume paths and first-law energy transfers for an ideal gas.',
    'During a reversible adiabatic expansion, what happens to temperature?',
    ['It falls', 'It stays fixed', 'It rises'],
    'The gas does work without receiving heat, reducing internal energy.',
    'One mole at 300 K expanding isothermally from 10 L to 20 L does nRT ln 2≈1728.94 ' +
      'J of work; heat supplied equals that work.',
    'pV=nRT. Isothermal: W=nRT ln(Vf/Vi). Isobaric: W=pi(Vf−Vi). Adiabatic: ' +
      'pV^γ=constant. ΔU=nR(Tf−Ti)/(γ−1), Q=ΔU+W.',
    'Quasi-static expansion of a calorically perfect ideal gas. Work by the gas and ' +
      'heat into it are positive. R=8.314462618 J/(mol·K); phase change and ' +
      'irreversibility are excluded.',
  ],
  carnot: [
    'Balance heat and work at the reversible upper limit for a heat engine.',
    'Can a heat engine convert all supplied heat to work between finite positive reservoirs?',
    ['No', 'Yes, at any temperature', 'Only with more heat input'],
    'Carnot efficiency is 1−Tc/Th; rejected heat remains positive for Tc>0.',
    'A reversible engine between 600 and 300 K is 50% efficient. From 1000 J in, it ' +
      'produces 500 J work and rejects 500 J.',
    'η=1−Tc/Th; W=η Qh; Qc=Qh−W. Reservoir temperatures must be absolute kelvin.',
    'Reversible cyclic limit with fixed reservoirs. No real cycle, power rating or ' +
      'entropy generation is simulated. Actual engines have lower efficiency.',
  ],
  refrigerator: [
    'Estimate the reversible work needed to move heat from cold to hot.',
    'How does increasing temperature lift affect reversible cooling COP?',
    ['It decreases COP', 'It increases COP', 'It leaves COP unchanged'],
    'COP=Tc/(Th−Tc), so a greater lift requires more work per unit of cooling.',
    'At Tc=270 K and Th=310 K, COP=6.75. A 2000 W cooling load needs at least 296.30 ' +
      'W work and rejects 2296.30 W.',
    'COP_R=Tc/(Th−Tc); Wdot=Qcdot/COP; Qhdot=Qcdot+Wdot.',
    'Reversible reservoir model, not a refrigerant property cycle. Compressor losses, ' +
      'superheat, pressure drop and finite heat-transfer approaches reduce real COP.',
  ],
};
