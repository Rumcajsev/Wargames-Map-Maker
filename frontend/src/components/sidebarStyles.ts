/** Shared style constants for all sidebar panels. */

import type { CSSProperties } from 'react'

export const sidebarStyle: CSSProperties = {
  width: 200,
  flexShrink: 0,
  background: '#0e0f18',
  borderRight: '1px solid #1e1f2e',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 12,
  color: '#a0a0c0',
  overflowY: 'auto',
  userSelect: 'none',
}

export const sectionStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #1e1f2e',
}

export const labelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  color: '#4a4a6a',
  textTransform: 'uppercase',
  marginBottom: 6,
}

export const modeBtn = (active: boolean): CSSProperties => ({
  flex: 1, padding: '3px 0', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
  background: active ? '#2a3a5a' : 'none', border: '1px solid #2a2a4a',
  color: active ? '#8ab0e0' : '#4a4a6a', borderRadius: 3, cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
})
