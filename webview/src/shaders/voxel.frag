precision highp float;
precision highp sampler3D;

uniform vec3 uVoxelShape;
uniform sampler3D uTexture;
uniform sampler2D uPaletteTexture;
uniform float uPaletteSize;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uLightIntensity; // ライトの拡散成分の強度
uniform float uAmbientIntensity; // アンビエント光の強度
uniform vec4 uClippingPlane; // クリッピングプレーン (normal.xyz, distance) - Custom mode用
uniform float uEnableClipping; // クリッピング有効フラグ
uniform float uClippingMode; // 0=off, 1=slice, 2=custom
uniform float uSliceAxis; // 0=X, 1=Y, 2=Z (操作対象の軸、描画には影響しない)
uniform float uSliceXMin; // X軸のmin側クリッピング距離
uniform float uSliceXMax; // X軸のmax側クリッピング距離
uniform float uSliceYMin; // Y軸のmin側クリッピング距離
uniform float uSliceYMax; // Y軸のmax側クリッピング距離
uniform float uSliceZMin; // Z軸のmin側クリッピング距離
uniform float uSliceZMax; // Z軸のmax側クリッピング距離
uniform float uCameraDistance; // カメラからの距離
uniform float uEnableEdgeHighlight; // エッジ強調有効フラグ
uniform float uEdgeThickness; // エッジの太さ
uniform vec3 uEdgeColor; // エッジの色
uniform float uEdgeIntensity; // エッジの強度
uniform float uEdgeFadeStart; // エッジフェード開始距離
uniform float uEdgeFadeEnd; // エッジフェード終了距離
uniform mat4 uModelMatrixInverse;
uniform float uValueVisibility[16]; // 各ボクセル値の表示フラグ (0.0=非表示, 1.0=表示)
uniform float uIsOrthographic; // 0.0=perspective, 1.0=orthographic
uniform sampler3D uOccupancyTexture; // Occupancy Grid (R8, 0=empty/255=occupied)
uniform vec3 uOccupancyDimensions;   // Grid dimensions (ceil(shape/blockSize))
uniform float uBlockSize;            // Block size (default 8)
uniform float uUseOccupancy;         // 0.0=off, 1.0=on

varying vec3 vOrigin;
varying vec3 vDirection;
varying vec3 vModelPosition;

vec3 applyEdgeHighlight(vec3 color, vec3 realPosition, vec3 normal) {
    if (uEnableEdgeHighlight < 0.5) return color;

    // Orthographicではスケールが距離に依存しないため距離フェードをスキップ
    float fade = 1.0;
    if (uIsOrthographic < 0.5) {
        float distanceFromCamera = length(vOrigin - realPosition);
        if (distanceFromCamera >= uEdgeFadeEnd) return color;
        fade = (uEdgeFadeEnd > uEdgeFadeStart)
            ? 1.0 - smoothstep(uEdgeFadeStart, uEdgeFadeEnd, distanceFromCamera)
            : 1.0;
    }

    vec3 objPos = (uModelMatrixInverse * vec4(realPosition, 1.0)).xyz;
    vec3 hOdd = 0.5 * mod(uVoxelShape, 2.0);
    vec3 fractPos = fract(objPos + hOdd);
    vec3 distToEdge = min(fractPos, 1.0 - fractPos);

    vec3 absN = abs(normal);
    vec2 edgeDists = absN.x > 0.5 ? distToEdge.yz :
                     absN.y > 0.5 ? distToEdge.xz : distToEdge.xy;

    if (!any(lessThan(edgeDists, vec2(uEdgeThickness)))) return color;

    return mix(color, uEdgeColor, uEdgeIntensity * fade);
}

vec4 sampleVoxel(vec3 objCenter) {
    // objCenter はオブジェクト座標（セル中心）。例: position + 0.5
    // [-N/2, N/2) → [0, N) の整数添字へ
    vec3 idx = floor(objCenter + 0.5 * uVoxelShape);

    // 半開区間 [0, N) の外は「空」
    if (any(lessThan(idx, vec3(0.0))) ||
        any(greaterThanEqual(idx, uVoxelShape))) {
        return vec4(0.0);
    }

    // テクセル中心で R8 インデックスを取得 → パレット参照
    // Visibility はパレットテクスチャの α 値にエンコード済み
    vec3 texel01 = (idx + 0.5) / uVoxelShape;
    float index = texture(uTexture, texel01).r * 255.0;

    // 0は空、1-15をカラーマップ、16以上は15周期で循環 (16→1, 17→2, ..., 30→15, 31→1, ...)
    float paletteIndex = (index < 0.5) ? 0.0 : (mod(index - 1.0, 15.0) + 1.0);
    float u = (paletteIndex + 0.5) / uPaletteSize;
    return texture(uPaletteTexture, vec2(u, 0.5));
}

vec4 voxelTrace(vec3 originWS, vec3 directionWS) {
    // --- ワールド→オブジェクト（以降、すべて obj 空間）---
    vec3 origin    = (uModelMatrixInverse * vec4(originWS,    1.0)).xyz;
    vec3 direction = (uModelMatrixInverse * vec4(directionWS, 0.0)).xyz;

    // AABB（obj 空間）
    vec3 boxMin = -uVoxelShape * 0.5;
    vec3 boxMax =  uVoxelShape * 0.5;

    // 交差判定（obj 空間）
    vec3 dirAbs = abs(direction);
    vec3 sgn = vec3(
        direction.x >= 0.0 ? 1.0 : -1.0,
        direction.y >= 0.0 ? 1.0 : -1.0,
        direction.z >= 0.0 ? 1.0 : -1.0
    );
    vec3 invDir = sgn / max(dirAbs, vec3(1e-8));
    
    vec3 tA = (boxMin - origin) * invDir;
    vec3 tB = (boxMax - origin) * invDir;
    vec3 tMin3 = min(tA, tB);
    vec3 tMax3 = max(tA, tB);
    float tEnter = max(max(tMin3.x, tMin3.y), tMin3.z);
    float tExit  = min(min(tMax3.x, tMax3.y), tMax3.z) + 1e-4;

    if (tExit < max(tEnter, 0.0)) discard;

    // --- クリッピング面との交差を統一的に処理 ---
    bool clippedAtEnter = false;
    vec3 clippingNormalWS = vec3(0.0); // スライスモード用：クリッピング面の法線（world空間）
    if (uEnableClipping > 0.5) {
        if (uClippingMode < 0.5) {
            // Mode 0: Off (何もしない)
        } else if (uClippingMode < 1.5) {
            // Mode 1: Slice (全軸同時クリッピング)
            // 各軸について min/max の範囲をクリッピング
            // 通常モード (min <= max): min <= coord <= max の範囲を表示
            // 逆転モード (min > max): max < coord < min の範囲を非表示（それ以外を表示）

            float origTEnter = tEnter;

            // X軸のクリッピング
            bool normalModeX = (uSliceXMin <= uSliceXMax);
            if (abs(directionWS.x) > 1e-6) {
                float tXMin = (uSliceXMin - originWS.x) / directionWS.x;
                float tXMax = (uSliceXMax - originWS.x) / directionWS.x;

                if (normalModeX) {
                    float newTEnter = max(tEnter, min(tXMin, tXMax));
                    if (newTEnter > tEnter + 1e-5) {
                        // X軸のクリッピング面でtEnterが更新された
                        clippingNormalWS = vec3(-sign(directionWS.x), 0.0, 0.0);
                    }
                    tEnter = newTEnter;
                    tExit = min(tExit, max(tXMin, tXMax));
                } else {
                    float tHiddenStart = min(tXMin, tXMax);
                    float tHiddenEnd = max(tXMin, tXMax);
                    float currentStart = max(tEnter, 0.0);
                    if (currentStart >= tHiddenEnd) {
                        // OK
                    } else if (currentStart >= tHiddenStart) {
                        float newTEnter = max(tEnter, tHiddenEnd);
                        if (newTEnter > tEnter + 1e-5) {
                            clippingNormalWS = vec3(-sign(directionWS.x), 0.0, 0.0);
                        }
                        tEnter = newTEnter;
                    } else {
                        tExit = min(tExit, tHiddenStart);
                    }
                }
            } else {
                vec3 rayStart = originWS + directionWS * max(tEnter, 0.0);
                if (normalModeX) {
                    if (rayStart.x < min(uSliceXMin, uSliceXMax) || rayStart.x > max(uSliceXMin, uSliceXMax)) {
                        discard;
                    }
                } else {
                    if (rayStart.x > min(uSliceXMin, uSliceXMax) && rayStart.x < max(uSliceXMin, uSliceXMax)) {
                        discard;
                    }
                }
            }

            if (tExit <= max(tEnter, 0.0)) discard;

            // Y軸のクリッピング
            bool normalModeY = (uSliceYMin <= uSliceYMax);
            if (abs(directionWS.y) > 1e-6) {
                float tYMin = (uSliceYMin - originWS.y) / directionWS.y;
                float tYMax = (uSliceYMax - originWS.y) / directionWS.y;

                if (normalModeY) {
                    float newTEnter = max(tEnter, min(tYMin, tYMax));
                    if (newTEnter > tEnter + 1e-5) {
                        // Y軸のクリッピング面でtEnterが更新された
                        clippingNormalWS = vec3(0.0, -sign(directionWS.y), 0.0);
                    }
                    tEnter = newTEnter;
                    tExit = min(tExit, max(tYMin, tYMax));
                } else {
                    float tHiddenStart = min(tYMin, tYMax);
                    float tHiddenEnd = max(tYMin, tYMax);
                    float currentStart = max(tEnter, 0.0);
                    if (currentStart >= tHiddenEnd) {
                        // OK
                    } else if (currentStart >= tHiddenStart) {
                        float newTEnter = max(tEnter, tHiddenEnd);
                        if (newTEnter > tEnter + 1e-5) {
                            clippingNormalWS = vec3(0.0, -sign(directionWS.y), 0.0);
                        }
                        tEnter = newTEnter;
                    } else {
                        tExit = min(tExit, tHiddenStart);
                    }
                }
            } else {
                vec3 rayStart = originWS + directionWS * max(tEnter, 0.0);
                if (normalModeY) {
                    if (rayStart.y < min(uSliceYMin, uSliceYMax) || rayStart.y > max(uSliceYMin, uSliceYMax)) {
                        discard;
                    }
                } else {
                    if (rayStart.y > min(uSliceYMin, uSliceYMax) && rayStart.y < max(uSliceYMin, uSliceYMax)) {
                        discard;
                    }
                }
            }

            if (tExit <= max(tEnter, 0.0)) discard;

            // Z軸のクリッピング
            bool normalModeZ = (uSliceZMin <= uSliceZMax);
            if (abs(directionWS.z) > 1e-6) {
                float tZMin = (uSliceZMin - originWS.z) / directionWS.z;
                float tZMax = (uSliceZMax - originWS.z) / directionWS.z;

                if (normalModeZ) {
                    float newTEnter = max(tEnter, min(tZMin, tZMax));
                    if (newTEnter > tEnter + 1e-5) {
                        // Z軸のクリッピング面でtEnterが更新された
                        clippingNormalWS = vec3(0.0, 0.0, -sign(directionWS.z));
                    }
                    tEnter = newTEnter;
                    tExit = min(tExit, max(tZMin, tZMax));
                } else {
                    float tHiddenStart = min(tZMin, tZMax);
                    float tHiddenEnd = max(tZMin, tZMax);
                    float currentStart = max(tEnter, 0.0);
                    if (currentStart >= tHiddenEnd) {
                        // OK
                    } else if (currentStart >= tHiddenStart) {
                        float newTEnter = max(tEnter, tHiddenEnd);
                        if (newTEnter > tEnter + 1e-5) {
                            clippingNormalWS = vec3(0.0, 0.0, -sign(directionWS.z));
                        }
                        tEnter = newTEnter;
                    } else {
                        tExit = min(tExit, tHiddenStart);
                    }
                }
            } else {
                vec3 rayStart = originWS + directionWS * max(tEnter, 0.0);
                if (normalModeZ) {
                    if (rayStart.z < min(uSliceZMin, uSliceZMax) || rayStart.z > max(uSliceZMin, uSliceZMax)) {
                        discard;
                    }
                } else {
                    if (rayStart.z > min(uSliceZMin, uSliceZMax) && rayStart.z < max(uSliceZMin, uSliceZMax)) {
                        discard;
                    }
                }
            }

            if (tExit <= max(tEnter, 0.0)) discard;

            clippedAtEnter = (tEnter > origTEnter + 1e-5);
        } else {
            // Mode 2: Custom (従来の1面クリッピング)
            vec3 rayStart = originWS + directionWS * max(tEnter, 0.0);
            vec3 rayEnd = originWS + directionWS * tExit;

            float startSide = dot(uClippingPlane.xyz, rayStart) - uClippingPlane.w;
            float endSide = dot(uClippingPlane.xyz, rayEnd) - uClippingPlane.w;

            // 表示側（負側）のみ表示
            if (startSide > 0.0 && endSide > 0.0) {
                discard;
            }

            if ((startSide > 0.0) != (endSide > 0.0)) {
                float nDotDir = dot(uClippingPlane.xyz, directionWS);
                if (abs(nDotDir) > 1e-6) {
                    float tClip = (uClippingPlane.w - dot(uClippingPlane.xyz, originWS)) / nDotDir;

                    if (startSide > 0.0) {
                        tEnter = max(tEnter, tClip);
                        clippedAtEnter = true;
                    } else {
                        tExit = min(tExit, tClip);
                    }
                }
            }

            if (tExit <= max(tEnter, 0.0)) discard;
        }
    }

    // --- レイ開始（境界直後から開始してズレを防ぐ） ---
    float tEnterClamped = max(tEnter + 1e-4, 0.0);
    float t = tEnterClamped;

    // 内部スタートか？
    bool insideStart = (tEnter < 0.0);

    // DDA開始位置を計算
    vec3 p = origin + t * direction;
    // 奇数サイズの軸はセル境界が半整数(±0.5, ±1.5, …)にあるため
    // floor に渡す前に halfOdd を加算→減算でグリッドに位置合わせする。
    // 偶数サイズの軸は halfOdd=0 なので影響なし。
    vec3 halfOdd = 0.5 * mod(uVoxelShape, 2.0);
    // レイ進行方向に微小オフセットを加え、セル境界上の曖昧さを解消
    vec3 position = floor(p + halfOdd + sgn * 1e-4) - halfOdd;

    // DDA 初期化（境界面基準・ゼロ方向は+1側）
    vec3 stepVec      = sgn;
    vec3 nextBoundary = position + step(vec3(0.0), stepVec);
    vec3 tMax         = (nextBoundary - origin) * invDir;
    vec3 tDelta       = abs(invDir);

    // 最初のセルをサンプル（常に中心）
    vec3 samplePos    = position + vec3(0.5);
    vec4 prevVoxel    = sampleVoxel(samplePos);
    bool prevOccupied = (prevVoxel.a > 0.0);

    // （外部スタート時のみ）入口面の即時ヒット確定
    if (!insideStart && prevOccupied) {
        vec3 nWS; // ワールド空間の法線（ライティング用）
        vec3 nOS; // オブジェクト空間の法線（エッジハイライト用）

        // クリッピング面で開始した場合は、クリッピング面の法線を使用
        if (clippedAtEnter && uEnableClipping > 0.5) {
            if (uClippingMode < 1.5 && uClippingMode > 0.5) {
                // Sliceモード: 記録されたクリッピング面の法線（world空間）を使用
                // 法線がゼロベクトルの場合（レイがクリッピング軸に平行など）、
                // レイの逆方向をフォールバックとして使用
                if (length(clippingNormalWS) < 0.1) {
                    nWS = -normalize(directionWS);
                } else {
                    nWS = clippingNormalWS;
                }
                // ワールド空間からオブジェクト空間へ変換（方向ベクトルとして変換）
                nOS = normalize((uModelMatrixInverse * vec4(nWS, 0.0)).xyz);
            } else {
                // Customモード: クリッピング面の法線
                nWS = normalize(uClippingPlane.xyz);
                nOS = normalize((uModelMatrixInverse * vec4(nWS, 0.0)).xyz);
            }
        } else {
            // どの軸のスラブで入射したか（tEnter は tMin3 の最大）
            int entryAxis = 0;
            if (tMin3.y >= tMin3.x && tMin3.y >= tMin3.z) entryAxis = 1;
            if (tMin3.z >= tMin3.x && tMin3.z >= tMin3.y) entryAxis = 2;

            // オブジェクト空間の法線を計算
            nOS = vec3(0.0);
            if (entryAxis == 0) nOS.x = -sign(direction.x);
            else if (entryAxis == 1) nOS.y = -sign(direction.y);
            else                     nOS.z = -sign(direction.z);

            // オブジェクト空間からワールド空間へ変換（法線は逆転置行列で変換）
            // 法線変換行列 = transpose(inverse(modelMatrix)) = transpose(uModelMatrixInverse)
            mat3 normalMatrix = transpose(mat3(uModelMatrixInverse));
            nWS = normalize(normalMatrix * nOS);
        }

        // 入口面でヒット確定
        float hitDistance = tEnterClamped;   // = tEnter (>=0)
        vec4  voxel       = prevVoxel;

        // シェーディングへ（既存の後段を流用）
        vec3 realPosition = originWS + directionWS * hitDistance;
        // Orthographicの場合はカメラ位置を使用
        vec3 lightDir = uIsOrthographic > 0.5
            ? normalize(cameraPosition - realPosition)
            : normalize(vOrigin - realPosition);
        float diff = max(dot(nWS, lightDir), 0.0);

        float lighting = uAmbientIntensity + uLightIntensity * diff;
        // エッジハイライトにはオブジェクト空間の法線を使用
        vec3 finalColor = applyEdgeHighlight(voxel.rgb * lighting, realPosition, nOS);
        return vec4(finalColor, voxel.a);
    }

    // ステップ数制御 — グリッド全体を走査できるステップ数を確保
    // DDA走査の最大ステップ数はグリッド次元の合計（各軸で最大N回境界を横切る）
    int maxSteps = int(uVoxelShape.x + uVoxelShape.y + uVoxelShape.z);

    bool  hit = false;
    vec3  hitNormal = vec3(0.0);
    float hitDistance = 0.0;
    vec4  voxel = vec4(0.0);

    for (int i = 0; i < 4096; ++i) {
        if (i >= maxSteps) break;

        // 最小のtMax軸を決定
        int axis;
        if (tMax.x <= tMax.y) {
            axis = (tMax.x <= tMax.z) ? 0 : 2;
        } else {
            axis = (tMax.y <= tMax.z) ? 1 : 2;
        }

        // 一歩進む
        if      (axis == 0) { position.x += stepVec.x; hitDistance = tMax.x; tMax.x += tDelta.x; hitNormal = vec3(-stepVec.x, 0.0, 0.0); }
        else if (axis == 1) { position.y += stepVec.y; hitDistance = tMax.y; tMax.y += tDelta.y; hitNormal = vec3(0.0, -stepVec.y, 0.0); }
        else                { position.z += stepVec.z; hitDistance = tMax.z; tMax.z += tDelta.z; hitNormal = vec3(0.0, 0.0, -stepVec.z); }

        // AABB境界チェック
        if (hitDistance > tExit) break;

        // 次のセルをサンプリング（常に中心）
        // Occupancy Grid チェックの前にサンプリングし、
        // ブロック境界の浮動小数点精度問題で実体ボクセルをスキップすることを防ぐ
        samplePos = position + vec3(0.5);
        voxel = sampleVoxel(samplePos);
        bool currentOccupied = (voxel.a > 0.0);

        // 空→実体境界の検出
        if (!prevOccupied && currentOccupied) {
            hit = true;
            break;
        }

        // セルが空の場合のみ Occupancy Grid による空ブロックスキップを試みる
        if (!currentOccupied && uUseOccupancy > 0.5) {
            // 現在セルが属するブロックインデックスを計算
            vec3 vidx = floor(position + vec3(0.5) + 0.5 * uVoxelShape);
            vec3 bidx = floor(vidx / uBlockSize);

            // ブロック範囲内かつ空ブロックの場合のみスキップ
            if (!(any(lessThan(bidx, vec3(0.0))) ||
                  any(greaterThanEqual(bidx, uOccupancyDimensions)))) {

                // Occupancy テクスチャをサンプリング
                vec3 tc = (bidx + 0.5) / uOccupancyDimensions;
                if (texture(uOccupancyTexture, tc).r < 0.5) {
                    // 空ブロック: ブロック遠端までスキップ
                    vec3 farEdge = (bidx + step(vec3(0.0), stepVec)) * uBlockSize
                                 - 0.5 * uVoxelShape;
                    vec3 tBlockFar = (farEdge - origin) * invDir;
                    float tSkip = min(min(tBlockFar.x, tBlockFar.y), tBlockFar.z);

                    // t空間でクリッピング境界を超えたら終了
                    if (tSkip > tExit) break;

                    // スキップで横切った面の法線を計算
                    vec3 skipMask = vec3(0.0);
                    if (tBlockFar.x <= tBlockFar.y && tBlockFar.x <= tBlockFar.z) {
                        skipMask.x = 1.0;
                    } else if (tBlockFar.y <= tBlockFar.z) {
                        skipMask.y = 1.0;
                    } else {
                        skipMask.z = 1.0;
                    }

                    // DDA状態をスキップ先で再初期化
                    vec3 pNew = origin + (tSkip + 1e-4) * direction;
                    position = floor(pNew + halfOdd + sgn * 1e-4) - halfOdd;
                    vec3 nb = position + step(vec3(0.0), stepVec);
                    tMax = (nb - origin) * invDir;

                    // 着地セルをサンプリング（ブロック境界の表面を見逃さない）
                    samplePos = position + vec3(0.5);
                    voxel = sampleVoxel(samplePos);
                    if (voxel.a > 0.0) {
                        // 空→実体の遷移をスキップ境界で検出
                        hitDistance = tSkip;
                        hitNormal = -stepVec * skipMask;
                        hit = true;
                        break;
                    }

                    prevOccupied = false;
                    continue;
                }
            }
        }

        prevOccupied = currentOccupied;
    }
    
    if (!hit) {
        // カメラが実体内部にいる場合も含め、空→実体の遷移なし → 描画なし
        // (inside→outside = 描画なし のルールに従う)
        return vec4(0.0);
    }

    vec3 realPosition = originWS + directionWS * hitDistance;
    // Orthographicの場合はカメラ位置を使用、Perspectiveの場合はvOriginを使用
    vec3 lightDir = uIsOrthographic > 0.5
        ? normalize(cameraPosition - realPosition)
        : normalize(vOrigin - realPosition);
    float diff = max(dot(hitNormal, lightDir), 0.0);

    // ライティング計算：環境光 + 拡散光
    float lighting = uAmbientIntensity + uLightIntensity * diff;
    vec3 finalColor = applyEdgeHighlight(voxel.rgb * lighting, realPosition, hitNormal);
    return vec4(finalColor, voxel.a);
}

void main() {
    // orthographicとperspectiveの両方で同じ計算方法を使用
    // 頂点シェーダーでvOriginが適切に設定されているため、
    // vModelPosition - vOriginは両方のカメラタイプで正しいレイ方向を提供する
    vec3 dirWS = normalize(vModelPosition - vOrigin);

    // ゼロ除算の保険（ほぼ無いが念のため）
    if (dot(dirWS, dirWS) < 1e-12) { discard; }

    vec4 voxelColor = voxelTrace(vOrigin, dirWS);
    gl_FragColor = vec4(voxelColor.rgb, voxelColor.a * uAlpha);
}
