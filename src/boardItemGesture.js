export const BOARD_ITEM_DRAG_THRESHOLD_PX = 4;
export const BOARD_ITEM_PINCH_SENSITIVITY = 1.18;
export const TRASH_DROP_TOLERANCE_PX = 12;

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

export const getGestureRotation = (baseRotation, startAngle, currentAngle) => {
  const shortestDelta = ((currentAngle - startAngle + 540) % 360) - 180;
  return baseRotation + shortestDelta;
};

export const getBoardItemMaxXPercent = (boardRect, itemRect, itemX) => {
  if (!boardRect || !itemRect || boardRect.width <= 0 || !Number.isFinite(itemX)) return 96;
  const anchorX = boardRect.left + (itemX / 100) * boardRect.width;
  const rightExtent = Math.max(0, itemRect.right - anchorX);
  return Math.min(100, Math.max(4, 100 - (rightExtent / boardRect.width) * 100));
};

export const isTrashDropTarget = (
  point,
  itemRect,
  trashRect,
  tolerance = TRASH_DROP_TOLERANCE_PX
) => {
  if (!trashRect) return false;
  const target = {
    left: trashRect.left - tolerance,
    right: trashRect.right + tolerance,
    top: trashRect.top - tolerance,
    bottom: trashRect.bottom + tolerance
  };
  const pointHit = Number.isFinite(point?.clientX) && Number.isFinite(point?.clientY)
    && point.clientX >= target.left
    && point.clientX <= target.right
    && point.clientY >= target.top
    && point.clientY <= target.bottom;
  const itemHit = itemRect
    && itemRect.left < target.right
    && itemRect.right > target.left
    && itemRect.top < target.bottom
    && itemRect.bottom > target.top;
  return Boolean(pointHit || itemHit);
};
