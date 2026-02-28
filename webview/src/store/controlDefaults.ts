import type { ControlState } from './controlTypes';

export const DEFAULT_PALETTE: string[] = [
  '#000000', // 0 (空ボクセル)
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#ff8000',
  '#8000ff',
  '#0080ff',
  '#ff0080',
  '#80ff00',
  '#00ff80',
  '#804000',
  '#404040',
  '#c0c0c0',
];

export const DEFAULT_VISIBILITY: boolean[] = [
  false, // 0 (空)は非表示
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];

export const DEFAULT_CONTROL_STATE: ControlState = {
  // Initialization Info
  voxelDims: { x: 1, y: 1, z: 1 },
  maxDpr: 1.0,
  // Camera
  usePerspective: true,
  fov: 50,
  far: 2000,
  // Lighting
  lightIntensity: 0.8,
  ambientIntensity: 0.4,
  // Display
  alpha: 1.0,
  dpr: 1.0, // initDefaults()で maxDpr に更新
  useOccupancy: true,
  showScaleBar: true,
  showBoundingBox: false,
  showGrid: true,
  // Edge Highlight
  enableEdgeHighlight: true,
  edgeThickness: 0.03,
  edgeColor: '#ffffff',
  edgeIntensity: 0.8,
  edgeMaxDistance: 200,
  // Clipping
  clippingMode: 'Off',
  sliceAxis: 'Z',
  slicePosition1X: 0,
  slicePosition2X: 0,
  slicePosition1Y: 0,
  slicePosition2Y: 0,
  slicePosition1Z: 0,
  slicePosition2Z: 0,
  customNormalX: 0,
  customNormalY: 0,
  customNormalZ: 1,
  customDistance: 0,
  alwaysShowSlicePlanes: false,
  activeSlice: 1,
  // Camera Reset
  cameraResetRequest: 0,
  // Colors
  customColors: DEFAULT_PALETTE,
  valueVisibility: DEFAULT_VISIBILITY,
};
