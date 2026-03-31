import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  WebGLHitContext,
  type RegisteredWebGLMesh,
} from './webglHitContext'
import type { CssRect } from './buildProjectsTexture'

function hitRegion(mx: number, my: number, r: CssRect): boolean {
  return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom
}

export default function WebGLInteractionProvider({
  children,
  visible,
}: {
  children: ReactNode
  visible: boolean
}) {
  const { camera, size } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointerNdc = useRef(new THREE.Vector2())
  const listRef = useRef<RegisteredWebGLMesh[]>([])

  const register = useCallback((entry: RegisteredWebGLMesh) => {
    listRef.current.push(entry)
    return () => {
      listRef.current = listRef.current.filter(e => e !== entry)
    }
  }, [])

  useEffect(() => {
    if (!visible) {
      document.body.style.cursor = ''
      return
    }

    const pick = (e: MouseEvent) => {
      pointerNdc.current.x = (e.clientX / size.width) * 2 - 1
      pointerNdc.current.y = -(e.clientY / size.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc.current, camera)

      const meshes = listRef.current.map(r => r.mesh)
      if (meshes.length === 0) return null

      const hits = raycaster.intersectObjects(meshes, false)
      if (hits.length === 0) return null

      const hit = hits[0]
      const reg = listRef.current.find(r => r.mesh === hit.object)
      if (!reg || !hit.uv) return null

      const mx = hit.uv.x * reg.cssW
      const my = (1 - hit.uv.y) * reg.cssH

      for (const r of reg.regions) {
        if (hitRegion(mx, my, r.rect)) return r.href
      }
      return null
    }

    const onMove = (e: MouseEvent) => {
      document.body.style.cursor = pick(e) ? 'pointer' : ''
    }

    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-webgl-hit-ignore]')) return

      const href = pick(e)
      if (!href) return

      e.preventDefault()
      e.stopPropagation()
      if (href.startsWith('mailto:')) {
        window.location.href = href
      } else {
        window.open(href, '_blank', 'noopener,noreferrer')
      }
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('click', onClick, true)
      document.body.style.cursor = ''
    }
  }, [visible, camera, size, raycaster])

  return (
    <WebGLHitContext.Provider value={{ register }}>{children}</WebGLHitContext.Provider>
  )
}
