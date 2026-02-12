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
uniform float uSliceAxis; // 0=X, 1=Y, 2=Z
uniform float uSliceDistance1; // Slice 1の距離
uniform float uSliceDistance2; // Slice 2の距離
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

varying vec3 vOrigin;
varying vec3 vDirection;
varying vec3 vModelPosition;

vec3 applyEdgeHighlight(vec3 color, vec3 realPosition, vec3 normal) {
    if (uEnableEdgeHighlight < 0.5) return color;
    // Orthographicの場合はカメラ位置から距離を計算
    float distanceFromCamera = uIsOrthographic > 0.5
        ? length(cameraPosition - realPosition)
        : length(vOrigin - realPosition);
    if (distanceFromCamera >= uEdgeFadeEnd) return color;

    vec3 objPos = (uModelMatrixInverse * vec4(realPosition, 1.0)).xyz;
    vec3 hOdd = 0.5 * mod(uVoxelShape, 2.0);
    vec3 fractPos = fract(objPos + hOdd);
    vec3 distToEdge = min(fractPos, 1.0 - fractPos);

    vec3 absN = abs(normal);
    vec2 edgeDists = absN.x > 0.5 ? distToEdge.yz :
                     absN.y > 0.5 ? distToEdge.xz : distToEdge.xy;

    if (!any(lessThan(edgeDists, vec2(uEdgeThickness)))) return color;

    float fade = (uEdgeFadeEnd > uEdgeFadeStart)
        ? 1.0 - smoothstep(uEdgeFadeStart, uEdgeFadeEnd, distanceFromCamera)
        : 1.0;
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
    float u = (index + 0.5) / uPaletteSize;
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
    if (uEnableClipping > 0.5) {
        if (uClippingMode < 0.5) {
            // Mode 0: Off (何もしない)
        } else if (uClippingMode < 1.5) {
            // Mode 1: Slice (2面スライス)
            vec3 rayStart = originWS + directionWS * max(tEnter, 0.0);
            vec3 rayEnd = originWS + directionWS * tExit;

            // 軸方向の座標を取得
            float startCoord = (int(uSliceAxis) == 0) ? rayStart.x :
                               (int(uSliceAxis) == 1) ? rayStart.y : rayStart.z;
            float endCoord = (int(uSliceAxis) == 0) ? rayEnd.x :
                             (int(uSliceAxis) == 1) ? rayEnd.y : rayEnd.z;

            // スライス1は常にpos側（正方向）をカット: coord > distance1 を非表示
            // スライス2は常にneg側（負方向）をカット: coord < distance2 を非表示
            // 通常（distance1 >= distance2）: distance2 <= coord <= distance1 の範囲を表示
            // 逆転（distance1 < distance2）: distance1 < coord < distance2 のみを非表示（それ以外を表示）

            bool normalMode = (uSliceDistance1 >= uSliceDistance2);

            // 範囲との交差を計算
            float dirCoord = (int(uSliceAxis) == 0) ? directionWS.x :
                             (int(uSliceAxis) == 1) ? directionWS.y : directionWS.z;
            float originCoord = (int(uSliceAxis) == 0) ? originWS.x :
                                (int(uSliceAxis) == 1) ? originWS.y : originWS.z;

            if (abs(dirCoord) > 1e-6) {
                float t1 = (uSliceDistance1 - originCoord) / dirCoord;
                float t2 = (uSliceDistance2 - originCoord) / dirCoord;

                if (normalMode) {
                    // 通常モード: distance2 <= coord <= distance1 の範囲を表示
                    // 両端点が範囲外なら描画しない
                    if ((startCoord < uSliceDistance2 && endCoord < uSliceDistance2) ||
                        (startCoord > uSliceDistance1 && endCoord > uSliceDistance1)) {
                        discard;
                    }

                    float tMin = min(t1, t2);
                    float tMax = max(t1, t2);

                    // レイがスライス範囲に入る/出る位置でtEnter/tExitを調整
                    if (startCoord < uSliceDistance2 || startCoord > uSliceDistance1) {
                        tEnter = max(tEnter, tMin);
                        clippedAtEnter = true;
                    }
                    if (endCoord < uSliceDistance2 || endCoord > uSliceDistance1) {
                        tExit = min(tExit, tMax);
                    }
                } else {
                    // 逆転モード: distance1 < coord < distance2 のみを非表示
                    // 両端点が非表示範囲内にあれば描画しない
                    if (startCoord > uSliceDistance1 && startCoord < uSliceDistance2 &&
                        endCoord > uSliceDistance1 && endCoord < uSliceDistance2) {
                        discard;
                    }

                    float tMin = min(t1, t2);
                    float tMax = max(t1, t2);

                    // レイの開始点の位置に応じて処理
                    if (startCoord <= uSliceDistance1) {
                        // 非表示範囲より前から開始 → 非表示範囲の手前まで表示
                        if (endCoord > uSliceDistance1) {
                            tExit = min(tExit, tMin);
                        }
                    } else if (startCoord < uSliceDistance2) {
                        // 非表示範囲内から開始 → 範囲を抜けた位置から表示
                        tEnter = max(tEnter, tMax);
                        clippedAtEnter = true;
                    }
                    // startCoord >= uSliceDistance2 の場合は変更なし（そのまま表示）
                }
            } else {
                // dirCoordがほぼ0の場合（レイがスライス軸に平行）
                if (normalMode) {
                    if (startCoord < uSliceDistance2 || startCoord > uSliceDistance1) {
                        discard;
                    }
                } else {
                    if (startCoord > uSliceDistance1 && startCoord < uSliceDistance2) {
                        discard;
                    }
                }
            }

            if (tExit <= max(tEnter, 0.0)) discard;
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
        vec3 n;

        // クリッピング面で開始した場合は、クリッピング面の法線を使用
        if (clippedAtEnter && uEnableClipping > 0.5) {
            if (uClippingMode < 1.5 && uClippingMode > 0.5) {
                // Sliceモード: 軸方向の法線
                n = vec3(0.0);
                if (int(uSliceAxis) == 0) n.x = sign(direction.x);
                else if (int(uSliceAxis) == 1) n.y = sign(direction.y);
                else n.z = sign(direction.z);
            } else {
                // Customモード: クリッピング面の法線
                n = normalize(uClippingPlane.xyz);
            }
        } else {
            // どの軸のスラブで入射したか（tEnter は tMin3 の最大）
            int entryAxis = 0;
            if (tMin3.y >= tMin3.x && tMin3.y >= tMin3.z) entryAxis = 1;
            if (tMin3.z >= tMin3.x && tMin3.z >= tMin3.y) entryAxis = 2;

            // 外向き法線は「-sign(direction[axis])」
            n = vec3(0.0);
            if (entryAxis == 0) n.x = -sign(direction.x);
            else if (entryAxis == 1) n.y = -sign(direction.y);
            else                     n.z = -sign(direction.z);
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
        float diff = max(dot(n, lightDir), 0.0);

        float lighting = uAmbientIntensity + uLightIntensity * diff;
        vec3 finalColor = applyEdgeHighlight(voxel.rgb * lighting, realPosition, n);
        return vec4(finalColor, voxel.a);
    }

    // ステップ数制御
    float near = 50.0, far = 500.0;
    float distanceFactor = smoothstep(near, far, uCameraDistance);
    int baseMaxSteps = int(min(length(uVoxelShape) * 2.0, 800.0));
    int maxSteps = int(mix(float(baseMaxSteps), float(baseMaxSteps) * 0.25, distanceFactor));

    bool  hit = false;
    vec3  hitNormal = vec3(0.0);
    float hitDistance = 0.0;
    vec4  voxel = vec4(0.0);

    for (int i = 0; i < 1000; ++i) {
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
        samplePos = position + vec3(0.5);
        voxel = sampleVoxel(samplePos);
        bool currentOccupied = (voxel.a > 0.0);

        // 空→実体境界の検出
        if (!prevOccupied && currentOccupied) {
            hit = true;
            break;
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
