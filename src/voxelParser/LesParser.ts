import { VoxelDataset, Dimensions, getTotalVoxels } from './VoxelData';
import {
  ParseError,
  validateHeader,
  validateDataRowCount,
  validateRowLength,
  validateVoxelValue,
  validateDataArray,
  validateFileExtension,
  validateFileSize,
} from './validation';

/**
 * .leSファイルパーサー
 *
 * Format:
 * ```
 * X Y Z [voxel_length]
 * data[0,0,0] data[0,0,1] ... data[0,0,Z-1]
 * data[0,1,0] data[0,1,1] ... data[0,1,Z-1]
 * ...
 * ```
 */
export class LesParser {
  /**
   * .leSファイルの内容をパースしてVoxelDatasetに変換
   * @param content ファイルの内容（Uint8Array）
   * @param fileName ファイル名
   * @param filePath ファイルパス（オプション）
   * @returns パースされたVoxelDataset
   * @throws ParseError パース失敗時
   */
  static parse(content: Uint8Array, fileName: string, filePath?: string): VoxelDataset {
    // ファイルサイズ検証（1GB上限）
    validateFileSize(content.byteLength);

    // ファイル拡張子検証
    validateFileExtension(fileName);

    // テキストデコード
    const text = new TextDecoder('utf-8').decode(content);

    // 行分割（空行を除外）
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      throw new ParseError('File is empty');
    }

    // ヘッダーパース
    const { dimensions, voxelLength } = this.parseHeader(lines[0]);

    // データパース
    const dataLines = lines.slice(1);
    const values = this.parseData(dataLines, dimensions);

    // 最終検証
    validateDataArray(values, dimensions);

    return {
      dimensions,
      voxelLength,
      values,
      fileName,
      filePath,
    };
  }

  /**
   * ヘッダー行をパース
   * Format: X Y Z [voxel_length]
   */
  private static parseHeader(headerLine: string): { dimensions: Dimensions; voxelLength: number } {
    const parts = headerLine.trim().split(/\s+/);

    if (parts.length < 3) {
      throw new ParseError(
        `Invalid header format. Expected "X Y Z [voxel_length]", got: ${headerLine}`,
        1
      );
    }

    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const z = parseInt(parts[2], 10);
    const voxelLength = parts.length >= 4 ? parseFloat(parts[3]) : 1.0;

    // 数値として解釈できるかチェック
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      throw new ParseError(
        `Invalid dimensions in header. X, Y, Z must be integers. Got: ${parts[0]}, ${parts[1]}, ${parts[2]}`,
        1
      );
    }

    if (isNaN(voxelLength)) {
      throw new ParseError(`Invalid voxel length in header. Must be a number. Got: ${parts[3]}`, 1);
    }

    // ヘッダー検証
    validateHeader(x, y, z, voxelLength);

    return {
      dimensions: { x, y, z },
      voxelLength,
    };
  }

  /**
   * データ行をパース
   * Format: X*Y rows, each with Z space-separated values
   */
  private static parseData(dataLines: string[], dimensions: Dimensions): Uint8Array {
    const { x, y, z } = dimensions;
    const expectedRows = x * y;

    // 行数検証
    validateDataRowCount(dataLines.length, expectedRows);

    // データ配列を準備
    const totalVoxels = getTotalVoxels(dimensions);
    const values = new Uint8Array(totalVoxels);

    // 各行をパース（最適化版：手動スキャン）
    for (let rowIndex = 0; rowIndex < expectedRows; rowIndex++) {
      const line = dataLines[rowIndex];

      // Row i corresponds to (x, y) = (i÷Y, i%Y)
      const xCoord = Math.floor(rowIndex / y);
      const yCoord = rowIndex % y;

      // 手動スキャンで数値を抽出（split不要、高速化）
      let colIndex = 0;
      let currentValue = 0;
      let hasValue = false;
      const lineLength = line.length;

      for (let i = 0; i < lineLength; i++) {
        const char = line.charCodeAt(i);

        // 数字（0-9）の場合: charCode 48-57
        if (char >= 48 && char <= 57) {
          currentValue = currentValue * 10 + (char - 48);
          hasValue = true;
        }
        // 空白文字（space, tab, cr, lf）の場合
        else if (char === 32 || char === 9 || char === 13 || char === 10) {
          if (hasValue) {
            // 数値の終わり - 値を格納
            if (colIndex >= z) {
              throw new ParseError(
                `Row ${rowIndex + 1} has too many values. Expected ${z} values.`,
                rowIndex + 2
              );
            }

            // 値検証
            validateVoxelValue(currentValue, rowIndex, colIndex);

            // 1次元配列に格納
            // Three.js Data3DTexture expects: index = x + X * (y + Y * z)
            const zCoord = colIndex;
            const index = xCoord + x * (yCoord + y * zCoord);
            values[index] = currentValue;

            colIndex++;
            currentValue = 0;
            hasValue = false;
          }
        }
        // その他の文字（無効）
        else {
          throw new ParseError(
            `Invalid character at row ${rowIndex + 1}, position ${i + 1}: "${line[i]}"`,
            rowIndex + 2
          );
        }
      }

      // 行末の最後の数値を処理
      if (hasValue) {
        if (colIndex >= z) {
          throw new ParseError(
            `Row ${rowIndex + 1} has too many values. Expected ${z} values.`,
            rowIndex + 2
          );
        }

        validateVoxelValue(currentValue, rowIndex, colIndex);

        const zCoord = colIndex;
        const index = xCoord + x * (yCoord + y * zCoord);
        values[index] = currentValue;

        colIndex++;
      }

      // 行の値数検証
      validateRowLength(rowIndex, colIndex, z);
    }

    return values;
  }

  /**
   * VoxelDatasetをleS形式の文字列に変換（保存用）
   */
  static serialize(dataset: VoxelDataset): string {
    const { dimensions, voxelLength, values } = dataset;
    const { x, y, z } = dimensions;

    // ヘッダー行
    const header = `${x} ${y} ${z} ${voxelLength.toExponential(6)}`;

    // データ行
    // leS format: X*Y rows, each with Z values
    // Row i corresponds to (xCoord, yCoord) = (i÷Y, i%Y)
    const dataLines: string[] = [];
    for (let rowIndex = 0; rowIndex < x * y; rowIndex++) {
      const xCoord = Math.floor(rowIndex / y);
      const yCoord = rowIndex % y;

      const rowValues: number[] = [];
      for (let zCoord = 0; zCoord < z; zCoord++) {
        // Read from 1D array using Three.js layout: index = x + X * (y + Y * z)
        const index = xCoord + x * (yCoord + y * zCoord);
        rowValues.push(values[index]);
      }
      dataLines.push(rowValues.join(' '));
    }

    return header + '\n' + dataLines.join('\n') + '\n';
  }
}
