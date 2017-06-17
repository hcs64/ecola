(function () {
'use strict';

const SVG = SVGR();
const BOXES = [];
let NEW_BOX = null;

const BOX_PAD = 40;
const PAREN_X = 10;
const LEVEL_COLORS = ['#f0f0ff', '#fff0f0', '#f0fff0'];
const OUTLINE_COLOR = '#808080';

const touchHandler = function (box) {
  return function (e) {
    // TODO:
    // This allows the event to propagate upwards, but that may not be
    // desirable if it is a child of something else. On the other hand,
    // because we remove and readd the SVG, it may just go to the top level
    // once this handler is done anyway.
    removeBox(box.idx);

    NEW_BOX = createNewBox({x: box.x + BOX_PAD, y: box.y + BOX_PAD});
    // We need to reuse the SVG otherwise Firefox loses the subsequent
    // touchmove events. Probably a good idea anyway.
    NEW_BOX.svg = box.svg;
    SVG.element.appendChild(box.svg.group);
  };
};

const createNewBox = function (p) {
  const newBox = {x: p.x - BOX_PAD, y: p.y - BOX_PAD,
                  w: BOX_PAD*2, h: BOX_PAD*2,
                  svg: {},
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
};

const removeBox = function (idx) {
  const removed = BOXES.splice(idx, 1)[0];
  removed.idx = -1;

  for (let i = idx; i < BOXES.length; i++) {
    BOXES[i].idx = i;
  }

  SVG.removeElement(removed.svg.group);
  removed.svg.rect.removeEventListener('touchStart', removed.touchHandler);
  removed.svg.rect.removeEventListener('mousedown', removed.touchHandler);

  return removed;
};

const requestDraw = function (box) {
  if (!box.drawRequestInFlight) {
    box.drawRequestInFlight = true;
    window.requestAnimationFrame(function () {draw(box)});
  }
};

const draw = function (box) {
  box.drawRequestInFlight = false;

  if (!box.svg.group) {
    box.svg.group = SVG.makeGroup({});
  }

  box.svg.group.setAttribute('transform', `translate(${box.x} ${box.y})`);

  if (!box.svg.rect) {
    const rectAttrs = {x: 0, y: 0, w: box.w, h: box.h,
       fill: LEVEL_COLORS[0], p: box.svg.group};

    box.svg.rect = SVG.makeRect(rectAttrs);
  }

  if (!box.finished) {
    if (!box.svg.rect.hasAttribute('stroke')) {
      box.svg.rect.setAttribute('stroke', OUTLINE_COLOR);
    }
  } else {
    if (box.svg.rect.hasAttribute('stroke')) {
      box.svg.rect.removeAttribute('stroke');
    }
  }

  if (!box.svg.openParen) {
    const openParenAttrs = {x: PAREN_X,
                            y: box.h/2,
                            msg: '(',
                            p: box.svg.group};

    box.svg.openParen = SVG.makeText(openParenAttrs);
  }
  
  if (!box.svg.closeParen) {
    const closeParenAttrs = {x: box.w - 1 - PAREN_X,
                             y: box.h/2,
                             msg: ')',
                             p: box.svg.group};

    box.svg.closeParen = SVG.makeText(closeParenAttrs);
  }

  if (box.finished) {
    box.touchHandler = touchHandler(box);
    box.svg.rect.addEventListener('touchstart', box.touchHandler);
    box.svg.rect.addEventListener('mousedown', box.touchHandler);
  }

};

GET_TOUCHY(SVG.element, {
  touchStart (p) {
    if (!NEW_BOX) {
      NEW_BOX = createNewBox(p);
    }
    requestDraw(NEW_BOX);
  },
  touchMove (p) {
    if (NEW_BOX) {
      moveNewBox(NEW_BOX, p);
      requestDraw(NEW_BOX);
    }
  },
  touchEnd (p, cancelled) {
    if (NEW_BOX) {
      finishNewBox(NEW_BOX, p, cancelled);
      requestDraw(NEW_BOX);
      NEW_BOX = null;
    }
  },
});

})();
