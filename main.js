(function () {
'use strict';

const CNV = CNVR();
const BOXES = [];
let NEW_BOX = null;
let DRAW_REQUEST_IN_FLIGHT = false;

const BOX_PAD = 40;
const PAREN_X = 10;
const LEVEL_COLORS = ['#f0f0ff', '#fff0f0', '#f0fff0'];
const OUTLINE_COLORS = ['#e0e0ff', '#ffe0e0', '#e0ffe0'];

const findIntersectingBox = function ({x, y, first = BOXES.length - 1}) {
  for (let i = first; i >= 0; i --) {
    const bx = BOXES[i].x;
    const by = BOXES[i].y;
    const bxm = BOXES[i].x + BOXES[i].w;
    const bym = BOXES[i].y + BOXES[i].h;
    if (x >= bx && x < bxm && y >= by && y < bym) {
      return BOXES[i];
    }
  }

  return null;
};

const createNewBox = function (p) {
  const newBox = {x: p.x - BOX_PAD, y: p.y - BOX_PAD,
                  w: BOX_PAD*2, h: BOX_PAD*2,
                  finished: false};
  BOXES.push(newBox);
  newBox.idx = BOXES.indexOf(newBox);

  return newBox;
};

const moveNewBox = function (newBox, p) {
    newBox.x = p.x - BOX_PAD;
    newBox.y = p.y - BOX_PAD;
};

const finishNewBox = function (newBox, p, cancelled) {
    newBox.x = p.x - BOX_PAD;
    newBox.y = p.y - BOX_PAD;
    newBox.finished = true;
    newBox.cancelled = cancelled;

    if (typeof newBox.properIdx !== 'undefined' &&
        newBox.properIdx !== newBox.idx) {
      // shift back into position
      const proper = newBox.properIdx, idx = newBox.idx;
      BOXES.splice(idx, 1);
      BOXES.splice(proper, 0, newBox);

      reindexBoxes();
    }
};

const removeBox = function (box) {
  const idx = box.idx;
  const removed = BOXES.splice(idx, 1)[0];
  removed.idx = -1;

  reindexBoxes(idx);

  return removed;
};

const reindexBoxes = function (first = 0) {
  for (let i = first; i < BOXES.length; i++) {
    BOXES[i].idx = i;
  }
};

const requestDraw = function () {
  if (!DRAW_REQUEST_IN_FLIGHT) {
    DRAW_REQUEST_IN_FLIGHT = true;
    window.requestAnimationFrame(draw);
  }
};

const draw = function () {
  DRAW_REQUEST_IN_FLIGHT = false;

  CNV.clear();

  BOXES.forEach(drawBox);
};

const drawBox = function (box, idx) {
  CNV.enterRel({x: box.x, y: box.y});

  const rectAttrs = {x: 0, y: 0, w: box.w, h: box.h, fill: LEVEL_COLORS[0]};

  if (!box.finished) {
    rectAttrs.stroke = OUTLINE_COLORS[0];
  }

  CNV.drawRect(rectAttrs);

  const openParenAttrs = {x: PAREN_X, y: box.h/2,
                          msg: '(', fill: '#000000'};
  CNV.drawText(openParenAttrs);
  
  const closeParenAttrs = {x: box.w - 1 - PAREN_X, y: box.h/2,
                           msg: ')', fill: '#000000'}
  CNV.drawText(closeParenAttrs);

  CNV.exitRel();
};

GET_TOUCHY(CNV.element, {
  touchStart (p) {
    const target = findIntersectingBox({x: p.x, y: p.y});

    if (target) {
      const idx = target.idx;
      removeBox(target);

      NEW_BOX = createNewBox(p);
      NEW_BOX.properIdx = idx;
    } else if (!NEW_BOX) {
      NEW_BOX = createNewBox(p);
    }

    requestDraw();
  },
  touchMove (p) {
    if (NEW_BOX) {
      moveNewBox(NEW_BOX, p);
      requestDraw();
    }
  },
  touchEnd (p, cancelled) {
    if (NEW_BOX) {
      finishNewBox(NEW_BOX, p, cancelled);
      requestDraw();
      NEW_BOX = null;
    }
  },
});

})();
