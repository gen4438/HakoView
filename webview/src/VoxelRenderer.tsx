import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import {
  TrackballControls,
  PerspectiveCamera,
  OrthographicCamera,
  GizmoHelper,
  GizmoViewport,
  Stats,
  shaderMaterial,
} from '@react-three/drei';
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
    uIsOrthographic: 0.0,
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

// OrthographicCamera用のカスタムズームハンドラ
// TrackballControlsはOrthoCameraのzoomプロパティを正しく制御しないため、
// wheelイベントで直接camera.zoomを変更する
function OrthoZoomHandler({ initialZoomRef }: { initialZoomRef: React.MutableRefObject<number> }) {
  const { camera, gl, size } = useThree();

  // 初期ズームをビューポートとモデルサイズに基づいて設定
  useEffect(() => {
    if (!(camera as any).isOrthographicCamera) return;
    const orthoCamera = camera as THREE.OrthographicCamera;
    orthoCamera.zoom = initialZoomRef.current;
    orthoCamera.updateProjectionMatrix();
  }, [camera, initialZoomRef, size]);

  // ホイールイベントでzoomを直接制御
  useEffect(() => {
    if (!(camera as any).isOrthographicCamera) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const orthoCamera = camera as THREE.OrthographicCamera;
      // deltaY > 0 でズームアウト、< 0 でズームイン
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      orthoCamera.zoom = Math.max(0.01, orthoCamera.zoom * zoomFactor);
      orthoCamera.updateProjectionMatrix();
    };

    gl.domElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => gl.domElement.removeEventListener('wheel', handleWheel);
  }, [camera, gl]);

  return null;
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
  '#17becf',
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
      ambientIntensity,
    });
  }, [voxelData, alpha, lightIntensity, ambientIntensity]);

  // 3Dテクスチャ作成
  const dataTexture = useMemo(() => {
    const { dimensions, values } = voxelData;
    const uint8Array = new Uint8Array(values);

    const texture = new THREE.Data3DTexture(uint8Array, dimensions.x, dimensions.y, dimensions.z);

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

    u.uVoxelShape.value.set(voxelData.dimensions.x, voxelData.dimensions.y, voxelData.dimensions.z);
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
      hasUniforms: !!materialRef.current.uniforms,
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
    u.uValueVisibility.value = valueVisibility.map((v) => (v ? 1.0 : 0.0));

    // パレットテクスチャを更新
    u.uPaletteTexture.value = paletteTexture;
    u.uPaletteSize.value = 16;

    console.log('✅ Uniforms updated successfully, uAlpha.value:', u.uAlpha.value);
  }, [
    alpha,
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
    paletteTexture,
  ]);

  // フレームごとに変わる値のみuseFrameで更新
  useFrame(() => {
    if (meshRef.current && materialRef.current) {
      // フレームごとに逆行列を更新
      materialRef.current.uniforms.uModelMatrixInverse.value
        .copy(meshRef.current.matrixWorld)
        .invert();

      // カメラタイプを設定
      materialRef.current.uniforms.uIsOrthographic.value = (camera as any).isOrthographicCamera
        ? 1.0
        : 0.0;

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
      <boxGeometry
        args={[voxelData.dimensions.x, voxelData.dimensions.y, voxelData.dimensions.z, 1, 1, 1]}
      />
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
      valuesLength: voxelData.values.length,
    });
  }, [voxelData]);

  // ボクセル値表示制御の状態（0は初期値非表示）
  const [valueVisibility, setValueVisibility] = useState<boolean[]>(
    Array(16)
      .fill(0)
      .map((_, i) => i !== 0)
  );
  const [customColors, setCustomColors] = useState<string[]>(
    Array(16)
      .fill('')
      .map((_, i) => defaultPalette[i] || '#000000')
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
    edgeColor: '#ffffff',
    edgeIntensity: 0.8,
    edgeMaxDistance: 200,
    clippingMode: 'Off',
    sliceAxis: 'Z',
    slicePosition: 0,
    sliceReverse: false,
    customNormalX: 0,
    customNormalY: 0,
    customNormalZ: 1,
    customDistance: 0,
    usePerspective: true,
  });

  // Levaから独立した状態更新関数
  const updateValueVisibility = useCallback((index: number, value: boolean) => {
    setValueVisibility((prev) => {
      const newVisibility = [...prev];
      newVisibility[index] = value;
      return newVisibility;
    });
  }, []);

  const updateCustomColor = useCallback((index: number, value: string) => {
    setCustomColors((prev) => {
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
  const [controls, set] = useControls(
    () => ({
      Reset: button(() => {
        // ボクセル値表示とカスタム色のリセット用オブジェクト
        const voxelResetValues: Record<string, any> = {};
        for (let i = 0; i < 16; i++) {
          voxelResetValues[`visible${i}`] = i !== 0; // 0は非表示、1-15は表示
          voxelResetValues[`color${i}`] = defaultPalette[i] || '#000000';
        }

        // すべての設定をデフォルト値に戻す
        set({
          alpha: defaultValues.current.alpha,
          dpr: maxDpr,
          fov: defaultValues.current.fov,
          far: defaultValues.current.far,
          lightIntensity: defaultValues.current.lightIntensity,
          ambientIntensity: defaultValues.current.ambientIntensity,
          enableEdgeHighlight: defaultValues.current.enableEdgeHighlight,
          edgeThickness: defaultValues.current.edgeThickness,
          edgeColor: defaultValues.current.edgeColor,
          edgeIntensity: defaultValues.current.edgeIntensity,
          edgeMaxDistance: defaultValues.current.edgeMaxDistance,
          clippingMode: defaultValues.current.clippingMode,
          sliceAxis: defaultValues.current.sliceAxis,
          slicePosition: defaultValues.current.slicePosition,
          sliceReverse: defaultValues.current.sliceReverse,
          customNormalX: defaultValues.current.customNormalX,
          customNormalY: defaultValues.current.customNormalY,
          customNormalZ: defaultValues.current.customNormalZ,
          customDistance: defaultValues.current.customDistance,
          ...voxelResetValues,
        });

        // React状態もリセット（onChangeが呼ばれない場合のため）
        setValueVisibility(
          Array(16)
            .fill(0)
            .map((_, i) => i !== 0)
        );
        setCustomColors(
          Array(16)
            .fill('')
            .map((_, i) => defaultPalette[i] || '#000000')
        );

        // カメラ位置もリセット
        if (controlsRef.current) {
          controlsRef.current.reset();
        }
      }),
      usePerspective: { value: true, label: 'Perspective' },
      edgeHighlight: folder(
        {
          enableEdgeHighlight: { value: defaultValues.current.enableEdgeHighlight },
          edgeThickness: {
            value: defaultValues.current.edgeThickness,
            min: 0.02,
            max: 0.15,
            step: 0.01,
          },
          edgeColor: { value: defaultValues.current.edgeColor },
          edgeIntensity: {
            value: defaultValues.current.edgeIntensity,
            min: 0.0,
            max: 1.0,
            step: 0.01,
          },
          edgeMaxDistance: {
            value: defaultValues.current.edgeMaxDistance,
            min: 50,
            max: 1000,
            step: 10,
          },
        },
        { collapsed: true }
      ),
      voxelColors: folder(
        {
          // 0-15値制御を動的生成（0も他と同じ扱い）
          ...Array.from({ length: 16 }, (_, i) => i).reduce(
            (acc, i) => ({
              ...acc,
              [`visible${i}`]: {
                value: valueVisibility[i],
                onChange: (value: boolean) => updateValueVisibility(i, value),
              },
              [`color${i}`]: {
                value: customColors[i],
                onChange: (value: string) => updateCustomColor(i, value),
              },
            }),
            {}
          ),
        },
        { collapsed: true }
      ),
      clipping: folder(
        {
          clippingMode: {
            value: defaultValues.current.clippingMode,
            options: ['Off', 'Slice', 'Custom'],
          },
          sliceAxis: {
            value: defaultValues.current.sliceAxis,
            options: ['X', 'Y', 'Z'],
            render: (get: any) => get('clipping.clippingMode') === 'Slice',
          },
          slicePosition: {
            value: defaultValues.current.slicePosition,
            min: -150,
            max: 150,
            step: 1,
            render: (get: any) => get('clipping.clippingMode') === 'Slice',
          },
          sliceReverse: {
            value: defaultValues.current.sliceReverse,
            label: 'Reverse Direction',
            render: (get: any) => get('clipping.clippingMode') === 'Slice',
          },
          customNormalX: {
            value: defaultValues.current.customNormalX,
            min: -1,
            max: 1,
            step: 0.01,
            render: (get: any) => get('clipping.clippingMode') === 'Custom',
          },
          customNormalY: {
            value: defaultValues.current.customNormalY,
            min: -1,
            max: 1,
            step: 0.01,
            render: (get: any) => get('clipping.clippingMode') === 'Custom',
          },
          customNormalZ: {
            value: defaultValues.current.customNormalZ,
            min: -1,
            max: 1,
            step: 0.01,
            render: (get: any) => get('clipping.clippingMode') === 'Custom',
          },
          customDistance: {
            value: defaultValues.current.customDistance,
            min: -300,
            max: 300,
            step: 1,
            render: (get: any) => get('clipping.clippingMode') === 'Custom',
          },
        },
        { collapsed: true }
      ),
      dpr: { value: maxDpr, min: 0.5, max: maxDpr, step: 0.1 },
      alpha: { value: defaultValues.current.alpha, min: 0.0, max: 1.0, step: 0.01 },
      camera: folder(
        {
          fov: { value: defaultValues.current.fov, min: 0, max: 180, step: 5 },
          far: { value: defaultValues.current.far, min: 500, max: 3000, step: 100 },
        },
        { collapsed: true }
      ),
      lighting: folder(
        {
          lightIntensity: {
            value: defaultValues.current.lightIntensity,
            min: 0.0,
            max: 2.0,
            step: 0.01,
          },
          ambientIntensity: {
            value: defaultValues.current.ambientIntensity,
            min: 0.0,
            max: 1.0,
            step: 0.01,
          },
        },
        { collapsed: true }
      ),
    }),
    [maxDpr, updateValueVisibility, updateCustomColor, valueVisibility, customColors]
  );

  const {
    usePerspective,
    fov,
    far,
    alpha,
    dpr,
    lightIntensity,
    ambientIntensity,
    enableEdgeHighlight,
    edgeThickness,
    edgeColor,
    edgeIntensity,
    edgeMaxDistance,
    clippingMode,
    sliceAxis,
    slicePosition,
    sliceReverse,
    customNormalX,
    customNormalY,
    customNormalZ,
    customDistance,
  } = controls;

  // クリッピングプレーン計算
  const calculateClippingPlane = () => {
    if (clippingMode === 'Off') {
      return { normal: new THREE.Vector3(0, 0, 1), distance: 0, enabled: false };
    }

    if (clippingMode === 'Slice') {
      const normal = new THREE.Vector3(0, 0, 0);
      let distance = slicePosition;

      switch (sliceAxis) {
        case 'X':
          normal.x = sliceReverse ? -1 : 1;
          break;
        case 'Y':
          normal.y = sliceReverse ? -1 : 1;
          break;
        case 'Z':
          normal.z = sliceReverse ? -1 : 1;
          break;
      }

      if (sliceReverse) distance = -distance;
      return { normal, distance, enabled: true };
    }

    const normal = new THREE.Vector3(customNormalX, customNormalY, customNormalZ).normalize();
    return { normal, distance: customDistance, enabled: true };
  };

  const clippingPlane = calculateClippingPlane();
  const effectiveDpr = Math.min(Math.max(dpr, 0.5), maxDpr);

  // モデル全体が画面に収まるカメラ初期位置を計算
  const cameraPosition = useMemo((): [number, number, number] => {
    const { x, y, z } = voxelData.dimensions;
    // バウンディングスフィアの半径
    const radius = Math.sqrt(x * x + y * y + z * z) / 2;
    // デフォルトFOVでちょうど収まる距離（少し余白を追加）
    const defaultFovRad = (defaultValues.current.fov * Math.PI) / 180;
    const distance = (radius / Math.tan(defaultFovRad / 2)) * 1.2;
    // 視線方向 (2.5, 1.0, 0.5) を正規化してdistance倍
    const dir = new THREE.Vector3(2.5, 1.0, 0.5).normalize();
    return [dir.x * distance, dir.y * distance, dir.z * distance];
  }, [voxelData.dimensions]);

  // OrthographicCamera用の初期ズーム値を計算
  const orthoInitialZoomRef = useRef<number>(1);
  useMemo(() => {
    const { x, y, z } = voxelData.dimensions;
    const maxDim = Math.max(x, y, z);
    // Perspectiveと同等の見え方になるよう調整
    // ビューポートの半分 / モデルの最大寸法 で適切なズームに
    const zoom = Math.min(width, height) / (maxDim * 1.4);
    orthoInitialZoomRef.current = Math.max(0.1, zoom);
  }, [voxelData.dimensions, width, height]);

  // デバッグ: コントロール値確認
  useEffect(() => {
    console.log('Controls:', {
      fov,
      far,
      alpha,
      dpr,
      lightIntensity,
      ambientIntensity,
      enableEdgeHighlight,
      clippingEnabled: clippingPlane.enabled,
    });
  }, [
    fov,
    far,
    alpha,
    dpr,
    lightIntensity,
    ambientIntensity,
    enableEdgeHighlight,
    clippingPlane.enabled,
  ]);

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
            controlWidth: '160px',
          },
        }}
        oneLineLabels
        hideCopyButton
      />

      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        dpr={effectiveDpr}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        {usePerspective ? (
          <PerspectiveCamera
            makeDefault
            position={cameraPosition}
            up={[0, 0, 1]}
            fov={fov}
            far={far}
          />
        ) : (
          <OrthographicCamera
            makeDefault
            position={cameraPosition}
            up={[0, 0, 1]}
            zoom={orthoInitialZoomRef.current}
            near={0.1}
            far={far}
          />
        )}

        {!usePerspective && <OrthoZoomHandler initialZoomRef={orthoInitialZoomRef} />}

        <TrackballControls
          ref={controlsRef}
          rotateSpeed={2.0}
          zoomSpeed={1.2}
          panSpeed={0.8}
          noZoom={!usePerspective}
          noPan={false}
          staticMoving={false}
          dynamicDampingFactor={0.2}
        />

        <ambientLight intensity={ambientIntensity} />
        <directionalLight position={[10, 5, 10]} intensity={lightIntensity} />

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

        <gridHelper
          args={[100, 10]}
          position={[0, 0, -voxelData.dimensions.z / 2 - 5]}
          rotation={[Math.PI / 2, 0, 0]}
        />

        <Stats />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ff0000', '#00ff00', '#0000ff']} labelColor="white" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
