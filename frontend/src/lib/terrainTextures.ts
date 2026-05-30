export const TEXTURE_OPTIONS = [
  { id: 'forest',      label: 'Forest' },
  { id: 'lightforest', label: 'Light Forest' },
  { id: 'marsh',       label: 'Marsh' },
  { id: 'rough',       label: 'Rough' },
  { id: 'fields',      label: 'Fields' },
  { id: 'fields2',     label: 'Fields 2' },
  { id: 'light2',      label: 'Light 2' },
  { id: 'light3',      label: 'Light 3' },
  { id: '2clear',      label: 'Clear' },
] as const

export type TextureId = typeof TEXTURE_OPTIONS[number]['id']

export const DEFAULT_TERRAIN_TEXTURES: Record<string, string> = {
  woods:       'forest',
  light_woods: 'lightforest',
  marsh:       'marsh',
  clear:       '2clear',
}
