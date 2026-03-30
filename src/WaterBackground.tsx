import type { CSSProperties } from 'react'
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'

interface WaterBackgroundProps {
  style?: CSSProperties
}

export default function WaterBackground({ style }: WaterBackgroundProps) {
  return (
    <ShaderGradientCanvas
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', ...style }}
      pointerEvents="none"
    >
      <ShaderGradient
        type="waterPlane"
        animate="on"
        color1="#0a1628"
        color2="#0d1f3c"
        color3="#060e1e"
        uSpeed={0.08}
        uStrength={2.5}
        uFrequency={3}
        cPolarAngle={75}
        cDistance={5}
        lightType="3d"
        envPreset="city"
        brightness={1.0}
        grain="off"
      />
    </ShaderGradientCanvas>
  )
}
