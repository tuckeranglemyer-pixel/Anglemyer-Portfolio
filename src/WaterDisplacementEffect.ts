import * as THREE from 'three'
import { Effect, BlendFunction } from 'postprocessing'

export const DEFAULT_WATER_DISPLACEMENT_SCALE = 0.012

const fragmentShader = /* glsl */ `
uniform sampler2D displacementMap;
uniform float scale;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
	vec4 disp = texture2D(displacementMap, uv);
	vec2 offset = (disp.rg - vec2(0.5)) * scale;
	vec2 uv2 = clamp(uv + offset, vec2(0.0), vec2(1.0));
	outputColor = texture2D(inputBuffer, uv2);
}
`

export type WaterDisplacementEffectOptions = {
	displacementMap: THREE.Texture
	scale?: number
}

/**
 * Fullscreen UV displacement using a DataTexture from useWaterSim (R/G encode offset around 0.5).
 */
export class WaterDisplacementEffect extends Effect {
	constructor({
		displacementMap,
		scale = DEFAULT_WATER_DISPLACEMENT_SCALE,
	}: WaterDisplacementEffectOptions) {
		super('WaterDisplacementEffect', fragmentShader, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map<string, THREE.Uniform>([
				['displacementMap', new THREE.Uniform(displacementMap)],
				['scale', new THREE.Uniform(scale)],
			]),
		})
	}

	get displacementMap(): THREE.Texture {
		return this.uniforms.get('displacementMap')!.value as THREE.Texture
	}

	set displacementMap(value: THREE.Texture) {
		this.uniforms.get('displacementMap')!.value = value
	}

	get scale(): number {
		return this.uniforms.get('scale')!.value as number
	}

	set scale(value: number) {
		this.uniforms.get('scale')!.value = value
	}
}
