/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  gates: [
    'Toggle input bits, compare gate symbols, and inspect the complete truth table.',
    'What does XOR output when both inputs are 1?',
    ['0', '1', 'An undefined voltage'],
    'XOR is high only when its two inputs differ.',
    'For AND, A=1 and B=0 produces Y=0. Switching B to 1 produces Y=1. NOT uses only input A.',
    'AND=A·B; OR=A+B (Boolean); XOR=A⊕B. NAND/NOR/XNOR invert their corresponding outputs. NOT=¬A.',
    'Ideal two-state Boolean logic. No voltage thresholds, propagation delay, fan-out ' +
      'or unknown/high-impedance states. Input B is ignored for NOT.',
  ],
  fulladder: [
    'Add three single-bit inputs and separate the sum from the carry.',
    'For A=B=Cin=1, what are Cout and S?',
    ['Cout=1, S=1', 'Cout=0, S=1', 'Cout=1, S=0'],
    'The arithmetic total is 3, whose two-bit representation is 11.',
    'A=1, B=1, Cin=0 gives total 2: Cout=1 and S=0.',
    'S=A⊕B⊕Cin; Cout=(A·B)∨(Cin·(A⊕B)). Arithmetic check: A+B+Cin=2Cout+S.',
    'Ideal one-bit combinational adder. The truth table includes all eight input ' +
      'combinations. Ripple-carry delay and physical gate implementation are not ' +
      'modeled.',
  ],
  flipflop: [
    'Step positive clock edges and compare D capture, T toggle, and JK behavior.',
    'For a JK flip-flop, what happens when J=K=1 at an active clock edge?',
    ['Q toggles', 'Q always becomes 1', 'Q is invalid'],
    'JK defines the 11 case as toggle, unlike an invalid SR latch input combination.',
    'A D flip-flop initialized at 0 captures the default sequence 1,0,1,1,0,0,1,0. Q ' +
      'ends at 0 after six transitions.',
    'At each positive edge: D→Qnext=D; T→Qnext=Q⊕T; JK→Qnext=J¬Q∨¬K Q.',
    'Ideal edge-sampled model. Each sequence entry is a value immediately before one ' +
      'positive clock edge. No asynchronous reset, setup/hold timing, metastability or ' +
      'propagation delay.',
  ],
  counter: [
    'Watch bit patterns change as an ideal synchronous counter wraps around its modulus.',
    'What follows 1111 in a four-bit up counter?',
    ['0000', '10000 in the same four bits', '1110'],
    'Modulo-16 arithmetic discards the carry beyond the fourth bit.',
    'A four-bit up counter starting at 0 reaches 4 after 20 edges and wraps once at edge 16.',
    'Qnext=(Q±1) mod 2^b. The count is unsigned; bit strings are padded to b positions.',
    'Ideal synchronous binary counter, no ripple delay, clock gating or invalid state ' +
      'encoding. Use the step control to inspect individual clock edges.',
  ],
  fsm: [
    'Step a Moore machine that detects overlapping occurrences of the bit pattern 101.',
    'How many detections occur in 10101?',
    ['Two', 'One', 'Three'],
    'The final 1 of the first occurrence can begin the second occurrence.',
    'The default stream 10101101 contains detections ending at positions 3, 5 and 8 (one-based).',
    'States: S0=no prefix, S1=1, S2=10, S3=101 detected. Transition rows for inputs ' +
      '0/1: S0→S0/S1; S1→S2/S1; S2→S0/S3; S3→S2/S1.',
    'Ideal positive-edge Moore machine with overlapping detection. Output is high in ' +
      'S3 after consuming the active input bit. No HDL synthesis, gate delay or ' +
      'physical timing model.',
  ],
  cache: [
    'Split addresses into block, set and tag, and follow deterministic least-recently-used replacement.',
    'Can greater associativity reduce conflict misses for the same set count?',
    ['Yes', 'Never', 'Only if addresses are negative'],
    'More ways let blocks with the same set index coexist, though cache capacity also grows here.',
    'For 16-byte blocks, 4 sets, 1 way and trace [0,16,0,64,0,16], there are 2 hits ' +
      'and 4 misses. With 2 ways there are 3 hits and 3 misses.',
    'block=floor(address/B); set=block mod S; tag=floor(block/S). A hit requires a ' +
      'matching valid tag; a full set evicts its least recently accessed way.',
    'Cold-start cache, byte addresses, read-only references and deterministic LRU. ' +
      'Changing associativity with fixed set count changes capacity. No dirty/write ' +
      'policies, multilevel cache, timing or prefetching.',
  ],
};
