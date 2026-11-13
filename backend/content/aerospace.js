/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  ballistic: [
    'Resolve the launch velocity and follow an exact constant-gravity flight path to the ground.',
    'On level ground without drag, which angle maximizes range?',
    ['45°', '30°', '90°'],
    'For equal launch and landing heights, range is v² sin(2θ)/g.',
    'At 50 m/s and 45° from ground level with g=9.80665 m/s², range is about 254.929 ' +
      'm and flight time 7.2105 s.',
    'vx=v cosθ, vy=v sinθ. x=vx t; y=h+vy t−gt²/2. T=[vy+√(vy²+2gh)]/g; ymax=h+vy²/(2g).',
    'Point mass, constant gravity, flat ground, no air drag, lift, wind, Earth ' +
      'curvature or propulsion after launch. Angles are measured above horizontal. The ' +
      'final point is the ground crossing, not a fixed arbitrary viewing time.',
  ],
  dragpolar: [
    'Separate parasite and induced drag while enforcing lift equal to weight.',
    'As speed rises, what happens to induced drag in level flight?',
    ['It decreases', 'It increases with speed squared', 'It stays constant'],
    'The required lift coefficient falls as 1/v², so induced drag falls as 1/v².',
    'For W=10000 N, S=16 m², ρ=1.225 kg/m³ and v=50 m/s, CL≈0.40816. With CD0=0.025 ' +
      'and k=0.05, drag is 612.5+204.082≈816.582 N.',
    'q=ρv²/2; CL=W/(qS); CD=CD0+kCL²; D=qS CD. Parasite D0=qS CD0; induced Di=kW²/(qS).',
    'Steady level flight with a parabolic drag polar, fixed configuration and ' +
      'prescribed density. The curve is a conditional mathematical continuation where ' +
      'CL exceeds CLmax; a warning identifies an infeasible selected speed. No ' +
      'compressibility, stall dynamics or engine model.',
  ],
  bankturn: [
    'Balance vertical lift and horizontal centripetal force in a constant-altitude turn.',
    'What happens to load factor as bank increases?',
    ['It increases', 'It decreases', 'It remains one'],
    'Maintaining altitude requires L cosφ=W, giving n=1/cosφ.',
    'At 50 m/s and 30° bank, load factor is 1.1547 g and turn radius is approximately 441.55 m.',
    'n=secφ, R=v²/(g tanφ), ω=g tanφ/v; banked stall speed=Vs,0√n. Coordinates x=R ' +
      'sin(ωt), y=R[1−cos(ωt)].',
    'Coordinated, still-air, constant-speed and constant-altitude turn at Earth ' +
      'gravity g=9.80665 m/s². Positive bank magnitude is used. No roll transient, ' +
      'wind, sideslip, power limit or structural certification; a stall-speed warning ' +
      'is explicit.',
  ],
  rocketequation: [
    'Follow ideal velocity gain as a rocket expels a finite fraction of its initial mass.',
    'Does delta-v grow linearly with mass ratio?',
    ['No, it grows logarithmically', 'Yes', 'It is independent of mass ratio'],
    'Momentum conservation integrates to ve ln(m0/mf).',
    'For m0=1000 kg, mf=500 kg and Isp=300 s, ve=2941.995 m/s and Δv≈2039.236 m/s.',
    'Δv=ve ln(m0/mf), ve=g0 Isp, g0=9.80665 m/s². At expelled fraction f, m=m0(1−f) and Δv=−ve ln(1−f).',
    'Single ideal stage, constant effective exhaust speed, no gravity or aerodynamic ' +
      'losses, no launch trajectory, no staging or burn-rate model. Delta-v is a ' +
      'velocity budget, not altitude or achieved orbital speed.',
  ],
  atmosphere: [
    'Explore the lapse-rate layer of a dry standard atmosphere and its pressure-density relationship.',
    'Does standard air density increase with altitude here?',
    ['No, it decreases', 'Yes', 'It stays constant'],
    'Hydrostatic pressure falls with altitude; density follows p/(RT).',
    'At sea level the model gives 15°C, 101.325 kPa and about 1.225 kg/m³. At 11 km ' +
      'temperature is −56.5°C.',
    'T=T0−Lh, p=p0(T/T0)^[g0/(RL)], ρ=p/(RT). T0=288.15 K, p0=101325 Pa, L=0.0065 ' +
      'K/m, R=287.05287 J/(kg·K).',
    'Dry standard-atmosphere troposphere from 0 to 11 km geopotential altitude only. ' +
      'No weather, humidity, temperature offset, tropopause-above-11-km model or ' +
      'geometric-altitude correction.',
  ],
  isentropicflow: [
    'Compare static-to-stagnation ratios and the choked area relation across subsonic ' +
      'and supersonic states.',
    'Where is A/A* minimized?',
    ['At Mach one', 'At Mach zero', 'At the largest Mach number'],
    'The starred area is the sonic throat, where the isentropic area–Mach relation has its minimum.',
    'At M=1, γ=1.4, T0=300 K and p0=100 kPa, static T=250 K, p≈52.8282 kPa and A/A*=1.',
    'T/T0=[1+(γ−1)M²/2]⁻¹; p/p0=(T/T0)^[γ/(γ−1)]; ρ/ρ0=(T/T0)^[1/(γ−1)]; ' +
      'A/A*=(1/M){2[1+(γ−1)M²/2]/(γ+1)}^[(γ+1)/(2(γ−1))].',
    'Calorically perfect gas, constant γ, reversible adiabatic flow. No shocks, ' +
      'viscosity, heat addition or variable gas properties. An area ratio above one ' +
      'permits two branches; specifying Mach selects a state, not a unique complete ' +
      'nozzle solution.',
  ],
};
