export const navigationGroups = [
  ['PHYSICAL ENGINEERING', ['civil', 'mechanical', 'thermofluids', 'materials']],
  ['CIRCUITS & SYSTEMS', ['electrical', 'electronics', 'signals', 'control']],
  ['COMPUTING & MACHINES', ['algorithms', 'digital', 'robotics', 'computational']],
  ['ENERGY & CONNECTIONS', ['energy', 'communications']],
  ['FLIGHT, PROCESS & OPERATIONS', ['aerospace', 'chemical', 'industrial']],
];
const paths = {
  civil: 'M3 20V9l9-6 9 6v11M6 20V11h12v9M3 15h18',
  mechanical:
    'm9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3ZM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  electrical: 'm13 2-9 12h7l-1 8 10-13h-7Z',
  electronics: 'M7 7h10v10H7ZM3 9h4m-4 6h4m10-6h4m-4 6h4M9 3v4m6-4v4m-6 10v4m6-4v4',
  signals: 'M2 12h3q3-16 6 0t6 0h5',
  control: 'M2 12h5m10 0h5M7 8h10v8H7ZM20 12v8H4v-8',
  algorithms: 'm8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18',
  digital: 'M4 4h16v12H4ZM9 20h6m-3-4v4M7 8h3m4 0h3m-10 4h10',
  robotics: 'M5 21h14M8 21v-5l6-5-5-6m5 6 5-5m-12-3 4 4m6-3 4 4',
  computational: 'M4 4h16v16H4ZM7 9h10m-7 4-3 4m0-4 3 4m4-3h3m-3 3h3',
  thermofluids: 'M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13ZM9 16q0 3 3 3',
  materials: 'm12 2 9 5v10l-9 5-9-5V7ZM3 7l9 5 9-5m-9 5v10',
  communications:
    'M12 10v12m-4 0h8M8 6a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 3a10 10 0 0 0 0 14m14-14a10 10 0 0 1 0 14',
  energy: 'M9 4H5v16h14V4h-4V2H9Zm4 4-5 6h4l-1 4 5-6h-4Z',
  aerospace: 'm2 14 8-4 2-8 2 8 8 4-8-1-1 7h-2l-1-7Z',
  chemical: 'M8 3h8m-6 0v7l-6 10h16l-6-10V3M7 15h10',
  industrial: 'M3 21V9l6 4V7l6 5V3h4v18ZM6 17h2m3 0h2m3 0h2',
};
export const disciplineIcon = (id) =>
  `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[id] ?? 'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z'}"/></svg>`;
