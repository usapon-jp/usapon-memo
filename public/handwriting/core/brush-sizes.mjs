const regular = { min: 1, max: 32, presets: [2, 5, 8, 14, 24] };
export const BRUSH_SIZES = {
  pen: regular, pencil: regular, marker: regular,
  crayon: { min: 1, max: 80, presets: [4, 12, 24, 48, 80] },
  watercolor: { min: 1, max: 120, presets: [6, 18, 36, 72, 120] },
  eraser: { min: 1, max: 160, presets: [1, 10, 32, 80, 160] },
};
