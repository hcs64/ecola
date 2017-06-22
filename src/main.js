(function () {
'use strict';

const CNV = CNVR();

let BOXES;
let BOX_CHANGED;
let PANNING;
let PAN_TRANSLATE;
let TEMP_PAN_TRANSLATE;
let DRAW_REQUEST_IN_FLIGHT;
let TOUCH_ORIGIN;
let HOLD_TIMEOUT1_ID;
let HOLD_TIMEOUT2_ID;
let TARGET_BOX;
let WARN_HOLD;
let SAVE_HASH;
let CANCEL_PROMPT;

let SEMANTIC_ZOOM;
let DEEPEST;
let SHRINK_CUTOFF;
let HANDLE_SHRINK_ROLLOFF;
let SHRINK_ROLLOFF0;
let SHRINK_ROLLOFF1;
let SHRINK_ROLLOFF2;

let ZOOMING_BOX;
let ZOOM_CHANGED;
let LAST_ZOOM_COORDS;
let PINCH_DISTANCE;
let ZOOM_TARGET;

const resetGlobals = function () {
  BOXES = [];
  BOX_CHANGED = true;
  PANNING = false;
  PAN_TRANSLATE = {x: 0, y: 0};
  TEMP_PAN_TRANSLATE = {x: 0, y: 0};
  if (DRAW_REQUEST_IN_FLIGHT) {
    window.cancelAnimationFrame(DRAW_REQUEST_IN_FLIGHT);
  }
  DRAW_REQUEST_IN_FLIGHT = false;
  TOUCH_ORIGIN = {x: 0, y: 0};
  cancelHoldTimeout();
  HOLD_TIMEOUT1_ID = null;
  HOLD_TIMEOUT2_ID = null;
  TARGET_BOX = null;
  WARN_HOLD = false;
  SAVE_HASH = '#';
  CANCEL_PROMPT = null;

  SEMANTIC_ZOOM = 0;
  DEEPEST = 0;
  SHRINK_CUTOFF = 0;
  HANDLE_SHRINK_ROLLOFF = 0;
  SHRINK_ROLLOFF0 = 0;
  SHRINK_ROLLOFF1 = 0;
  SHRINK_ROLLOFF2 = 0;

  ZOOMING_BOX = null;
  ZOOM_CHANGED = false;
  LAST_ZOOM_COORDS = null;
  PINCH_DISTANCE = null;
  ZOOM_TARGET = null;
};

const TARGET_LINE_WIDTH = 15;
const HOLD_TIMEOUT1_MS = 500;
const HOLD_TIMEOUT2_MS = 500;
const PAN_DIST = 20;
const HANDLE_PX = 40;
const BOX_BORDER_PX = 4;
const EMPTY_WIDTH_PX = 120;
const EMPTY_BOX_WIDTH_PX = EMPTY_WIDTH_PX + 2 * BOX_BORDER_PX;
const EMPTY_BOX_HEIGHT_PX = HANDLE_PX + 2 * BOX_BORDER_PX;
const MIN_TEXT_WIDTH = HANDLE_PX;
const LEVEL_HUES = [[240],[0]];
const TARGET_COLOR = '#000000';
const WARN_COLOR = '#ff0000';
const FONT_SIZE = 18;
const ZOOM_LEVEL_PIXELS = 80;
const SHRINK0 = 1/2;
const MIN_SHRINK = SHRINK0/16;
const TOO_SMALL_THRESH = 0.75;

const SAVE_LINK = document.getElementById('save-link');
const PROMPT_INPUT = document.getElementById('prompt-input');
const PROMPT_FORM = document.getElementById('prompt-form');

const OPEN_SYM = '(';
const CLOSE_SYM = ')';
const ROW_SYM = ',';
const ID_SYM = "'";
const ESC_SYM = '~';

/*
  box properties

  under
  x, y: relative to row if under exists, else absolute
  w, h: now only temporary, generated through updateAllBoxes
  level: >= 0
  rows[x]: {
    x, y: relative to under
    w, h
    cells[x]: box
  }
  rows[] will exist but could be empty, rows[].cells[] cannot be empty
  idx: index in whatever array this box is in (currently cells or BOXES)
  rowIdx: row within under, in this case idx is the index in cells
  text
  textWidth
*/

const findIntersectingBox = function ({x, y, boxes = BOXES, first = -1}) {
  if (first === -1) {
    first = boxes.length - 1;
  }
  for (let i = first; i >= 0; i --) {
    const b = boxes[i];
    const bxm = b.x + b.w;
    const bym = b.y + b.h;
    if (x >= b.x && x < bxm && y >= b.y && y < bym) {
      for (let ri = b.rows.length - 1; ri >= 0; ri --) {
        const r = b.rows[ri];
        const child =
          findIntersectingBox({x: x - b.x - r.x, y: y - b.y - r.y,
                               boxes: r.cells});
        if (child) {
          return child;
        }
      }

      return b;
    }
  }

  return null;
};

const convertToBoxXY = function (box, x, y) {
  if (box.under) {
    const row = box.under.rows[box.rowIdx];
    x -= box.x + row.x;
    y -= box.y + row.y;
    return convertToBoxXY(box.under, x, y);
  }
  return {x: x - box.x, y: y - box.y};
};

const convertToAbsoluteXY = function (box, x, y) {
  if (box.under) {
    const row = box.under.rows[box.rowIdx];
    x += box.x + row.x;
    y += box.y + row.y;
    return convertToAbsoluteXY(box.under, x, y);
  }
  return {x: x + box.x, y: y + box.y}
};

const createNewBox = function (p, under = null) {
  const newBox = {x: 0, y: 0,
                  rows: [], under, level: 0};

  if (under) {
    newBox.level = under.level + 1;

    const targetRow = {cells: [newBox]};
    under.rows.splice(0, 0, targetRow);

    reindexRows(under.rows);

  } else {
    BOXES.push(newBox);
    newBox.idx = BOXES.indexOf(newBox);
  }

  newBox.w = EMPTY_BOX_WIDTH_PX;
  newBox.h = EMPTY_BOX_HEIGHT_PX;

  if (!under) {
    newBox.x = p.x - newBox.w/2
    newBox.y = p.y - newBox.h/2;
  }

  BOX_CHANGED = true;

  return newBox;
};

const removeBox = function (box) {
  const idx = box.idx;
  box.idx = -1;

  let removed;

  if (box.under) {
    const under = box.under;
    const rowIdx = box.rowIdx;
    const row = under.rows[rowIdx];
    removed = row.cells.splice(idx, 1)[0];
    box.rowIdx = -1;
    if (row.cells.length === 0) {
      under.rows.splice(rowIdx, 1);
      reindexRows(under.rows);
    } else {
      reindexBoxes(row.cells);
    }

  } else {
    removed = BOXES.splice(idx, 1)[0];
    reindexBoxes();
  }

  BOX_CHANGED = true;

  return removed;
};

const reindexBoxes = function (list = BOXES, first = 0) {
  for (let i = first; i < list.length; i ++) {
    list[i].idx = i;
  }
};

const reindexRows = function (rows) {
  for (let i = 0; i < rows.length; i ++) {
    for (let j = 0; j < rows[i].cells.length; j ++) {
      rows[i].cells[j].idx = j;
      rows[i].cells[j].rowIdx = i;
    }
  }
};

const updateBoxRows = function (box, callUp = true) {
  // Set position for the rows of this box based on their sizes, then set the
  // size of this box from that.
  // Also calls up to update the parent box since this box's size could
  // have changed (updateRowCells on the row this box is in and updateBoxRows
  // on the parent box)

  const hs = getHandleShrinkage(box);
  const handle = HANDLE_PX * hs;
  let w = 0;
  let h = BOX_BORDER_PX;

  box.rows.forEach(function (row) {
    row.x = BOX_BORDER_PX + handle;
    row.y = h;

    w = Math.max(w, row.w);
    h += row.h + BOX_BORDER_PX;
  });

  if (box.rows.length === 0) {
    const s = getTextShrinkage(box);
    if (typeof box.textWidth === 'number') {
      box.w = BOX_BORDER_PX * 2 + (box.textWidth * s);
      box.h = BOX_BORDER_PX * 2 + FONT_SIZE * 1.5 * s;
    } else {
      box.w = EMPTY_BOX_WIDTH_PX * s;
      box.h = EMPTY_BOX_HEIGHT_PX * s;
    }
  } else {
    box.w = w + 2 * BOX_BORDER_PX + handle;
    box.h = h;
  }

  if (callUp && box.under) {
    updateRowCells(box.under.rows[box.rowIdx], box);
    updateBoxRows(box.under);
  }
};

const updateRowCells = function (row, box) {
  // Set the position of each cell (box) based on the size of previous boxes,
  // and update the size of the row.
  let h = 0;
  let w = 0;

  row.cells.forEach(function (cell, idx) {
    cell.x = w;
    cell.y = 0;

    w += cell.w + BOX_BORDER_PX;
    h = Math.max(h, cell.h);
  });

  row.w = w - BOX_BORDER_PX;
  row.h = h;
};

const zoomFactor = function (zoom) {
  return Math.pow(2, zoom/100);
};

const recalculateDeepestInner = function (box) {
  DEEPEST = Math.max(DEEPEST, box.level);
  box.rows.forEach(function (row) {
    row.cells.forEach(function (cell) {
      recalculateDeepestInner(cell);
    });
  });
};

const recalculateDeepest = function (box) {
  DEEPEST = 0;
  if (BOXES.length > 0) {
    recalculateDeepestInner(BOXES[0]);
  }
  updateZoom();
};

const updateAllBoxesInner = function (box) {
  box.rows.forEach(function (row) {
    row.cells.forEach(function (cell) {
      updateAllBoxesInner(cell);
    });
    updateRowCells(row, box);
  });
  updateBoxRows(box, false);
};
const updateAllBoxes = function () {
  recalculateDeepest();
  BOXES.forEach(updateAllBoxesInner);
};

const setZoom = function (newZoom, p) {
  SEMANTIC_ZOOM = newZoom;
  if (p) {
    LAST_ZOOM_COORDS = adjustForPanAndZoom(p);
  } else {
    LAST_ZOOM_COORDS = null;
  }
  ZOOM_CHANGED = true;
  updateZoom();
}

const updateZoom = function() {
  if (SEMANTIC_ZOOM < -ZOOM_LEVEL_PIXELS * DEEPEST) {
    SEMANTIC_ZOOM = -ZOOM_LEVEL_PIXELS * DEEPEST;
  }

  if (SEMANTIC_ZOOM < 0) {
    const nz = SEMANTIC_ZOOM / -ZOOM_LEVEL_PIXELS;
    const rnz = Math.floor(nz);
    SHRINK_CUTOFF = DEEPEST - rnz;
    const s = 1 - (nz - rnz);
    HANDLE_SHRINK_ROLLOFF = s;
    SHRINK_ROLLOFF0 = Math.max(s, SHRINK0);
    SHRINK_ROLLOFF1 = SHRINK0 * lerp01(.25, 1, s);
    SHRINK_ROLLOFF2 = SHRINK0 * lerp01(.0625, .25, s);
  } else {
    SEMANTIC_ZOOM = 0;
    SHRINK_CUTOFF = DEEPEST;
    HANDLE_SHRINK_ROLLOFF = 1;
    SHRINK_ROLLOFF0 = 1;
    SHRINK_ROLLOFF1 = 1;
    SHRINK_ROLLOFF2 = 1;
  }

  requestDraw();
};

const getHandleShrinkage = function (box, noRowBonus) {
  let level = box.level;
  if (box.rows.length !== 0 && !noRowBonus) {
    level ++;
  }

  if (level > SHRINK_CUTOFF) {
    return 0;
  } else if (level === SHRINK_CUTOFF) {
    return HANDLE_SHRINK_ROLLOFF;
  } else {
    return 1;
  }

};

const getTextShrinkage = function (box, noRowBonus) {
  let level = box.level;
  if (box.rows.length !== 0 && !noRowBonus) {
    level ++;
  }

  if (level > SHRINK_CUTOFF + 2) {
    return MIN_SHRINK;
  } else if (level === SHRINK_CUTOFF + 2) {
    return SHRINK_ROLLOFF2; 
  } else if (level === SHRINK_CUTOFF + 1) {
    return SHRINK_ROLLOFF1;
  } else if (level === SHRINK_CUTOFF) {
    return SHRINK_ROLLOFF0;
  } else {
    return 1;
  }

};

const zoomToBox = function (box, touch) {
  if (getHandleShrinkage(box) > TOO_SMALL_THRESH) {
    return;
  }
  let minLevel = DEEPEST - box.level;
  if (box.rows.length !== 0) {
    minLevel --;
  }
  setZoom(-ZOOM_LEVEL_PIXELS * minLevel, touch);
};

const zoomOut = function () {
  recalculateDeepest();
  setZoom(-ZOOM_LEVEL_PIXELS * DEEPEST - 1, null);
};

const adjustForPanAndZoom = function ({x,y}) {
  return {x: x - PAN_TRANSLATE.x,
          y: y - PAN_TRANSLATE.y};
};

const lerp01 = function (start, end, t) {
  return t * (end-start) + start;
};
const lerp = function (start, end, t, tmin, tmax) {
  return lerp01(start, end, (t-tmin)/(tmax-tmin));
};
const roundLerp = function (start, end, t, tmin, tmax, round) {
  return Math.round(lerp(start, end, t, tmin, tmax) * round) / round;
};

const setTextAttributes = function () {
  CNV.context.textAlign = 'center';
  CNV.context.textBaseline = 'middle';
  CNV.context.font = FONT_SIZE + 'px serif';
};

const requestDraw = function () {
  if (!DRAW_REQUEST_IN_FLIGHT) {
    DRAW_REQUEST_IN_FLIGHT = window.requestAnimationFrame(draw);
  }
};

const draw = function () {
  DRAW_REQUEST_IN_FLIGHT = false;

  let zoomTarget = null;
  let zoomTargetDim = null;

  if (ZOOM_CHANGED && LAST_ZOOM_COORDS) {
    // collect information about where the zoom is focused before it updates,
    // so we can center the zoom there
    if (ZOOM_TARGET) {
      zoomTarget = ZOOM_TARGET;
    } else {
      zoomTarget = findIntersectingBox(LAST_ZOOM_COORDS);
    }

    if (zoomTarget &&
        typeof zoomTarget.w === 'number' && typeof zoomTarget.h === 'number') {
      zoomTargetDim = convertToAbsoluteXY(zoomTarget, 0, 0);
      zoomTargetDim.w = zoomTarget.w;
      zoomTargetDim.h = zoomTarget.h;
    }
  }

  // so much easier to just always do this
  if (BOX_CHANGED || ZOOM_CHANGED) {
    updateAllBoxes();
  }
  BOX_CHANGED = false;
  ZOOM_CHANGED = false;

  if (zoomTargetDim) {
    // adjust pan to center on the zoom focus
    const {x: oldx, y: oldy, w: oldw, h: oldh} = zoomTargetDim;
    const {x: newx, y: newy} = convertToAbsoluteXY(zoomTarget, 0, 0);
    const {w: neww, h: newh} = zoomTarget;
    const {x: zx, y: zy}  = LAST_ZOOM_COORDS;
    PAN_TRANSLATE.x += zx - ((zx - oldx) / oldw * neww + newx);
    PAN_TRANSLATE.y += zy - ((zy - oldy) / oldh * newh + newy);
  }

  // setup canvas context for drawing
  CNV.clear();

  setTextAttributes();
  CNV.enterRel({x: PAN_TRANSLATE.x + TEMP_PAN_TRANSLATE.x,
                y: PAN_TRANSLATE.y + TEMP_PAN_TRANSLATE.y});

  BOXES.forEach(drawBox);

  CNV.exitRel();
};

const drawBox = function (box, idx) {
  CNV.enterRel({x: box.x, y: box.y});

  // TODO: detection of clipping, should be easy with rects to see if
  // they are fully clipped

  const levelHue = LEVEL_HUES[box.level % LEVEL_HUES.length];
  let levelLum = roundLerp(92, 80, getHandleShrinkage(box), 1, 0, 4);

  const levelHSL = `hsl(${levelHue},80%,${levelLum}%)`;

  const rectAttrs = {x: 0, y: 0, w: box.w, h: box.h, fill: levelHSL};

  CNV.drawRect(rectAttrs);

  // draw rows, containing cells
  box.rows.forEach(function (row) {
    CNV.enterRel({x: row.x, y: row.y});
    row.cells.forEach(drawBox);
    CNV.exitRel();
  });

  // draw text
  if (typeof box.text === 'string' && box.text.length > 0) {
    const scale = getTextShrinkage(box);
    if (scale > MIN_SHRINK) {
      const adj = (1-scale)/2/scale;
      // TODO: CNVR should support this without two levels, probably just
      // do saving manually
      CNV.enterRel({zoom: scale});
      CNV.enterRel({x: box.w*adj, y: box.h*adj});
      CNV.drawText({x: Math.round(box.w/2),
                  y: Math.round(box.h/2),
                  msg: box.text, fill: '#000000'});
      CNV.exitRel();
      CNV.exitRel();
    }
  }

  // draw warning box
  if (box === TARGET_BOX) {
    CNV.context.lineWidth = TARGET_LINE_WIDTH;

    if (WARN_HOLD) {
      CNV.drawRect(
        {x: 0, y: 0, w: box.w, h: box.h, stroke: WARN_COLOR});
    }
  }

  CNV.exitRel();
};

const startHoldTimeout1 = function () {
  if (typeof HOLD_TIMEOUT1_ID === 'number') {
    window.clearTimeout(HOLD_TIMEOUT1_ID);
  }
  HOLD_TIMEOUT1_ID = window.setTimeout(handleHoldTimeout1, HOLD_TIMEOUT1_MS);
};

const startHoldTimeout2 = function () {
  if (typeof HOLD_TIMEOUT2_ID === 'number') {
    window.clearTimeout(HOLD_TIMEOUT2_ID);
  }
  HOLD_TIMEOUT2_ID = window.setTimeout(handleHoldTimeout2, HOLD_TIMEOUT2_MS);
};

const cancelHoldTimeout = function () {
  WARN_HOLD = false;

  if (typeof HOLD_TIMEOUT1_ID === 'number') {
    window.clearTimeout(HOLD_TIMEOUT1_ID)
    HOLD_TIMEOUT1_ID = null;
  }
  if (typeof HOLD_TIMEOUT2_ID === 'number') {
    window.clearTimeout(HOLD_TIMEOUT2_ID)
    HOLD_TIMEOUT2_ID = null;
  }
};

const handleHoldTimeout1 = function () {
  WARN_HOLD = true;

  requestDraw();

  startHoldTimeout2();
};

const handleHoldTimeout2 = function () {
  if (WARN_HOLD) {
    removeBox(TARGET_BOX);
    TARGET_BOX = null;
    requestDraw();
  }
};

const boxFromString = function (str, level, i) {
  if (i >= str.length) {
    throw 'expected object at end of string';
  }

  const box = {rows:[], level};

  if (str[i] === ID_SYM) {
    // id
    let idDone = false;
    let idStr = '';
    i++;
    while (!idDone && i < str.length) {
      switch (str[i]) {
        case ESC_SYM:
          i++;
          if (i < str.length) {
            idStr += str[i++];
          } else {
            throw 'escape char at end of string';
          }
          break;
        case OPEN_SYM: case CLOSE_SYM: case ROW_SYM: case ID_SYM:
          idDone = true;
          break;
        default:
          idStr += str[i++];
      }
    }

    tagBox(box, idStr);
    return {box, i};
  } else if (str[i] !== OPEN_SYM) {
    throw 'missing ' + OPEN_SYM + ' or ' + ID_SYM + ' at start of object';
  }

  // list
  i++;

  let curRow = null;

  while (i < str.length) {
    switch (str[i]) {
      case CLOSE_SYM:
        i++;
        if (curRow && curRow.cells.length === 0) {
          throw 'empty last row';
        }
        if (box.rows.length > 0) {
          // row and cell indexes
          reindexRows(box.rows);
        }
        return {box, i};
      case ROW_SYM:
        i++;
        if (!curRow) {
          throw ROW_SYM + ' without previous row';
        } else if (curRow.cells.length === 0) {
          throw 'empty row';
        }
        curRow = {cells: []};
        box.rows.push(curRow);
        break;
      case OPEN_SYM:
      case ID_SYM:
        // either of these signify a whole object
        if (!curRow) {
          curRow = {cells: []};
          box.rows.push(curRow);
        }
        let childBox;
        ({box: childBox, i} = boxFromString(str, level + 1, i));
        childBox.under = box;
        curRow.cells.push(childBox);
        break;
     default:
        throw "unexpected character '" + str[i] + "'";
    }
  }

  throw 'unexpected end of string';
};
const loadFromHash = function () {
  let hash = window.location.hash;
  if (typeof hash === 'string' && hash.length > 1 && hash[0] === '#') {
    try {
      hash = decodeURIComponent(hash.substring(1));
    } catch (e) {
      console.log('load error: decodeURIComponent failed');
      return;
    }
    let box = null;
    let i = 0;
    try {
      ({i, box} = boxFromString(hash, 0, i));
    } catch (e) {
      console.log('load error: boxFromString threw ' + e);
      return;
    }
    if (box) {
      resetGlobals();
      if (i !== hash.length) {
        console.log('load error: trailing characters')
      } else {
        // make up position for a restored box
        BOXES = [box];
        box.x = 0;
        box.y = 0;
        reindexBoxes();
        zoomOut();
        setZoom(SEMANTIC_ZOOM + ZOOM_LEVEL_PIXELS);
        updateAllBoxes();
        box.x = (window.innerWidth - box.w)/2;
        box.y = (window.innerHeight - box.h)/2;

        BOX_CHANGED = true;
        requestDraw();

        updateSaveHash();
      }
    }
  }
};

const escapeSaveString = function (str) {
  let outStr = '';

  for (let i = 0; i < str.length; i++) {
    switch (str[i]) {
      case OPEN_SYM: case CLOSE_SYM: case ROW_SYM: case ID_SYM: case ESC_SYM:
        outStr += ESC_SYM + str[i];
        break;
      default:
        outStr += str[i];
    }
  }

  return outStr;
};

const stringFromBox = function (box) {
  if (typeof box.text === 'string' && box.text !== '') {
    return ID_SYM + escapeSaveString(box.text);
  }

  let str = OPEN_SYM;

  box.rows.forEach(function (row, rowIdx) {
    if (rowIdx !== 0) {
      str += ROW_SYM;
    }
    row.cells.forEach(function (cell) {
      str += stringFromBox(cell);
    });
  });

  return str + CLOSE_SYM;
};

const updateSaveHash = function () {
  let str = '';
  if (BOXES.length > 0) {
    str = stringFromBox(BOXES[0]);
  }

  SAVE_HASH = '#' + encodeURIComponent(str);
};


const promptText = function (init, cb) {
  if (typeof init !== 'string') {
    init = '';
  }

  if (CANCEL_PROMPT) {
    CANCEL_PROMPT();
  }

  PROMPT_FORM.style.visibility = 'visible';

  const submitHandler = function (e) {
    const value = PROMPT_INPUT.value;
    cancelPromptText(submitHandler);
    PROMPT_INPUT.blur();
    e.preventDefault();

    cb(value);
  };

  PROMPT_FORM.addEventListener('submit', submitHandler);

  PROMPT_INPUT.value = init;
  PROMPT_INPUT.focus();

  CANCEL_PROMPT = () => cancelPromptText(submitHandler);
};

const cancelPromptText = function (submitHandler) {
  PROMPT_INPUT.blur();
  PROMPT_INPUT.value = '';
  PROMPT_FORM.style.visibility = 'hidden'
  PROMPT_FORM.removeEventListener('submit', submitHandler);
  CANCEL_PROMPT = null;
};

const tagBox = function (box, text) {
  if (typeof text === 'string' && text !== '') {
    box.text = text;
    setTextAttributes();
    box.textWidth = Math.max(MIN_TEXT_WIDTH, CNV.context.measureText(text).width);
  } else {
    delete box.text;
    delete box.textWidth;
  }
  BOX_CHANGED = true;
  requestDraw();
};

// main code starts here

resetGlobals();
loadFromHash();

GET_TOUCHY(CNV.element, {
  touchStart: function (p) {
    if (CANCEL_PROMPT) {
      CANCEL_PROMPT();
    }
    // TOUCH_ORIGIN is in absolute screen units
    TOUCH_ORIGIN = {x: p.x, y: p.y};

    const {x, y} = adjustForPanAndZoom(TOUCH_ORIGIN);

    TARGET_BOX = findIntersectingBox({x, y});

    if (TARGET_BOX) {
      if (getHandleShrinkage(TARGET_BOX) < TOO_SMALL_THRESH) {
        ZOOMING_BOX = TARGET_BOX;
        TARGET_BOX = null;
      } else {
        startHoldTimeout1();
      }
    }

    requestDraw();
  },
  touchMove: function (p) {
    const dist = Math.sqrt(
      Math.pow(TOUCH_ORIGIN.x - p.x, 2) + Math.pow(TOUCH_ORIGIN.y - p.y, 2));

    if (!PANNING && dist >= PAN_DIST) {
      PANNING = true;
      cancelHoldTimeout();

      TARGET_BOX = null;
      ZOOMING_BOX = null;
    }

    if (PANNING) {
      TEMP_PAN_TRANSLATE.x = p.x - TOUCH_ORIGIN.x;
      TEMP_PAN_TRANSLATE.y = p.y - TOUCH_ORIGIN.y;
    }
    requestDraw();
  },
  touchEnd: function (p) {
    if (PANNING) {
      TEMP_PAN_TRANSLATE.x = p.x - TOUCH_ORIGIN.x;
      TEMP_PAN_TRANSLATE.y = p.y - TOUCH_ORIGIN.y;

      PAN_TRANSLATE.x += TEMP_PAN_TRANSLATE.x;
      PAN_TRANSLATE.y += TEMP_PAN_TRANSLATE.y;

      TEMP_PAN_TRANSLATE.x = 0;
      TEMP_PAN_TRANSLATE.y = 0;

      PANNING = false;
    } else if (WARN_HOLD) {
      //
    } else if (ZOOMING_BOX) {
        zoomToBox(ZOOMING_BOX, TOUCH_ORIGIN);
        ZOOMING_BOX = null;
    } else {
      if (TARGET_BOX) {
        // a box has been targeted, what to do?
        if (TARGET_BOX.rows.length === 0) {
          // nothing is in this box yet, give a chance to enter text
          const targetBoxCopy = TARGET_BOX;
          promptText(TARGET_BOX.text, function (text) {
            tagBox(targetBoxCopy, text);
            if (text.length === 0) {
              // position doesn't matter with the second param set
              createNewBox({x:0,y:0}, targetBoxCopy);
            }
          });

        } else {
          // box already has rows, just create a box under this one
          // no prompt
          createNewBox(adjustForPanAndZoom(TOUCH_ORIGIN), TARGET_BOX);
        }

      } else if (BOXES.length === 0) {
        // nothing targeted, no existing boxes, make a top level box
        // no prompt
        if (!WARN_HOLD) {
          createNewBox(adjustForPanAndZoom(TOUCH_ORIGIN));
        }
      }
      // do nothing if a click lands nowhere when there are alredy boxes
    }

    TARGET_BOX = null;

    cancelHoldTimeout();
    requestDraw();
  },
  touchCancel: function () {
    if (PANNING) {
      PAN_TRANSLATE.x += TEMP_PAN_TRANSLATE.x;
      PAN_TRANSLATE.y += TEMP_PAN_TRANSLATE.y;

      TEMP_PAN_TRANSLATE.x = 0;
      TEMP_PAN_TRANSLATE.y = 0;

      PANNING = false;
    } else if (WARN_HOLD) {
      //
    } else if (ZOOMING_BOX) {
      ZOOMING_BOX = null;
    } else {
      TARGET_BOX = null;
    }

    cancelHoldTimeout();
  },

  pinchStart: function (touch1, touch2) {
    let x = (touch1.x + touch2.x) / 2;
    let y = (touch1.y + touch2.y) / 2;
    PINCH_DISTANCE =
      Math.sqrt(Math.pow(touch1.x - touch2.x, 2) +
                Math.pow(touch1.y - touch2.y, 2));
    TOUCH_ORIGIN = {x, y};
    ZOOM_TARGET = findIntersectingBox(LAST_ZOOM_COORDS);
  },

  pinchMove: function (touch1, touch2) {
    let dist =
      Math.sqrt(Math.pow(touch1.x - touch2.x, 2) +
                Math.pow(touch1.y - touch2.y, 2));
    let delta = dist - PINCH_DISTANCE;
    setZoom(SEMANTIC_ZOOM + delta, TOUCH_ORIGIN);

    PINCH_DISTANCE = dist;
  },

  pinchEnd: function (touch1, touch2) {
    PINCH_DISTANCE = null;
    ZOOM_TARGET = null;
  },

});

window.addEventListener('resize', function () {
  CNV.setupCanvas();
  requestDraw();
});

window.addEventListener('wheel', function (e) {
  const mx = e.pageX;
  const my = e.pageY;
  let delta = e.deltaY;

  if (e.deltaMode === 0x01) {
    delta *= FONT_SIZE * 1.5;
  }
  if (e.deltaMode === 0x02) {
    delta *= FONT_SIZE * 15;
  }

  setZoom(SEMANTIC_ZOOM - delta, {x: mx, y: my});
});

window.addEventListener('hashchange', function () {
  updateSaveHash();
  if (window.location.hash !== SAVE_HASH) {
    loadFromHash();
  }
});

SAVE_LINK.addEventListener('click', function (e) {
  updateSaveHash();
  window.history.replaceState(undefined, undefined, SAVE_HASH);
  e.preventDefault();
});

})();
