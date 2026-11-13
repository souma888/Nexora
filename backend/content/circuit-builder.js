/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  circuitbuilder: [
    'Build a grounded resistor/source network and solve its assembled modified nodal system.',
    'If both divider resistances double, does the midpoint voltage change?',
    ['No, but current halves', 'It doubles', 'It falls to zero'],
    'For an unloaded equal divider the resistance ratio stays fixed.',
    'The default 10 V source and two 1 kΩ resistors give V1=10 V, V2=5 V, 5 mA branch ' +
      'current, and 0.05 W total resistor heating. Source power is −0.05 W.',
    'Each resistor stamps conductance into G. Independent current sources stamp the ' +
      'right-hand side; voltage sources add branch-current unknowns. Solve [G B; Bᵀ ' +
      '0][v;i]=[j;e] with scaled partial-pivot Gaussian elimination.',
    'DC linear resistors and independent ideal V/I sources only; ≤20 components, node ' +
      'labels 0–8, node 0 ground. Enter one component per line: R|V|I name nodeA nodeB ' +
      'value. Current is positive A→B; voltage source enforces VA−VB=value. Signed ' +
      'absorbed power is (VA−VB)I; source delivery is negative. Floating or conflicting ' +
      'systems are rejected. Geometry is a connectivity sketch, not a physical layout.',
  ],
};
