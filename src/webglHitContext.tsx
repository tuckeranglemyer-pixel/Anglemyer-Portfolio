import { createContext, useContext } from 'react'
import * as THREE from 'three'
import type { CssRect } from './buildProjectsTexture'

export type InteractiveRegion = { rect: CssRect; href: string }

export type RegisteredWebGLMesh = {
  mesh: THREE.Mesh
  cssW: number
  cssH: number
  regions: InteractiveRegion[]
}

export type WebGLHitContextValue = {
  register: (r: RegisteredWebGLMesh) => () => void
}

export const WebGLHitContext = createContext<WebGLHitContextValue | null>(null)

export function useRegisterWebGLInteraction(): WebGLHitContextValue['register'] {
  const ctx = useContext(WebGLHitContext)
  if (!ctx) throw new Error('useRegisterWebGLInteraction must be used inside WebGLInteractionProvider')
  return ctx.register
}
