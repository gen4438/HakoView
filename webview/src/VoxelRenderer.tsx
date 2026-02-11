import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { VoxelDataMessage } from './types/voxel';
import vertexShader from './shaders/voxel.vert';
import fragmentShader from './shaders/voxel.frag';

interface VoxelRendererProps {
	voxelData: VoxelDataMessage;
}

// デフォルトパレット（data-model.mdに基づく）
const defaultPalette = [
	'#ffffff', // 0: 空（白色背景、実際は透明）
	'#0000FF', // 1: 青
	'#FF0000', // 2: 赤
	'#FFFF00', // 3: 黄
	'#00FF00', // 4: 緑
	'#FF00FF', // 5: マゼンタ
	'#1f77b4', // 6-16: 追加色
	'#ff7f0e',
	'#2ca02c',
	'#d62728',
	'#9467bd',
	'#8c564b',
	'#e377c2',
	'#7f7f7f',
	'#bcbd22',
	'#17becf'
];

function VoxelMesh({ voxelData }: { voxelData: VoxelDataMessage }) {
	const meshRef = useRef<THREE.Mesh>(null);
	const { camera } = useThree();

	// 3Dテクスチャ作成
	const dataTexture = useMemo(() => {
		const { dimensions, values } = voxelData;
		const uint8Array = new Uint8Array(values);

		const texture = new THREE.Data3DTexture(
			uint8Array,
			dimensions.x,
			dimensions.y,
			dimensions.z
		);

		texture.format = THREE.RedFormat;
		texture.type = THREE.UnsignedByteType;
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;
		texture.unpackAlignment = 1;
		texture.needsUpdate = true;

		return texture;
	}, [voxelData]);

	// パレットテクスチャ作成
	const paletteTexture = useMemo(() => {
		const paletteSize = 16;
		const data = new Uint8Array(paletteSize * 3);

		defaultPalette.forEach((colorStr, i) => {
			const color = new THREE.Color(colorStr);
			data[i * 3 + 0] = Math.floor(color.r * 255);
			data[i * 3 + 1] = Math.floor(color.g * 255);
			data[i * 3 + 2] = Math.floor(color.b * 255);
		});

		const texture = new THREE.DataTexture(data, paletteSize, 1);
		texture.format = THREE.RGBFormat;
		texture.type = THREE.UnsignedByteType;
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;
		texture.needsUpdate = true;

		return texture;
	}, []);

	// シェーダユニフォーム
	const uniforms = useMemo(() => ({
		uVoxelShape: { value: new THREE.Vector3(
			voxelData.dimensions.x,
			voxelData.dimensions.y,
			voxelData.dimensions.z
		)},
		uTexture: { value: dataTexture },
		uPaletteTexture: { value: paletteTexture },
		uPaletteSize: { value: 16 },
		uOccupancyTexture: { value: null },
		uOccupancyDimensions: { value: new THREE.Vector3(0, 0, 0) },
		uBlockSize: { value: 8 },
		uColor: { value: new THREE.Color(1, 1, 1) },
		uAlpha: { value: 1.0 },
		uLightIntensity: { value: 0.8 },
		uAmbientIntensity: { value: 0.4 },
		uClippingPlane: { value: new THREE.Vector4(0, 1, 0, 0) },
		uEnableClipping: { value: 0.0 },
		uCameraDistance: { value: 100 },
		uEnableEdgeHighlight: { value: 0.0 },
		uEdgeThickness: { value: 0.05 },
		uEdgeColor: { value: new THREE.Color(0, 0, 0) },
		uEdgeIntensity: { value: 0.5 },
		uEdgeFadeStart: { value: 0 },
		uEdgeFadeEnd: { value: 200 },
		uModelMatrixInverse: { value: new THREE.Matrix4() },
		uValueVisibility: { value: new Array(16).fill(1.0) },
		uShowZeroValues: { value: 1.0 }
	}), [voxelData, dataTexture, paletteTexture]);

	// フレームごとにユニフォームを更新
	useFrame(() => {
		if (meshRef.current) {
			uniforms.uModelMatrixInverse.value.copy(meshRef.current.matrixWorld).invert();
			
			if (camera) {
				const distance = camera.position.length();
				uniforms.uCameraDistance.value = distance;
			}
		}
	});

	// ボックスジオメトリ（ボクセルグリッドのバウンディングボックス）
	const size = Math.max(
		voxelData.dimensions.x,
		voxelData.dimensions.y,
		voxelData.dimensions.z
	);

	return (
		<mesh ref={meshRef}>
			<boxGeometry args={[size, size, size]} />
			<shaderMaterial
				vertexShader={vertexShader}
				fragmentShader={fragmentShader}
				uniforms={uniforms}
				transparent
				side={THREE.BackSide}
				depthTest={true}
				depthWrite={true}
			/>
		</mesh>
	);
}

export function VoxelRenderer({ voxelData }: VoxelRendererProps) {
	return (
		<Canvas
			gl={{ antialias: true, alpha: true }}
			style={{ width: '100%', height: '100%', background: 'transparent' }}
		>
			<PerspectiveCamera
				makeDefault
				position={[
					voxelData.dimensions.x * 1.5,
					voxelData.dimensions.y * 1.5,
					voxelData.dimensions.z * 1.5
				]}
				fov={50}
			/>
			
			<OrbitControls
				enableDamping
				dampingFactor={0.05}
				maxPolarAngle={Math.PI}
				minPolarAngle={0}
			/>

			<ambientLight intensity={0.5} />
			<directionalLight position={[10, 10, 5]} intensity={0.8} />

			<VoxelMesh voxelData={voxelData} />

			<gridHelper args={[100, 10]} position={[0, -voxelData.dimensions.y / 2 - 5, 0]} />
		</Canvas>
	);
}
