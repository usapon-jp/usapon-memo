import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_TEXT_FONT, fitImage, isBlankText, StickerEditor, wrapTextLines } from '../public/handwriting/core/sticker-editor.mjs';

test('編集用写真は長辺2048pxを超えず、縦横比を保つ', () => {
  assert.deepEqual(fitImage(4096, 2048), { width: 2048, height: 1024 });
  assert.deepEqual(fitImage(1200, 800), { width: 1200, height: 800 });
});

test('文字の標準書体は画面と書き出しで共有できるCSSフォント指定', () => {
  assert.match(DEFAULT_TEXT_FONT, /Hiragino Sans/);
});

test('長い文字と明示改行は指定幅で同じ行へ分割する', () => {
  const measure = value => value.length * 10;
  assert.deepEqual(wrapTextLines('うさぽんメモ', 30, measure), ['うさぽ', 'んメモ']);
  assert.deepEqual(wrapTextLines('上\n下', 30, measure), ['上', '下']);
  assert.deepEqual(wrapTextLines('上\n\n下', 30, measure), ['上', '', '下']);
});

test('未入力または空白だけの文字は画面に残さない', () => {
  assert.equal(isBlankText(''), true);
  assert.equal(isBlankText('  \n '), true);
  assert.equal(isBlankText('文字'), false);
});

test('写真の背景削除を一操作ずつ戻してやり直しても選択を保つ', () => {
  const editor = new StickerEditor({ layer: {}, onChange() {} });
  editor.render = () => {};
  editor.elements = [{ id: 'photo-1', type: 'image', source: 'original', removedBackground: false }];
  editor.selectedId = 'photo-1';
  editor.replaceSelectedImage('cutout');
  editor.replaceSelectedImage('erased-once');
  assert.equal(editor.selected().source, 'erased-once');

  assert.equal(editor.undo(true), true);
  assert.equal(editor.selected().source, 'cutout');
  assert.equal(editor.undo(true), true);
  assert.equal(editor.selected().source, 'original');
  assert.equal(editor.selected().removedBackground, false);

  assert.equal(editor.redo(true), true);
  assert.equal(editor.selected().source, 'cutout');
  assert.equal(editor.redo(true), true);
  assert.equal(editor.selected().source, 'erased-once');
});
