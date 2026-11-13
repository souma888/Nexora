/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  alu: [
    'Execute a bounded ALU word and distinguish unsigned carry from signed overflow.',
    'Can signed overflow occur without an unsigned carry?',
    ['Yes', 'No', 'Only for logical operations'],
    'Two positive signed operands can overflow the signed range while their unsigned total still fits.',
    'In four bits, 7+3 produces 1010: unsigned 10, signed −6, carry 0, overflow 1.',
    'Results are modulo 2^w. ADD carry is the discarded high bit; SUB carry means no ' +
      'borrow. Signed overflow tests the exact signed sum/difference against ' +
      '[−2^(w−1),2^(w−1)−1].',
    'Ideal combinational ALU, widths 4–8. Logical operations clear C/V; shifts set C ' +
      'to the shifted-out bit and clear V. Zero/negative flags appear in the state ' +
      'table. No timing or ISA encoding is modeled.',
  ],
  twos: [
    'Encode a signed integer, invert its bits, add one, and identify the asymmetric minimum-value case.',
    'Can the most negative signed value be negated in the same width?',
    [
      'No, its positive counterpart is out of range',
      'Yes, always',
      'Only when the word has an even number of bits',
    ],
    'The negative range includes −2^(w−1), but the positive range ends at 2^(w−1)−1.',
    'At eight bits, −5 is 11111011. Invert to 00000100 and add one to obtain +5 as 00000101.',
    'An integer x is encoded as x mod 2^w. Negation is (~encoded+1) mod 2^w. Decode a ' +
      'word ≥2^(w−1) by subtracting 2^w.',
    'Integer two’s-complement representation only. No floating point, saturation or ' +
      'physical carry propagation. The minimum signed input wraps to itself and is ' +
      'explicitly flagged.',
  ],
  booth: [
    'Inspect add/subtract decisions and arithmetic right shifts for signed multiplication.',
    'What does pair Q0,Q−1=10 request?',
    ['Subtract the multiplicand', 'Add the multiplicand', 'Skip the shift'],
    'Booth recodes a transition into the start of a run of ones as a subtraction.',
    'Four-bit operands −3 and 5 produce −15 after four Booth cycles.',
    'Inspect (Q0,Q−1): 01 → A+=M; 10 → A−=M; 00/11 → no add. Then arithmetic-shift ' +
      'the combined A,Q,Q−1 right. Repeat w times.',
    'The accumulator uses w+1 bits so the minimum negative operand is handled ' +
      'correctly. Q has w bits, and the final signed product is reported in 2w bits. ' +
      'Microsteps are conceptual, without gate delays.',
  ],
  division: [
    'Shift the partial remainder, try a subtraction, and restore when the trial goes negative.',
    'When the trial remainder is negative, what quotient bit is appended?',
    ['0', '1', 'The divisor’s sign bit'],
    'A failed subtraction is restored, meaning the divisor did not fit at that position.',
    'Unsigned 13 divided by 3 yields quotient 4 and remainder 1; 13=4×3+1.',
    'Shift A,Q left; trial=A−M. If trial≥0, keep it and set Q0=1; otherwise restore A ' +
      'and keep Q0=0. Repeat w times.',
    'Unsigned integer division only, divisor nonzero. A wide trial accumulator avoids ' +
      'arithmetic truncation. Negative trial states are displayed in two’s complement; ' +
      'completed remainders are nonnegative.',
  ],
  hamming: [
    'Place parity bits, inject one channel error, and use the syndrome to correct its position.',
    'What does a zero syndrome prove in this single-error teaching model?',
    [
      'No injected single-bit error remains',
      'No possible multi-bit error exists',
      'Every bit must be zero',
    ],
    'A Hamming (7,4) syndrome locates one flipped bit but is not a guarantee against ' +
      'arbitrary multi-bit corruption.',
    'Data bits occupy positions 3,5,6,7; parity bits occupy 1,2,4. Injecting an error ' +
      'at position 5 gives syndrome 5 and recovers the original data.',
    'Use even parity over positions selected by each binary position bit. Syndrome = ' +
      's1+2s2+4s4; flip that position if nonzero.',
    'Single-error correction without an extra overall parity bit. This is not SECDED: ' +
      'two-bit errors may be miscorrected. Position 1 is displayed at the left, and ' +
      'data is mapped most-significant bit first.',
  ],
  crc: [
    'Append zero bits, perform modulo-2 long division, and verify a transmitted codeword.',
    'Does modulo-2 subtraction need borrowing?',
    ['No, it is XOR', 'Yes, exactly as decimal subtraction', 'Only for odd polynomials'],
    'Arithmetic is over GF(2), where addition and subtraction are both XOR.',
    'For generator 1011, append three zeros to the message. The remainder becomes the ' +
      'CRC suffix; dividing the intact codeword gives zero.',
    'If G has degree r, divide M(x)x^r by G(x); send M followed by the r-bit ' +
      'remainder. The receiver divides the whole received word without appending more ' +
      'zeros.',
    'Teaching CRCs with explicit polynomials, no reflection, initial seed, final XOR ' +
      'or byte framing. These are not named industrial CRC profiles. Only one optional ' +
      'channel bit is flipped; this lab detects errors but does not correct them.',
  ],
  shiftregister: [
    'Move a serial stream through a bounded register and observe the outgoing bit at each edge.',
    'Where does a new bit enter during a left shift?',
    ['The least significant bit', 'The most significant bit', 'Both ends'],
    'Left shift moves existing bits toward higher positions and makes the low bit available for input.',
    'A four-bit left-shifting register starting at zero and receiving 1,0,1,1,0,0 finishes as 1100 (12).',
    'Left: Qnext=((Q<<1)|input) mod 2^w, out=old MSB. Right: Qnext=(Q>>1)|(input<<(w−1)), out=old LSB.',
    'Ideal edge-triggered register with a zero-delay serial input. Output bits are ' +
      'the values shifted out before the update, not the new end bits.',
  ],
  roundrobin: [
    'Rotate runnable processes, account for switch overhead, and inspect completion and waiting times.',
    'Does reducing the quantum always improve total completion time?',
    ['No, switching overhead can increase', 'Yes, without exception', 'Only when all bursts match'],
    'More frequent process switches can consume a greater fraction of the CPU time.',
    'Bursts [5,3,1], quantum 2 and zero overhead complete at times [9,8,5]; mean waiting time is 13/3.',
    'Run min(quantum,remaining) from the FIFO ready queue. An unfinished process ' +
      'joins the rear. With all arrivals at zero, turnaround=completion and ' +
      'waiting=completion−burst.',
    'All processes arrive at time zero, have one CPU burst and never block. Switch ' +
      'cost applies only between different process IDs; initial dispatch and ' +
      'immediately continuing the sole remaining process have no extra cost.',
  ],
  paging: [
    'Compare replacement decisions and inspect Clock reference-bit clearing before eviction.',
    'In Clock, what happens to a referenced page during a scan?',
    [
      'Its reference bit is cleared and it gets a second chance',
      'It is immediately evicted',
      'Its page number is incremented',
    ],
    'The hand clears a set reference bit and continues until it finds an unreferenced candidate.',
    'Use the same reference string and frame count for each policy. Hits do not add a ' +
      'page fault; Clock may show several inspection steps for one reference.',
    'FIFO evicts the oldest admitted page; LRU evicts the least recently accessed ' +
      'page; Clock uses a circular hand and one reference bit per frame.',
    'Initially empty physical frames, read-only references, no dirty/write-back costs ' +
      'or actual address translation. Clock microsteps are inspections, not additional ' +
      'memory references.',
  ],
  branch: [
    'Predict before updating and observe how counter hysteresis responds to an isolated loop exit.',
    'How many opposite outcomes can move a strongly taken two-bit state to predict not taken?',
    ['Two', 'One', 'Four'],
    'State 3 first becomes weakly taken (2), which still predicts taken; the next ' +
      'opposite outcome reaches 1.',
    'Two-bit states 0/1 predict not taken and 2/3 predict taken. For the default ' +
      'TTTTNTTTTN stream from state 1, there are three mispredictions.',
    'Predict from the old state. One-bit stores the actual outcome. Two-bit ' +
      'increments toward 3 for taken and decrements toward 0 for not taken, saturating ' +
      'at the endpoints.',
    'One static branch with no address-index aliasing, speculative update, history ' +
      'register or pipeline penalty. Clock-zero is an initial state, not a scored ' +
      'prediction.',
  ],
};
