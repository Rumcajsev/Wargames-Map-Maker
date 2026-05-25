// Context-specific color palettes derived from wargame cartographic conventions
// (Ardennes '44, Holland '44 reference maps)

export const PALETTE_TERRAIN = [
  '#1e3d5a', '#2a5080', '#3a6898', '#4a78a8',
  '#5888b0', '#6aa8c0', '#7ab0c8', '#90c0d8',
  '#5a8878', '#6b9e8a', '#7ab0a0',
  '#c8bc9a', '#ddd4b8', '#ede8d5', '#f0e8d0',
  '#8aaa6a', '#a0bc70', '#b8cc88',
  '#3d6040', '#4d7a50', '#5a8a5a',
  '#887060', '#9e8c6a', '#b0a080',
] as const

export const PALETTE_TERRAIN_GROUPS = [
  { label: 'Blues',  colors: ['#1e3d5a', '#2a5080', '#3a6898', '#4a78a8', '#5888b0', '#6aa8c0', '#7ab0c8', '#90c0d8'] },
  { label: 'Teals',  colors: ['#5a8878', '#6b9e8a', '#7ab0a0'] },
  { label: 'Tans',   colors: ['#c8bc9a', '#ddd4b8', '#ede8d5', '#f0e8d0'] },
  { label: 'Greens', colors: ['#8aaa6a', '#a0bc70', '#b8cc88', '#3d6040', '#4d7a50', '#5a8a5a'] },
  { label: 'Browns', colors: ['#887060', '#9e8c6a', '#b0a080'] },
] as const satisfies { label: string; colors: string[] }[]

export const PALETTE_ROAD_SURFACE = [
  // Pale / white surfaces
  '#ffffff', '#f5f0e8', '#f0e8d0', '#e8dcc8',
  // Yellow / amber surfaces
  '#ffe8a8', '#ffe0a0', '#ffd080', '#f5d878',
  // Warm neutral surfaces
  '#f0e0b8', '#d8d8c0', '#d0cca8',
  // Red / crimson surfaces
  '#c83030', '#a02020', '#802020', '#d85050',
] as const

export const PALETTE_ROAD_CASING = [
  // Very dark / black
  '#1a1208', '#3a3020', '#4a3820',
  // Brown casings
  '#6a4828', '#8a5c2a', '#b07820',
  // Warm grey-brown
  '#786040', '#a09070',
  // Neutral grey
  '#606060', '#808060',
  // Dark red casings
  '#5a1010', '#781818', '#380808',
] as const

export const PALETTE_RAIL_LIGHT = [
  '#ffffff', '#f5f2ec', '#f0ece4', '#e8e0d0', '#d0c8b8', '#c0b8a8',
] as const

export const PALETTE_RAIL_DARK = [
  '#000000', '#0e0e0e', '#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4040',
] as const

export const PALETTE_SETTLEMENT_FILL = [
  // Wargame red (city)
  '#c0392b', '#e74c3c',
  // Blue (large town)
  '#2c3e50', '#2980b9', '#1a6090',
  // Grey (town)
  '#34495e', '#7f8c8d',
  // Other convention colors
  '#27ae60', '#f39c12', '#e67e22', '#8e44ad',
  // Black / white
  '#000000', '#ffffff',
] as const

export const PALETTE_SETTLEMENT_STROKE = [
  '#ffffff', '#f0e8d0', '#aaaaaa', '#555555', '#000000',
] as const

export const PALETTE_BUILDINGS = [
  // Terracotta / brick (from Ardennes '44 house style)
  '#c85040', '#b04030', '#9a3828', '#d87060',
  // Sandstone / plaster walls
  '#e8d8b0', '#d4b890', '#c8a878', '#b09868',
  // Olive / military drab
  '#5a6040', '#6a7050', '#7a8060', '#4a5030',
  // Stone / slate
  '#8a8070', '#706860', '#6a5848',
] as const

export const PALETTE_BUILDING_STROKE = [
  '#000000', '#1a1a1a', '#2a2a2a', '#3a2a1a', '#4a3828', '#3a4020',
] as const

export const PALETTE_HIGHLIGHTS = [
  // Allied / blue
  '#1133aa', '#2244cc', '#3355ee', '#6688dd', '#88aaff',
  // Axis / red
  '#aa1111', '#cc2222', '#dd4444', '#ee8888',
  // Supply / green
  '#116622', '#228833', '#44aa55', '#66cc77',
  // Objective / yellow-orange
  '#aa8800', '#ccaa00', '#eedd22', '#ff9900', '#dd6600',
  // Neutral
  '#ffffff', '#cccccc', '#888888', '#444444', '#000000',
  // Purple
  '#6622bb', '#8833aa',
] as const

export const PALETTE_RIVER = [
  // Blues — natural water
  '#3a6898', '#4a78a8', '#5888b0', '#6aa8c0', '#7ab0c8',
  // Deep blue
  '#2a5080', '#1e3d5a',
  // Teal / blue-green
  '#3a8878', '#4a9890', '#5aaa9a',
  // Grey-blue (stylised)
  '#607890', '#7090a0',
] as const

export const PALETTE_RIVER_OUTLINE = [
  '#1a3050', '#2a4060', '#1e3d5a', '#0a2030',
  '#2a5a4a', '#1a4040',
  '#000000', '#1a1a2a', '#2a2a3a',
] as const

export const PALETTE_CANAL = [
  // Teal / constructed water
  '#4a8878', '#5a9a8a', '#6aaa9a', '#3a7870',
  // Blue-green
  '#4a8898', '#5a98a8', '#3a7888',
  // Olive / muddy
  '#6a8860', '#7a9870', '#708a60',
  // Greys
  '#608080', '#708888',
] as const

export const PALETTE_CANAL_OUTLINE = [
  '#1a3028', '#2a4030', '#0a2020',
  '#3a3820', '#2a3018',
  '#000000', '#1a1a1a', '#2a2a2a',
] as const
