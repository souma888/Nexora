/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  solarpv: [
    'Inspect a fitted ideal-diode I–V curve and locate its maximum-power operating point.',
    'At open circuit, how much power is delivered?',
    ['Zero', 'Maximum power', 'The short-circuit power'],
    'Open-circuit voltage is nonzero, but current is zero, so VI is zero.',
    'At reference Isc=5 A, Voc=20 V and diode scale 1 V, the maximum is approximately ' +
      '17.1 V, 4.72 A and 80.8 W.',
    'a=shape·Voc, I0=Isc,ref/[exp(Voc,ref/a)−1]. I(V)=Isc,ref·G/1000−I0[exp(V/a)−1]. ' +
      'Solve I+V dI/dV=0 by bracketed bisection.',
    'A teaching ideal-diode fit with fixed temperature, zero series resistance and ' +
      'infinite shunt resistance. Irradiance scales photocurrent; open-circuit voltage ' +
      'is recomputed. This is not a calibrated panel, MPPT controller or environmental ' +
      'forecast.',
  ],
  windpower: [
    'Relate swept area and wind speed to extractable mechanical and electrical power.',
    'If wind speed doubles with fixed Cp, how does power change?',
    ['It grows eightfold', 'It doubles', 'It grows fourfold'],
    'The kinetic energy flow is proportional to v³.',
    'For radius 5 m, ρ=1.225 kg/m³ and v=10 m/s, available power is about 48.106 kW; ' +
      'Cp=0.4 and efficiency 0.9 give about 17.318 kW electric.',
    'A=πR²; Pwind=½ρAv³; Pshaft=Cp Pwind; Pelectric=ηPshaft. Ideal actuator-disk Cp≤16/27.',
    'Uniform steady flow, prescribed constant Cp and generator efficiency. No cut-in, ' +
      'rated-power regulation, cut-out, wake interaction, turbulence or structural ' +
      'loads. The cubic curve must not be treated as a real turbine power curve.',
  ],
  batterydischarge: [
    'Compare state of charge, open-circuit voltage and resistive voltage sag under a fixed load current.',
    'Does zero load current cause an ohmic voltage drop?',
    ['No', 'Yes, the maximum drop', 'Only after one hour'],
    'The series-resistance drop is IR and therefore vanishes at I=0.',
    'For a 5 Ah cell at 100% SOC and 2 A, ideal charge runtime is 2.5 h. With OCV ' +
      '3.0–4.2 V and R=0.05 Ω, the initial load voltage is 4.1 V and two-hour delivered ' +
      'energy is 14.48 Wh.',
    'SOC(t)=max[0,SOC0−It/Q]. Voc=Vempty+(Vfull−Vempty)SOC. Before cutoff, ' +
      'Vload=Voc−IR. Delivered Wh integrates Vload over delivered Ah.',
    'One idealized cell with linear OCV–SOC and constant usable capacity/resistance, ' +
      'no thermal, aging, relaxation or Peukert effects. At zero SOC an ideal ' +
      'protection switch disconnects the load, drawn as zero load-port voltage. At I=0, ' +
      'time to empty is undefined (—).',
  ],
  buckconverter: [
    'Inspect ideal step-down gain and the inductor’s current rise and fall over two switching cycles.',
    'What is the ideal CCM voltage gain?',
    ['D', '1/(1−D)', '1/D'],
    'Volt-second balance in the inductor gives Vo=D Vin.',
    'Vin=24 V, D=0.5, R=10 Ω, L=2 mH and fs=20 kHz give Vo=12 V, Io=1.2 A and ΔiL=0.15 A peak-to-peak.',
    'Vo=D Vin; Io=Vo/R; ΔiL=Vin D(1−D)/(Lfs). Current rises during on-time and falls during off-time.',
    'Ideal fixed-frequency steady-state CCM, large output capacitor, lossless ' +
      'switch/diode and no output-voltage ripple model. If predicted inductor current ' +
      'crosses zero, a warning identifies the invalid diode-CCM assumption; the ' +
      'conditional CCM waveform remains visible.',
  ],
  boostconverter: [
    'Connect boost duty ratio to output voltage, input current and inductor ripple.',
    'What happens to ideal voltage gain as duty approaches one?',
    ['It grows without bound', 'It approaches one', 'It approaches zero'],
    'Vo/Vin=1/(1−D), but real losses and ratings prevent the ideal singular limit.',
    'Vin=12 V, D=0.5, R=10 Ω, L=2 mH and fs=20 kHz give Vo=24 V, Io=2.4 A, mean ' +
      'inductor current 4.8 A and ripple 0.15 A.',
    'Vo=Vin/(1−D), Io=Vo/R, IL=Io/(1−D), ΔiL=Vin D/(Lfs). Ideal input and output powers match.',
    'Ideal steady-state CCM and large output capacitor; no switching loss, voltage ' +
      'ratings, startup or current limit. Duty is bounded below 0.85. A zero-current ' +
      'warning marks settings outside diode-converter CCM validity.',
  ],
  threephase: [
    'Compare oscillating single-phase power with the constant sum in a balanced three-phase load.',
    'Do balanced sinusoidal phase powers sum to a constant?',
    ['Yes', 'Only at unity power factor', 'Never'],
    'Their twice-frequency oscillatory components cancel across the three 120°-spaced phases.',
    '400 V line-to-line, 10 A line current and PF=0.8 give P≈5.54256 kW, Q≈4.15692 ' +
      'kvar and S≈6.92820 kVA for a lagging load.',
    'S=√3 VLL IL, P=S cosφ, Q=S sinφ (positive lagging). For a wye representation, ' +
      'Vphase=VLL/√3 and pk(t)=2Vphase IL cos(ωt−αk)cos(ωt−αk−φ).',
    'Balanced sinusoidal steady state, no harmonics or neutral current. The ' +
      'wye-equivalent phase representation is explicit; line-to-line voltage is never ' +
      'substituted for phase voltage in the waveform calculation. Leading current gives ' +
      'negative Q.',
  ],
};
