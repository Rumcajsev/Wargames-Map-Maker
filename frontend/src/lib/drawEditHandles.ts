/** Edit-mode handle overlays: road CPs, rail CPs, river nodes. Pure canvas — no React or store imports. */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type RoadCp = { key: string; pos: [number, number] }
export type RailCp = { key: string; pos: [number, number] }

export type SnapPreview =
  | { kind: 'sibling'; key: string }
  | { kind: 'road'; pos: [number, number] }

export type DrawRoadHandlesParams = {
  ctx: Ctx
  controlPoints: RoadCp[]
  overrides: Record<string, [number, number] | null | undefined>
  zoom: number
  draggingCpKey: string | null
  hoveredChain: { kind: string; id: string } | null
  snapPreview: SnapPreview | null
  liveChains: { id: string; baseChain?: [number, number][] }[]
  project: (lon: number, lat: number) => [number, number]
}

export function drawRoadHandles(p: DrawRoadHandlesParams): void {
  const { ctx, controlPoints, overrides, zoom, draggingCpKey, hoveredChain, snapPreview, liveChains, project } = p

  const dissolvedHexes = new Set<string>()
  for (const key of Object.keys(overrides)) {
    if (key.startsWith('jt|')) dissolvedHexes.add(key.split('|')[1])
  }

  const handleScale = 1 / (zoom || 1)
  const juncR = 4 * handleScale
  const edgeR = 3 * handleScale
  const diamondR = 4 * handleScale

  const hovChainForGhost = draggingCpKey ? null : hoveredChain
  const hovChainData = hovChainForGhost?.kind === 'road'
    ? liveChains.find(c => c.id === hovChainForGhost.id)
    : null
  if (hovChainData?.baseChain && hovChainData.baseChain.length >= 2) {
    const bc = hovChainData.baseChain
    ctx.save()
    ctx.beginPath()
    const [gx0, gy0] = project(bc[0][0], bc[0][1])
    ctx.moveTo(gx0, gy0)
    for (let i = 1; i < bc.length; i++) {
      const [gx, gy] = project(bc[i][0], bc[i][1])
      ctx.lineTo(gx, gy)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5 * handleScale
    ctx.setLineDash([4 * handleScale, 4 * handleScale])
    ctx.stroke()
    ctx.restore()
  }

  const jtDots = controlPoints.filter(cp => cp.key.startsWith('jt|') && dissolvedHexes.has(cp.key.split('|')[1]))
  const jtGroups: { keys: string[]; pos: [number, number] }[] = []
  for (const cp of jtDots) {
    const [cx, cy] = project(cp.pos[0], cp.pos[1])
    let merged = false
    for (const g of jtGroups) {
      const [gx, gy] = project(g.pos[0], g.pos[1])
      if (Math.hypot(cx - gx, cy - gy) < 2) { g.keys.push(cp.key); merged = true; break }
    }
    if (!merged) jtGroups.push({ keys: [cp.key], pos: cp.pos })
  }

  ctx.save()
  for (const { key, pos } of controlPoints) {
    const isJunc = key.startsWith('ja|')
    if (key.startsWith('jt|')) continue
    if (isJunc) {
      const hexKey = key.slice(3)
      if (dissolvedHexes.has(hexKey)) continue
    }
    const [x, y] = project(pos[0], pos[1])
    ctx.beginPath()
    ctx.arc(x, y, isJunc ? juncR : edgeR, 0, Math.PI * 2)
    ctx.fillStyle = isJunc ? 'rgba(255,255,255,0.6)' : (!!overrides[key] ? '#ffcc44' : 'rgba(255,255,255,0.6)')
    ctx.fill()
    ctx.strokeStyle = isJunc ? '#cc8800' : '#888'
    ctx.lineWidth = handleScale
    ctx.stroke()
  }
  for (const g of jtGroups) {
    const [x, y] = project(g.pos[0], g.pos[1])
    const isGroup = g.keys.length >= 2
    const dragging = g.keys.includes(draggingCpKey ?? '')
    ctx.beginPath()
    if (isGroup) {
      ctx.arc(x, y, juncR, 0, Math.PI * 2)
    } else {
      const r = diamondR
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath()
    }
    ctx.fillStyle = dragging ? '#ffcc44' : isGroup ? 'rgba(100,200,255,0.8)' : 'rgba(255,255,255,0.6)'
    ctx.fill()
    ctx.strokeStyle = isGroup ? '#2288cc' : '#4488cc'
    ctx.lineWidth = handleScale
    ctx.stroke()
  }

  if (snapPreview) {
    if (snapPreview.kind === 'sibling') {
      for (const hlKey of [snapPreview.key, draggingCpKey]) {
        if (!hlKey) continue
        const cp = controlPoints.find(c => c.key === hlKey)
        if (!cp) continue
        const [x, y] = project(cp.pos[0], cp.pos[1])
        const r = diamondR * 1.8
        ctx.beginPath()
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath()
        ctx.fillStyle = 'rgba(255, 220, 40, 0.35)'
        ctx.fill()
        ctx.strokeStyle = '#ffdd00'
        ctx.lineWidth = handleScale * 2
        ctx.stroke()
      }
    } else {
      const [x, y] = project(snapPreview.pos[0], snapPreview.pos[1])
      ctx.beginPath()
      ctx.arc(x, y, juncR * 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 220, 40, 0.4)'
      ctx.fill()
      ctx.strokeStyle = '#ffdd00'
      ctx.lineWidth = handleScale * 2
      ctx.stroke()
    }
  }
  ctx.restore()
}

export type DrawRailHandlesParams = {
  ctx: Ctx
  controlPoints: RailCp[]
  overrides: Record<string, [number, number] | null | undefined>
  zoom: number
  draggingCpKey: string | null
  hoveredChain: { kind: string; id: string } | null
  smoothedChains: { id: string; baseChain?: [number, number][] }[]
  project: (lon: number, lat: number) => [number, number]
}

export function drawRailHandles(p: DrawRailHandlesParams): void {
  const { ctx, controlPoints, overrides, zoom, hoveredChain, smoothedChains, project } = p

  const handleScale = 1 / (zoom || 1)
  const juncR = 4 * handleScale
  const edgeR = 3 * handleScale

  const hovChainForGhost = p.draggingCpKey ? null : hoveredChain
  const hovChainData = hovChainForGhost?.kind === 'rail'
    ? smoothedChains.find(c => c.id === hovChainForGhost.id)
    : null
  if (hovChainData?.baseChain && hovChainData.baseChain.length >= 2) {
    const bc = hovChainData.baseChain
    ctx.save()
    ctx.beginPath()
    const [gx0, gy0] = project(bc[0][0], bc[0][1])
    ctx.moveTo(gx0, gy0)
    for (let i = 1; i < bc.length; i++) {
      const [gx, gy] = project(bc[i][0], bc[i][1])
      ctx.lineTo(gx, gy)
    }
    ctx.strokeStyle = 'rgba(0,220,220,0.3)'
    ctx.lineWidth = 1.5 * handleScale
    ctx.setLineDash([4 * handleScale, 4 * handleScale])
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  for (const { key, pos } of controlPoints) {
    const isJunc = key.startsWith('ja|')
    const [x, y] = project(pos[0], pos[1])
    ctx.beginPath()
    ctx.arc(x, y, isJunc ? juncR : edgeR, 0, Math.PI * 2)
    ctx.fillStyle = !!overrides[key] ? '#44ddff' : (isJunc ? 'rgba(0,200,220,0.6)' : 'rgba(0,200,220,0.5)')
    ctx.fill()
    ctx.strokeStyle = isJunc ? '#0099aa' : '#006688'
    ctx.lineWidth = handleScale
    ctx.stroke()
  }
  ctx.restore()
}

export type DrawRiverHandlesParams = {
  ctx: Ctx
  zoom: number
  allChains: { segKey: string; baseChain: [number, number][] }[]
  chainOverrides: Record<string, [number, number][]>
  hoveredChain: { kind: string; id: string; handles?: [number, number][] } | null
  hoveredHandleIdx: number | null
  draggingDensePt: { kind: string; id: string; handleIdx: number; handles: [number, number][] } | null
  dragLiveDensePos: [number, number] | null
  project: (lon: number, lat: number) => [number, number]
}

export function drawRiverHandles(p: DrawRiverHandlesParams): void {
  const { ctx, zoom, allChains, chainOverrides, hoveredChain, hoveredHandleIdx, draggingDensePt, dragLiveDensePos, project } = p

  const handleScale = 1 / (zoom || 1)
  const dotR = 2.5 * handleScale

  const denseDrag = draggingDensePt?.kind === 'river' ? draggingDensePt : null
  const hovChain = hoveredChain?.kind === 'river' ? hoveredChain : null
  const activeId = denseDrag?.id ?? hovChain?.id ?? null
  const activeHandleIdx = denseDrag ? denseDrag.handleIdx : hoveredHandleIdx

  const sparseHandles = (chain: [number, number][]): [number, number][] => {
    const out: [number, number][] = []
    for (let i = 0; i < chain.length; i += 5) out.push(chain[i])
    if (out[out.length - 1] !== chain[chain.length - 1]) out.push(chain[chain.length - 1])
    return out
  }

  ctx.save()
  for (const c of allChains) {
    const baseHandles = chainOverrides[c.segKey] ?? sparseHandles(c.baseChain)
    const isActive = c.segKey === activeId

    const handles = isActive && denseDrag
      ? denseDrag.handles.map((pt, i) =>
          i === denseDrag.handleIdx && dragLiveDensePos ? dragLiveDensePos : pt
        ) as [number, number][]
      : baseHandles

    // Dashed baseline through all handles
    if (handles.length >= 2) {
      ctx.beginPath()
      const [x0, y0] = project(handles[0][0], handles[0][1])
      ctx.moveTo(x0, y0)
      for (let i = 1; i < handles.length; i++) {
        const [x, y] = project(handles[i][0], handles[i][1])
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)'
      ctx.lineWidth = handleScale
      ctx.setLineDash([4 * handleScale, 4 * handleScale])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Dots for interior handles
    for (let i = 1; i < handles.length - 1; i++) {
      const [x, y] = project(handles[i][0], handles[i][1])
      const isHovered = isActive && i === activeHandleIdx
      ctx.beginPath()
      ctx.arc(x, y, isHovered ? dotR * 1.8 : dotR, 0, Math.PI * 2)
      ctx.fillStyle = isHovered ? '#ffcc44' : 'rgba(255,255,255,0.55)'
      ctx.fill()
      ctx.strokeStyle = isHovered ? '#cc8800' : 'rgba(60,140,200,0.8)'
      ctx.lineWidth = handleScale * 0.8
      ctx.stroke()
    }
  }
  ctx.restore()
}
