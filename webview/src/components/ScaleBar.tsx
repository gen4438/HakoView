import React, { useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { formatPhysicalLength } from '../utils/scaleBarUtils';

interface ScaleBarProps {
  dimensions: { x: number; y: number; z: number };
  voxelLength: number;
}

interface Edge {
  start: THREE.Vector3;
  end: THREE.Vector3;
  axis: 'x' | 'y' | 'z';
  faceNormals: [THREE.Vector3, THREE.Vector3];
  outwardDir: THREE.Vector3;
}

// Pre-allocated temp vectors for useFrame (avoid GC)
const _viewDir = new THREE.Vector3();
const _edgeMid = new THREE.Vector3();
const _projected = new THREE.Vector3();
const _barDir = new THREE.Vector3();
const _barStart = new THREE.Vector3();
const _barEnd = new THREE.Vector3();
const _tickOffset = new THREE.Vector3();
const _labelPos = new THREE.Vector3();

const AXIS_COLORS_HEX = [0xff4444, 0x44ff44, 0x4488ff];
const AXIS_COLORS_STR = ['#ff4444', '#44ff44', '#4488ff'];
const AXES: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];

/**
 * Create a text sprite for scale bar label
 */
function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const fontSize = 56;
  ctx.font = `bold ${fontSize}px "Consolas", "Monaco", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Measure text for background
  const metrics = ctx.measureText(text);
  const pad = 14;
  const bgW = metrics.width + pad * 2;
  const bgH = fontSize + pad;
  const bgX = (canvas.width - bgW) / 2;
  const bgY = (canvas.height - bgH) / 2;

  // Semi-transparent black background with rounded rect
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(bgX + r, bgY);
  ctx.lineTo(bgX + bgW - r, bgY);
  ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + r);
  ctx.lineTo(bgX + bgW, bgY + bgH - r);
  ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - r, bgY + bgH);
  ctx.lineTo(bgX + r, bgY + bgH);
  ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - r);
  ctx.lineTo(bgX, bgY + r);
  ctx.quadraticCurveTo(bgX, bgY, bgX + r, bgY);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 1000;
  sprite.frustumCulled = false;
  return sprite;
}

/**
 * Helper to build one edge object
 */
function makeEdge(
  start: THREE.Vector3,
  end: THREE.Vector3,
  axis: 'x' | 'y' | 'z',
  n0: THREE.Vector3,
  n1: THREE.Vector3
): Edge {
  return {
    start,
    end,
    axis,
    faceNormals: [n0, n1],
    outwardDir: new THREE.Vector3().addVectors(n0, n1).normalize(),
  };
}

/**
 * Scale bar component
 *
 * Draws dimension indicators along 3 edges (one per axis) of an expanded
 * bounding box. The bar length equals the model dimension for each axis.
 * Edges auto-switch based on camera orientation, preferring bottom-right
 * screen position with farther-from-camera tiebreaker.
 */
export function ScaleBar({ dimensions, voxelLength }: ScaleBarProps) {
  const { camera } = useThree();

  const modelSize = useMemo(() => Math.max(dimensions.x, dimensions.y, dimensions.z), [dimensions]);

  // Model bounding box (no margin) for edge selection
  const modelBox = useMemo(() => {
    const { x, y, z } = dimensions;
    return {
      min: new THREE.Vector3(-x / 2, -y / 2, -z / 2),
      max: new THREE.Vector3(x / 2, y / 2, z / 2),
    };
  }, [dimensions]);

  // Margin for offsetting scale bars outward from model surface
  const margin = useMemo(() => modelSize * 0.05, [modelSize]);

  // Define 12 edges of the model bounding box (no margin)
  const edges = useMemo((): Edge[] => {
    const { min, max } = modelBox;
    return [
      // X-axis edges (4)
      makeEdge(
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, min.z),
        'x',
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, -1)
      ),
      makeEdge(
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, min.z),
        'x',
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, -1)
      ),
      makeEdge(
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(max.x, min.y, max.z),
        'x',
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1)
      ),
      makeEdge(
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, max.y, max.z),
        'x',
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1)
      ),
      // Y-axis edges (4)
      makeEdge(
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, max.y, min.z),
        'y',
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ),
      makeEdge(
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, max.y, min.z),
        'y',
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ),
      makeEdge(
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, max.z),
        'y',
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1)
      ),
      makeEdge(
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, max.z),
        'y',
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 1)
      ),
      // Z-axis edges (4)
      makeEdge(
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        'z',
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, -1, 0)
      ),
      makeEdge(
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        'z',
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, -1, 0)
      ),
      makeEdge(
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        'z',
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0)
      ),
      makeEdge(
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z),
        'z',
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0)
      ),
    ];
  }, [modelBox]);

  // Create rendering objects: LineSegments + Sprites, one per axis
  const renderObjects = useMemo(() => {
    return AXES.map((axis, i) => {
      // 3 line segments = 6 vertices * 3 components = 18 floats
      const positions = new Float32Array(18);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: AXIS_COLORS_HEX[i],
        depthTest: false,
        depthWrite: false,
      });

      const lines = new THREE.LineSegments(geometry, material);
      lines.renderOrder = 999;
      lines.visible = false;
      lines.frustumCulled = false;

      // Label: "X: 200 nm" etc.
      const physLen = dimensions[axis] * voxelLength;
      const labelText = `${axis.toUpperCase()}: ${formatPhysicalLength(physLen)}`;
      const sprite = createTextSprite(labelText, AXIS_COLORS_STR[i]);
      sprite.visible = false;

      return { axis, lines, sprite, geometry };
    });
  }, [dimensions, voxelLength]);

  // Cleanup on unmount or re-creation
  useEffect(() => {
    return () => {
      renderObjects.forEach((obj) => {
        obj.geometry.dispose();
        (obj.lines.material as THREE.Material).dispose();
        const mat = obj.sprite.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
      });
    };
  }, [renderObjects]);

  // Update positions every frame based on camera
  useFrame(() => {
    // Guard: skip if invalid data
    if (voxelLength <= 0 || dimensions.x <= 0 || dimensions.y <= 0 || dimensions.z <= 0) {
      return;
    }

    // View direction: camera → model center (origin)
    _viewDir.copy(camera.position).negate().normalize();

    const tickLen = modelSize * 0.025;
    const SILHOUETTE_THRESHOLD = 0.01;

    for (let axisIdx = 0; axisIdx < 3; axisIdx++) {
      const obj = renderObjects[axisIdx];
      const axis = AXES[axisIdx];
      // Bar length = model dimension (full extent of this axis)
      const barLength = dimensions[axis];

      // --- Edge selection: silhouette edges only + bottom-right preference ---
      // A silhouette edge has one adjacent face toward camera and one away.
      // These lie on the boundary of the projected bounding box and don't
      // overlap its interior. Ridge edges (both faces toward camera) and
      // valley edges (both faces away) are excluded.
      let bestEdge: Edge | null = null;
      let bestScore = -Infinity;

      for (const edge of edges) {
        if (edge.axis !== axis) continue;

        const d0 = edge.faceNormals[0].dot(_viewDir);
        const d1 = edge.faceNormals[1].dot(_viewDir);

        // Skip ridge edges (both faces clearly toward camera)
        const isFront = d0 < -SILHOUETTE_THRESHOLD && d1 < -SILHOUETTE_THRESHOLD;
        // Skip valley edges (both faces clearly away from camera)
        const isBack = d0 > SILHOUETTE_THRESHOLD && d1 > SILHOUETTE_THRESHOLD;
        if (isFront || isBack) continue;

        // Project edge midpoint to screen space
        _edgeMid.addVectors(edge.start, edge.end).multiplyScalar(0.5);
        _projected.copy(_edgeMid).project(camera);
        const screenX = (1 + _projected.x) / 2; // 0=left, 1=right
        const screenY = (1 - _projected.y) / 2; // 0=top, 1=bottom

        // Depth factor: z in NDC is [-1, 1] (near=-1, far=1)
        // Convert to [0, 1] and subtract to prefer nearer edges
        const depthFactor = (_projected.z + 1) * 0.5; // 0=near, 1=far

        // Score: prefer bottom-right + foreground (nearer to camera)
        // Subtract depth so that nearer edges get higher score
        const score = screenX + screenY - depthFactor;

        if (score > bestScore) {
          bestEdge = edge;
          bestScore = score;
        }
      }

      // Fallback: if no silhouette edges found (degenerate angle), use any edge
      if (!bestEdge) {
        for (const edge of edges) {
          if (edge.axis !== axis) continue;
          _edgeMid.addVectors(edge.start, edge.end).multiplyScalar(0.5);
          _projected.copy(_edgeMid).project(camera);
          const screenX = (1 + _projected.x) / 2;
          const screenY = (1 - _projected.y) / 2;
          const depthFactor = (_projected.z + 1) * 0.5;
          const score = screenX + screenY - depthFactor;
          if (score > bestScore) {
            bestEdge = edge;
            bestScore = score;
          }
        }
      }

      if (!bestEdge) {
        obj.lines.visible = false;
        obj.sprite.visible = false;
        continue;
      }

      // --- Compute bar geometry ---
      // Edge direction and midpoint
      _barDir.subVectors(bestEdge.end, bestEdge.start).normalize();
      _edgeMid.addVectors(bestEdge.start, bestEdge.end).multiplyScalar(0.5);

      // Offset edge midpoint outward from model surface by margin
      const barCenter = _edgeMid.clone().addScaledVector(bestEdge.outwardDir, margin);

      // Bar centered on offset position, length = model dimension
      _barStart.copy(barCenter).addScaledVector(_barDir, -barLength / 2);
      _barEnd.copy(barCenter).addScaledVector(_barDir, barLength / 2);

      // Tick direction (inward toward box center)
      _tickOffset.copy(bestEdge.outwardDir).multiplyScalar(-tickLen);

      // --- Update LineSegments buffer ---
      const posAttr = obj.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      // Segment 0: main bar
      arr[0] = _barStart.x;
      arr[1] = _barStart.y;
      arr[2] = _barStart.z;
      arr[3] = _barEnd.x;
      arr[4] = _barEnd.y;
      arr[5] = _barEnd.z;

      // Segment 1: start tick
      arr[6] = _barStart.x;
      arr[7] = _barStart.y;
      arr[8] = _barStart.z;
      arr[9] = _barStart.x + _tickOffset.x;
      arr[10] = _barStart.y + _tickOffset.y;
      arr[11] = _barStart.z + _tickOffset.z;

      // Segment 2: end tick
      arr[12] = _barEnd.x;
      arr[13] = _barEnd.y;
      arr[14] = _barEnd.z;
      arr[15] = _barEnd.x + _tickOffset.x;
      arr[16] = _barEnd.y + _tickOffset.y;
      arr[17] = _barEnd.z + _tickOffset.z;

      posAttr.needsUpdate = true;
      obj.lines.visible = true;

      // --- Label positioning ---
      _labelPos.copy(barCenter).addScaledVector(bestEdge.outwardDir, tickLen * 2.5);
      obj.sprite.position.copy(_labelPos);
      obj.sprite.visible = true;

      // Dynamic label scale based on camera distance
      const dist = camera.position.distanceTo(barCenter);
      const s = dist * 0.035;
      obj.sprite.scale.set(s * 4, s, 1);
    }
  });

  return (
    <group>
      {renderObjects.map((obj, i) => (
        <React.Fragment key={i}>
          <primitive object={obj.lines} />
          <primitive object={obj.sprite} />
        </React.Fragment>
      ))}
    </group>
  );
}
