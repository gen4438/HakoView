import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
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
import { folder, useControls, Leva, button, useCreateStore } from 'leva';
import { useWindowSize } from 'react-use';
import * as THREE from 'three';
import type { VoxelDataMessage, ViewerSettings } from './types/voxel';
import vertexShader from './shaders/voxel.vert';
import fragmentShader from './shaders/voxel.frag';
import { ScaleBar } from './components/ScaleBar';

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
    uModelMatrixInverse: new THREE.Matrix4(),
    uClippingPlane: new THREE.Vector4(0, 1, 0, 0),
    uEnableClipping: 0.0,
    uClippingMode: 0.0, // 0=off, 1=slice, 2=custom
    uSliceAxis: 0.0, // 0=X, 1=Y, 2=Z (操作対象の軸、描画には影響しない)
    uSliceXMin: 0.0,
    uSliceXMax: 0.0,
    uSliceYMin: 0.0,
    uSliceYMax: 0.0,
    uSliceZMin: 0.0,
    uSliceZMax: 0.0,
    uIsOrthographic: 0.0,
    uCameraDistance: 0.0,
    uOccupancyTexture: null,
    uOccupancyDimensions: new THREE.Vector3(1, 1, 1),
    uBlockSize: 8.0,
    uUseOccupancy: 0.0,
    uEnableEdgeHighlight: 1.0,
    uEdgeThickness: 0.03,
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
  settings: ViewerSettings | null;
  isVisible?: boolean;
  onSaveColorSettings?: (colormap: Record<string, string>) => void;
  onOpenSettings?: () => void;
}

export interface VoxelRendererRef {
  captureImage: (width?: number, height?: number) => Promise<string>;
}

// カメラ状態を保存・復元するヘルパーコンポーネント
// Perspective↔Orthographic切り替え時に姿勢と見た目のスケールを保持する
// 写像（bijective）: 繰り返し切り替えても値がズレない
function CameraStateManager({
  cameraStateRef,
  controlsRef,
  usePerspective,
  fov,
  canvasHeight,
  orthoInitialZoomRef,
}: {
  cameraStateRef: React.MutableRefObject<{
    position: THREE.Vector3;
    up: THREE.Vector3;
    quaternion: THREE.Quaternion;
    target: THREE.Vector3;
    isPerspective: boolean;
    perspFov: number;
    orthoZoom: number;
  } | null>;
  controlsRef: React.MutableRefObject<any>;
  usePerspective: boolean;
  fov: number;
  canvasHeight: number;
  orthoInitialZoomRef: React.MutableRefObject<number>;
}) {
  const { camera, invalidate } = useThree();
  const previousCameraTypeRef = useRef<boolean | null>(null);
  const [isRestoringCamera, setIsRestoringCamera] = useState(false);
  const restoringFrameCountRef = useRef(0);
  // 変換後の状態（復元中にuseFrameで適用）
  const convertedStateRef = useRef<{
    position: THREE.Vector3;
    up: THREE.Vector3;
    quaternion: THREE.Quaternion;
    target: THREE.Vector3;
    orthoZoom: number;
  } | null>(null);

  // 現在のカメラ状態を常に保存（復元中は保存しない）
  useFrame(() => {
    if (!camera || !controlsRef.current) return;

    // 復元中の場合は、変換された状態を強制的に適用
    if (isRestoringCamera && convertedStateRef.current) {
      camera.position.copy(convertedStateRef.current.position);
      camera.up.copy(convertedStateRef.current.up);
      camera.quaternion.copy(convertedStateRef.current.quaternion);

      if ((camera as any).isOrthographicCamera) {
        (camera as THREE.OrthographicCamera).zoom = convertedStateRef.current.orthoZoom;
      }

      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.copy(convertedStateRef.current.target);
        controlsRef.current.update();
      }

      // 数フレーム適用したら復元モードを終了
      restoringFrameCountRef.current++;
      if (restoringFrameCountRef.current > 5) {
        setIsRestoringCamera(false);
        restoringFrameCountRef.current = 0;
        convertedStateRef.current = null;
      } else {
        // frameloop="demand"のため、次フレームの描画を明示的に要求
        invalidate();
      }
      return;
    }

    // 通常時はカメラ状態を保存（カメラタイプ固有の情報を含む）
    const isPerspective = !(camera as any).isOrthographicCamera;
    const target = controlsRef.current.target
      ? new THREE.Vector3().copy(controlsRef.current.target)
      : new THREE.Vector3(0, 0, 0);

    cameraStateRef.current = {
      position: camera.position.clone(),
      up: camera.up.clone(),
      quaternion: camera.quaternion.clone(),
      target: target,
      isPerspective: isPerspective,
      perspFov: isPerspective ? (camera as THREE.PerspectiveCamera).fov : 0,
      orthoZoom: !isPerspective ? (camera as THREE.OrthographicCamera).zoom : 0,
    };
  });

  // カメラタイプが切り替わったときにスケール変換して復元モードを開始
  useEffect(() => {
    // 初回レンダリングはスキップ
    if (previousCameraTypeRef.current === null) {
      previousCameraTypeRef.current = usePerspective;
      return;
    }

    // カメラタイプが変わっていない場合はスキップ
    if (previousCameraTypeRef.current === usePerspective) {
      return;
    }

    const prevWasPerspective = previousCameraTypeRef.current;
    previousCameraTypeRef.current = usePerspective;

    if (!cameraStateRef.current) return;
    const saved = cameraStateRef.current;

    if (prevWasPerspective && !usePerspective) {
      // Perspective → Orthographic: 見た目のスケールを保持
      // visibleHeight = 2 * distance * tan(fov/2) → orthoZoom = canvasHeight / visibleHeight
      const distance = saved.position.distanceTo(saved.target);
      const fovRad = (saved.perspFov * Math.PI) / 180;
      let newZoom = orthoInitialZoomRef.current; // フォールバック
      if (fovRad > 0 && distance > 0) {
        const visibleHeight = 2 * distance * Math.tan(fovRad / 2);
        newZoom = Math.max(0.01, canvasHeight / visibleHeight);
      }
      orthoInitialZoomRef.current = newZoom;

      convertedStateRef.current = {
        position: saved.position.clone(),
        up: saved.up.clone(),
        quaternion: saved.quaternion.clone(),
        target: saved.target.clone(),
        orthoZoom: newZoom,
      };
    } else if (!prevWasPerspective && usePerspective) {
      // Orthographic → Perspective: 見た目のスケールを保持
      // visibleHeight = canvasHeight / orthoZoom → distance = visibleHeight / (2 * tan(fov/2))
      const fovRad = (fov * Math.PI) / 180;
      let newDistance = saved.position.distanceTo(saved.target); // フォールバック
      if (fovRad > 0 && saved.orthoZoom > 0) {
        const visibleHeight = canvasHeight / saved.orthoZoom;
        newDistance = visibleHeight / (2 * Math.tan(fovRad / 2));
      }

      const direction = new THREE.Vector3().subVectors(saved.position, saved.target).normalize();
      // カメラがターゲット上にある場合のフォールバック
      if (direction.lengthSq() < 0.0001) {
        direction.set(0, 0, 1);
      }

      const newPosition = new THREE.Vector3()
        .copy(saved.target)
        .addScaledVector(direction, newDistance);

      convertedStateRef.current = {
        position: newPosition,
        up: saved.up.clone(),
        quaternion: saved.quaternion.clone(),
        target: saved.target.clone(),
        orthoZoom: 0,
      };
    }

    if (convertedStateRef.current) {
      restoringFrameCountRef.current = 0;
      setIsRestoringCamera(true);
    }
  }, [usePerspective, cameraStateRef, fov, canvasHeight, orthoInitialZoomRef]);

  return null;
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

// ドラッグ可能なスライス平面コンポーネント
function DraggableSlicePlane({
  position,
  rotation,
  planeSize,
  color,
  sliceNumber,
  sliceAxis,
  dimensions,
  onDragStart,
  onDrag,
  onDragEnd,
  controlsRef,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  planeSize: [number, number];
  color: string;
  sliceNumber: 1 | 2;
  sliceAxis: 'X' | 'Y' | 'Z';
  dimensions: { x: number; y: number; z: number };
  onDragStart: (sliceNumber: 1 | 2, initialPos: number) => void;
  onDrag: (sliceNumber: 1 | 2, newPos: number) => void;
  onDragEnd: () => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera, raycaster, gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());
  const intersectionPointRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // ドラッグ開始
  const handlePointerDown = useCallback(
    (event: any) => {
      event.stopPropagation();
      if (!meshRef.current) return;

      // ドラッグ平面を設定（カメラの向きに垂直な平面）
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(cameraDirection, meshRef.current.position);

      setIsDragging(true);

      // TrackballControlsを無効化
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }

      // 現在のスライス位置を取得
      const axisIndex = sliceAxis === 'X' ? 0 : sliceAxis === 'Y' ? 1 : 2;
      const currentPos =
        position[axisIndex] + dimensions[sliceAxis.toLowerCase() as 'x' | 'y' | 'z'] / 2;

      onDragStart(sliceNumber, currentPos);

      // カーソルを変更
      gl.domElement.style.cursor = 'grabbing';
    },
    [camera, position, sliceAxis, dimensions, sliceNumber, onDragStart, controlsRef, gl]
  );

  // ドラッグ中
  const handlePointerMove = useCallback(
    (event: any) => {
      if (!isDragging || !meshRef.current) return;

      // マウス位置を正規化デバイス座標に変換
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // レイキャスターでドラッグ平面との交点を計算
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.ray.intersectPlane(
        dragPlaneRef.current,
        intersectionPointRef.current
      );

      if (intersects) {
        // 軸方向の成分のみを抽出
        const axisIndex = sliceAxis === 'X' ? 0 : sliceAxis === 'Y' ? 1 : 2;
        const worldPos = intersects.getComponent(axisIndex);
        const maxDim = dimensions[sliceAxis.toLowerCase() as 'x' | 'y' | 'z'];

        // ボクセル座標系に変換（中心が原点なので半分を足す）
        let newPos = worldPos + maxDim / 2;

        // 範囲をクランプ
        newPos = Math.max(0, Math.min(maxDim, newPos));

        onDrag(sliceNumber, newPos);
      }
    },
    [isDragging, camera, raycaster, gl, sliceAxis, dimensions, sliceNumber, onDrag]
  );

  // ドラッグ終了
  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // TrackballControlsを再度有効化
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }

    onDragEnd();

    // カーソルを元に戻す
    gl.domElement.style.cursor = 'grab';
  }, [isDragging, onDragEnd, controlsRef, gl]);

  // グローバルなポインターイベントをリスン
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      handlePointerMove(e);
    };

    const handleUp = () => {
      handlePointerUp();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      renderOrder={999}
      onPointerDown={handlePointerDown}
      onPointerOver={() => {
        gl.domElement.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        if (!isDragging) {
          gl.domElement.style.cursor = 'auto';
        }
      }}
    >
      <planeGeometry args={planeSize} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={isDragging ? 0.5 : 0.3}
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

// 画像キャプチャ用のヘルパーコンポーネント
// Canvas内部でglにアクセスして画像をキャプチャする
// サイズ指定時はWebGLRenderTargetでオフスクリーンレンダリングし、
// メインのカメラ・レンダラーに影響を与えない
function CaptureHelper({
  captureRef,
}: {
  captureRef: React.MutableRefObject<((width?: number, height?: number) => Promise<string>) | null>;
}) {
  const { gl, camera, scene } = useThree();

  // オフスクリーンキャプチャ用のgizmoシーン（GizmoHelperは別ビューポートで描画されるため再現が必要）
  const gizmoResources = useMemo(() => {
    const gScene = new THREE.Scene();

    const axisLength = 1.0;
    const axisRadius = 0.045;
    const tipRadius = 0.14;

    const createAxis = (dir: [number, number, number], color: string) => {
      const mat = new THREE.MeshBasicMaterial({ color });
      // Shaft
      const shaftGeo = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8);
      if (dir[0] === 1) {
        shaftGeo.rotateZ(-Math.PI / 2);
        shaftGeo.translate(axisLength / 2, 0, 0);
      } else if (dir[1] === 1) {
        shaftGeo.translate(0, axisLength / 2, 0);
      } else {
        shaftGeo.rotateX(Math.PI / 2);
        shaftGeo.translate(0, 0, axisLength / 2);
      }
      gScene.add(new THREE.Mesh(shaftGeo, mat));
      // Tip
      const tipGeo = new THREE.SphereGeometry(tipRadius, 12, 12);
      tipGeo.translate(dir[0] * axisLength, dir[1] * axisLength, dir[2] * axisLength);
      gScene.add(new THREE.Mesh(tipGeo, mat));
    };

    createAxis([1, 0, 0], '#ff0000');
    createAxis([0, 1, 0], '#00ff00');
    createAxis([0, 0, 1], '#0000ff');

    // Center sphere
    const centerGeo = new THREE.SphereGeometry(0.08, 12, 12);
    gScene.add(new THREE.Mesh(centerGeo, new THREE.MeshBasicMaterial({ color: 0x888888 })));

    // 軸ラベル（X, Y, Z）をスプライトとして追加
    const createTextSprite = (text: string, bgColor: string, pos: [number, number, number]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 64, 64);
      // 背景円を描画（軸色）
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
      // テキスト描画（白）
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText(text, 32, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(...pos);
      sprite.scale.set(0.5, 0.5, 1);
      gScene.add(sprite);
    };

    createTextSprite('X', '#ff0000', [axisLength + 0.3, 0, 0]);
    createTextSprite('Y', '#00ff00', [0, axisLength + 0.3, 0]);
    createTextSprite('Z', '#0000ff', [0, 0, axisLength + 0.3]);

    // 視錐体を軸サイズに合わせて密にし、ビューポート内でのgizmo占有率を上げる
    const gCamera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);

    return { scene: gScene, camera: gCamera };
  }, []);

  // Cleanup gizmo resources on unmount
  useEffect(() => {
    return () => {
      gizmoResources.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Sprite) {
          (obj.material as THREE.SpriteMaterial).map?.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    };
  }, [gizmoResources]);

  useEffect(() => {
    captureRef.current = async (width?: number, height?: number) => {
      if (!width || !height) {
        // サイズ指定なしの場合は現在のサイズでキャプチャ
        return new Promise<string>((resolve) => {
          requestAnimationFrame(() => {
            resolve(gl.domElement.toDataURL('image/png'));
          });
        });
      }

      // オフスクリーン専用のcanvas+レンダラーを作成
      // dpr=1の独立レンダラーなのでビューポート補正・状態保存復元・Y反転が不要
      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = height;
      const offRenderer = new THREE.WebGLRenderer({
        canvas: offCanvas,
        antialias: false,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      offRenderer.setSize(width, height, false);
      offRenderer.setPixelRatio(1);

      // カメラをクローンしてオフスクリーン用に設定（メインカメラに影響を与えない）
      const aspect = width / height;
      const offCamera = camera.clone();
      offCamera.matrixWorld.copy(camera.matrixWorld);
      offCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);

      if ((offCamera as any).isPerspectiveCamera) {
        (offCamera as THREE.PerspectiveCamera).aspect = aspect;
        offCamera.updateProjectionMatrix();
      } else if ((offCamera as any).isOrthographicCamera) {
        const frustumHeight =
          (camera as THREE.OrthographicCamera).top - (camera as THREE.OrthographicCamera).bottom;
        const frustumWidth = frustumHeight * aspect;
        (offCamera as THREE.OrthographicCamera).left = -frustumWidth / 2;
        (offCamera as THREE.OrthographicCamera).right = frustumWidth / 2;
        offCamera.updateProjectionMatrix();
      }

      // メインシーンをレンダリング
      offRenderer.render(scene, offCamera);

      // Gizmoオーバーレイを右下に描画
      const { scene: gScene, camera: gCamera } = gizmoResources;
      gCamera.position.copy(camera.position).normalize().multiplyScalar(4);
      gCamera.up.copy(camera.up);
      gCamera.lookAt(0, 0, 0);
      gCamera.updateProjectionMatrix();

      // GizmoHelper margin={[80,80]} → ビューポートは margin*2=160 CSS px
      // 保存画像でも同じ画面比率を維持する
      const canvasMinDim = Math.min(gl.domElement.clientWidth, gl.domElement.clientHeight) || 600;
      const gizmoScale = Math.min(width, height) / canvasMinDim;
      const gizmoSize = Math.max(Math.round(160 * gizmoScale), 100);
      // drei の GizmoHelper はビューポートがコーナーに密着（内部余白でマージンに見える）
      const gizmoX = width - gizmoSize;
      const gizmoY = 0;

      offRenderer.autoClear = false;
      offRenderer.setViewport(gizmoX, gizmoY, gizmoSize, gizmoSize);
      offRenderer.setScissorTest(true);
      offRenderer.setScissor(gizmoX, gizmoY, gizmoSize, gizmoSize);
      offRenderer.clearDepth();
      offRenderer.render(gScene, gCamera);

      const dataUrl = offCanvas.toDataURL('image/png');
      offRenderer.dispose();
      return dataUrl;
    };
  }, [gl, camera, scene, captureRef, gizmoResources]);

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
  clippingPlane: {
    mode: 'off' | 'slice' | 'custom';
    normal: THREE.Vector3;
    distance: number;
    axis: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  };
  enableClipping: boolean;
  enableEdgeHighlight: boolean;
  edgeThickness: number;
  edgeColor: string;
  edgeIntensity: number;
  edgeFadeStart: number;
  edgeFadeEnd: number;
  valueVisibility: boolean[];
  customColors: string[];
  useOccupancy: boolean;
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
    useOccupancy,
  } = props;

  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();

  // 3Dテクスチャ作成
  const dataTexture = useMemo(() => {
    const { dimensions, values } = voxelData;
    // valuesが既にUint8Arrayの場合はそのまま使用、number[]の場合は変換
    const uint8Array = values instanceof Uint8Array ? values : new Uint8Array(values);

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
      // Visibility をパレットの α 値にエンコード（シェーダー側の配列参照を不要に）
      data[i * 4 + 3] = valueVisibility[i] ? 255 : 0;
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

  // ブロック単位のパレットインデックス存在ビットマスクを事前計算（voxelData依存のみ）
  // 各ブロックにどのパレットインデックス(0-15)が存在するかを16bitマスクで保持
  // これにより valueVisibility 変更時は O(blocks) で occupancy を再構築できる
  const blockMaskData = useMemo(() => {
    const { dimensions, values } = voxelData;
    const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);
    const blockSize = Math.max(
      8,
      Math.min(64, Math.pow(2, Math.ceil(Math.log2(Math.max(1, maxDim / 32)))))
    );
    const occX = Math.ceil(dimensions.x / blockSize);
    const occY = Math.ceil(dimensions.y / blockSize);
    const occZ = Math.ceil(dimensions.z / blockSize);
    const masks = new Uint16Array(occX * occY * occZ);
    const uint8Array = values instanceof Uint8Array ? values : new Uint8Array(values);

    for (let bx = 0; bx < occX; bx++) {
      const xStart = bx * blockSize;
      const xEnd = Math.min(xStart + blockSize, dimensions.x);
      for (let by = 0; by < occY; by++) {
        const yStart = by * blockSize;
        const yEnd = Math.min(yStart + blockSize, dimensions.y);
        for (let bz = 0; bz < occZ; bz++) {
          const zStart = bz * blockSize;
          const zEnd = Math.min(zStart + blockSize, dimensions.z);
          let mask = 0;
          for (let x = xStart; x < xEnd; x++) {
            for (let y = yStart; y < yEnd; y++) {
              for (let z = zStart; z < zEnd; z++) {
                const index = x + dimensions.x * (y + dimensions.y * z);
                const voxelValue = uint8Array[index];
                if (voxelValue === 0) {
                  mask |= 1; // bit 0: 値0のボクセルが存在
                } else {
                  const paletteIndex = ((voxelValue - 1) % 15) + 1;
                  mask |= 1 << paletteIndex;
                }
              }
            }
            // 全ビット埋まったら早期終了（これ以上変わらない）
            if (mask === 0xffff) break;
          }
          masks[bx + occX * (by + occY * bz)] = mask;
        }
      }
    }

    return { masks, occX, occY, occZ, blockSize };
  }, [voxelData]);

  // Occupancy Grid テクスチャ（valueVisibility変更時は O(blocks) で再構築）
  const occupancyData = useMemo(() => {
    const { masks, occX, occY, occZ, blockSize } = blockMaskData;
    const totalBlocks = occX * occY * occZ;
    const occData = new Uint8Array(totalBlocks);

    // valueVisibility を 16bit マスクに変換（値0も含む）
    let visMask = 0;
    for (let i = 0; i < 16; i++) {
      if (valueVisibility[i]) visMask |= 1 << i;
    }

    // ブロックごとに AND でチェック（O(blocks)、ボクセル走査なし）
    for (let b = 0; b < totalBlocks; b++) {
      occData[b] = (masks[b] & visMask) !== 0 ? 255 : 0;
    }

    const texture = new THREE.Data3DTexture(occData, occX, occY, occZ);
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    return { texture, dimensions: new THREE.Vector3(occX, occY, occZ), blockSize };
  }, [blockMaskData, valueVisibility]);

  // テクスチャの破棄（GPUメモリリーク防止）
  useEffect(() => {
    return () => {
      dataTexture.dispose();
    };
  }, [dataTexture]);

  useEffect(() => {
    return () => {
      paletteTexture.dispose();
    };
  }, [paletteTexture]);

  useEffect(() => {
    return () => {
      occupancyData.texture.dispose();
    };
  }, [occupancyData]);

  // 初期化: voxelDataとテクスチャをuniformsに設定
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;

    u.uVoxelShape.value.set(voxelData.dimensions.x, voxelData.dimensions.y, voxelData.dimensions.z);
    u.uVoxelLength.value = voxelData.voxelLength;
    u.uTexture.value = dataTexture;
    u.uPaletteTexture.value = paletteTexture;
    u.uPaletteSize.value = 16;
    u.uOccupancyTexture.value = occupancyData.texture;
    u.uOccupancyDimensions.value.copy(occupancyData.dimensions);
    u.uBlockSize.value = occupancyData.blockSize;
  }, [voxelData, dataTexture, paletteTexture, occupancyData]);

  // Levaコントロールの値が変更されたときにuniformsを直接更新
  useEffect(() => {
    if (!materialRef.current) return;

    const u = materialRef.current.uniforms;

    u.uAlpha.value = alpha;
    u.uLightIntensity.value = lightIntensity;
    u.uAmbientIntensity.value = ambientIntensity;

    // クリッピング
    u.uEnableClipping.value = enableClipping ? 1.0 : 0.0;

    if (clippingPlane.mode === 'slice') {
      u.uClippingMode.value = 1.0;
      u.uSliceAxis.value = clippingPlane.axis;
      u.uSliceXMin.value = clippingPlane.xMin;
      u.uSliceXMax.value = clippingPlane.xMax;
      u.uSliceYMin.value = clippingPlane.yMin;
      u.uSliceYMax.value = clippingPlane.yMax;
      u.uSliceZMin.value = clippingPlane.zMin;
      u.uSliceZMax.value = clippingPlane.zMax;
    } else if (clippingPlane.mode === 'custom') {
      u.uClippingMode.value = 2.0;
      u.uClippingPlane.value.set(
        clippingPlane.normal.x,
        clippingPlane.normal.y,
        clippingPlane.normal.z,
        clippingPlane.distance
      );
    } else {
      u.uClippingMode.value = 0.0;
    }

    // エッジハイライト
    u.uEnableEdgeHighlight.value = enableEdgeHighlight ? 1.0 : 0.0;
    u.uEdgeThickness.value = edgeThickness;
    u.uEdgeColor.value.set(edgeColor);
    u.uEdgeIntensity.value = edgeIntensity;
    u.uEdgeFadeStart.value = edgeFadeStart;
    u.uEdgeFadeEnd.value = edgeFadeEnd;

    // Occupancy Grid
    u.uUseOccupancy.value = useOccupancy ? 1.0 : 0.0;

    // ボクセル値表示制御
    u.uValueVisibility.value = valueVisibility.map((v) => (v ? 1.0 : 0.0));

    // パレットテクスチャを更新
    u.uPaletteTexture.value = paletteTexture;
    u.uPaletteSize.value = 16;
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
    useOccupancy,
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

/**
 * タブの表示状態に応じて描画を制御する。
 * frameloop="never"→"demand"に切り替わった直後に1フレーム描画をトリガーし、
 * 画面が最新の状態で表示されるようにする。
 */
function VisibilityManager({ isVisible }: { isVisible: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const prevRef = useRef(isVisible);

  useEffect(() => {
    if (isVisible && !prevRef.current) {
      // タブが表示状態に復帰 → 最初の描画をトリガー
      invalidate();
    }
    prevRef.current = isVisible;
  }, [isVisible, invalidate]);

  return null;
}

export const VoxelRenderer = forwardRef<VoxelRendererRef, VoxelRendererProps>(
  ({ voxelData, settings, isVisible = true, onSaveColorSettings, onOpenSettings }, ref) => {
    // TrackballControlsのrefを作成
    const controlsRef = useRef<any>(null);

    // 画像キャプチャ用のref
    const captureRef = useRef<((width?: number, height?: number) => Promise<string>) | null>(null);

    // 軸視点の状態を追跡（正方向=1, 負方向=-1）
    const axisViewState = useRef({ x: 1, y: 1, z: 1 });

    // カメラ状態の保存用ref（カメラ切り替え時に状態を引き継ぐ）
    const cameraStateRef = useRef<{
      position: THREE.Vector3;
      up: THREE.Vector3;
      quaternion: THREE.Quaternion;
      target: THREE.Vector3;
      isPerspective: boolean;
      perspFov: number;
      orthoZoom: number;
    } | null>(null);

    // 数値入力バッファ（スライス位置調整用）
    const [numericBuffer, setNumericBuffer] = useState<string>('');
    const numericBufferTimeoutRef = useRef<number | null>(null);

    // 現在操作対象のスライス（1 or 2）
    const [activeSlice, setActiveSlice] = useState<1 | 2>(1);

    // スライス平面の可視化状態（両方のスライスを表示）
    const [showSlicePlanes, setShowSlicePlanes] = useState<boolean>(false);
    const slicePlaneTimeoutRef = useRef<number | null>(null);

    // スライス平面を常に表示するかどうか
    const [alwaysShowSlicePlanes, setAlwaysShowSlicePlanes] = useState<boolean>(false);

    // 最後に押されたキーを記録（"gg"の実装用）
    const lastKeyRef = useRef<string>('');
    const lastKeyTimeoutRef = useRef<number | null>(null);

    // Clippingメニューの展開状態を管理
    const [isClippingCollapsed, setIsClippingCollapsed] = useState(true);

    // スライス平面のドラッグ状態
    const [draggingSlice, setDraggingSlice] = useState<1 | 2 | null>(null);
    const dragStartRef = useRef<{ mousePos: THREE.Vector2; slicePos: number } | null>(null);

    // 外部から呼び出し可能なメソッドを公開
    useImperativeHandle(ref, () => ({
      captureImage: async (width?: number, height?: number) => {
        if (captureRef.current) {
          return await captureRef.current(width, height);
        }
        throw new Error('Capture function not initialized');
      },
    }));

    // デバッグログ
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
      far: 2000, // 大きなモデル（600³など）に対応
      alpha: 1.0,
      lightIntensity: 0.8,
      ambientIntensity: 0.4,
      enableEdgeHighlight: true,
      edgeThickness: 0.03,
      edgeColor: '#ffffff',
      edgeIntensity: 0.8,
      edgeMaxDistance: 200,
      clippingMode: 'Off',
      sliceAxis: 'Z',
      slicePosition1: 0, // 後で各軸の半分に設定
      slicePosition2: 0,
      customNormalX: 0,
      customNormalY: 0,
      customNormalZ: 1,
      customDistance: 0,
      usePerspective: true,
      showScaleBar: true,
      showBoundingBox: false,
      showGrid: true,
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

    // クリップボードにカラー設定をコピー
    const copyColorsToClipboard = useCallback(() => {
      const colormap: Record<string, string> = {};
      customColors.forEach((color, index) => {
        colormap[index.toString()] = color;
      });
      const jsonString = JSON.stringify(colormap, null, 2);

      navigator.clipboard.writeText(jsonString).then(
        () => {
          console.log('カラー設定をクリップボードにコピーしました');
        },
        (err) => {
          console.error('クリップボードへのコピーに失敗しました:', err);
        }
      );
    }, [customColors]);

    // VSCodeの設定に保存
    const saveColorsToSettings = useCallback(() => {
      if (!onSaveColorSettings) return;

      const colormap: Record<string, string> = {};
      customColors.forEach((color, index) => {
        colormap[index.toString()] = color;
      });

      onSaveColorSettings(colormap);
      console.log('カラー設定をVSCodeの設定に保存しました');
    }, [customColors, onSaveColorSettings]);

    // VSCodeの設定を開く
    const openSettingsPanel = useCallback(() => {
      if (!onOpenSettings) return;
      onOpenSettings();
    }, [onOpenSettings]);

    // DPR管理
    const { width, height } = useWindowSize();
    const [currentDevicePixelRatio, setCurrentDevicePixelRatio] = useState(window.devicePixelRatio);
    // 設定からDPRを取得、nullの場合は自動検出
    const configuredDpr = settings?.devicePixelRatio ?? null;
    const maxDpr =
      configuredDpr !== null
        ? Math.min(Math.max(configuredDpr, 0.5), 4.0)
        : Math.min(currentDevicePixelRatio, 3.0);

    // ボクセルサイズに基づく動的な範囲を計算
    const { x, y, z } = voxelData.dimensions;
    const maxDim = Math.max(x, y, z);
    const sliceRange = maxDim; // スライス範囲: 0〜maxDim（セル境界）
    const distanceRange = Math.ceil(maxDim * 2);
    const edgeMaxRange = Math.ceil(maxDim * 3);

    // デフォルト値の初期化（初回のみ）
    if (defaultValues.current.slicePosition1 === 0) {
      defaultValues.current.slicePosition1 = maxDim;
      defaultValues.current.slicePosition2 = 0;
    }

    // Clipping専用のLevaストアを作成
    const clippingStore = useCreateStore();

    // Clippingコントロール（別のLeva）
    const [clippingControls, setClipping] = useControls(
      () => ({
        clippingMode: {
          value: defaultValues.current.clippingMode,
          options: ['Off', 'Slice', 'Custom'],
        },
        slice: folder(
          {
            sliceAxis: {
              value: defaultValues.current.sliceAxis,
              options: ['X', 'Y', 'Z'],
              render: (get: any) => get('clippingMode') === 'Slice',
            },
            // X軸用のスライスコントロール
            slicePosition1X: {
              value: x,
              min: 0,
              max: x,
              step: 1,
              label: 'Slice 1 (Pos)',
              render: (get: any) => get('clippingMode') === 'Slice' && get('sliceAxis') === 'X',
            },
            slicePosition2X: {
              value: defaultValues.current.slicePosition2,
              min: 0,
              max: x,
              step: 1,
              label: 'Slice 2 (Neg)',
              render: (get: any) => get('clippingMode') === 'Slice' && get('sliceAxis') === 'X',
            },
            // Y軸用のスライスコントロール
            slicePosition1Y: {
              value: y,
              min: 0,
              max: y,
              step: 1,
              label: 'Slice 1 (Pos)',
              render: (get: any) => get('clippingMode') === 'Slice' && get('sliceAxis') === 'Y',
            },
            slicePosition2Y: {
              value: defaultValues.current.slicePosition2,
              min: 0,
              max: y,
              step: 1,
              label: 'Slice 2 (Neg)',
              render: (get: any) => get('clippingMode') === 'Slice' && get('sliceAxis') === 'Y',
            },
            // Z軸用のスライスコントロール
            slicePosition1Z: {
              value: z,
              min: 0,
              max: z,
              step: 1,
              label: 'Slice 1 (Pos)',
              render: (get: any) => get('clippingMode') === 'Slice' && get('sliceAxis') === 'Z',
            },
            slicePosition2Z: {
              value: defaultValues.current.slicePosition2,
              min: 0,
              max: z,
              step: 1,
              label: 'Slice 2 (Neg)',
              render: (get: any) => get('clippingMode') === 'Slice' && get('sliceAxis') === 'Z',
            },
          },
          { collapsed: false }
        ),
        custom: folder(
          {
            customNormalX: {
              value: defaultValues.current.customNormalX,
              min: -1,
              max: 1,
              step: 0.01,
              render: (get: any) => get('clippingMode') === 'Custom',
            },
            customNormalY: {
              value: defaultValues.current.customNormalY,
              min: -1,
              max: 1,
              step: 0.01,
              render: (get: any) => get('clippingMode') === 'Custom',
            },
            customNormalZ: {
              value: defaultValues.current.customNormalZ,
              min: -1,
              max: 1,
              step: 0.01,
              render: (get: any) => get('clippingMode') === 'Custom',
            },
            customDistance: {
              value: defaultValues.current.customDistance,
              min: -distanceRange,
              max: distanceRange,
              step: 1,
              render: (get: any) => get('clippingMode') === 'Custom',
            },
          },
          { collapsed: false }
        ),
      }),
      { store: clippingStore },
      [sliceRange, distanceRange]
    );

    // メインのLevaコントロール
    const [controls, set] = useControls(
      () => ({
        Reset: button(() => resetAllSettings()),
        voxelColors: folder(
          {
            'Copy Colors': button(() => copyColorsToClipboard()),
            'Save to Settings': button(() => saveColorsToSettings()),
            'Open Settings': button(() => openSettingsPanel()),
            // 0-15値制御を動的生成
            ...Array.from({ length: 16 }, (_, i) => i).reduce(
              (acc, i) => ({
                ...acc,
                [`visible${i}`]: {
                  value: i !== 0, // 初期値
                  onChange: (value: boolean) => {
                    // 状態を更新
                    updateValueVisibility(i, value);
                  },
                },
                [`color${i}`]: {
                  value: defaultPalette[i] || '#000000', // 初期値
                  onChange: (value: string) => {
                    // 状態を更新
                    updateCustomColor(i, value);
                  },
                },
              }),
              {}
            ),
          },
          { collapsed: true }
        ),
        camera: folder(
          {
            usePerspective: { value: true, label: 'Perspective' },
            fov: {
              value: defaultValues.current.fov,
              min: 0,
              max: 180,
              step: 5,
              render: (get) => get('camera.usePerspective'),
            },
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
        display: folder(
          {
            dpr: { value: maxDpr, min: 0.5, max: maxDpr, step: 0.1 },
            alpha: { value: defaultValues.current.alpha, min: 0.0, max: 1.0, step: 0.01 },
            useOccupancy: { value: true, label: 'Occupancy Grid' },
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
                  max: Math.max(edgeMaxRange, 200),
                  step: 10,
                },
              },
              { collapsed: true }
            ),
            showScaleBar: { value: true, label: 'Scale Bar' },
            showBoundingBox: { value: false, label: 'Bounding Box' },
            showGrid: { value: true, label: 'Grid' },
          },
          { collapsed: true }
        ),
      }),
      [
        maxDpr,
        updateValueVisibility,
        updateCustomColor,
        sliceRange,
        distanceRange,
        edgeMaxRange,
        copyColorsToClipboard,
        saveColorsToSettings,
        openSettingsPanel,
      ]
    );

    // 初期化時のみ設定からカスタム色を読み込む
    const initializedRef = useRef(false);
    useEffect(() => {
      if (!initializedRef.current && settings?.colormap) {
        initializedRef.current = true;

        setCustomColors((prev) => {
          const newColors = [...prev];
          // 設定オブジェクトから色を適用 (0-15)
          Object.entries(settings.colormap || {}).forEach(([key, color]) => {
            const index = parseInt(key, 10);
            if (!isNaN(index) && index >= 0 && index < 16) {
              newColors[index] = color;
            }
          });
          return newColors;
        });

        const voxelResetValues: Record<string, any> = {};
        Object.entries(settings.colormap || {}).forEach(([key, color]) => {
          const index = parseInt(key, 10);
          if (!isNaN(index) && index >= 0 && index < 16) {
            voxelResetValues[`color${index}`] = color;
          }
        });
        set(voxelResetValues);
      }
    }, [settings, set]);

    const {
      usePerspective,
      useOccupancy,
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
      showScaleBar,
      showBoundingBox,
      showGrid,
    } = controls;

    // Clipping設定を取得
    const {
      clippingMode,
      sliceAxis,
      slicePosition1X,
      slicePosition2X,
      slicePosition1Y,
      slicePosition2Y,
      slicePosition1Z,
      slicePosition2Z,
      customNormalX,
      customNormalY,
      customNormalZ,
      customDistance,
    } = clippingControls;

    // 現在の軸に応じたスライス位置を取得
    const slicePosition1 =
      sliceAxis === 'X' ? slicePosition1X : sliceAxis === 'Y' ? slicePosition1Y : slicePosition1Z;
    const slicePosition2 =
      sliceAxis === 'X' ? slicePosition2X : sliceAxis === 'Y' ? slicePosition2Y : slicePosition2Z;

    // 軸に応じてスライス位置を設定するヘルパー関数
    const setSlicePosition = useCallback(
      (pos1?: number, pos2?: number) => {
        const updates: any = {};
        if (pos1 !== undefined) {
          if (sliceAxis === 'X') updates.slicePosition1X = pos1;
          else if (sliceAxis === 'Y') updates.slicePosition1Y = pos1;
          else updates.slicePosition1Z = pos1;
        }
        if (pos2 !== undefined) {
          if (sliceAxis === 'X') updates.slicePosition2X = pos2;
          else if (sliceAxis === 'Y') updates.slicePosition2Y = pos2;
          else updates.slicePosition2Z = pos2;
        }
        setClipping(updates);
      },
      [sliceAxis, setClipping]
    );

    // スライス平面のドラッグハンドラー
    const handleSliceDragStart = useCallback((sliceNumber: 1 | 2, initialPos: number) => {
      setDraggingSlice(sliceNumber);
      // ドラッグしたスライスをアクティブに設定
      setActiveSlice(sliceNumber);
      dragStartRef.current = {
        mousePos: new THREE.Vector2(),
        slicePos: initialPos,
      };
      // スライス平面を表示
      setShowSlicePlanes(true);
    }, []);

    const handleSliceDrag = useCallback(
      (sliceNumber: 1 | 2, newPos: number) => {
        // 整数に丸める
        const roundedPos = Math.round(newPos);
        if (sliceNumber === 1) {
          setSlicePosition(roundedPos, undefined);
        } else {
          setSlicePosition(undefined, roundedPos);
        }
      },
      [setSlicePosition]
    );

    const handleSliceDragEnd = useCallback(() => {
      setDraggingSlice(null);
      dragStartRef.current = null;
      // ドラッグ終了後もスライス平面を一時的に表示
      setShowSlicePlanes(true);
      if (slicePlaneTimeoutRef.current !== null) {
        window.clearTimeout(slicePlaneTimeoutRef.current);
      }
      slicePlaneTimeoutRef.current = window.setTimeout(() => {
        setShowSlicePlanes(false);
      }, 2000);
    }, []);

    // リセット処理を関数化（Resetボタンと"R"キーの両方から使用）
    // TrackballControlsの慣性（ダンピング）を停止するヘルパー
    // staticMoving=trueにしてupdate()を呼ぶと、内部の速度ベクトルがゼロになる
    const stopControlsInertia = useCallback(() => {
      const controls = controlsRef.current;
      if (!controls) return;
      controls.staticMoving = true;
      controls.update();
      controls.staticMoving = false;
    }, []);

    const resetAllSettings = useCallback(() => {
      // ボクセル値表示とカスタム色のリセット用オブジェクト
      const voxelResetValues: Record<string, any> = {};
      for (let i = 0; i < 16; i++) {
        voxelResetValues[`visible${i}`] = i !== 0; // 0は非表示、1-15は表示
        voxelResetValues[`color${i}`] = defaultPalette[i] || '#000000';
      }

      // すべての設定をデフォルト値に戻す
      set({
        usePerspective: defaultValues.current.usePerspective,
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
        showScaleBar: defaultValues.current.showScaleBar,
        showBoundingBox: defaultValues.current.showBoundingBox,
        showGrid: defaultValues.current.showGrid,
        useOccupancy: true,
        ...voxelResetValues,
      });

      // Clippingコントロールもリセット
      setClipping({
        clippingMode: defaultValues.current.clippingMode,
        sliceAxis: defaultValues.current.sliceAxis,
        slicePosition1X: defaultValues.current.slicePosition1,
        slicePosition2X: defaultValues.current.slicePosition2,
        slicePosition1Y: defaultValues.current.slicePosition1,
        slicePosition2Y: defaultValues.current.slicePosition2,
        slicePosition1Z: defaultValues.current.slicePosition1,
        slicePosition2Z: defaultValues.current.slicePosition2,
        customNormalX: defaultValues.current.customNormalX,
        customNormalY: defaultValues.current.customNormalY,
        customNormalZ: defaultValues.current.customNormalZ,
        customDistance: defaultValues.current.customDistance,
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

      // カメラ位置のリセットは呼び出し側で行う（initialCameraPositionが後で定義されるため）
    }, [set, setClipping, maxDpr, stopControlsInertia]);

    // 軸視点に移動する関数
    const setAxisView = useCallback(
      (axis: 'x' | 'y' | 'z') => {
        if (!controlsRef.current) return;

        // 状態をトグル
        axisViewState.current[axis] *= -1;
        const dir = axisViewState.current[axis];

        // 現在のカメラ位置からtargetまでの距離を計算して維持
        const camera = controlsRef.current.object;
        const target = controlsRef.current.target;
        const currentDistance = camera.position.distanceTo(target);

        // カメラの新しい位置を設定（現在の距離を維持）
        camera.position.set(
          axis === 'x' ? dir * currentDistance : 0,
          axis === 'y' ? dir * currentDistance : 0,
          axis === 'z' ? dir * currentDistance : 0
        );

        // up ベクトルを設定（Z軸が上）
        if (axis === 'x') {
          camera.up.set(0, 0, 1);
        } else if (axis === 'y') {
          camera.up.set(0, 0, 1);
        } else {
          // Z軸視点の場合、Y軸を上に
          camera.up.set(0, 1, 0);
        }

        // targetを見る
        camera.lookAt(target);
        camera.updateProjectionMatrix();

        // TrackballControlsを更新し、慣性を停止
        controlsRef.current.update();
        stopControlsInertia();
      },
      [stopControlsInertia]
    );

    // 軸周りに90度回転する関数
    const rotateAroundAxis = useCallback(
      (axis: 'x' | 'y' | 'z') => {
        if (!controlsRef.current) return;

        const camera = controlsRef.current.object;
        const currentPos = camera.position.clone();
        const currentUp = camera.up.clone();

        // 回転軸ベクトル（右手系で正の方向）
        const rotationAxis = new THREE.Vector3(
          axis === 'x' ? 1 : 0,
          axis === 'y' ? 1 : 0,
          axis === 'z' ? 1 : 0
        );

        // 90度（π/2ラジアン）回転
        const angle = Math.PI / 2;

        // カメラ位置を回転
        currentPos.applyAxisAngle(rotationAxis, angle);
        camera.position.copy(currentPos);

        // upベクトルも回転
        currentUp.applyAxisAngle(rotationAxis, angle);
        camera.up.copy(currentUp);

        // 原点を見る
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        // TrackballControlsを更新し、慣性を停止
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
        stopControlsInertia();
      },
      [stopControlsInertia]
    );

    // 数値バッファをクリアする関数
    const clearNumericBuffer = useCallback(() => {
      setNumericBuffer('');
      if (numericBufferTimeoutRef.current !== null) {
        window.clearTimeout(numericBufferTimeoutRef.current);
        numericBufferTimeoutRef.current = null;
      }
      // lastKeyRefもクリア（"gg"の誤動作を防ぐ）
      lastKeyRef.current = '';
      if (lastKeyTimeoutRef.current !== null) {
        window.clearTimeout(lastKeyTimeoutRef.current);
        lastKeyTimeoutRef.current = null;
      }
    }, []);

    // スライス平面を2秒間表示する関数（両方のスライス）
    const showSlicePlanesTemporarily = useCallback(() => {
      setShowSlicePlanes(true);
      if (slicePlaneTimeoutRef.current !== null) {
        window.clearTimeout(slicePlaneTimeoutRef.current);
      }
      slicePlaneTimeoutRef.current = window.setTimeout(() => {
        setShowSlicePlanes(false);
      }, 2000);
    }, []);

    // モデルを画面にフィットさせる関数
    const fitModelToView = useCallback(() => {
      if (!controlsRef.current) return;

      const camera = controlsRef.current.object;
      const target = controlsRef.current.target;
      const { x, y, z } = voxelData.dimensions;

      // モデルのバウンディングスフィアの半径
      const radius = Math.sqrt(x * x + y * y + z * z) / 2;

      // カメラからターゲットへの方向ベクトルを正規化
      const direction = new THREE.Vector3().subVectors(camera.position, target).normalize();

      if ((camera as any).isOrthographicCamera) {
        // Orthographicカメラの場合: zoomを調整
        const orthoCamera = camera as THREE.OrthographicCamera;
        // モデルが画面に収まるzoomを計算（少し余白を持たせる）
        const zoom = Math.min(width, height) / (radius * 2.8);
        orthoCamera.zoom = Math.max(0.1, zoom);
        orthoCamera.updateProjectionMatrix();
      } else {
        // Perspectiveカメラの場合: カメラの距離を調整
        const perspCamera = camera as THREE.PerspectiveCamera;
        const fovRad = (perspCamera.fov * Math.PI) / 180;
        const aspect = width / height;

        // 縦方向と横方向の両方に収まる距離を計算
        const distanceV = (radius / Math.tan(fovRad / 2)) * 1.2; // 縦方向
        const fovH = 2 * Math.atan(Math.tan(fovRad / 2) * aspect); // 横方向FOV
        const distanceH = (radius / Math.tan(fovH / 2)) * 1.2; // 横方向

        // 両方に収まる距離（大きい方）を採用
        const distance = Math.max(distanceV, distanceH);

        // 現在の向きを維持したまま距離だけ調整
        const newPosition = new THREE.Vector3().copy(target).addScaledVector(direction, distance);
        camera.position.copy(newPosition);
      }

      camera.updateProjectionMatrix();
      controlsRef.current.update();
    }, [voxelData.dimensions, width, height]);

    // 現在の画面サイズに基づいた初期カメラ位置を計算
    const calculateInitialCameraPosition = useCallback(() => {
      const { x, y, z } = voxelData.dimensions;
      const radius = Math.sqrt(x * x + y * y + z * z) / 2;
      const defaultFovRad = (defaultValues.current.fov * Math.PI) / 180;
      const aspect = width / height;

      // 縦方向と横方向の両方に収まる距離を計算
      const distanceV = (radius / Math.tan(defaultFovRad / 2)) * 1.2;
      const fovH = 2 * Math.atan(Math.tan(defaultFovRad / 2) * aspect);
      const distanceH = (radius / Math.tan(fovH / 2)) * 1.2;
      const distance = Math.max(distanceV, distanceH);

      // 視線方向 (2.5, 1.0, 0.5) を正規化してdistance倍
      const dir = new THREE.Vector3(2.5, 1.0, 0.5).normalize();
      return new THREE.Vector3(dir.x * distance, dir.y * distance, dir.z * distance);
    }, [voxelData.dimensions, width, height]);

    // 現在の画面サイズに基づいた初期Orthoズームを計算
    const calculateInitialOrthoZoom = useCallback(() => {
      const { x, y, z } = voxelData.dimensions;
      const maxDim = Math.max(x, y, z);
      const zoom = Math.min(width, height) / (maxDim * 1.4);
      return Math.max(0.1, zoom);
    }, [voxelData.dimensions, width, height]);

    // 数値バッファのタイムアウト設定（2秒後に自動クリア）
    const resetNumericBufferTimeout = useCallback(() => {
      if (numericBufferTimeoutRef.current !== null) {
        window.clearTimeout(numericBufferTimeoutRef.current);
      }
      numericBufferTimeoutRef.current = window.setTimeout(() => {
        clearNumericBuffer();
      }, 2000);
    }, [clearNumericBuffer]);

    // スライス位置が変更されたら、両方の平面を表示
    useEffect(() => {
      if (clippingMode === 'Slice') {
        showSlicePlanesTemporarily();
      }
    }, [
      slicePosition1X,
      slicePosition2X,
      slicePosition1Y,
      slicePosition2Y,
      slicePosition1Z,
      slicePosition2Z,
      clippingMode,
      showSlicePlanesTemporarily,
    ]);

    // キーボードショートカット
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // 入力フォームなどでの入力中は無視したいが、今回はLeva以外に入力要素はないので簡易的に実装

        const key = event.key;

        // Spaceキーでモデルをフィット
        if (key === ' ') {
          event.preventDefault();
          clearNumericBuffer();
          fitModelToView();
          return;
        }

        // ESCキーで数値バッファをクリア
        if (key === 'Escape') {
          clearNumericBuffer();
          return;
        }

        // 数字キー（0-9）の入力をバッファに追加
        if (/^[0-9]$/.test(key)) {
          const newBuffer = numericBuffer + key;
          setNumericBuffer(newBuffer);
          resetNumericBufferTimeout();
          return;
        }

        // Backspaceキーで数値バッファの最後の文字を削除
        if (key === 'Backspace' && numericBuffer) {
          event.preventDefault();
          setNumericBuffer(numericBuffer.slice(0, -1));
          resetNumericBufferTimeout();
          return;
        }

        // 's'キー: lastKeyが's'の場合はスライス平面の表示モード切り替え（ss）
        if (key === 's') {
          if (clippingMode === 'Slice' && lastKeyRef.current === 's') {
            // ssキーでスライス平面の表示モードを切り替え
            setAlwaysShowSlicePlanes((prev) => !prev);
            lastKeyRef.current = '';
            if (lastKeyTimeoutRef.current !== null) {
              window.clearTimeout(lastKeyTimeoutRef.current);
              lastKeyTimeoutRef.current = null;
            }
            clearNumericBuffer();
            return;
          } else {
            // lastKeyをsに設定してタイムアウトを開始
            lastKeyRef.current = 's';
            if (lastKeyTimeoutRef.current !== null) {
              window.clearTimeout(lastKeyTimeoutRef.current);
            }
            lastKeyTimeoutRef.current = window.setTimeout(() => {
              lastKeyRef.current = '';
            }, 1000);
            return;
          }
        }

        // 小文字のキー（x, y, z - 軸視点切り替え、またはsxでスライス軸切り替え）
        if (key === 'x' || key === 'y' || key === 'z') {
          // Sliceモード かつ lastKeyが's'の場合はスライス軸を切り替え
          if (clippingMode === 'Slice' && lastKeyRef.current === 's') {
            const axisMap = { x: 'X' as const, y: 'Y' as const, z: 'Z' as const };
            setClipping({ sliceAxis: axisMap[key] });
            showSlicePlanesTemporarily(); // 軸切り替え時にスライス平面を一時表示
            lastKeyRef.current = '';
            if (lastKeyTimeoutRef.current !== null) {
              window.clearTimeout(lastKeyTimeoutRef.current);
              lastKeyTimeoutRef.current = null;
            }
            clearNumericBuffer();
          } else {
            // 通常の軸視点切り替え
            clearNumericBuffer();
            setAxisView(key);
          }
          return;
        }

        // 大文字のキー（X, Y, Z - 90度回転）
        if (key === 'X' || key === 'Y' || key === 'Z') {
          clearNumericBuffer();
          rotateAroundAxis(key.toLowerCase() as 'x' | 'y' | 'z');
          return;
        }

        // "o": スライス1/2の切り替え
        if (key === 'o') {
          clearNumericBuffer();
          setActiveSlice((prev) => (prev === 1 ? 2 : 1));
          return;
        }

        // Sliceモード専用のキー
        if (clippingMode === 'Slice') {
          const maxRange = sliceAxis === 'X' ? x : sliceAxis === 'Y' ? y : z;

          // "k": 対象スライスを正方向に移動 (up)
          if (key === 'k') {
            const amount = numericBuffer ? parseInt(numericBuffer, 10) : 1;
            if (!isNaN(amount)) {
              if (activeSlice === 1) {
                const newPosition = Math.min(slicePosition1 + amount, maxRange);
                setSlicePosition(newPosition, undefined);
              } else {
                const newPosition = Math.min(slicePosition2 + amount, maxRange);
                setSlicePosition(undefined, newPosition);
              }
            }
            clearNumericBuffer();
            return;
          }

          // "j": 対象スライスを逆方向に移動 (down)
          if (key === 'j') {
            const amount = numericBuffer ? parseInt(numericBuffer, 10) : 1;
            if (!isNaN(amount)) {
              if (activeSlice === 1) {
                const newPosition = Math.max(slicePosition1 - amount, 0);
                setSlicePosition(newPosition, undefined);
              } else {
                const newPosition = Math.max(slicePosition2 - amount, 0);
                setSlicePosition(undefined, newPosition);
              }
            }
            clearNumericBuffer();
            return;
          }

          // "K": 両スライスを正方向に移動 (up)
          if (key === 'K') {
            const amount = numericBuffer ? parseInt(numericBuffer, 10) : 1;
            if (!isNaN(amount)) {
              const newPosition1 = Math.min(slicePosition1 + amount, maxRange);
              const newPosition2 = Math.min(slicePosition2 + amount, maxRange);
              setSlicePosition(newPosition1, newPosition2);
            }
            clearNumericBuffer();
            return;
          }

          // "J": 両スライスを逆方向に移動 (down)
          if (key === 'J') {
            const amount = numericBuffer ? parseInt(numericBuffer, 10) : 1;
            if (!isNaN(amount)) {
              const newPosition1 = Math.max(slicePosition1 - amount, 0);
              const newPosition2 = Math.max(slicePosition2 - amount, 0);
              setSlicePosition(newPosition1, newPosition2);
            }
            clearNumericBuffer();
            return;
          }

          // "g": 数値バッファありで現在選択中のスライスをジャンプ、"gg"で両スライスを距離保持で+側max移動
          if (key === 'g') {
            if (numericBuffer) {
              // "10g": 現在選択中のスライスを指定位置に移動
              const targetPosition = parseInt(numericBuffer, 10);
              if (!isNaN(targetPosition)) {
                const clampedPosition = Math.max(0, Math.min(targetPosition, maxRange));
                if (activeSlice === 1) {
                  setSlicePosition(clampedPosition, undefined);
                } else {
                  setSlicePosition(undefined, clampedPosition);
                }
              }
              clearNumericBuffer();
            } else if (lastKeyRef.current === 'g') {
              // "gg": 両スライスを距離保持で+側がmaxになるように移動
              const maxSlice = Math.max(slicePosition1, slicePosition2);
              const minSlice = Math.min(slicePosition1, slicePosition2);
              const distance = maxSlice - minSlice;
              const newMax = maxRange;
              const newMin = Math.max(0, newMax - distance);

              // どちらがmaxだったかを判定して適切に設定
              if (slicePosition1 > slicePosition2) {
                setSlicePosition(newMax, newMin);
              } else {
                setSlicePosition(newMin, newMax);
              }
              lastKeyRef.current = '';
              clearNumericBuffer();
            } else {
              // 最初の"g"を記録
              lastKeyRef.current = 'g';
              if (lastKeyTimeoutRef.current !== null) {
                window.clearTimeout(lastKeyTimeoutRef.current);
              }
              lastKeyTimeoutRef.current = window.setTimeout(() => {
                lastKeyRef.current = '';
              }, 1000);
            }
            return;
          }

          // "G": 数値バッファありで中心を指定位置に移動、なしで両スライスを距離保持で-側min移動
          if (key === 'G') {
            if (numericBuffer) {
              // "10G": slice1/2の中心を指定位置に移動（距離保持）
              const targetCenter = parseInt(numericBuffer, 10);
              if (!isNaN(targetCenter)) {
                const distance = Math.abs(slicePosition1 - slicePosition2);
                const halfDistance = distance / 2;

                let newSlice1 = targetCenter - halfDistance;
                let newSlice2 = targetCenter + halfDistance;

                // 範囲チェックして調整
                if (newSlice1 < 0) {
                  newSlice1 = 0;
                  newSlice2 = distance;
                } else if (newSlice2 > maxRange) {
                  newSlice2 = maxRange;
                  newSlice1 = maxRange - distance;
                }

                // 範囲内にクランプ
                newSlice1 = Math.max(0, Math.min(newSlice1, maxRange));
                newSlice2 = Math.max(0, Math.min(newSlice2, maxRange));

                // slice1とslice2の大小関係を保つ
                if (slicePosition1 < slicePosition2) {
                  setSlicePosition(newSlice1, newSlice2);
                } else {
                  setSlicePosition(newSlice2, newSlice1);
                }
              }
            } else {
              // "G": 両スライスを距離保持で-側がminになるように移動
              const maxSlice = Math.max(slicePosition1, slicePosition2);
              const minSlice = Math.min(slicePosition1, slicePosition2);
              const distance = maxSlice - minSlice;
              const newMin = 0;
              const newMax = Math.min(maxRange, newMin + distance);

              // どちらがminだったかを判定
              if (slicePosition1 < slicePosition2) {
                setSlicePosition(newMin, newMax);
              } else {
                setSlicePosition(newMax, newMin);
              }
            }
            clearNumericBuffer();
            return;
          }

          // "M": 対象スライスを中央に移動
          if (key === 'M') {
            clearNumericBuffer();
            if (activeSlice === 1) {
              setSlicePosition(Math.floor(maxRange / 2), undefined);
            } else {
              setSlicePosition(undefined, Math.floor(maxRange / 2));
            }
            return;
          }

          // "H": 対象スライスを最大位置に移動
          if (key === 'H') {
            clearNumericBuffer();
            if (activeSlice === 1) {
              setSlicePosition(maxRange, undefined);
            } else {
              setSlicePosition(undefined, maxRange);
            }
            return;
          }

          // "L": 対象スライスを最小位置に移動
          if (key === 'L') {
            clearNumericBuffer();
            if (activeSlice === 1) {
              setSlicePosition(0, undefined);
            } else {
              setSlicePosition(undefined, 0);
            }
            return;
          }

          // "=": 現在の軸のスライス位置を初期配置にリセット（min=0, max=軸の最大値）
          if (key === '=') {
            clearNumericBuffer();
            setSlicePosition(maxRange, 0);
            return;
          }

          // "s": 次にx/y/zでスライス軸切り替え
          if (key === 's') {
            lastKeyRef.current = 's';
            if (lastKeyTimeoutRef.current !== null) {
              window.clearTimeout(lastKeyTimeoutRef.current);
            }
            lastKeyTimeoutRef.current = window.setTimeout(() => {
              lastKeyRef.current = '';
            }, 1000);
            return;
          }
        }

        // "R"キー（大文字）で設定すべてリセット（カメラも画面サイズに合わせて初期位置に）
        if (key === 'R') {
          clearNumericBuffer();
          resetAllSettings();

          // カメラ位置もリセット（現在の画面サイズに基づいた初期位置に）
          if (controlsRef.current) {
            const camera = controlsRef.current.object;
            const target = controlsRef.current.target;

            // 現在の画面サイズに基づいた初期位置を計算
            const initialPos = calculateInitialCameraPosition();
            camera.position.copy(initialPos);
            target.set(0, 0, 0);

            // カメラの姿勢を初期状態にリセット（Z軸が上）
            camera.up.set(0, 0, 1);

            // Orthographicカメラの場合はズームもリセット
            if ((camera as any).isOrthographicCamera) {
              const orthoCamera = camera as THREE.OrthographicCamera;
              orthoCamera.zoom = calculateInitialOrthoZoom();
              orthoCamera.updateProjectionMatrix();
            }

            camera.updateProjectionMatrix();
            controlsRef.current.update();
            stopControlsInertia();
          }
          return;
        }

        // "r"キー（小文字）でカメラのみリセット（位置・角度を初期値に、画面サイズ考慮）
        if (key === 'r') {
          clearNumericBuffer();
          if (controlsRef.current) {
            const camera = controlsRef.current.object;
            const target = controlsRef.current.target;

            // 現在の画面サイズに基づいた初期位置を計算
            const initialPos = calculateInitialCameraPosition();
            camera.position.copy(initialPos);
            target.set(0, 0, 0);

            // カメラの姿勢を初期状態にリセット（Z軸が上）
            camera.up.set(0, 0, 1);

            // Orthographicカメラの場合はズームもリセット
            if ((camera as any).isOrthographicCamera) {
              const orthoCamera = camera as THREE.OrthographicCamera;
              orthoCamera.zoom = calculateInitialOrthoZoom();
              orthoCamera.updateProjectionMatrix();
            }

            camera.updateProjectionMatrix();
            controlsRef.current.update();
            stopControlsInertia();
          }
          return;
        }

        switch (key.toLowerCase()) {
          case 'p':
            clearNumericBuffer();
            set({ usePerspective: !usePerspective });
            break;
          case 'e':
            clearNumericBuffer();
            set({ enableEdgeHighlight: !enableEdgeHighlight });
            break;
          case 'c':
            // "cc"キーでclippingを切り替え、"cx/cy/cz"でスライス軸を切り替え
            if (lastKeyRef.current === 'c') {
              // 2回目の'c' → clippingをトグル
              clearNumericBuffer(); // lastKeyRefをチェックした後にクリア
              if (clippingMode === 'Off') {
                setClipping({ clippingMode: 'Slice' });
                setIsClippingCollapsed(false); // 有効化したら展開
              } else {
                setClipping({ clippingMode: 'Off' });
                setIsClippingCollapsed(true); // 無効化したら折りたたむ
              }
              lastKeyRef.current = '';
              if (lastKeyTimeoutRef.current !== null) {
                window.clearTimeout(lastKeyTimeoutRef.current);
                lastKeyTimeoutRef.current = null;
              }
            } else {
              // 1回目の'c' → 次のキー入力待ち（cx/cy/czまたはccの準備）
              // 数値バッファのみクリア（lastKeyRefは保持）
              setNumericBuffer('');
              if (numericBufferTimeoutRef.current !== null) {
                window.clearTimeout(numericBufferTimeoutRef.current);
                numericBufferTimeoutRef.current = null;
              }

              lastKeyRef.current = 'c';
              if (lastKeyTimeoutRef.current !== null) {
                window.clearTimeout(lastKeyTimeoutRef.current);
              }
              lastKeyTimeoutRef.current = window.setTimeout(() => {
                lastKeyRef.current = '';
              }, 1000);
            }
            break;
          case 'b':
            clearNumericBuffer();
            set({ showBoundingBox: !showBoundingBox });
            break;
          case 'w':
            clearNumericBuffer();
            set({ showGrid: !showGrid });
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
      enableEdgeHighlight,
      clippingMode,
      showBoundingBox,
      showGrid,
      slicePosition1,
      slicePosition2,
      sliceRange,
      numericBuffer,
      activeSlice,
      usePerspective,
      set,
      setClipping,
      setAxisView,
      rotateAroundAxis,
      clearNumericBuffer,
      resetNumericBufferTimeout,
      resetAllSettings,
      fitModelToView,
      showSlicePlanesTemporarily,
    ]);

    // クリッピングプレーン計算
    const calculateClippingPlane = () => {
      if (clippingMode === 'Off') {
        return {
          mode: 'off' as const,
          normal: new THREE.Vector3(0, 0, 1),
          distance: 0,
          enabled: false,
          axis: 0,
          xMin: 0,
          xMax: 0,
          yMin: 0,
          yMax: 0,
          zMin: 0,
          zMax: 0,
        };
      }

      if (clippingMode === 'Slice') {
        const { x, y, z } = voxelData.dimensions;

        // 操作対象の軸 (0=X, 1=Y, 2=Z)
        let axis = 0;
        switch (sliceAxis) {
          case 'X':
            axis = 0;
            break;
          case 'Y':
            axis = 1;
            break;
          case 'Z':
            axis = 2;
            break;
        }

        // すべての軸のクリッピング距離を中心からのオフセットに変換
        // Slice 1 (Pos) は大きい値 → Max, Slice 2 (Neg) は小さい値 → Min
        const xMax = slicePosition1X - x / 2;
        const xMin = slicePosition2X - x / 2;
        const yMax = slicePosition1Y - y / 2;
        const yMin = slicePosition2Y - y / 2;
        const zMax = slicePosition1Z - z / 2;
        const zMin = slicePosition2Z - z / 2;

        return {
          mode: 'slice' as const,
          axis,
          xMin,
          xMax,
          yMin,
          yMax,
          zMin,
          zMax,
          enabled: true,
          normal: new THREE.Vector3(0, 0, 1), // dummy
          distance: 0, // dummy
        };
      }

      // Custom mode
      const normal = new THREE.Vector3(customNormalX, customNormalY, customNormalZ).normalize();
      return {
        mode: 'custom' as const,
        normal,
        distance: customDistance,
        enabled: true,
        axis: 0,
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0,
        zMin: 0,
        zMax: 0,
      };
    };

    const clippingPlane = calculateClippingPlane();
    const effectiveDpr = Math.min(Math.max(dpr, 0.5), maxDpr);

    // モデルのサイズに基づいて適切なカメラfarを自動計算
    const autoFar = useMemo(() => {
      const { x, y, z } = voxelData.dimensions;
      // モデルの対角線の長さ
      const diagonal = Math.sqrt(x * x + y * y + z * z);
      // モデルを十分にカバーできる距離（対角線の5倍程度）
      return diagonal * 5;
    }, [voxelData.dimensions]);

    // 自動計算されたfarとユーザー指定のfarの大きい方を使用
    const effectiveFar = Math.max(autoFar, far);

    // モデル全体が画面に収まるカメラ初期位置を計算（固定、リサイズ時は再計算しない）
    const initialCameraPosition = useMemo(() => {
      const { x, y, z } = voxelData.dimensions;
      // バウンディングスフィアの半径
      const radius = Math.sqrt(x * x + y * y + z * z) / 2;
      // デフォルトFOVでちょうど収まる距離（初回の画面サイズで計算）
      const defaultFovRad = (defaultValues.current.fov * Math.PI) / 180;
      const aspect = width / height;

      // 縦方向と横方向の両方に収まる距離を計算
      const distanceV = (radius / Math.tan(defaultFovRad / 2)) * 1.2; // 縦方向
      const fovH = 2 * Math.atan(Math.tan(defaultFovRad / 2) * aspect); // 横方向FOV
      const distanceH = (radius / Math.tan(fovH / 2)) * 1.2; // 横方向

      // 両方に収まる距離（大きい方）を採用
      const distance = Math.max(distanceV, distanceH);

      // 視線方向 (2.5, 1.0, 0.5) を正規化してdistance倍
      const dir = new THREE.Vector3(2.5, 1.0, 0.5).normalize();
      return new THREE.Vector3(dir.x * distance, dir.y * distance, dir.z * distance);
    }, [voxelData.dimensions]); // width, heightは依存配列から削除

    // OrthographicCamera用の初期ズーム値を計算（固定、リサイズ時は再計算しない）
    const orthoInitialZoomRef = useRef<number>(0);
    useMemo(() => {
      if (orthoInitialZoomRef.current !== 0) return; // 初回のみ計算
      const { x, y, z } = voxelData.dimensions;
      const maxDim = Math.max(x, y, z);
      // Perspectiveと同等の見え方になるよう調整
      // ビューポートの半分 / モデルの最大寸法 で適切なズームに
      const zoom = Math.min(width, height) / (maxDim * 1.4);
      orthoInitialZoomRef.current = Math.max(0.1, zoom);
    }, [voxelData.dimensions, width, height]);

    // Perspective→Orthographic切り替え時: 見た目のスケールが一致するzoomを事前計算
    // レンダーフェーズで計算することで、OrthoZoomHandlerのuseEffectより先に値が設定される
    if (!usePerspective && cameraStateRef.current && cameraStateRef.current.isPerspective) {
      const saved = cameraStateRef.current;
      const distance = saved.position.distanceTo(saved.target);
      const fovRad = (saved.perspFov * Math.PI) / 180;
      if (fovRad > 0 && distance > 0) {
        const visibleHeight = 2 * distance * Math.tan(fovRad / 2);
        orthoInitialZoomRef.current = Math.max(0.01, height / visibleHeight);
      }
    }

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

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* メインのLeva（右上） */}
        <Leva
          collapsed={true}
          theme={{
            sizes: {
              rootWidth: '320px',
              controlWidth: '160px',
            },
          }}
          hideCopyButton
        />

        {/* Clipping専用のLeva（右上のメインメニューの下） - clippingStoreを使用 */}
        <div
          style={{
            position: 'fixed',
            right: '10px',
            top: '400px', // メインメニューが展開しても重ならず、gizmoともぶつからない位置
            zIndex: 1000,
          }}
        >
          <div className="leva-clipping-panel">
            <style>{`
              .leva-clipping-panel > div {
                position: relative !important;
              }
            `}</style>
            <Leva
              {...({ store: clippingStore } as any)}
              fill
              flat
              collapsed={isClippingCollapsed}
              key={`clipping-${isClippingCollapsed}`} // 折りたたみ状態が変わったら再レンダリング
              theme={{
                sizes: {
                  rootWidth: '320px',
                  controlWidth: '160px',
                },
              }}
              hideCopyButton
              titleBar={{ title: 'Clipping Controls' }}
            />
          </div>
        </div>

        {/* アクティブスライスインジケーター（Sliceモード時のみ） */}
        {clippingMode === 'Slice' && (
          <div
            style={{
              position: 'absolute',
              top: '100px',
              left: '20px',
              padding: '8px 16px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: activeSlice === 1 ? '#00aaff' : '#ff9900',
              fontSize: '16px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              borderRadius: '6px',
              border: `2px solid ${activeSlice === 1 ? '#00aaff' : '#ff9900'}`,
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            Slice {activeSlice} {activeSlice === 1 ? '(Pos)' : '(Neg)'}:{' '}
            {activeSlice === 1 ? slicePosition1 : slicePosition2}
          </div>
        )}

        {/* 数値バッファ表示（入力中のみ） */}
        {numericBuffer && clippingMode === 'Slice' && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '12px 24px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#00ff00',
              fontSize: '32px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              borderRadius: '8px',
              border: '2px solid #00ff00',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            {numericBuffer}
          </div>
        )}

        <Canvas
          gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
          dpr={effectiveDpr}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
          frameloop={isVisible ? 'demand' : 'never'}
        >
          <VisibilityManager isVisible={isVisible} />
          {usePerspective ? (
            <PerspectiveCamera
              makeDefault
              position={initialCameraPosition}
              up={[0, 0, 1]}
              fov={fov}
              far={effectiveFar}
            />
          ) : (
            <OrthographicCamera
              makeDefault
              position={initialCameraPosition}
              up={[0, 0, 1]}
              zoom={orthoInitialZoomRef.current}
              near={0.1}
              far={effectiveFar}
            />
          )}

          {!usePerspective && <OrthoZoomHandler initialZoomRef={orthoInitialZoomRef} />}

          <CameraStateManager
            cameraStateRef={cameraStateRef}
            controlsRef={controlsRef}
            usePerspective={usePerspective}
            fov={fov}
            canvasHeight={height}
            orthoInitialZoomRef={orthoInitialZoomRef}
          />

          <CaptureHelper captureRef={captureRef} />

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
            clippingPlane={clippingPlane}
            enableClipping={clippingPlane.enabled}
            enableEdgeHighlight={enableEdgeHighlight}
            edgeThickness={edgeThickness}
            edgeColor={edgeColor}
            edgeIntensity={edgeIntensity}
            edgeFadeStart={0}
            edgeFadeEnd={edgeMaxDistance}
            valueVisibility={valueVisibility}
            customColors={customColors}
            useOccupancy={useOccupancy}
          />

          {showBoundingBox && (
            <lineSegments>
              <edgesGeometry
                args={[
                  new THREE.BoxGeometry(
                    voxelData.dimensions.x,
                    voxelData.dimensions.y,
                    voxelData.dimensions.z
                  ),
                ]}
              />
              <lineBasicMaterial color="#00ff00" linewidth={2} />
            </lineSegments>
          )}

          {showScaleBar && (
            <ScaleBar dimensions={voxelData.dimensions} voxelLength={voxelData.voxelLength} />
          )}

          {showGrid && (
            <gridHelper
              args={[Math.max(voxelData.dimensions.x, voxelData.dimensions.y) * 3, 10]}
              position={[0, 0, Number((-voxelData.dimensions.z / 2) * 1.1)]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          )}

          {/* スライス平面の可視化（両方のスライス） */}
          {(alwaysShowSlicePlanes || showSlicePlanes) && clippingMode === 'Slice' && (
            <>
              {/* Slice 1 (Pos) の平面 */}
              {(() => {
                const { x, y, z } = voxelData.dimensions;
                let position: [number, number, number] = [0, 0, 0];
                let rotation: [number, number, number] = [0, 0, 0];
                let planeSize: [number, number] = [1, 1];

                switch (sliceAxis) {
                  case 'X':
                    position = [slicePosition1 - x / 2, 0, 0];
                    rotation = [0, Math.PI / 2, 0];
                    planeSize = [z * 1.2, y * 1.2];
                    break;
                  case 'Y':
                    position = [0, slicePosition1 - y / 2, 0];
                    rotation = [Math.PI / 2, 0, 0];
                    planeSize = [x * 1.2, z * 1.2];
                    break;
                  case 'Z':
                    position = [0, 0, slicePosition1 - z / 2];
                    rotation = [0, 0, 0];
                    planeSize = [x * 1.2, y * 1.2];
                    break;
                }

                return (
                  <DraggableSlicePlane
                    position={position}
                    rotation={rotation}
                    planeSize={planeSize}
                    color="#00aaff"
                    sliceNumber={1}
                    sliceAxis={sliceAxis as 'X' | 'Y' | 'Z'}
                    dimensions={voxelData.dimensions}
                    onDragStart={handleSliceDragStart}
                    onDrag={handleSliceDrag}
                    onDragEnd={handleSliceDragEnd}
                    controlsRef={controlsRef}
                  />
                );
              })()}

              {/* Slice 2 (Neg) の平面 */}
              {(() => {
                const { x, y, z } = voxelData.dimensions;
                let position: [number, number, number] = [0, 0, 0];
                let rotation: [number, number, number] = [0, 0, 0];
                let planeSize: [number, number] = [1, 1];

                switch (sliceAxis) {
                  case 'X':
                    position = [slicePosition2 - x / 2, 0, 0];
                    rotation = [0, Math.PI / 2, 0];
                    planeSize = [z * 1.2, y * 1.2];
                    break;
                  case 'Y':
                    position = [0, slicePosition2 - y / 2, 0];
                    rotation = [Math.PI / 2, 0, 0];
                    planeSize = [x * 1.2, z * 1.2];
                    break;
                  case 'Z':
                    position = [0, 0, slicePosition2 - z / 2];
                    rotation = [0, 0, 0];
                    planeSize = [x * 1.2, y * 1.2];
                    break;
                }

                return (
                  <DraggableSlicePlane
                    position={position}
                    rotation={rotation}
                    planeSize={planeSize}
                    color="#ff9900"
                    sliceNumber={2}
                    sliceAxis={sliceAxis as 'X' | 'Y' | 'Z'}
                    dimensions={voxelData.dimensions}
                    onDragStart={handleSliceDragStart}
                    onDrag={handleSliceDrag}
                    onDragEnd={handleSliceDragEnd}
                    controlsRef={controlsRef}
                  />
                );
              })()}
            </>
          )}

          <Stats />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#ff0000', '#00ff00', '#0000ff']} labelColor="white" />
          </GizmoHelper>
        </Canvas>
      </div>
    );
  }
);

VoxelRenderer.displayName = 'VoxelRenderer';
