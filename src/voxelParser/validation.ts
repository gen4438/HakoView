import { Dimensions } from './VoxelData';

/**
 * パースエラー
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * ヘッダー情報の検証
 */
export function validateHeader(x: number, y: number, z: number, voxelLength: number): void {
  // FR-005: 各次元は1〜1024
  if (x < 1 || x > 1024) {
    throw new ParseError(`Invalid X dimension: ${x}. Must be between 1 and 1024.`);
  }
  if (y < 1 || y > 1024) {
    throw new ParseError(`Invalid Y dimension: ${y}. Must be between 1 and 1024.`);
  }
  if (z < 1 || z > 1024) {
    throw new ParseError(`Invalid Z dimension: ${z}. Must be between 1 and 1024.`);
  }

  // voxelLengthは正の数
  if (voxelLength <= 0) {
    throw new ParseError(`Invalid voxel length: ${voxelLength}. Must be positive.`);
  }
}

/**
 * データ行数の検証
 */
export function validateDataRowCount(actualRows: number, expectedRows: number): void {
  // FR-008: X*Y行が必要
  if (actualRows < expectedRows) {
    throw new ParseError(
      `Insufficient data rows: ${actualRows} found, ${expectedRows} expected (X*Y).`
    );
  }
  if (actualRows > expectedRows) {
    throw new ParseError(
      `Too many data rows: ${actualRows} found, ${expectedRows} expected (X*Y).`
    );
  }
}

/**
 * 各行のZ値数の検証
 */
export function validateRowLength(
  rowIndex: number,
  actualLength: number,
  expectedLength: number
): void {
  // FR-008: 各行はZ個の値が必要
  if (actualLength < expectedLength) {
    throw new ParseError(
      `Row ${rowIndex + 1}: insufficient values (${actualLength} found, ${expectedLength} expected).`,
      rowIndex + 2 // +2 for 1-indexed and header line
    );
  }
  if (actualLength > expectedLength) {
    throw new ParseError(
      `Row ${rowIndex + 1}: too many values (${actualLength} found, ${expectedLength} expected).`,
      rowIndex + 2
    );
  }
}

/**
 * ボクセル値の範囲検証
 */
export function validateVoxelValue(value: number, rowIndex: number, colIndex: number): void {
  // FR-011: 値は0〜255
  if (value < 0 || value > 255) {
    throw new ParseError(
      `Invalid voxel value: ${value} at row ${rowIndex + 1}, column ${colIndex + 1}. Must be 0-255.`,
      rowIndex + 2,
      colIndex + 1
    );
  }

  // NaN、Infinityチェック
  if (!Number.isFinite(value)) {
    throw new ParseError(
      `Non-numeric voxel value at row ${rowIndex + 1}, column ${colIndex + 1}.`,
      rowIndex + 2,
      colIndex + 1
    );
  }
}

/**
 * 最終的なデータ配列の検証
 */
export function validateDataArray(values: Uint8Array, dimensions: Dimensions): void {
  const expectedLength = dimensions.x * dimensions.y * dimensions.z;

  if (values.length !== expectedLength) {
    throw new ParseError(
      `Data array length mismatch: ${values.length} values, ${expectedLength} expected (X*Y*Z).`
    );
  }
}

/**
 * ファイル拡張子の検証
 */
export function validateFileExtension(fileName: string): void {
  const lowerFileName = fileName.toLowerCase();
  if (!lowerFileName.endsWith('.les') && !lowerFileName.endsWith('.les.gz')) {
    throw new ParseError(`Invalid file extension. Expected .leS or .leS.gz file, got: ${fileName}`);
  }
}

/**
 * ファイルサイズの検証（1GB上限）
 */
export function validateFileSize(sizeInBytes: number): void {
  const MAX_SIZE = 1024 * 1024 * 1024; // 1GB

  if (sizeInBytes > MAX_SIZE) {
    throw new ParseError(
      `File too large: ${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB. Maximum 1 GB allowed.`
    );
  }
}
