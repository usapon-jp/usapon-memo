export const BOARD_ITEM_DRAG_THRESHOLD_PX = 4;
export const BOARD_ITEM_PINCH_SENSITIVITY = 1.18;

export const hasBoardItemDragStarted = (origin, point, threshold = BOARD_ITEM_DRAG_THRESHOLD_PX) => (
  Math.hypot(point.clientX - origin.clientX, point.clientY - origin.clientY) > threshold
);

export const getBoardItemPinchScale = (
  baseScale,
  startDistance,
  currentDistance,
  sensitivity = BOARD_ITEM_PINCH_SENSITIVITY
) => {
  const ratio = Math.max(currentDistance, 1) / Math.max(startDistance, 1);
  return baseScale * Math.pow(ratio, sensitivity);
};
