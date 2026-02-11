import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { TrackballControls, PerspectiveCamera, OrthographicCamera, GizmoHelper, GizmoViewport, Stats, shaderMaterial } from '@react-three/drei';
import { folder, useControls, Leva, button } from 'leva';
import { useWindowSize } from 'react-use';
import * as THREE from 'three';
import type { VoxelDataMessage } from './types/voxel';
import vertexShader from './shaders/voxel.vert';
import fragmentShader from './shaders/voxel.frag';

// カスタムシェーダーマテリアルを定義
const VoxelShaderMaterial = shaderMaterial(
	{
		uVoxelShape: new THREE.Vector3(1, 1, 1),
		uVoxelLength: 1.0,
		uAlpha: 1.0,
		uColor: new THREE.Color('#ffffff'),
		uLightIntensity: 1.0,
		uAmbientIntensity: 0.2,
		uTexture: null,
		uPaletteTexture: null,
		uPaletteSize: 16,
		uOccupancyTexture: null,
		uOccupancyDimensions: new THREE.Vector3(0, 0, 0),
		uBlockSize: 8,
		uModelMatrixInverse: new THREE.Matrix4(),
		uClippingPlane: new THREE.Vector4(0, 1, 0, 0),
		uEnableClipping: 0.0,
		uCameraDistance: 0.0,
		uEnableEdgeHighlight: 0.0,
		uEdgeThickness: 0.05,
		uEdgeColor: new THREE.Color('#ffffff'),
		uEdgeIntensity: 1.0,
		uEdgeFadeStart: 0,
		uEdgeFadeEnd: 100,
		uValueVisibility: new Array(16).fill(1.0),
	},
	vertexShader,
	fragmentShader
);

// React Three FiberでJSXとして使えるように拡張
extend({ VoxelShaderMaterial });

// TypeScript用の型宣言
declare module 'react' {
	namespace JSX {
		interface IntrinsicElements {
			voxelShaderMaterial: any;
		}
	}
}

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

interface VoxelMeshProps {
	voxelData: VoxelDataMessage;
	alpha: number;
	wireframe: boolean;
	lightIntensity: number;
	ambientIntensity: number;
	clippingPlane: { normal: THREE.Vector3; distance: number };
	enableClipping: boolean;
	enableEdgeHighlight: boolean;
	edgeThickness: number;
	edgeColor: string;
	edgeIntensity: number;
	edgeFadeStart: number;
	edgeFadeEnd: number;
	valueVisibility: boolean[];
	customColors: string[];
}

function VoxelMesh(props: VoxelMeshProps) {
	const {
		voxelData,
		alpha,
		wireframe,
		lightIntensity,
		ambientIntensity,
		clippingPlane,
		enableClipping,
		enableEdgeHighlight,
		edgeThickness,
		edgeColor,
		edgeIntensity,
		edgeFadeStart,
		edgeFadeEnd,
		valueVisibility,
		customColors,
	} = props;

	const meshRef = useRef<THREE.Mesh>(null);
	const materialRef = useRef<THREE.ShaderMaterial>(null);
	const { camera } = useThree();
	const [cameraDistance, setCameraDistance] = useState<number>(0);

	// デバッグログ
	useEffect(() => {
		console.log('VoxelMesh rendering with:', {
			dimensions: voxelData.dimensions,
			voxelLength: voxelData.voxelLength,
			alpha,
			lightIntensity,
			ambientIntensity
		});
	}, [voxelData, alpha, lightIntensity, ambientIntensity]);

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

	// パレットテクスチャ作成（カスタム色対応）
	const paletteTexture = useMemo(() => {
		const paletteSize = 16;
		const data = new Uint8Array(paletteSize * 4);

		for (let i = 0; i < paletteSize; i++) {
			const colorStr = customColors[i] || defaultPalette[i] || '#000000';
			const color = new THREE.Color(colorStr);
			data[i * 4 + 0] = Math.floor(color.r * 255);
			data[i * 4 + 1] = Math.floor(color.g * 255);
			data[i * 4 + 2] = Math.floor(color.b * 255);
			data[i * 4 + 3] = i === 0 ? (valueVisibility[0] ? 255 : 0) : 255; // 0番の透明度制御
		}

		const texture = new THREE.DataTexture(
			data,
			paletteSize,
			1,
			THREE.RGBAFormat,
			THREE.UnsignedByteType
		);
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;
		texture.needsUpdate = true;

		return texture;
	}, [customColors, valueVisibility]);

	// VoxelShaderMaterialは既にグローバルで定義されているので削除

	// 初期化: voxelDataとテクスチャをuniformsに設定
	useEffect(() => {
		if (!materialRef.current) return;
		const u = materialRef.current.uniforms;

		u.uVoxelShape.value.set(
			voxelData.dimensions.x,
			voxelData.dimensions.y,
			voxelData.dimensions.z
		);
		u.uVoxelLength.value = voxelData.voxelLength;
		u.uTexture.value = dataTexture;
		u.uPaletteTexture.value = paletteTexture;
		u.uPaletteSize.value = 16;
	}, [voxelData, dataTexture, paletteTexture]);

	// Levaコントロールの値が変更されたときにuniformsを直接更新
	useEffect(() => {
		if (!materialRef.current) {
			console.warn('⚠️ materialRef.current is null, uniforms not updated');
			return;
		}

		console.log('🔄 Updating shader uniforms:', {
			alpha,
			lightIntensity,
			ambientIntensity,
			hasUniforms: !!materialRef.current.uniforms
		});

		const u = materialRef.current.uniforms;

		u.uAlpha.value = alpha;
		u.uLightIntensity.value = lightIntensity;
		u.uAmbientIntensity.value = ambientIntensity;

		// クリッピング
		u.uClippingPlane.value.set(
			clippingPlane.normal.x,
			clippingPlane.normal.y,
			clippingPlane.normal.z,
			clippingPlane.distance
		);
		u.uEnableClipping.value = enableClipping ? 1.0 : 0.0;

		// エッジハイライト
		u.uEnableEdgeHighlight.value = enableEdgeHighlight ? 1.0 : 0.0;
		u.uEdgeThickness.value = edgeThickness;
		u.uEdgeColor.value.set(edgeColor);
		u.uEdgeIntensity.value = edgeIntensity;
		u.uEdgeFadeStart.value = edgeFadeStart;
		u.uEdgeFadeEnd.value = edgeFadeEnd;

		// ボクセル値表示制御
		u.uValueVisibility.value = valueVisibility.map(v => v ? 1.0 : 0.0);

		// パレットテクスチャを更新
		u.uPaletteTexture.value = paletteTexture;
		u.uPaletteSize.value = 16;

		console.log('✅ Uniforms updated successfully, uAlpha.value:', u.uAlpha.value);
	}, [
		alpha, lightIntensity, ambientIntensity,
		clippingPlane, enableClipping,
		enableEdgeHighlight, edgeThickness, edgeColor, edgeIntensity,
		edgeFadeStart, edgeFadeEnd,
		valueVisibility, paletteTexture
	]);

	// フレームごとに変わる値のみuseFrameで更新
	useFrame(() => {
		if (meshRef.current && materialRef.current) {
			// フレームごとに逆行列を更新
			materialRef.current.uniforms.uModelMatrixInverse.value.copy(meshRef.current.matrixWorld).invert();

			// カメラからの距離を計算
			if (camera) {
				const distance = camera.position.distanceTo(meshRef.current.position);
				materialRef.current.uniforms.uCameraDistance.value = distance;
				setCameraDistance(distance);
			}
		}
	});

	return (
		<mesh ref={meshRef}>
			<boxGeometry args={[
				voxelData.dimensions.x,
				voxelData.dimensions.y,
				voxelData.dimensions.z,
				1, 1, 1
			]} />
			<voxelShaderMaterial
				ref={materialRef}
				key={VoxelShaderMaterial.key}
				wireframe={wireframe}
				side={THREE.DoubleSide}
				transparent={true}
			/>
		</mesh>
	);
}

export function VoxelRenderer({ voxelData }: VoxelRendererProps) {
	// TrackballControlsのrefを作成
	const controlsRef = useRef<any>(null);

	// デバッグログ
	useEffect(() => {
		console.log('VoxelRenderer received data:', {
			dimensions: voxelData.dimensions,
			voxelLength: voxelData.voxelLength,
			valuesLength: voxelData.values.length
		});
	}, [voxelData]);

	// ボクセル値表示制御の状態（0は初期値非表示）
	const [valueVisibility, setValueVisibility] = useState<boolean[]>(
		Array(16).fill(0).map((_, i) => i !== 0)
	);
	const [customColors, setCustomColors] = useState<string[]>(
		Array(16).fill("").map((_, i) => defaultPalette[i] || "#000000")
	);

	// デフォルト値を保存
	const defaultValues = useRef({
		fov: 50,
		far: 1000,
		alpha: 1.0,
		lightIntensity: 0.8,
		ambientIntensity: 0.4,
		enableEdgeHighlight: false,
		edgeThickness: 0.05,
		edgeColor: "#ffffff",
		edgeIntensity: 0.8,
		edgeMaxDistance: 200,
		clippingMode: "Off",
		sliceAxis: "Y",
		slicePosition: 0,
		sliceReverse: false,
		customNormalX: 0,
		customNormalY: 1,
		customNormalZ: 0,
		customDistance: 0,
		usePerspective: true,
	});

	// Levaから独立した状態更新関数
	const updateValueVisibility = useCallback((index: number, value: boolean) => {
		setValueVisibility(prev => {
			const newVisibility = [...prev];
			newVisibility[index] = value;
			return newVisibility;
		});
	}, []);

	const updateCustomColor = useCallback((index: number, value: string) => {
		setCustomColors(prev => {
			const newColors = [...prev];
			newColors[index] = value;
			return newColors;
		});
	}, []);

	// DPR管理
	const { width, height } = useWindowSize();
	const [currentDevicePixelRatio, setCurrentDevicePixelRatio] = useState(window.devicePixelRatio);
	const maxDpr = Math.min(currentDevicePixelRatio, 3.0);

	// Levaコントロール
	const controls = useControls({
		// usePerspective: { value: true, label: 'Perspective' },
		camera: folder({
			fov: { value: 50, min: 0, max: 180, step: 5 },
			far: { value: 1000, min: 500, max: 3000, step: 100 },
		}, { collapsed: true }),
		alpha: { value: 1.0, min: 0.0, max: 1.0, step: 0.01 },
		dpr: { value: maxDpr, min: 0.5, max: maxDpr, step: 0.1 },
		lighting: folder({
			lightIntensity: { value: 0.8, min: 0.0, max: 2.0, step: 0.01 },
			ambientIntensity: { value: 0.4, min: 0.0, max: 1.0, step: 0.01 },
		}, { collapsed: true }),
		edgeHighlight: folder({
			enableEdgeHighlight: { value: false },
			edgeThickness: { value: 0.05, min: 0.02, max: 0.15, step: 0.01 },
			edgeColor: { value: "#ffffff" },
			edgeIntensity: { value: 0.8, min: 0.0, max: 1.0, step: 0.01 },
			edgeMaxDistance: { value: 200, min: 50, max: 1000, step: 10 },
		}, { collapsed: true }),
		voxelColors: folder({
			// 0-15値制御を動的生成（0も他と同じ扱い）
			...Array.from({ length: 16 }, (_, i) => i).reduce((acc, i) => ({
				...acc,
				[`visible${i}`]: {
					value: valueVisibility[i],
					onChange: (value: boolean) => updateValueVisibility(i, value)
				},
				[`color${i}`]: {
					value: customColors[i],
					onChange: (value: string) => updateCustomColor(i, value)
				},
			}), {}),
		}, { collapsed: true }),
		clipping: folder({
			clippingMode: { value: "Off", options: ["Off", "Slice", "Custom"] },
			sliceAxis: { value: "Y", options: ["X", "Y", "Z"], render: (get: any) => get('clipping.clippingMode') === 'Slice' },
			slicePosition: { value: 0, min: -150, max: 150, step: 1, render: (get: any) => get('clipping.clippingMode') === 'Slice' },
			sliceReverse: { value: false, label: "Reverse Direction", render: (get: any) => get('clipping.clippingMode') === 'Slice' },
			customNormalX: { value: 0, min: -1, max: 1, step: 0.01, render: (get: any) => get('clipping.clippingMode') === 'Custom' },
			customNormalY: { value: 1, min: -1, max: 1, step: 0.01, render: (get: any) => get('clipping.clippingMode') === 'Custom' },
			customNormalZ: { value: 0, min: -1, max: 1, step: 0.01, render: (get: any) => get('clipping.clippingMode') === 'Custom' },
			customDistance: { value: 0, min: -300, max: 300, step: 1, render: (get: any) => get('clipping.clippingMode') === 'Custom' },
		}, { collapsed: true }),
	}, [maxDpr, updateValueVisibility, updateCustomColor, valueVisibility, customColors]);

	const {
		usePerspective,
		fov, far, alpha, dpr,
		lightIntensity, ambientIntensity,
		enableEdgeHighlight, edgeThickness, edgeColor, edgeIntensity, edgeMaxDistance,
		clippingMode, sliceAxis, slicePosition, sliceReverse,
		customNormalX, customNormalY, customNormalZ, customDistance,
	} = controls;

	// クリッピングプレーン計算
	const calculateClippingPlane = () => {
		if (clippingMode === "Off") {
			return { normal: new THREE.Vector3(0, 1, 0), distance: 0, enabled: false };
		}

		if (clippingMode === "Slice") {
			const normal = new THREE.Vector3(0, 0, 0);
			let distance = slicePosition;

			switch(sliceAxis) {
				case "X": normal.x = sliceReverse ? -1 : 1; break;
				case "Y": normal.y = sliceReverse ? -1 : 1; break;
				case "Z": normal.z = sliceReverse ? -1 : 1; break;
			}

			if (sliceReverse) distance = -distance;
			return { normal, distance, enabled: true };
		}

		const normal = new THREE.Vector3(customNormalX, customNormalY, customNormalZ).normalize();
		return { normal, distance: customDistance, enabled: true };
	};

	const clippingPlane = calculateClippingPlane();
	const effectiveDpr = Math.min(Math.max(dpr, 0.5), maxDpr);

	// デバッグ: コントロール値確認
	useEffect(() => {
		console.log('Controls:', {
			fov, far, alpha, dpr,
			lightIntensity, ambientIntensity,
			enableEdgeHighlight,
			clippingEnabled: clippingPlane.enabled
		});
	}, [fov, far, alpha, dpr, lightIntensity, ambientIntensity, enableEdgeHighlight, clippingPlane.enabled]);

	// DPR変化の監視
	useEffect(() => {
		const handlePixelRatioChange = () => {
			setCurrentDevicePixelRatio(window.devicePixelRatio);
		};

		const mediaQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		mediaQuery.addEventListener('change', handlePixelRatioChange);

		return () => {
			mediaQuery.removeEventListener('change', handlePixelRatioChange);
		};
	}, []);

	// rキーでカメラリセット
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'r' || event.key === 'R') {
				if (controlsRef.current) {
					controlsRef.current.reset();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	return (
		<div style={{ width: '100%', height: '100%', position: 'relative' }}>
			<Leva
				collapsed={true}
				theme={{
					sizes: {
						rootWidth: '320px',
						controlWidth: '160px'
					}
				}}
				oneLineLabels
				hideCopyButton
			/>

			<Canvas
				gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
				dpr={effectiveDpr}
				style={{ width: '100%', height: '100%', background: 'transparent' }}
			>
				{usePerspective ? (
					<PerspectiveCamera
						makeDefault
						position={[
							voxelData.dimensions.x * 1.5,
							voxelData.dimensions.y * 1.5,
							voxelData.dimensions.z * 1.5
						]}
						fov={fov}
						far={far}
					/>
				) : (
					<OrthographicCamera
						makeDefault
						position={[
							voxelData.dimensions.x * 1.5,
							voxelData.dimensions.y * 1.5,
							voxelData.dimensions.z * 1.5
						]}
						zoom={2}
						near={0.1}
						far={far}
					/>
				)}

				<TrackballControls
					ref={controlsRef}
					rotateSpeed={2.0}
					zoomSpeed={1.2}
					panSpeed={0.8}
					noZoom={false}
					noPan={false}
					staticMoving={false}
					dynamicDampingFactor={0.2}
				/>

				<ambientLight intensity={ambientIntensity} />
				<directionalLight position={[10, 10, 5]} intensity={lightIntensity} />

				<VoxelMesh
					voxelData={voxelData}
					alpha={alpha}
					wireframe={false}
					lightIntensity={lightIntensity}
					ambientIntensity={ambientIntensity}
					clippingPlane={{
						normal: clippingPlane.normal,
						distance: clippingPlane.distance,
					}}
					enableClipping={clippingPlane.enabled}
					enableEdgeHighlight={enableEdgeHighlight}
					edgeThickness={edgeThickness}
					edgeColor={edgeColor}
					edgeIntensity={edgeIntensity}
					edgeFadeStart={0}
					edgeFadeEnd={edgeMaxDistance}
					valueVisibility={valueVisibility}
					customColors={customColors}
				/>

				<gridHelper args={[100, 10]} position={[0, -voxelData.dimensions.y / 2 - 5, 0]} />

				<Stats />
				<GizmoHelper alignment="bottom-right" margin={[80, 80]}>
					<GizmoViewport axisColors={['#ff0000', '#00ff00', '#0000ff']} labelColor="white" />
				</GizmoHelper>
			</Canvas>
		</div>
	);
}
