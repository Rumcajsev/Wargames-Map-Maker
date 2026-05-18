/** V2 road renderer — re-exports the V1 function unchanged.
 *  V2 chains are structurally compatible ({ tier, chain }) so no separate
 *  draw logic is needed. This file exists as a seam for future per-hop
 *  tier-split rendering without touching V1. */

export { drawRoadsAndRails as drawRoadsAndRailsV2 } from './drawRoadsRails'
