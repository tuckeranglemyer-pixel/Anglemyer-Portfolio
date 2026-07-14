// Shared mutable state between the DOM layer and the R3F scene.
// Written by rAF handlers, read by useFrame — never triggers React renders.
export const world = {
  /** continuous band position 0..7 (section index + local progress) */
  t: 0,
  /** true once the scroll has pierced the floor (t >= PIERCE_T) */
  underground: false,
  /** smoothed 0..1 bass energy from the analyser (0 when audio off) */
  bass: 0,
  /** violet beacon on the terrain: world x/z + intensity */
  beacon: { x: 0, z: 0, i: 0 },
}

/** the t value at which the floor pierces */
export const PIERCE_T = 5.0

export interface Terra {
  size: number
  minElev: number
  maxElev: number
  kmWidth: number
  kmHeight: number
  peak: { name: string; lat: number; lon: number; elev: number }
  data: number[]
}

export interface Peaks {
  title: string
  duration: number
  src: string
  peaks: number[]
}

export interface Contrib {
  total: number
  from: string
  to: string
  days: { d: string; l: number; c: number }[]
}
