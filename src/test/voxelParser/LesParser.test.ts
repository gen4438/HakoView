import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { LesParser } from '../../voxelParser/LesParser';
import { ParseError } from '../../voxelParser/validation';

suite('LesParser', () => {
  test('parses a valid leS file', () => {
    const filePath = path.resolve(__dirname, '..', '..', '..', 'tmp', 'grid_11x20x29.leS');
    const content = fs.readFileSync(filePath);

    const dataset = LesParser.parse(new Uint8Array(content), 'grid_11x20x29.leS', filePath);

    assert.strictEqual(dataset.dimensions.x, 11);
    assert.strictEqual(dataset.dimensions.y, 20);
    assert.strictEqual(dataset.dimensions.z, 29);
    assert.strictEqual(dataset.values.length, 11 * 20 * 29);
    assert.strictEqual(dataset.fileName, 'grid_11x20x29.leS');
    assert.strictEqual(dataset.filePath, filePath);
    assert.ok(Math.abs(dataset.voxelLength - 2.0e-8) < 1.0e-12);
  });

  test('throws on invalid header', () => {
    const content = new TextEncoder().encode('X Y Z\n0\n');

    assert.throws(() => {
      LesParser.parse(content, 'invalid.leS');
    }, ParseError);
  });
});
