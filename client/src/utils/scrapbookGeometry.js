const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

// All persisted positions and dimensions are percentages of their scrapbook page.
export function moveElement(item, deltaX, deltaY, pageRect) {
  return {
    x: clamp(item.x + deltaX / pageRect.width * 100, 0, 100 - item.w),
    y: clamp(item.y + deltaY / pageRect.height * 100, 0, 100 - item.h),
  };
}

// Project pointer movement onto the item's rotated axes. Dragging the bottom-right
// handle then feels natural even when a piece of washi tape has been turned.
export function resizeElement(item, deltaX, deltaY, pageRect, keepAspectRatio = false) {
  const angle = item.rotation * Math.PI / 180;
  const localX = deltaX * Math.cos(angle) + deltaY * Math.sin(angle);
  const localY = -deltaX * Math.sin(angle) + deltaY * Math.cos(angle);
  const changeW = localX / pageRect.width * 100;
  const changeH = localY / pageRect.height * 100;

  if (keepAspectRatio) {
    const changeScale = Math.abs(changeW / item.w) >= Math.abs(changeH / item.h)
      ? changeW / item.w : changeH / item.h;
    const scale = clamp(1 + changeScale,
      Math.max(5 / item.w, 5 / item.h),
      Math.min((100 - item.x) / item.w, (100 - item.y) / item.h));
    return { w: item.w * scale, h: item.h * scale };
  }

  return {
    w: clamp(item.w + changeW, 5, 100 - item.x),
    h: clamp(item.h + changeH, 5, 100 - item.y),
  };
}

export function pointerAngle(item, pageRect, clientX, clientY) {
  const centerX = pageRect.left + pageRect.width * (item.x + item.w / 2) / 100;
  const centerY = pageRect.top + pageRect.height * (item.y + item.h / 2) / 100;
  return Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
}

export function rotateElement(item, pageRect, startAngle, clientX, clientY) {
  const currentAngle = pointerAngle(item, pageRect, clientX, clientY);
  const angleChange = ((currentAngle - startAngle + 540) % 360) - 180;
  return { rotation: ((item.rotation + angleChange + 540) % 360) - 180 };
}
