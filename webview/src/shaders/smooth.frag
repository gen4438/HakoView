precision highp float;
precision highp sampler3D;
precision highp int;

// hakolab の smoothShaderV2.glsl.ts を hakoview のユニフォーム体系に合わせて移植したもの。
// CPU 側で valueVisibility を反映した 2値占有 + 分離型 3D ガウシアンで平滑化した
// `uSmoothOccupancyTexture` (R8, Linear filter) を等値面トレースに使う。
// 可視性は palette テクスチャの α チャネルから読む (hakoview 既存方式)。

uniform vec3 uVoxelShape;
uniform float uAlpha;
uniform float uLightIntensity;
uniform float uAmbientIntensity;
uniform float uEnableClipping;
uniform float uClippingMode;     // 0=off, 1=slice, 2=custom
uniform vec4 uClippingPlane;
uniform float uSliceXMin;
uniform float uSliceXMax;
uniform float uSliceYMin;
uniform float uSliceYMax;
uniform float uSliceZMin;
uniform float uSliceZMax;
uniform float uEnableEdgeHighlight;
uniform vec3 uEdgeColor;
uniform float uEdgeIntensity;
uniform float uEdgeFadeStart;
uniform float uEdgeFadeEnd;
uniform mat4 uModelMatrixInverse;
uniform float uBlockSize;
uniform float uUseOccupancy;
uniform vec3 uOccupancyDimensions;
uniform float uIsOrthographic;

// Smooth V2 特有のユニフォーム
uniform float uSmoothStepSize;
uniform int uSmoothRefineIterations;

uniform sampler3D uTexture;
uniform sampler2D uPaletteTexture;
uniform float uPaletteSize;
uniform sampler3D uOccupancyTexture;
uniform sampler3D uSmoothOccupancyTexture;

varying vec3 vOrigin;
varying vec3 vDirection;
varying vec3 vModelPosition;

int sampleId(int ix, int iy, int iz) {
    int sx = int(uVoxelShape.x);
    int sy = int(uVoxelShape.y);
    int sz = int(uVoxelShape.z);
    int cx = clamp(ix, 0, sx - 1);
    int cy = clamp(iy, 0, sy - 1);
    int cz = clamp(iz, 0, sz - 1);
    float raw = texelFetch(uTexture, ivec3(cx, cy, cz), 0).r * 255.0;
    return int(raw + 0.5);
}

int paletteIndexFor(int id) {
    if (id <= 0) return 0;
    return ((id - 1) - ((id - 1) / 15) * 15) + 1;
}

vec4 fetchPalette(int pIdx) {
    float u = (float(pIdx) + 0.5) / uPaletteSize;
    return texture(uPaletteTexture, vec2(u, 0.5));
}

bool isVisible(int id) {
    if (id <= 0) return false;
    return fetchPalette(paletteIndexFor(id)).a > 0.5;
}

// CPU 側で事前にガウシアンフィルタが適用された平滑化占有テクスチャを
// トリリニア補間でサンプリングする。
float smoothOccupancyAt(vec3 p) {
    vec3 pg = p + 0.5 * uVoxelShape;
    vec3 tc = clamp(pg / uVoxelShape, vec3(0.0), vec3(1.0));
    return texture(uSmoothOccupancyTexture, tc).r;
}

struct BestPaletteResult {
    int idx;
    bool isEdge;
};

// 衝突点 p における palette index を 3x3x3 → 5x5x5 のスコア集計で決める。
// hakolab smoothShaderV2 と同じ重み (1 - d²/5.5)².
BestPaletteResult findBestPaletteAt(vec3 p) {
    BestPaletteResult res;
    res.idx = 0;
    res.isEdge = false;

    vec3 pg = clamp(p + 0.5 * uVoxelShape, vec3(0.0), uVoxelShape - vec3(1e-4));
    int cx = int(floor(pg.x));
    int cy = int(floor(pg.y));
    int cz = int(floor(pg.z));

    int sx = int(uVoxelShape.x);
    int sy = int(uVoxelShape.y);
    int sz = int(uVoxelShape.z);

    float scores[16];
    for (int k = 0; k < 16; ++k) scores[k] = 0.0;

    float invD2Max = 1.0 / 5.5;

    int firstPIdx = 0;
    bool hasMultiple = false;
    for (int dz = -1; dz <= 1; ++dz) {
        for (int dy = -1; dy <= 1; ++dy) {
            for (int dx = -1; dx <= 1; ++dx) {
                int ix = cx + dx;
                int iy = cy + dy;
                int iz = cz + dz;
                if (ix < 0 || ix >= sx || iy < 0 || iy >= sy || iz < 0 || iz >= sz) continue;

                vec3 center = vec3(float(ix), float(iy), float(iz)) + 0.5;
                vec3 diff = pg - center;
                float d2 = dot(diff, diff);
                if (d2 > 5.5) continue;

                int id = sampleId(ix, iy, iz);
                if (id <= 0 || !isVisible(id)) continue;
                int pIdx = paletteIndexFor(id);
                float u = 1.0 - d2 * invD2Max;
                scores[pIdx] += u * u;

                if (firstPIdx == 0) firstPIdx = pIdx;
                else if (firstPIdx != pIdx) hasMultiple = true;
            }
        }
    }

    if (!hasMultiple && firstPIdx > 0) {
        res.idx = firstPIdx;
        res.isEdge = false;
        return res;
    }

    ivec3 phase2Offsets[90] = ivec3[](
        ivec3(2, 0, 0), ivec3(-2, 0, 0), ivec3(0, 2, 0), ivec3(0, -2, 0), ivec3(0, 0, 2), ivec3(0, 0, -2),
        ivec3(2, 1, 0), ivec3(2, -1, 0), ivec3(-2, 1, 0), ivec3(-2, -1, 0),
        ivec3(2, 0, 1), ivec3(2, 0, -1), ivec3(-2, 0, 1), ivec3(-2, 0, -1),
        ivec3(1, 2, 0), ivec3(1, -2, 0), ivec3(-1, 2, 0), ivec3(-1, -2, 0),
        ivec3(0, 2, 1), ivec3(0, 2, -1), ivec3(0, -2, 1), ivec3(0, -2, -1),
        ivec3(1, 0, 2), ivec3(1, 0, -2), ivec3(-1, 0, 2), ivec3(-1, 0, -2),
        ivec3(0, 1, 2), ivec3(0, -1, 2), ivec3(0, 1, -2), ivec3(0, -1, -2),
        ivec3(2, 1, 1), ivec3(2, 1, -1), ivec3(2, -1, 1), ivec3(2, -1, -1),
        ivec3(-2, 1, 1), ivec3(-2, 1, -1), ivec3(-2, -1, 1), ivec3(-2, -1, -1),
        ivec3(1, 2, 1), ivec3(1, 2, -1), ivec3(1, -2, 1), ivec3(1, -2, -1),
        ivec3(-1, 2, 1), ivec3(-1, 2, -1), ivec3(-1, -2, 1), ivec3(-1, -2, -1),
        ivec3(1, 1, 2), ivec3(1, 1, -2), ivec3(1, -1, 2), ivec3(1, -1, -2),
        ivec3(-1, 1, 2), ivec3(-1, 1, -2), ivec3(-1, -1, 2), ivec3(-1, -1, -2),
        ivec3(2, 2, 0), ivec3(2, -2, 0), ivec3(-2, 2, 0), ivec3(-2, -2, 0),
        ivec3(2, 0, 2), ivec3(2, 0, -2), ivec3(-2, 0, 2), ivec3(-2, 0, -2),
        ivec3(0, 2, 2), ivec3(0, 2, -2), ivec3(0, -2, 2), ivec3(0, -2, -2),
        ivec3(2, 2, 1), ivec3(2, 2, -1), ivec3(2, -2, 1), ivec3(2, -2, -1),
        ivec3(-2, 2, 1), ivec3(-2, 2, -1), ivec3(-2, -2, 1), ivec3(-2, -2, -1),
        ivec3(2, 1, 2), ivec3(2, 1, -2), ivec3(2, -1, 2), ivec3(2, -1, -2),
        ivec3(-2, 1, 2), ivec3(-2, 1, -2), ivec3(-2, -1, 2), ivec3(-2, -1, -2),
        ivec3(1, 2, 2), ivec3(1, 2, -2), ivec3(1, -2, 2), ivec3(1, -2, -2),
        ivec3(-1, 2, 2), ivec3(-1, 2, -2), ivec3(-1, -2, 2), ivec3(-1, -2, -2)
    );

    for (int idx = 0; idx < 90; ++idx) {
        ivec3 offset = phase2Offsets[idx];
        int ix = cx + offset.x;
        int iy = cy + offset.y;
        int iz = cz + offset.z;
        if (ix < 0 || ix >= sx || iy < 0 || iy >= sy || iz < 0 || iz >= sz) continue;

        vec3 center = vec3(float(ix), float(iy), float(iz)) + 0.5;
        vec3 diff = pg - center;
        float d2 = dot(diff, diff);
        if (d2 > 5.5) continue;

        int id = sampleId(ix, iy, iz);
        if (id <= 0 || !isVisible(id)) continue;
        int pIdx = paletteIndexFor(id);
        float u = 1.0 - d2 * invD2Max;
        scores[pIdx] += u * u;
    }

    int bestIdx = 0;
    float bestScore = 0.0;
    int secondIdx = 0;
    float secondScore = 0.0;

    for (int k = 1; k <= 15; ++k) {
        float val = scores[k];
        if (val > bestScore) {
            secondScore = bestScore;
            secondIdx = bestIdx;
            bestScore = val;
            bestIdx = k;
        } else if (val > secondScore) {
            secondScore = val;
            secondIdx = k;
        }
    }

    res.idx = bestIdx;
    res.isEdge = (bestIdx > 0 && secondIdx > 0 && bestScore > 0.0 && secondScore > 0.3 * bestScore);
    return res;
}

float occupancyAt(vec3 p) {
    vec3 vidx = clamp(floor(p + 0.5 * uVoxelShape), vec3(0.0), uVoxelShape - vec3(1.0));
    vec3 bidx = floor(vidx / uBlockSize);
    if (any(lessThan(bidx, vec3(0.0))) || any(greaterThanEqual(bidx, uOccupancyDimensions))) {
        return 0.0;
    }
    vec3 tc = (bidx + 0.5) / uOccupancyDimensions;
    return texture(uOccupancyTexture, tc).r;
}

void main() {
    vec3 directionWS = normalize(vModelPosition - vOrigin);
    if (dot(directionWS, directionWS) < 1e-12) discard;
    vec3 originWS = vOrigin;

    vec3 origin = (uModelMatrixInverse * vec4(originWS, 1.0)).xyz;
    vec3 direction = (uModelMatrixInverse * vec4(directionWS, 0.0)).xyz;
    vec3 boxMin = -uVoxelShape * 0.5;
    vec3 boxMax = uVoxelShape * 0.5;
    vec3 dirAbs = abs(direction);
    vec3 sgn = vec3(
        direction.x >= 0.0 ? 1.0 : -1.0,
        direction.y >= 0.0 ? 1.0 : -1.0,
        direction.z >= 0.0 ? 1.0 : -1.0
    );
    vec3 sgnSafe = mix(sgn, vec3(1.0), vec3(lessThan(dirAbs, vec3(1e-8))));
    vec3 invDir = sgnSafe / max(dirAbs, vec3(1e-8));
    vec3 tA = (boxMin - origin) * invDir;
    vec3 tB = (boxMax - origin) * invDir;
    vec3 tMin3 = min(tA, tB);
    vec3 tMax3 = max(tA, tB);
    float tEnter = max(max(tMin3.x, tMin3.y), tMin3.z);
    float tExit = min(min(tMax3.x, tMax3.y), tMax3.z) + 1e-4;
    if (tExit < max(tEnter, 0.0)) discard;

    bool clippedAtEnter = false;
    vec3 clippingNormalWS = vec3(0.0);
    bool invertX = false;
    bool invertY = false;
    bool invertZ = false;

    if (uEnableClipping > 0.5) {
        if (uClippingMode > 0.5 && uClippingMode < 1.5) {
            invertX = (uSliceXMin > uSliceXMax);
            invertY = (uSliceYMin > uSliceYMax);
            invertZ = (uSliceZMin > uSliceZMax);
            float origTEnter = tEnter;

            if (!invertX && abs(directionWS.x) > 1e-6) {
                float tXMin = (uSliceXMin - originWS.x) / directionWS.x;
                float tXMax = (uSliceXMax - originWS.x) / directionWS.x;
                float newTEnter = max(tEnter, min(tXMin, tXMax));
                if (newTEnter > tEnter + 1e-5) clippingNormalWS = vec3(-sign(directionWS.x), 0.0, 0.0);
                tEnter = newTEnter;
                tExit = min(tExit, max(tXMin, tXMax));
            }
            if (tExit <= max(tEnter, 0.0)) discard;

            if (!invertY && abs(directionWS.y) > 1e-6) {
                float tYMin = (uSliceYMin - originWS.y) / directionWS.y;
                float tYMax = (uSliceYMax - originWS.y) / directionWS.y;
                float newTEnter = max(tEnter, min(tYMin, tYMax));
                if (newTEnter > tEnter + 1e-5) clippingNormalWS = vec3(0.0, -sign(directionWS.y), 0.0);
                tEnter = newTEnter;
                tExit = min(tExit, max(tYMin, tYMax));
            }
            if (tExit <= max(tEnter, 0.0)) discard;

            if (!invertZ && abs(directionWS.z) > 1e-6) {
                float tZMin = (uSliceZMin - originWS.z) / directionWS.z;
                float tZMax = (uSliceZMax - originWS.z) / directionWS.z;
                float newTEnter = max(tEnter, min(tZMin, tZMax));
                if (newTEnter > tEnter + 1e-5) clippingNormalWS = vec3(0.0, 0.0, -sign(directionWS.z));
                tEnter = newTEnter;
                tExit = min(tExit, max(tZMin, tZMax));
            }
            if (tExit <= max(tEnter, 0.0)) discard;
            clippedAtEnter = (tEnter > origTEnter + 1e-5);
        } else if (uClippingMode > 1.5) {
            vec3 rayStart = originWS + directionWS * max(tEnter, 0.0);
            vec3 rayEnd = originWS + directionWS * tExit;
            float startSide = dot(uClippingPlane.xyz, rayStart) - uClippingPlane.w;
            float endSide = dot(uClippingPlane.xyz, rayEnd) - uClippingPlane.w;
            if (startSide > 0.0 && endSide > 0.0) discard;
            if ((startSide > 0.0) != (endSide > 0.0)) {
                float nDotDir = dot(uClippingPlane.xyz, directionWS);
                if (abs(nDotDir) > 1e-6) {
                    float tClip = (uClippingPlane.w - dot(uClippingPlane.xyz, originWS)) / nDotDir;
                    if (startSide > 0.0) { tEnter = max(tEnter, tClip); clippedAtEnter = true; }
                    else { tExit = min(tExit, tClip); }
                }
            }
            if (tExit <= max(tEnter, 0.0)) discard;
        }
    }

    // 進入したバウンディングボックス面の法線
    vec3 boxNormalOS = vec3(0.0);
    if (tEnter == tMin3.x) boxNormalOS = vec3(-sgnSafe.x, 0.0, 0.0);
    else if (tEnter == tMin3.y) boxNormalOS = vec3(0.0, -sgnSafe.y, 0.0);
    else boxNormalOS = vec3(0.0, 0.0, -sgnSafe.z);

    float stepSize = max(uSmoothStepSize, 1e-3);
    float t = max(tEnter, 0.0) + 1e-4;

    vec3 prevPos = clamp(origin + max(tEnter, 0.0) * direction, boxMin, boxMax);
    float prevOcc = smoothOccupancyAt(prevPos);
    vec3 hitPos = vec3(0.0);
    bool prevIsExcluded = false;
    bool hit = false;
    bool hitAtBoundary = false;

    float tNextOccupancyCheck = -1.0;

    // 開始時点で既に物体内部（バウンディングボックス外面に接している）の場合
    vec3 startPg = prevPos + 0.5 * uVoxelShape;
    int startId = sampleId(int(floor(startPg.x)), int(floor(startPg.y)), int(floor(startPg.z)));
    if (startId > 0 && isVisible(startId) && prevOcc >= 0.5) {
        hitPos = prevPos;
        hit = true;
        hitAtBoundary = true;
    } else {
        prevOcc = 0.0;
    }

    if (!hit) {
        for (int i = 0; i < 4096; ++i) {
            if (t >= tExit) break;
            vec3 p = origin + t * direction;

            if (uUseOccupancy > 0.5) {
                if (t >= tNextOccupancyCheck) {
                    float occVal = occupancyAt(p);
                    vec3 vidx = floor(p + 0.5 * uVoxelShape);
                    vec3 bidx = floor(vidx / uBlockSize);
                    vec3 farEdge = (bidx + step(vec3(0.0), sgnSafe)) * uBlockSize - 0.5 * uVoxelShape;
                    vec3 tBlockFar = (farEdge - origin) * invDir;
                    float tSkip = min(min(tBlockFar.x, tBlockFar.y), tBlockFar.z);
                    if (occVal < 0.5) {
                        if (tSkip > t) {
                            t = tSkip + 1e-4;
                            prevOcc = -1.0;
                            prevIsExcluded = false;
                            tNextOccupancyCheck = -1.0;
                            continue;
                        }
                    } else {
                        tNextOccupancyCheck = tSkip + 1e-4;
                    }
                }
            }

            bool excluded = false;
            if (invertX && p.x > uSliceXMax && p.x < uSliceXMin) excluded = true;
            if (invertY && p.y > uSliceYMax && p.y < uSliceYMin) excluded = true;
            if (invertZ && p.z > uSliceZMax && p.z < uSliceZMin) excluded = true;

            float currOcc = 0.0;
            if (!excluded) currOcc = smoothOccupancyAt(p);

            if (currOcc >= 0.5 && prevOcc < 0.5) {
                if (prevOcc < -0.5 || prevIsExcluded) {
                    hitPos = p;
                    hit = true;
                    break;
                } else {
                    // 線形補間で 0.5 に達する位置を初期推定し、二分探索を絞り込む
                    float t_lerp = (0.5 - prevOcc) / max(currOcc - prevOcc, 1e-6);
                    vec3 estPos = mix(prevPos, p, t_lerp);
                    vec3 lo = mix(prevPos, estPos, 0.5);
                    vec3 hi = mix(p, estPos, 0.5);
                    int iters = max(3, uSmoothRefineIterations - 4);
                    for (int r = 0; r < 8; ++r) {
                        if (r >= iters) break;
                        vec3 mid = (lo + hi) * 0.5;
                        float occMid = smoothOccupancyAt(mid);
                        if (occMid < 0.5) lo = mid;
                        else hi = mid;
                    }
                    hitPos = hi;
                    hit = true;
                    break;
                }
            }

            prevOcc = currOcc;
            prevPos = p;
            prevIsExcluded = excluded;
            t += stepSize;
        }
    }

    if (!hit) discard;

    BestPaletteResult bestPaletteResult = findBestPaletteAt(hitPos);
    int hitPaletteIdx = bestPaletteResult.idx;
    if (hitPaletteIdx <= 0) discard;

    // 法線：平滑化占有場 (C1連続) の前方差分。ヒット点で密度は 0.5 確定。
    vec3 nOS = vec3(0.0);
    vec3 distToEdge = 0.5 * uVoxelShape - abs(hitPos);
    float edgeEpsilon = 0.8;
    if (hitAtBoundary) {
        nOS = boxNormalOS;
    } else if (distToEdge.x < edgeEpsilon || distToEdge.y < edgeEpsilon || distToEdge.z < edgeEpsilon) {
        if (distToEdge.x < distToEdge.y && distToEdge.x < distToEdge.z) {
            nOS = vec3(sign(hitPos.x), 0.0, 0.0);
        } else if (distToEdge.y < distToEdge.z) {
            nOS = vec3(0.0, sign(hitPos.y), 0.0);
        } else {
            nOS = vec3(0.0, 0.0, sign(hitPos.z));
        }
    } else {
        float h = 1.0;
        float nx = smoothOccupancyAt(hitPos + vec3(h, 0.0, 0.0)) - 0.5;
        float ny = smoothOccupancyAt(hitPos + vec3(0.0, h, 0.0)) - 0.5;
        float nz = smoothOccupancyAt(hitPos + vec3(0.0, 0.0, h)) - 0.5;
        nOS = vec3(-nx, -ny, -nz);
    }
    float nLen = length(nOS);
    if (nLen < 1e-6) nOS = -direction;
    else nOS = nOS / nLen;
    mat3 normalMatrix = transpose(mat3(uModelMatrixInverse));
    vec3 nWS = normalize(normalMatrix * nOS);
    if (clippedAtEnter && uEnableClipping > 0.5 && length(clippingNormalWS) > 0.1) {
        nWS = clippingNormalWS;
    }

    vec4 palette = fetchPalette(hitPaletteIdx);
    vec3 color = palette.rgb;

    float dirLen = length(direction);
    vec3 realPosition = originWS + directionWS * (length(hitPos - origin) / max(dirLen, 1e-6));
    vec3 camPos = uIsOrthographic > 0.5 ? cameraPosition : vOrigin;
    vec3 viewDir = normalize(camPos - realPosition);
    float NdotV = abs(dot(nWS, viewDir));
    float lighting = uAmbientIntensity + uLightIntensity * NdotV;
    color = color * lighting;

    if (uEnableEdgeHighlight > 0.5 && bestPaletteResult.isEdge) {
        float fade = 1.0;
        if (uIsOrthographic < 0.5) {
            float distanceFromCamera = length(vOrigin - realPosition);
            if (distanceFromCamera >= uEdgeFadeEnd) fade = 0.0;
            else if (uEdgeFadeEnd > uEdgeFadeStart) {
                fade = 1.0 - smoothstep(uEdgeFadeStart, uEdgeFadeEnd, distanceFromCamera);
            }
        }
        color = mix(color, uEdgeColor, clamp(uEdgeIntensity * fade, 0.0, 1.0));
    }

    gl_FragColor = vec4(color, uAlpha);
}
