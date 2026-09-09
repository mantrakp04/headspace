export const landingThemes = [
  'pearl',
  'night',
  'studio',
  'flyer',
  'manual',
] as const;

export type LandingTheme = (typeof landingThemes)[number];

export const landingThemeKey = 'headspace.landingTheme';

export const landingThemeOptions: ReadonlyArray<{
  id: LandingTheme;
  label: string;
}> = [
  { id: 'pearl', label: 'Pearl' },
  { id: 'night', label: 'Night' },
  { id: 'studio', label: 'Studio' },
  { id: 'flyer', label: 'Flyer' },
  { id: 'manual', label: 'Manual' },
];

export function isLandingTheme(value: string): value is LandingTheme {
  return landingThemes.some((theme) => theme === value);
}

export function readLandingTheme(): LandingTheme {
  if (globalThis.window === undefined) return 'pearl';
  const saved = window.localStorage.getItem(landingThemeKey);
  return saved && isLandingTheme(saved) ? saved : 'pearl';
}
