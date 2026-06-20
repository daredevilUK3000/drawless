// DrawLess atmospheric themes. Calm, architectural moods — never busy behind the
// play surface. Each theme defines page background + a SUBTLE canvas tint; the grid
// colour stays constant so the player's measuring tool is always crisp.
export type Theme = {
  id: string;
  name: string;
  premium: boolean;
  page: string;            // CSS background for the whole page
  canvasTop: string;       // canvas backdrop gradient (top)
  canvasBot: string;       // canvas backdrop gradient (bottom)
  ink: string;             // obstacle / text colour on canvas
  accent: string;          // player line colour
  grid: string;            // gridline colour (kept high-contrast for legibility)
};

export const THEMES: Theme[] = [
  // ---- FREE ----
  {
    id: 'daylight', name: 'Daylight', premium: false,
    page: 'radial-gradient(120% 80% at 50% -10%, #FBFCFB 0%, rgba(251,252,251,0) 55%), linear-gradient(180deg, #EEF2F1 0%, #E4E9EA 55%, #DCE2E4 100%)',
    canvasTop: '#F4F7F4', canvasBot: '#E7EEE9', ink: '#1B2733', accent: '#3346D3', grid: '#DEE4DD'
  },
  {
    id: 'dusk', name: 'Dusk', premium: false,
    page: 'linear-gradient(180deg, #2A2740 0%, #3B3354 45%, #4A3B5C 100%)',
    canvasTop: '#E9E6F2', canvasBot: '#DCD7EC', ink: '#2A2740', accent: '#6C4FE0', grid: '#CFC8E4'
  },
  // ---- PREMIUM (locked until premium launches) ----
  {
    id: 'deepspace', name: 'Deep Space', premium: true,
    page: 'radial-gradient(120% 90% at 70% 10%, #1B2740 0%, rgba(27,39,64,0) 60%), linear-gradient(180deg, #0B1020 0%, #131A2E 60%, #1A2238 100%)',
    canvasTop: '#E6EAF4', canvasBot: '#D6DCEC', ink: '#0B1020', accent: '#3E6BFF', grid: '#CBD3E6'
  },
  {
    id: 'forest', name: 'Forest', premium: true,
    page: 'linear-gradient(180deg, #1E3A2E 0%, #2A4A38 50%, #35563F 100%)',
    canvasTop: '#EAF1EA', canvasBot: '#DCE8DC', ink: '#1E3A2E', accent: '#2E9E6A', grid: '#CBDCC9'
  },
  {
    id: 'ocean', name: 'Ocean', premium: true,
    page: 'linear-gradient(180deg, #0E2A3A 0%, #144055 50%, #1B5066 100%)',
    canvasTop: '#E6F1F4', canvasBot: '#D6E8EC', ink: '#0E2A3A', accent: '#1C8FB0', grid: '#C8DEE4'
  },
  {
    id: 'dawn', name: 'Dawn', premium: true,
    page: 'linear-gradient(180deg, #3A2A3A 0%, #5C3B4A 45%, #7A4F52 100%)',
    canvasTop: '#F6EEEC', canvasBot: '#EFE0DC', ink: '#3A2A3A', accent: '#D2683E', grid: '#E4CFC8'
  }
];

export const DEFAULT_THEME = 'daylight';
export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}
