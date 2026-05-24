/** Registry of available terrain textures. Add an entry here when adding a new file to public/textures/. */

export interface TextureEntry {
  id: string
  label: string
  path: string
}

export const TEXTURE_REGISTRY: TextureEntry[] = [
  { id: 'forest',       label: 'Forest',       path: '/textures/forest.png' },
  { id: 'light_forest', label: 'Light Forest',  path: '/textures/lightforest.png' },
  { id: 'clear',        label: 'Grain',         path: '/textures/clear.png' },
  { id: 'marsh',        label: 'Marsh',         path: '/textures/marsh.png' },
  { id: 'beach',        label: 'Beach',         path: '/textures/beach.png' },
  { id: 'mountains',    label: 'Mountains',     path: '/textures/mountains.png' },
]
