import type { ControlState } from './controlTypes';

export const DEFAULT_PALETTE: string[] = [
  '#FFFFFF', // 0 (空ボクセル default) -> #FFFFFF (パッケージJSONと同じ)
  '#0000FF', // 1
  '#FF0000', // 2
  '#FFFF00', // 3
  '#00FF00', // 4
  '#FF00FF', // 5
  '#1F77B4', // 6
  '#FF7F0E', // 7
  '#2CA02C', // 8
  '#D62728', // 9
  '#9467BD', // 10
  '#8C564B', // 11
  '#E377C2', // 12
  '#7F7F7F', // 13
  '#BCBD22', // 14
  '#17BECF', // 15
];

export const SEM_PALETTE: string[] = [
  '#1a1a1a', // 0 (オフブラック)
  '#e6e6e6', // 1 (白に近いグレー)
  '#d6d6d6', // 2
  '#c6c6c6', // 3
  '#b7b7b7', // 4
  '#a8a8a8', // 5
  '#999999', // 6
  '#898989', // 7
  '#7a7a7a', // 8
  '#6b6b6b', // 9
  '#5c5c5c', // 10
  '#4d4d4d', // 11
  '#3d3d3d', // 12
  '#2e2e2e', // 13
  '#1f1f1f', // 14
  '#101010', // 15
];

export const GRAYSCALE_PALETTE: string[] = [
  '#000000',
  '#111111',
  '#222222',
  '#333333',
  '#444444',
  '#555555',
  '#666666',
  '#777777',
  '#888888',
  '#999999',
  '#aaaaaa',
  '#bbbbbb',
  '#cccccc',
  '#dddddd',
  '#eeeeee',
  '#ffffff',
];

export const RAINBOW_PALETTE: string[] = [
  '#000000',
  '#ff0000',
  '#ff4000',
  '#ff8000',
  '#ffbf00',
  '#ffff00',
  '#bfff00',
  '#80ff00',
  '#40ff00',
  '#00ff00',
  '#00ff40',
  '#00ff80',
  '#00ffbf',
  '#00ffff',
  '#00bfff',
  '#0080ff',
];

export const TAB10_PALETTE: string[] = [
  '#000000',
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
  '#1f77b4', // 11以降はループさせる
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
];

export const SET1_PALETTE: string[] = [
  '#000000',
  '#e41a1c',
  '#377eb8',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
  '#ffff33',
  '#a65628',
  '#f781bf',
  '#999999',
  '#e41a1c',
  '#377eb8',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
  '#ffff33',
];

export const SET2_PALETTE: string[] = [
  '#000000',
  '#66c2a5',
  '#fc8d62',
  '#8da0cb',
  '#e78ac3',
  '#a6d854',
  '#ffd92f',
  '#e5c494',
  '#b3b3b3',
  '#66c2a5',
  '#fc8d62',
  '#8da0cb',
  '#e78ac3',
  '#a6d854',
  '#ffd92f',
  '#e5c494',
];

export const SET3_PALETTE: string[] = [
  '#000000',
  '#8dd3c7',
  '#ffffb3',
  '#bebada',
  '#fb8072',
  '#80b1d3',
  '#fdb462',
  '#b3de69',
  '#fccde5',
  '#d9d9d9',
  '#bc80bd',
  '#ccebc5',
  '#ffed6f',
  '#8dd3c7',
  '#ffffb3',
  '#bebada',
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
  colorProfile: 'hako',
  customColors: DEFAULT_PALETTE,
  valueVisibility: DEFAULT_VISIBILITY,
  // Statistics
  voxelStatistics: null,
};
