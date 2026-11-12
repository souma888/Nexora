# Data Structures & Algorithms: 30 additional labs

This document covers the earlier batch of 30 additions. The section currently contains 55 labs, and Nexora contains 159 experiments in total; see [the next 20 computing labs](COMPUTING_LABS.md) for that release. The sidebar, catalog tags, and discipline selector consistently display **Data Structures & Algorithms**.

## New inventory

| Subject | New labs |
| --- | --- |
| Stacks and queues | Stack Operations, Queue Operations, Double-Ended Queue, Circular Queue Buffer |
| Linked lists | Singly Linked List, Doubly Linked List |
| Trees and priorities | Binary Search Tree, AVL Tree Rotations, Min-Heap Priority Queue |
| Hashing and sets | Hash Table: Chaining, Hash Table: Linear Probing, Disjoint Set Union |
| Prefix/range structures | Trie Prefix Search, Fenwick Tree Prefix Sums, Segment Tree Range Sums |
| Sorting | Counting Sort, LSD Radix Sort, Shell Sort |
| Graph algorithms | Topological Sort: Kahn, Kruskal’s Minimum Spanning Forest, Prim’s Minimum Spanning Forest, Floyd–Warshall All-Pairs Paths |
| String matching | Knuth–Morris–Pratt Search, Rabin–Karp Rolling Hash |
| Dynamic programming and arrays | Longest Common Subsequence, Levenshtein Edit Distance, Minimum Coin Change, Longest Increasing Subsequence, Kadane’s Maximum Subarray |
| Number theory | Sieve of Eratosthenes |

Every addition has editable inputs, a prediction question, four-step pseudocode, a worked example, complexity and invariant notes, reversible playback, operation counters, an accessible state table, and a structure-specific SVG. Tall/wide diagrams scroll inside their panel to retain readable text. Empty/full structures, duplicates, unreachable states and algorithm failure conditions are taught explicitly.

## Operation scripts

Separate operations with semicolons. Commands are case-insensitive, take space-separated integer arguments, and are limited to 24 operations. Values are −99 to 99. State-dependent failures such as removing from an empty structure or deleting an invalid position appear in the trace and preserve the data. Unknown commands or wrong argument counts are validation errors.

| Structure | Commands |
| --- | --- |
| Stack | `push value`, `pop`, `peek` |
| Queue / circular buffer | `enqueue value`, `dequeue`, `front` |
| Deque | `pushfront value`, `pushback value`, `popfront`, `popback`, `front`, `back` |
| Singly linked list | `append value`, `prepend value`, `insert index value`, `delete index`, `find value` |
| Doubly linked list | `append value`, `prepend value`, `delete index`, `reverse`, `find value` |
| Disjoint set | `union a b`, `find a`, `connected a b` |

Circular capacity is 1–8. Head and rear use modulo capacity; size distinguishes full from empty. Union–find has 2–10 elements, numbered from zero, with union by rank and path compression. Linked-list tables expose stable node identities and actual next/previous links. Structure diagrams and sequence snapshots are visualization machinery; copying/rendering that state is excluded from the model complexity displayed in the lab.

## Conventions and bounds

- Tree and array inputs contain 1–16 integers. BST/AVL ignore duplicate insertions; AVL uses cached heights and actual single/double rotations. Heap extraction can continue past exhaustion to demonstrate underflow.
- Modulo hashing normalizes negative keys. Chaining accepts collisions; linear probing wraps at capacity, rejects a full-table insertion, and has no deletion/tombstone operation. Hash capacity is 3–13.
- Trie words use lowercase a–z, up to eight words of eight letters. Terminal markers distinguish complete words from internal prefixes. Completions are lexicographic.
- Fenwick form indexes are zero-based; its internal tree is one-based and uses `i & -i`. Segment-tree bounds are inclusive. Range/update indexes must fit the current array.
- Counting-sort keys are −20…20; radix keys are 0…999. Counting placement scans right to left for stability. Radix digit buckets preserve order. Shell uses halving gaps and is not stable.
- Graphs have six nodes (0–5). Enter `from,to,weight` edges separated by semicolons. MST inputs are undirected: list each pair once. Prim and Kruskal include isolated nodes and return forests on disconnected graphs. Kahn ignores weights and reports a cycle if fewer than six nodes are emitted. Floyd allows negative weights and flags negative diagonal entries; it does not certify shortest paths when a negative cycle exists.
- String search uses up to 48 ASCII characters in the text and 16 in the pattern; both are nonempty and matching is case-sensitive. Overlapping matches count. Rabin–Karp uses base 31/modulus 101 and verifies every hash hit, so collisions cannot create false matches.
- LCS/edit-distance strings have up to 12 characters. LCS ties prefer the upper cell; alternative optima are possible. Edit operations have unit cost and the returned alignment uses a minus sign for gaps.
- Coin change permits unlimited copies of positive denominations and target amounts 0–40. LIS is strictly increasing. Kadane returns a nonempty interval even for all-negative arrays. Sieve bounds are inclusive, 2–100.

## Reproducible checks and references

`tests/data-structures.test.js` checks pointer identities, queue wraparound/overflow, all four AVL rotation patterns, heap order, duplicate/negative hash keys, union–find membership, trie terminals, Fenwick blocks and segment sums. `tests/additional-algorithms.test.js` compares sorting with an independent ordering, MST weight with exhaustive spanning-tree enumeration, Floyd distances with exhaustive simple paths, string searches with naive matching, and DP results with exhaustive subsets or breadth-first search. A deliberate Rabin–Karp collision verifies character checking. Sieve results are compared with trial division.

Browser tests open all 55 DSA labs from the catalog on desktop/mobile and compare their displayed outcomes with real API calls. Additional checks cover scripts, validation, reset, keyboard rotation playback, range edits, string edits, capitalization and visual snapshots for trees, hash chains and prefix tables.

- [MIT 6.006 lecture notes](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/) — search trees, hashing, graph algorithms and dynamic programming.
- [Princeton Algorithms: Minimum Spanning Trees](https://algs4.cs.princeton.edu/43mst/index.php) — cut/cycle reasoning and Prim/Kruskal.
- [MIT 6.006 notes on hashing and Karp–Rabin](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2008/pages/lecture-notes/) — collision handling and rolling-hash context.
