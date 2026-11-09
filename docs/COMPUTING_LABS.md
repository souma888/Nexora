# Twenty more DSA and Computer Engineering labs

These additions are available through the persistent discipline sidebar and searchable catalog. DSA has 55 labs; Digital Logic & Computer Engineering has 16. Nexora has 129 labs across 12 sections.

Every lab includes editable inputs, a prediction question, a worked example, governing rules, explicit limits, and a reproducible browser/API solver. DSA labs support play/pause, keyboard scrubbing, pseudocode highlights, immutable state snapshots and operation counters. Computer Engineering labs expose bit words or state diagrams, probe-linked tables, plots, metrics, and microstep playback where state evolves. The workbench preserves the existing theme and responsive layout; dense bit words and tables scroll inside their panels.

## Data Structures & Algorithms

Open `/algorithms.html?lab=ID`. Inputs are deliberately bounded for readable traces; complexity describes the algorithm excluding stored teaching snapshots.

| ID | Lab / convention | Domain and independent reference |
| --- | --- | --- |
| `twopointers` | Sort a copy with original indexes; move opposite endpoints toward a target | 1–16 signed entries; one distinct-index pair, not all pairs. `[1,4,6,8,10,12]`, target 14 returns 4+10. Exhaustive pair enumeration includes duplicates, negatives and no pair. Sorting costs O(n log n), scan O(n). |
| `slidingwindow` | Maximum sum of exactly k consecutive entries; earliest tie wins | k must fit the array; negative totals remain valid. `[2,1,5,1,3,2]`, k=3 → 9 at inclusive indexes 2–4. All window lengths tested against direct sums. O(n). |
| `prefixrange` | P[0]=0; P[i+1]=P[i]+a[i]; inclusive query P[r+1]−P[l] | Zero-based in-range l≤r. `[3,-2,5,1,4]`, [2,4] → 10. Every interval checked against direct summation. O(n) preparation and O(1) query. |
| `quickselect` | Last-pivot Lomuto selection; k is one-based and counts duplicates | k must fit 1–16 entries. `[9,3,7,1,8,2]`, k=3 → 3. All ranks checked against a sorted reference; output is partitioned, not necessarily sorted. Average O(n), worst O(n²). |
| `nextgreater` | Decreasing unresolved-index stack; strictly greater, first value to the right | `[4,5,2,10,8]` → `[5,10,10,null,null]`. Equal values do not qualify. Compared against a quadratic search. O(n) amortized. |
| `huffman` | Repeatedly merge two minimum-weight trees; stable node-ID ties; edges 0/1 | 1–8 positive frequencies, symbols A onward. `[5,9,12,13,16,45]` → weighted length 224, average 2.24. Prefix-free property and merge-cost identity checked. Singleton uses `0`. Header costs excluded. The implemented sorted queue costs O(n² log n); a heap would improve it. |
| `tarjan` | Discovery indexes, low links, active stack, SCC completion | Six directed vertices 0–5 including isolated nodes; weights ignored. Default SCCs `{0,1,2}`, `{3,4}`, `{5}`. Components checked against all-pairs mutual reachability, including edges to completed components. O(V+E). |
| `subsetsum` | 0/1 reachability DP reads the previous row; backtracking prefers exclusion on ties | Up to eight values 0–20, target 0–40. Target 12 in `[3,5,7,9,11]` → indexes [1,2], values [5,7]. Compared to exhaustive subsets; target zero permits the empty subset. O(n·target). |
| `matrixchain` | Interval DP minimizes left cost + right cost + d[i]d[k+1]d[j+1] | 2–8 dimensions, each 1–50. `[40,20,30,10,30]` → 26,000 scalar multiplications. Exhaustive parenthesizations check small cases; a single matrix costs zero. O(n³). |
| `nqueens` | Ascending-column depth-first search with explicit conflict scans and removals | N=4–6, first solution only. N=4 → columns [1,3,0,2]. All supported sizes checked for unique columns and nonattacking diagonals; frames show the actual partial board. Loose bound O(N!·N), search state O(N). |

## Digital Logic & Computer Engineering

Open `/simulation.html?lab=ID`. All arithmetic is exact within these bounded integer domains. Metrics report the completed result while the probe inspects individual intermediate states.

| ID | Lab / governing rule | Domain and independent reference |
| --- | --- | --- |
| `alu` | ADD/SUB/AND/OR/XOR/one-bit logical shifts; result modulo 2^w | Width 4–8; unsigned operands must fit. 4-bit 7+3 → 1010, unsigned 10, signed −6, C=0, V=1. Exhaustive 4-bit add/sub tests distinguish signed overflow from carry; SUB C means no borrow. Logic clears C/V; shifts set C from the discarded bit and clear V. Table includes N/Z. |
| `twos` | Encode x mod 2^w; negate by invert+1 and wrap | Signed word must fit width 4–8. 8-bit −5 → 11111011 → invert 00000100 → negate 00000101. All 4-bit inputs checked. Minimum signed value wraps to itself with an overflow warning. |
| `booth` | Inspect Q0,Q−1: 01 adds M, 10 subtracts M; arithmetic right shift | Signed operands fit width 4–8. Uses w+1 accumulator bits for minimum operands; final signed product has 2w bits. All 256 four-bit pairs plus eight-bit extremes checked against exact multiplication. −3×5=−15; −8×−8=64. Add/sub and shift are separate microsteps. |
| `division` | Shift A,Q left; subtract divisor; restore if negative, otherwise set Q0 | Unsigned width 4–8, nonzero divisor. 13/3 → quotient 4, remainder 1. Exhaustive four-bit pairs checked against floor division and remainder; wide trial accumulator preserves negative subtraction states. |
| `hamming` | Even parity at positions 1,2,4; syndrome locates one flipped position | Four data bits at positions 3,5,6,7, MSB first, position 1 displayed left. Data 10 encodes to 1011010; error at position 5 gives syndrome 5 and recovers 10. All 16 data values × eight injection choices checked. No overall parity bit: this is single-error correction, not SECDED. |
| `crc` | GF(2) polynomial long division: append r zeros, XOR, transmit remainder | 1–16 message bits; generators 1011, 1101 or 10011. Optional error position must fit transmitted length. Intact words have zero receiver remainder; every single-bit flip is detected. Encoder remainder checked using independent integer-polynomial division. Generator alignment and XOR offsets appear in the microsteps. No reflection, seed, final XOR, correction, or industrial CRC profile. |
| `shiftregister` | Left inserts at LSB; right inserts at MSB; outgoing bit uses the old word | Width 4–8; up to 16 serial bits. From zero, 4-bit left input 101100 → 1100 (12). Both directions checked against an independent bit-string queue including shifted-out bits. Ideal positive clock edges, no propagation delay. |
| `roundrobin` | FIFO ready queue; run min(quantum,remaining), requeue incomplete process | Up to six bursts, all arrive at zero, no blocking. [5,3,1], q=2 → completion [9,8,5], mean waiting 13/3, makespan 9. Cost 1 between different process IDs gives makespan 14. No cost on initial dispatch or sole-process continuation. Work conservation and switch accounting tested. |
| `paging` | FIFO admission order, LRU last access, or circular Clock reference bits | 2–5 empty physical frames; up to 20 references. Default three-frame trace → Clock faults 7, hits 1; LRU faults 6. FIFO/LRU checked against independent ordered-list policies. Clock clearing steps remain separate from reference counts. No dirty-page or transfer-time model. |
| `branch` | Predict from old state, then update one-bit history or saturating 2-bit counter | Up to 24 outcomes. One-bit states 0/1; two-bit states 0–3, 0/1 predict NT and 2/3 T. Default TTTTNTTTTN from state 1 → three misses. Tests verify saturation, one-bit alternation and two opposite outcomes to reverse strongly taken. One static branch, no aliasing or pipeline penalties. |

## Contracts and release checks

`backend/dsa-more-definitions.js` defines DSA schemas and teaching metadata; `backend/dsa-more.js` produces immutable traces. Computer Engineering definitions and pure solvers live in `backend/computer-engineering.js`. `GET /api/algorithms` and `GET /api/waves` discover the versioned definitions. POST requests use `{model,input}` and reject invalid fields with HTTP 422 and the existing `INVALID_INPUT` contract. Cross-field rules enforce word width, valid rank/window sizes, CRC error position and one-bit predictor state. Browser calculations import the same solver modules as the APIs.

Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run test:e2e` on Windows. `tests/dsa-more.test.js` and `tests/computer-engineering.test.js` contain the independent reference checks above. Integer results are exact; computed averages use absolute tolerance 1e−9. The maximum allowed subset-sum trace is checked below 3 MB. Browser tests cover every default addition on desktop/mobile, API agreement, persistent navigation, input errors, predictions, presets, microsteps and reset. Screenshot baselines cover bit words, page frames, Huffman trees and N-Queens. GitHub Actions runs the same release checks.

## Teaching references

- [Cornell CS312: Huffman coding](https://www.cs.cornell.edu/courses/cs312/2005sp/lectures/rec26.html): minimum-frequency merging, prefix codes and weighted code lengths.
- [MIT 6.006: parenthesization and dynamic programming](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/76f04a14b5c609e5157e7423ab083821_ocZMDMZwhCY.pdf): interval subproblems and multiplication-order cost.
- [UC San Diego CSE140L: Booth multiplication](https://cse140l.github.io/fa24-labs/docs/lab2/booths.html): recoding transitions, signed shifts and the extra accumulator bit.
- [University of Florida: computer arithmetic](https://www.cise.ufl.edu/~mssz/CompOrg/CDA-arith.html): ALU, two’s complement, multiplication and division.
- [OSTEP: scheduling](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) and [memory replacement policies](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf): round robin, overhead, FIFO/LRU and Clock.
- [CMU 15-441: data-link error control](https://www.cs.cmu.edu/~prs/15-441-F16/lectures/04-datalink.pdf): Hamming distance and polynomial CRC division.
- [MIT 6.5900: branch prediction](https://csg.csail.mit.edu/6.5900/Lectures/L08split.pdf): one-bit history and two-bit counter hysteresis.

These teaching references inform the models. The reference-case badge describes the automated checks above and does not imply professional hardware or operating-system certification.
