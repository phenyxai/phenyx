const STELLAR_PALETTE = [
  '#CC3300', '#E84422', '#E87722', '#E8B822',
  '#D4C87A', '#C8C8C8', '#88AAEE', '#77BBFF',
  '#5599FF', '#4488EE', '#3366DD', '#2255CC',
  '#1144BB', '#0033AA'
];

export function getRandomStellarColor(): string {
  return STELLAR_PALETTE[
    Math.floor(Math.random() * STELLAR_PALETTE.length)
  ];
}

export function getStarLuminosity(age: number): number {
  return 0.35 + (age / 100) * 0.65;
}

export function getStarType(color: string): string {
  const types: Record<string, string> = {
    '#CC3300': 'red dwarf',
    '#E84422': 'red dwarf',
    '#E87722': 'orange dwarf',
    '#E8B822': 'yellow dwarf',
    '#D4C87A': 'yellow white',
    '#C8C8C8': 'white star',
    '#88AAEE': 'blue white',
    '#77BBFF': 'light blue',
    '#5599FF': 'blue',
    '#4488EE': 'strong blue',
    '#3366DD': 'blue giant',
    '#2255CC': 'blue supergiant',
    '#1144BB': 'deep supergiant',
    '#0033AA': 'hyperstar'
  };
  return types[color] ?? 'star';
}

export { STELLAR_PALETTE };
