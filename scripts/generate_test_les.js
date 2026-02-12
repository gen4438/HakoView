#!/usr/bin/env node
/**
 * leS形式のテストファイルを生成するスクリプト
 *
 * Usage:
 *   node scripts/generate_test_les.js
 *
 * 生成されるファイル:
 * - test_data/cube_128.leS - 128³立方体、ランダムな球
 * - test_data/cube_256.leS - 256³立方体、ランダムな球
 * - test_data/cube_512.leS - 512³立方体、空間分割パターン
 * - test_data/cube_1024.leS - 1024³立方体、空間分割パターン
 * - test_data/rect_100x200x300.leS - 矩形、ランダムな球
 * - test_data/thin_512x512x64.leS - 薄い形状、空間分割
 * - test_data/tall_64x64x512.leS - 高い形状、グラデーション
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * leSフォーマットでボクセルデータをファイルに書き込む
 *
 * @param {string} filepath - 出力ファイルパス（.leSまたは.leS.gz）
 * @param {Uint8Array} data - 1次元配列（サイズ = X * Y * Z）
 * @param {number} X - X方向のボクセル数
 * @param {number} Y - Y方向のボクセル数
 * @param {number} Z - Z方向のボクセル数
 * @param {number} voxelLength - ボクセルの物理サイズ（メートル単位）
 * @param {boolean} compress - gzip圧縮するかどうか
 */
function writeLesFile(filepath, data, X, Y, Z, voxelLength = 1e-9, compress = false) {
  // ディレクトリが存在しない場合は作成
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 出力ストリームを作成
  const fileStream = fs.createWriteStream(filepath);
  let stream;

  if (compress) {
    // gzip圧縮ストリームを作成
    const gzip = zlib.createGzip();
    gzip.pipe(fileStream);
    stream = gzip;
  } else {
    stream = fileStream;
  }

  // ヘッダー行
  stream.write(`${X} ${Y} ${Z} ${voxelLength.toExponential(6)}\n`);

  // データ本体: X*Y行、各行にZ個の値
  // 行インデックス i → (x=i÷Y, y=i%Y)
  for (let i = 0; i < X * Y; i++) {
    const x = Math.floor(i / Y);
    const y = i % Y;

    // Z方向の値を取得
    const rowValues = [];
    for (let z = 0; z < Z; z++) {
      const index = x * Y * Z + y * Z + z;
      rowValues.push(data[index]);
    }

    stream.write(rowValues.join(' ') + '\n');
  }

  stream.end();

  // ストリームのクローズを待つ
  return new Promise((resolve) => {
    fileStream.on('finish', () => {
      const fileSizeMB = fs.statSync(filepath).size / (1024 * 1024);
      console.log(`生成完了: ${filepath}`);
      console.log(`  形状: ${X}×${Y}×${Z}, サイズ: ${fileSizeMB.toFixed(2)} MB`);
      resolve();
    });
  });
}

/**
 * 3Dインデックスから1Dインデックスへの変換
 */
function index3Dto1D(x, y, z, X, Y, Z) {
  return x * Y * Z + y * Z + z;
}

/**
 * ランダムに配置された球を含むボクセルデータを生成
 *
 * @param {number} X - X方向のボクセル数
 * @param {number} Y - Y方向のボクセル数
 * @param {number} Z - Z方向のボクセル数
 * @param {number} numSpheres - 配置する球の数
 * @param {number} minRadius - 球の最小半径
 * @param {number} maxRadius - 球の最大半径
 * @returns {Uint8Array}
 */
function createRandomSpheres(X, Y, Z, numSpheres = 10, minRadius = 5, maxRadius = 30) {
  const data = new Uint8Array(X * Y * Z);

  // シンプルなシード付き乱数生成器
  let seed = 42;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const randomInt = (min, max) => {
    return Math.floor(random() * (max - min + 1)) + min;
  };

  for (let sphereIdx = 0; sphereIdx < numSpheres; sphereIdx++) {
    // ランダムな中心位置
    const cx = randomInt(maxRadius, X - maxRadius - 1);
    const cy = randomInt(maxRadius, Y - maxRadius - 1);
    const cz = randomInt(maxRadius, Z - maxRadius - 1);

    // ランダムな半径
    const radius = randomInt(minRadius, maxRadius);

    // ランダムなマテリアルID (1-255)
    const materialId = randomInt(1, 255);

    // 球の範囲を計算
    const xMin = Math.max(0, cx - radius);
    const xMax = Math.min(X, cx + radius + 1);
    const yMin = Math.max(0, cy - radius);
    const yMax = Math.min(Y, cy + radius + 1);
    const zMin = Math.max(0, cz - radius);
    const zMax = Math.min(Z, cz + radius + 1);

    // 球内のボクセルを設定
    for (let x = xMin; x < xMax; x++) {
      for (let y = yMin; y < yMax; y++) {
        for (let z = zMin; z < zMax; z++) {
          const distSq = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
          if (distSq <= radius ** 2) {
            const idx = index3Dto1D(x, y, z, X, Y, Z);
            data[idx] = materialId;
          }
        }
      }
    }
  }

  return data;
}

/**
 * 空間を分割して異なる値を設定したボクセルデータを生成
 *
 * @param {number} X - X方向のボクセル数
 * @param {number} Y - Y方向のボクセル数
 * @param {number} Z - Z方向のボクセル数
 * @param {number} numRegions - 分割数（各軸方向）
 * @returns {Uint8Array}
 */
function createSpatialRegions(X, Y, Z, numRegions = 8) {
  const data = new Uint8Array(X * Y * Z);

  // 各軸を等分割
  const xSplits = [];
  const ySplits = [];
  const zSplits = [];

  for (let i = 0; i <= numRegions; i++) {
    xSplits.push(Math.floor((X * i) / numRegions));
    ySplits.push(Math.floor((Y * i) / numRegions));
    zSplits.push(Math.floor((Z * i) / numRegions));
  }

  let materialId = 1;
  for (let i = 0; i < numRegions; i++) {
    for (let j = 0; j < numRegions; j++) {
      for (let k = 0; k < numRegions; k++) {
        const xStart = xSplits[i];
        const xEnd = xSplits[i + 1];
        const yStart = ySplits[j];
        const yEnd = ySplits[j + 1];
        const zStart = zSplits[k];
        const zEnd = zSplits[k + 1];

        for (let x = xStart; x < xEnd; x++) {
          for (let y = yStart; y < yEnd; y++) {
            for (let z = zStart; z < zEnd; z++) {
              const idx = index3Dto1D(x, y, z, X, Y, Z);
              data[idx] = materialId;
            }
          }
        }

        // マテリアルIDを循環（1-16）
        materialId = (materialId % 16) + 1;
      }
    }
  }

  return data;
}

/**
 * 指定軸に沿ってグラデーションパターンを生成
 *
 * @param {number} X - X方向のボクセル数
 * @param {number} Y - Y方向のボクセル数
 * @param {number} Z - Z方向のボクセル数
 * @param {number} axis - グラデーション軸 (0=X, 1=Y, 2=Z)
 * @returns {Uint8Array}
 */
function createGradientPattern(X, Y, Z, axis = 2) {
  const data = new Uint8Array(X * Y * Z);
  const sizes = [X, Y, Z];
  const size = sizes[axis];

  for (let i = 0; i < size; i++) {
    // 0-255の範囲でグラデーション
    let value = Math.floor((i / Math.max(1, size - 1)) * 255);
    value = Math.max(1, Math.min(255, value)); // 1-255の範囲に制限

    if (axis === 0) {
      for (let y = 0; y < Y; y++) {
        for (let z = 0; z < Z; z++) {
          const idx = index3Dto1D(i, y, z, X, Y, Z);
          data[idx] = value;
        }
      }
    } else if (axis === 1) {
      for (let x = 0; x < X; x++) {
        for (let z = 0; z < Z; z++) {
          const idx = index3Dto1D(x, i, z, X, Y, Z);
          data[idx] = value;
        }
      }
    } else {
      // axis === 2
      for (let x = 0; x < X; x++) {
        for (let y = 0; y < Y; y++) {
          const idx = index3Dto1D(x, y, i, X, Y, Z);
          data[idx] = value;
        }
      }
    }
  }

  return data;
}

/**
 * 3Dチェッカーボードパターンを生成
 *
 * @param {number} X - X方向のボクセル数
 * @param {number} Y - Y方向のボクセル数
 * @param {number} Z - Z方向のボクセル数
 * @param {number} blockSize - チェッカーボードのブロックサイズ
 * @returns {Uint8Array}
 */
function createCheckerboardPattern(X, Y, Z, blockSize = 16) {
  const data = new Uint8Array(X * Y * Z);

  for (let x = 0; x < X; x++) {
    for (let y = 0; y < Y; y++) {
      for (let z = 0; z < Z; z++) {
        // チェッカーボードパターン
        const bx = Math.floor(x / blockSize);
        const by = Math.floor(y / blockSize);
        const bz = Math.floor(z / blockSize);

        const idx = index3Dto1D(x, y, z, X, Y, Z);
        if ((bx + by + bz) % 2 === 0) {
          data[idx] = 10;
        } else {
          data[idx] = 5;
        }
      }
    }
  }

  return data;
}

/**
 * テストファイルを生成
 */
async function main() {
  const baseDir = path.join(__dirname, '..', 'test_data');

  console.log('=== leSテストファイル生成開始 ===\n');

  // 1. 32³立方体
  console.log('1. 32³立方体（ランダムな球）');
  let data = createRandomSpheres(32, 32, 32, 5, 3, 8);
  await writeLesFile(path.join(baseDir, 'cube_32_spheres.leS.gz'), data, 32, 32, 32, 5e-8, true);
  console.log();

  console.log('2. 32³立方体（空間分割パターン）');
  data = createSpatialRegions(32, 32, 32, 2);
  await writeLesFile(path.join(baseDir, 'cube_32_regions.leS.gz'), data, 32, 32, 32, 5e-8, true);
  console.log();

  // 2. 128³立方体
  console.log('3. 128³立方体（ランダムな球）');
  data = createRandomSpheres(128, 128, 128, 20, 5, 15);
  await writeLesFile(
    path.join(baseDir, 'cube_128_spheres.leS.gz'),
    data,
    128,
    128,
    128,
    2e-8,
    true
  );
  console.log();

  console.log('4. 128³立方体（空間分割パターン）');
  data = createSpatialRegions(128, 128, 128, 4);
  await writeLesFile(
    path.join(baseDir, 'cube_128_regions.leS.gz'),
    data,
    128,
    128,
    128,
    2e-8,
    true
  );
  console.log();

  // 3. 256³立方体
  console.log('5. 256³立方体（ランダムな球）');
  data = createRandomSpheres(256, 256, 256, 30, 10, 30);
  await writeLesFile(
    path.join(baseDir, 'cube_256_spheres.leS.gz'),
    data,
    256,
    256,
    256,
    1e-8,
    true
  );
  console.log();

  console.log('6. 256³立方体（空間分割パターン）');
  data = createSpatialRegions(256, 256, 256, 4);
  await writeLesFile(
    path.join(baseDir, 'cube_256_regions.leS.gz'),
    data,
    256,
    256,
    256,
    1e-8,
    true
  );
  console.log();

  // 4. 512³立方体
  console.log('7. 512³立方体（ランダムな球）');
  data = createRandomSpheres(512, 512, 512, 40, 15, 40);
  await writeLesFile(
    path.join(baseDir, 'cube_512_spheres.leS.gz'),
    data,
    512,
    512,
    512,
    5e-9,
    true
  );
  console.log();

  console.log('8. 512³立方体（空間分割パターン）');
  data = createSpatialRegions(512, 512, 512, 8);
  await writeLesFile(
    path.join(baseDir, 'cube_512_regions.leS.gz'),
    data,
    512,
    512,
    512,
    5e-9,
    true
  );
  console.log();

  // 注: 1024³はメモリ消費が大きいため、必要に応じてコメントアウトを解除
  // console.log('9. 1024³立方体（ランダムな球）');
  // data = createRandomSpheres(1024, 1024, 1024, 50, 20, 50);
  // await writeLesFile(path.join(baseDir, 'cube_1024_spheres.leS.gz'), data, 1024, 1024, 1024, 2e-9, true);
  // console.log();
  //
  // console.log('10. 1024³立方体（空間分割パターン）');
  // data = createSpatialRegions(1024, 1024, 1024, 16);
  // await writeLesFile(path.join(baseDir, 'cube_1024_regions.leS.gz'), data, 1024, 1024, 1024, 2e-9, true);
  // console.log();

  // 5. 矩形形状
  console.log('11. 100×200×300矩形（ランダムな球）');
  data = createRandomSpheres(100, 200, 300, 25, 8, 20);
  await writeLesFile(
    path.join(baseDir, 'rect_100x200x300.leS.gz'),
    data,
    100,
    200,
    300,
    1.5e-8,
    true
  );
  console.log();

  // 6. 薄い形状
  console.log('12. 512×512×64薄い形状（チェッカーボード）');
  data = createCheckerboardPattern(512, 512, 64, 32);
  await writeLesFile(path.join(baseDir, 'thin_512x512x64.leS.gz'), data, 512, 512, 64, 1e-8, true);
  console.log();

  // 7. 高い形状
  console.log('13. 64×64×512高い形状（Z軸グラデーション）');
  data = createGradientPattern(64, 64, 512, 2);
  await writeLesFile(path.join(baseDir, 'tall_64x64x512.leS.gz'), data, 64, 64, 512, 1e-8, true);
  console.log();

  // 8. 非対称形状
  console.log('14. 256×128×64非対称形状（空間分割）');
  data = createSpatialRegions(256, 128, 64, 4);
  await writeLesFile(path.join(baseDir, 'asym_256x128x64.leS.gz'), data, 256, 128, 64, 2e-8, true);
  console.log();

  // 9. X軸グラデーション
  console.log('15. 200×100×100矩形（X軸グラデーション）');
  data = createGradientPattern(200, 100, 100, 0);
  await writeLesFile(
    path.join(baseDir, 'grad_x_200x100x100.leS.gz'),
    data,
    200,
    100,
    100,
    1e-8,
    true
  );
  console.log();

  console.log('=== 生成完了 ===');
  console.log(`ファイル出力先: ${baseDir}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  writeLesFile,
  createRandomSpheres,
  createSpatialRegions,
  createGradientPattern,
  createCheckerboardPattern,
};
