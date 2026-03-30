import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'

export default function InkEntry() {
  return (
    <ShaderGradientCanvas
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
      pointerEvents="none"
    >
      <ShaderGradient
        type="waterPlane"
        animate="on"
        color1="#000000"
        color2="#0a0a1a"
        color3="#050510"
        uSpeed={0.08}
        uStrength={1.5}
        uFrequency={3}
        cPolarAngle={75}
        cDistance={5}
        lightType="3d"
        envPreset="city"
        brightness={0.6}
        grain="off"
      />
    </ShaderGradientCanvas>
  )
}
