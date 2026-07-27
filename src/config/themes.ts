import { secureRandomIndex } from '../lib/random'

interface ThemePreview {
  bg: string
  surface: string
  accent: string
  text: string
}

interface ThemeMeta {
  label: string
  preview: ThemePreview
  dynamic?: boolean
}

const baseThemes = {
  dark: { label: 'Dark', preview: { bg: '#1e1e24', surface: '#282a30', accent: '#8b95a5', text: '#e8eaed' } },
  light: { label: 'Light', preview: { bg: '#eceef0', surface: '#f5f6f8', accent: '#8b95a5', text: '#1e2024' } },
  gruvbox: { label: 'Gruvbox', preview: { bg: '#1d2021', surface: '#282828', accent: '#83a598', text: '#fbf1c7' } },
  'gruvbox-light': { label: 'Gruvbox Light', preview: { bg: '#fbf1c7', surface: '#f2e5bc', accent: '#458588', text: '#282828' } },
  'tokyo-night': { label: 'Tokyo Night', preview: { bg: '#1a1b26', surface: '#1f2335', accent: '#7aa2f7', text: '#c0caf5' } },
  dracula: { label: 'Dracula', preview: { bg: '#282a36', surface: '#343746', accent: '#bd93f9', text: '#f8f8f2' } },
  'ayu-dark': { label: 'Ayu Dark', preview: { bg: '#0f1419', surface: '#14191f', accent: '#39bae6', text: '#e6b450' } },
  'ayu-mirage': { label: 'Ayu Mirage', preview: { bg: '#171b24', surface: '#1f2430', accent: '#5ccfe6', text: '#cccac2' } },
  catppuccin: { label: 'Catppuccin', preview: { bg: '#1e1e2e', surface: '#252538', accent: '#89b4fa', text: '#cdd6f4' } },
  nord: { label: 'Nord', preview: { bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0', text: '#eceff4' } },
  'one-dark-pro': { label: 'One Dark Pro', preview: { bg: '#282c34', surface: '#2c323c', accent: '#61afef', text: '#abb2bf' } },
  solarized: { label: 'Solarized', preview: { bg: '#002b36', surface: '#073642', accent: '#268bd2', text: '#839496' } },
  'catppuccin-latte': { label: 'Catppuccin Latte', preview: { bg: '#eff1f5', surface: '#e6e9ef', accent: '#1e66f5', text: '#4c4f69' } },
  'rose-pine-dawn': { label: 'Rosé Pine Dawn', preview: { bg: '#faf4ed', surface: '#fffaf3', accent: '#286983', text: '#575279' } },
  'serika-dark': { label: 'Serika Dark', preview: { bg: '#323437', surface: '#2c2e31', accent: '#e2b714', text: '#d1d0c5' } },
  'github-light': { label: 'GitHub Light', preview: { bg: '#ffffff', surface: '#f6f8fa', accent: '#0969da', text: '#1f2328' } },
  '8008': { label: '8008', preview: { bg: '#333a45', surface: '#3f4754', accent: '#f44c7f', text: '#e9ecf0' }, dynamic: true },
  '9009': { label: '9009', preview: { bg: '#eeebe2', surface: '#e5e1d6', accent: '#080808', text: '#080808' }, dynamic: true },
  aether: { label: 'Aether', preview: { bg: '#101820', surface: '#17232d', accent: '#e5b567', text: '#d9e1e8' }, dynamic: true },
  alpine: { label: 'Alpine', preview: { bg: '#6c687f', surface: '#7a768c', accent: '#c1a7e2', text: '#f5f5f5' }, dynamic: true },
  'anti-hero': { label: 'Anti Hero', preview: { bg: '#1b1b1b', surface: '#252525', accent: '#ff3d71', text: '#f6f6f6' }, dynamic: true },
  arch: { label: 'Arch', preview: { bg: '#0c0d11', surface: '#17191f', accent: '#1793d1', text: '#f6f6f6' }, dynamic: true },
  aurora: { label: 'Aurora', preview: { bg: '#011926', surface: '#0b2937', accent: '#00e5c0', text: '#d7f7f3' }, dynamic: true },
  beach: { label: 'Beach', preview: { bg: '#fee6c9', surface: '#f9d6ab', accent: '#ff7a59', text: '#24424a' }, dynamic: true },
  bento: { label: 'Bento', preview: { bg: '#2d394d', surface: '#37465d', accent: '#ffbd59', text: '#ffffff' }, dynamic: true },
  bingsu: { label: 'Bingsu', preview: { bg: '#b5e8e0', surface: '#d1f3ed', accent: '#f58fb4', text: '#264653' }, dynamic: true },
  bliss: { label: 'Bliss', preview: { bg: '#262b44', surface: '#323854', accent: '#f6bd60', text: '#f7f7ff' }, dynamic: true },
  'blue-dolphin': { label: 'Blue Dolphin', preview: { bg: '#003950', surface: '#0c4f66', accent: '#ffce4a', text: '#e7f7ff' }, dynamic: true },
  botanical: { label: 'Botanical', preview: { bg: '#1d3028', surface: '#294236', accent: '#e5c07b', text: '#e8f0df' }, dynamic: true },
  bouquet: { label: 'Bouquet', preview: { bg: '#17313e', surface: '#214454', accent: '#f6a6c1', text: '#eef4f6' }, dynamic: true },
  breeze: { label: 'Breeze', preview: { bg: '#f0f7ff', surface: '#dcecfb', accent: '#5d9cec', text: '#2e4057' }, dynamic: true },
  bushido: { label: 'Bushido', preview: { bg: '#1e1b18', surface: '#2b2622', accent: '#e36b6b', text: '#e8dcc8' }, dynamic: true },
  cafe: { label: 'Cafe', preview: { bg: '#2a1f1a', surface: '#382a22', accent: '#d49a6a', text: '#f1dfcf' }, dynamic: true },
  camping: { label: 'Camping', preview: { bg: '#1f2c2b', surface: '#2b3d39', accent: '#f4b860', text: '#f6f1d1' }, dynamic: true },
  carbon: { label: 'Carbon', preview: { bg: '#313131', surface: '#3d3d3d', accent: '#f66e0d', text: '#e6e6e6' }, dynamic: true },
  'chaos-theory': { label: 'Chaos Theory', preview: { bg: '#14121b', surface: '#211d2b', accent: '#bd93f9', text: '#e6dbff' }, dynamic: true },
  cheesecake: { label: 'Cheesecake', preview: { bg: '#f8f0e3', surface: '#f1e3cd', accent: '#d8875f', text: '#51413a' }, dynamic: true },
  'cherry-blossom': { label: 'Cherry Blossom', preview: { bg: '#2b2026', surface: '#392b32', accent: '#f7a8b8', text: '#fce8ee' }, dynamic: true },
  comfy: { label: 'Comfy', preview: { bg: '#4d4a49', surface: '#5c5857', accent: '#d6a76d', text: '#f4ede2' }, dynamic: true },
  copper: { label: 'Copper', preview: { bg: '#442b23', surface: '#54362c', accent: '#d68a59', text: '#f3e4d8' }, dynamic: true },
  creamsicle: { label: 'Creamsicle', preview: { bg: '#fff0df', surface: '#ffe2c1', accent: '#ff8b5d', text: '#4a3027' }, dynamic: true },
  cyberspace: { label: 'Cyberspace', preview: { bg: '#0b1020', surface: '#151b30', accent: '#00d9ff', text: '#e8f6ff' }, dynamic: true },
  'dark-magic-girl': { label: 'Dark Magic Girl', preview: { bg: '#211527', surface: '#2d1d35', accent: '#ff7eb6', text: '#f9e6ff' }, dynamic: true },
  darling: { label: 'Darling', preview: { bg: '#251f25', surface: '#332a33', accent: '#ff6b9a', text: '#f6e9ef' }, dynamic: true },
  deku: { label: 'Deku', preview: { bg: '#133d34', surface: '#1b5145', accent: '#f5c84c', text: '#e8f6ef' }, dynamic: true },
  'desert-oasis': { label: 'Desert Oasis', preview: { bg: '#2e2420', surface: '#403129', accent: '#e1a15c', text: '#f6e6cd' }, dynamic: true },
  diner: { label: 'Diner', preview: { bg: '#1e2b38', surface: '#293b4b', accent: '#ff6f61', text: '#f4f7fb' }, dynamic: true },
  dino: { label: 'Dino', preview: { bg: '#2c3a2c', surface: '#3a4c39', accent: '#d5e04b', text: '#f3f6df' }, dynamic: true },
  discord: { label: 'Discord', preview: { bg: '#313338', surface: '#3f4147', accent: '#5865f2', text: '#f2f3f5' }, dynamic: true },
  dollar: { label: 'Dollar', preview: { bg: '#203128', surface: '#2d4335', accent: '#85bb65', text: '#e8f3e8' }, dynamic: true },
  dots: { label: 'Dots', preview: { bg: '#121212', surface: '#1d1d1d', accent: '#ff4d6d', text: '#eeeeee' }, dynamic: true },
  earthsong: { label: 'Earthsong', preview: { bg: '#29231d', surface: '#383027', accent: '#e5b567', text: '#e8dfc8' }, dynamic: true },
  everblush: { label: 'Everblush', preview: { bg: '#141b1e', surface: '#232a2d', accent: '#8ccf7e', text: '#dadada' }, dynamic: true },
  fire: { label: 'Fire', preview: { bg: '#1f1010', surface: '#301818', accent: '#ff6b35', text: '#ffe8d6' }, dynamic: true },
  fleuriste: { label: 'Fleuriste', preview: { bg: '#f8f1e7', surface: '#f0e4d4', accent: '#bf6f8b', text: '#3f4a3c' }, dynamic: true },
  froyo: { label: 'Froyo', preview: { bg: '#26213a', surface: '#342d4d', accent: '#c792ea', text: '#f5efff' }, dynamic: true },
  'frozen-llama': { label: 'Frozen Llama', preview: { bg: '#2a3a4d', surface: '#354a61', accent: '#8be9fd', text: '#e9f8ff' }, dynamic: true },
  'future-funk': { label: 'Future Funk', preview: { bg: '#1a102a', surface: '#27183d', accent: '#ff4ecd', text: '#f7eaff' }, dynamic: true },
  godspeed: { label: 'Godspeed', preview: { bg: '#0e1b2b', surface: '#17283d', accent: '#f4c95d', text: '#eaf2ff' }, dynamic: true },
  grape: { label: 'Grape', preview: { bg: '#2b1e3d', surface: '#392850', accent: '#c77dff', text: '#f4ebff' }, dynamic: true },
  horizon: { label: 'Horizon', preview: { bg: '#1c1e26', surface: '#282a36', accent: '#e95678', text: '#e0e0e0' }, dynamic: true },
  incognito: { label: 'Incognito', preview: { bg: '#1e1e1e', surface: '#292929', accent: '#b0b0b0', text: '#f3f3f3' }, dynamic: true },
  laser: { label: 'Laser', preview: { bg: '#11111b', surface: '#1f1f2f', accent: '#ff00aa', text: '#f8f8ff' }, dynamic: true },
  lavender: { label: 'Lavender', preview: { bg: '#2a263b', surface: '#38334d', accent: '#b69cff', text: '#eeeaff' }, dynamic: true },
  lime: { label: 'Lime', preview: { bg: '#1d2718', surface: '#2a371f', accent: '#b7e34b', text: '#eff8d7' }, dynamic: true },
  luna: { label: 'Luna', preview: { bg: '#161b2d', surface: '#202844', accent: '#82aaff', text: '#e6edff' }, dynamic: true },
  'midnight-ocean': { label: 'Midnight Ocean', preview: { bg: '#071923', surface: '#0d2a36', accent: '#36c5d8', text: '#d8f3f5' }, dynamic: true },
  'neon-city': { label: 'Neon City', preview: { bg: '#100f1c', surface: '#1b1930', accent: '#ff4fd8', text: '#f4edff' }, dynamic: true },
  'paper-ink': { label: 'Paper Ink', preview: { bg: '#f3efe6', surface: '#fffdf7', accent: '#2f5d62', text: '#263238' }, dynamic: true },
  'forest-floor': { label: 'Forest Floor', preview: { bg: '#18231d', surface: '#243329', accent: '#a3c969', text: '#e4eedc' }, dynamic: true },
  'volcanic-ash': { label: 'Volcanic Ash', preview: { bg: '#1c1918', surface: '#2b2523', accent: '#f0845b', text: '#f5e9df' }, dynamic: true },
  'candy-floss': { label: 'Candy Floss', preview: { bg: '#fff0f6', surface: '#ffe1ed', accent: '#e96aa7', text: '#4a2940' }, dynamic: true },
  'deep-space': { label: 'Deep Space', preview: { bg: '#090d1a', surface: '#121a2b', accent: '#9b8cff', text: '#e5e9ff' }, dynamic: true },
  'moss-and-stone': { label: 'Moss and Stone', preview: { bg: '#292c28', surface: '#3b4038', accent: '#b8c47d', text: '#edf0df' }, dynamic: true },
  'apricot-sunrise': { label: 'Apricot Sunrise', preview: { bg: '#fff3e4', surface: '#ffe3c2', accent: '#ed8854', text: '#50352a' }, dynamic: true },
  'plum-night': { label: 'Plum Night', preview: { bg: '#211729', surface: '#30203d', accent: '#d78cff', text: '#f5eaff' }, dynamic: true },
  'teal-noir': { label: 'Teal Noir', preview: { bg: '#0d2022', surface: '#153437', accent: '#57d3c8', text: '#d9f2ef' }, dynamic: true },
  'rustic-paper': { label: 'Rustic Paper', preview: { bg: '#e9dfd0', surface: '#f6eee3', accent: '#a75138', text: '#3d3028' }, dynamic: true },
  'electric-lime': { label: 'Electric Lime', preview: { bg: '#101b16', surface: '#1b2b21', accent: '#c7f34a', text: '#eef8da' }, dynamic: true },
  'blue-hour': { label: 'Blue Hour', preview: { bg: '#15243a', surface: '#203653', accent: '#8bb9ef', text: '#e6f0ff' }, dynamic: true },
  'terracotta': { label: 'Terracotta', preview: { bg: '#2a1b19', surface: '#3d2722', accent: '#e07a5f', text: '#f6e2d7' }, dynamic: true },
  'mint-condition': { label: 'Mint Condition', preview: { bg: '#e8f5ef', surface: '#d4eee2', accent: '#218c74', text: '#193b35' }, dynamic: true },
  'royal-purple': { label: 'Royal Purple', preview: { bg: '#171127', surface: '#251a3b', accent: '#a77bff', text: '#eee7ff' }, dynamic: true },
  'sakura-mist': { label: 'Sakura Mist', preview: { bg: '#fff6f8', surface: '#ffe8ee', accent: '#d86b8a', text: '#482b37' }, dynamic: true },
  'cobalt-night': { label: 'Cobalt Night', preview: { bg: '#0a1226', surface: '#132044', accent: '#4f8cff', text: '#e1eaff' }, dynamic: true },
  'golden-hour': { label: 'Golden Hour', preview: { bg: '#272016', surface: '#3a2d1b', accent: '#f2bd55', text: '#fff0c9' }, dynamic: true },
  'sea-glass': { label: 'Sea Glass', preview: { bg: '#dff1ef', surface: '#c5e4e1', accent: '#278c91', text: '#23494c' }, dynamic: true },
  'charcoal-rose': { label: 'Charcoal Rose', preview: { bg: '#242022', surface: '#342c30', accent: '#d78a9e', text: '#f2e4e8' }, dynamic: true },
  'citrus-grove': { label: 'Citrus Grove', preview: { bg: '#172019', surface: '#263322', accent: '#e8d34f', text: '#f4f2d9' }, dynamic: true },
  'arctic-dawn': { label: 'Arctic Dawn', preview: { bg: '#eaf4f7', surface: '#d8eaf0', accent: '#438ca7', text: '#243b45' }, dynamic: true },
  'black-cherry': { label: 'Black Cherry', preview: { bg: '#210f17', surface: '#361723', accent: '#e74f78', text: '#ffe4ec' }, dynamic: true },
  'saffron': { label: 'Saffron', preview: { bg: '#241d12', surface: '#382c18', accent: '#f0b429', text: '#fff2c7' }, dynamic: true },
  'rainy-window': { label: 'Rainy Window', preview: { bg: '#1b252d', surface: '#293640', accent: '#7eb6c9', text: '#e1edf1' }, dynamic: true },
  'peach-fuzz': { label: 'Peach Fuzz', preview: { bg: '#fff1eb', surface: '#ffe0d5', accent: '#e48674', text: '#54332c' }, dynamic: true },
  'olive-garden': { label: 'Olive Garden', preview: { bg: '#20261b', surface: '#303b26', accent: '#b5c76b', text: '#edf2d8' }, dynamic: true },
  'violet-smoke': { label: 'Violet Smoke', preview: { bg: '#201e2b', surface: '#302c40', accent: '#b69ad7', text: '#eee9f7' }, dynamic: true },
  'coral-reef': { label: 'Coral Reef', preview: { bg: '#10262a', surface: '#174047', accent: '#ff8978', text: '#e5faf7' }, dynamic: true },
  'linen': { label: 'Linen', preview: { bg: '#eee8dc', surface: '#faf6ee', accent: '#89745b', text: '#3c3832' }, dynamic: true },
  'laser-blue': { label: 'Laser Blue', preview: { bg: '#080f1b', surface: '#101d31', accent: '#00aaff', text: '#e4f5ff' }, dynamic: true },
  'wildflower': { label: 'Wildflower', preview: { bg: '#24212c', surface: '#342e40', accent: '#e6a4d5', text: '#f7eefa' }, dynamic: true },
  'cedar': { label: 'Cedar', preview: { bg: '#241a18', surface: '#382723', accent: '#c8795b', text: '#f3dfd3' }, dynamic: true },
  'pistachio': { label: 'Pistachio', preview: { bg: '#edf5dc', surface: '#dcebc0', accent: '#6b9b45', text: '#293d25' }, dynamic: true },
  'moonstone': { label: 'Moonstone', preview: { bg: '#20242e', surface: '#303746', accent: '#9fc3d6', text: '#eaf4f7' }, dynamic: true },
  'ember-glow': { label: 'Ember Glow', preview: { bg: '#211312', surface: '#39201b', accent: '#ff975e', text: '#ffe9d9' }, dynamic: true },
  'blueberry': { label: 'Blueberry', preview: { bg: '#17192e', surface: '#24274a', accent: '#8294ff', text: '#e9ecff' }, dynamic: true },
  'cactus-bloom': { label: 'Cactus Bloom', preview: { bg: '#18251f', surface: '#26372c', accent: '#ed8fb1', text: '#e7f2e7' }, dynamic: true },
  'lemon-cream': { label: 'Lemon Cream', preview: { bg: '#fffbe5', surface: '#fff3b8', accent: '#b08a00', text: '#403713' }, dynamic: true },
  'inkwash': { label: 'Inkwash', preview: { bg: '#17191c', surface: '#292d31', accent: '#aeb8c2', text: '#edf1f4' }, dynamic: true },
  'lagoon': { label: 'Lagoon', preview: { bg: '#062b31', surface: '#0d4147', accent: '#38d9c5', text: '#d9fbf6' }, dynamic: true },
  'rosewood': { label: 'Rosewood', preview: { bg: '#251719', surface: '#3b2225', accent: '#d58b7e', text: '#f7e6e1' }, dynamic: true },
} satisfies Record<string, ThemeMeta>

export const THEME_META = baseThemes
export type Theme = keyof typeof THEME_META
export const THEME_IDS: readonly Theme[] = Object.keys(THEME_META) as Theme[]
export const ADDED_COLOR_THEME_IDS: readonly Theme[] = THEME_IDS.slice(-44)

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && value in THEME_META
}

const CSS_VARIABLES = ['--bg', '--surface', '--surface-hover', '--border', '--border-active', '--text', '--text-muted', '--accent', '--red', '--green'] as const

export function applyThemePalette(theme: Theme): void {
  const meta: ThemeMeta | undefined = THEME_META[theme]
  if (!meta?.dynamic) {
    CSS_VARIABLES.forEach(variable => document.documentElement.style.removeProperty(variable))
    return
  }

  const { bg, surface, accent, text } = meta.preview
  const root = document.documentElement.style
  root.setProperty('--bg', bg)
  root.setProperty('--surface', surface)
  root.setProperty('--surface-hover', `color-mix(in srgb, ${surface} 82%, ${accent})`)
  root.setProperty('--border', `color-mix(in srgb, ${text} 13%, transparent)`)
  root.setProperty('--border-active', `color-mix(in srgb, ${accent} 70%, ${text})`)
  root.setProperty('--text', text)
  root.setProperty('--text-muted', `color-mix(in srgb, ${text} 60%, ${bg})`)
  root.setProperty('--accent', accent)
  root.setProperty('--red', '#f07178')
  root.setProperty('--green', '#9ccf7a')
}

export function randomTheme(excluding?: Theme): Theme {
  const choices = excluding ? THEME_IDS.filter(theme => theme !== excluding) : THEME_IDS
  return choices[secureRandomIndex(choices.length)] ?? 'dark'
}
