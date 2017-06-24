(function () {
'use strict';

const CNV = CNVR(document.getElementById('cnv'));

let BOXES;
let BOX_CHANGED;
let PANNING;
let PAN_TRANSLATE;
let TEMP_PAN_TRANSLATE;
let DRAW_REQUEST_IN_FLIGHT;
let TOUCH_ORIGIN;
let TARGET_BOX;
let SAVE_HASH;
let CANCEL_PROMPT;

let ZOOM_STATS;
let ZOOMING_BOX;
let PINCH_DISTANCE;
let ZOOM_TARGET;

let CURSOR_BEFORE_BOX;
let CURSOR_AFTER_BOX;
let CURSOR_INSIDE_BOX;

let CLIPBOARD;
let CLIPBOARD_CNV;

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
  TARGET_BOX = null;
  SAVE_HASH = '#';
  CANCEL_PROMPT = null;

  ZOOM_STATS = {};
  ZOOMING_BOX = null;
  PINCH_DISTANCE = null;
  ZOOM_TARGET = null;

  CURSOR_BEFORE_BOX = null;
  CURSOR_AFTER_BOX = null;
  CURSOR_INSIDE_BOX = null;

  CLIPBOARD = [];
  CLIPBOARD_CNV = null;
};

const HOLD_TIMEOUT1_MS = 500;
const HOLD_TIMEOUT2_MS = 500;
const PAN_DIST = 20;
const HANDLE_WIDTH = 40;
const BOX_BORDER = 4;
const EMPTY_WIDTH = 120;
const EMPTY_BOX_WIDTH = EMPTY_WIDTH + 2 * BOX_BORDER;
const EMPTY_BOX_HEIGHT = HANDLE_WIDTH + 2 * BOX_BORDER;
const MIN_TEXT_WIDTH = HANDLE_WIDTH;
const LEVEL_HUES = [[240],[0]];
const TEXT_COLOR = '#000000';
const FONT_SIZE = 18;
const ZOOM_LEVEL_PIXELS = 80;
const SHRINK0 = 1/2;
const MIN_SHRINK = SHRINK0/16;
const TOO_SMALL_THRESH = 0.75;

const SELECTION_LINE_COLOR = '#808080';
const SELECTED_LINE_WIDTH = 2;

const PROMPT_INPUT = document.getElementById('prompt-input');
const PROMPT_FORM = document.getElementById('prompt-form');
const PROMPT_MSG = document.getElementById('prompt-msg');
const PROMPT = document.getElementById('prompt');

const CLIPBOARD_MAX_LENGTH = 10;
const CLIPBOARD_SPACING = 50;

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
  deepest: the deepest level in this subtree
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
        const ibx = x - b.x;
        const iby = y - b.y;
        const rxm = r.x + r.w;
        const rym = r.y + r.h;
        if (ibx >= r.x && ibx < rxm && iby >= r.y && iby < rym) {
          const child =
            findIntersectingBox({x: ibx - r.x, y: iby - r.y,
                                 boxes: r.cells});
          if (child) {
            return child;
          }
        }
      }

      return b;
    }
  }

  return null;
};

const convertToBoxXY = function (box, {x, y}) {
  if (box.under) {
    const row = box.under.rows[box.rowIdx];
    x -= box.x + row.x;
    y -= box.y + row.y;
    return convertToBoxXY(box.under, {x, y});
  }
  return {x: x - box.x, y: y - box.y};
};

const convertToAbsoluteXY = function (box, {x, y}) {
  if (box.under) {
    const row = box.under.rows[box.rowIdx];
    x += box.x + row.x;
    y += box.y + row.y;
    return convertToAbsoluteXY(box.under, {x, y});
  }
  return {x: x + box.x, y: y + box.y}
};

const createBox = function (p, under = null) {
  const newBox = {x: 0, y: 0, rows: [], under, level: 0};

  if (under) {
    newBox.level = under.level + 1;
  } else {
    BOXES.push(newBox);
    newBox.idx = BOXES.indexOf(newBox);
  }

  newBox.w = EMPTY_BOX_WIDTH;
  newBox.h = EMPTY_BOX_HEIGHT;

  if (p) {
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

const updateBoxRows = function (zoom, box, callUp = true) {
  // Set position for the rows of this box based on their sizes, then set the
  // size of this box from that.
  // Also calls up to update the parent box since this box's size could
  // have changed (updateRowCells on the row this box is in and updateBoxRows
  // on the parent box)

  const hs = getHandleShrinkage(zoom, box);
  const handle = HANDLE_WIDTH * hs;
  let w = 0;
  let h = BOX_BORDER;

  box.rows.forEach(function (row) {
    row.x = BOX_BORDER + handle;
    row.y = h;

    w = Math.max(w, row.w);
    h += row.h + BOX_BORDER;
  });

  if (box.rows.length === 0) {
    const s = getTextShrinkage(zoom, box);
    if (typeof box.textWidth === 'number') {
      box.w = BOX_BORDER * 2 + (FONT_SIZE + box.textWidth) * s;
      box.h = BOX_BORDER * 2 + FONT_SIZE * 1.5 * s;
    } else {
      box.w = EMPTY_BOX_WIDTH * s;
      box.h = EMPTY_BOX_HEIGHT * s;
    }
  } else {
    box.w = w + 2 * (BOX_BORDER + handle);
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

    w += cell.w;
    h = Math.max(h, cell.h);
  });

  row.w = w;
  row.h = h;
};

const recalculateDeepestInner = function (box, depth) {
  box.level = depth;
  let deepest = depth;
  box.rows.forEach(function (row) {
    row.cells.forEach(function (cell) {
      deepest = Math.max(deepest, recalculateDeepestInner(cell, depth + 1));
    });
  });
  box.deepest = deepest;
  return deepest;
};

const recalculateDeepest = function (zoom, box) {
  recalculateDeepestInner(box, 0);
  updateZoom(zoom, box);
};

const updateAllBoxesInner = function (zoom, box) {
  box.rows.forEach(function (row) {
    row.cells.forEach(function (cell) {
      updateAllBoxesInner(zoom, cell);
    });
    updateRowCells(row, box);
  });
  updateBoxRows(zoom, box, false);
};

const updateAllBoxes = function () {
  if (BOXES.length > 0) {
    recalculateDeepest(ZOOM_STATS, BOXES[0]);
  }
  BOXES.forEach(b => updateAllBoxesInner(ZOOM_STATS, b));
};

const setZoom = function (zoom, root, newZoom, p) {
  zoom.zoom = newZoom;
  if (p) {
    zoom.lastCoords = adjustForPanAndZoom(p);
  } else {
    zoom.lastCoords = null;
  }
  zoom.changed = true;
  updateZoom(zoom, root);

  return zoom;
}

const updateZoom = function(zoom, root) {
  if (zoom.zoom < -ZOOM_LEVEL_PIXELS * root.deepest) {
    zoom.zoom = -ZOOM_LEVEL_PIXELS * root.deepest;
  }

  if (zoom.zoom < 0) {
    const nz = zoom.zoom / -ZOOM_LEVEL_PIXELS;
    const rnz = Math.floor(nz);
    zoom.shrinkCutoff = root.deepest - rnz;
    const s = 1 - (nz - rnz);
    zoom.handleShrinkRolloff = s;
    zoom.shrinkRolloff0 = Math.max(s, SHRINK0);
    zoom.shrinkRolloff1 = SHRINK0 * lerp01(.25, 1, s);
    zoom.shrinkRolloff2 = SHRINK0 * lerp01(.0625, .25, s);
  } else {
    zoom.zoom = 0;
    zoom.shrinkCutoff = root.deepest;
    zoom.handleShrinkRolloff = 1;
    zoom.shrinkRolloff0 = 1;
    zoom.shrinkRolloff1 = 1;
    zoom.shrinkRolloff2 = 1;
  }

  requestDraw();
};

const getHandleShrinkage = function (zoom, box, noRowBonus) {
  let level = box.level;
  if (box.rows.length !== 0 && !noRowBonus) {
    level ++;
  }

  if (level > zoom.shrinkCutoff) {
    return 0;
  } else if (level === zoom.shrinkCutoff) {
    return zoom.handleShrinkRolloff;
  } else {
    return 1;
  }

};

const getTextShrinkage = function (zoom, box, noRowBonus) {
  let level = box.level;
  if (box.rows.length !== 0 && !noRowBonus) {
    level ++;
  }

  if (level > zoom.shrinkCutoff + 2) {
    return MIN_SHRINK;
  } else if (level === zoom.shrinkCutoff + 2) {
    return zoom.shrinkRolloff2;
  } else if (level === zoom.shrinkCutoff + 1) {
    return zoom.shrinkRolloff1;
  } else if (level === zoom.shrinkCutoff) {
    return zoom.shrinkRolloff0;
  } else {
    return 1;
  }

};

const zoomToBox = function (zoom, root, box, touch) {
  if (getHandleShrinkage(zoom, box) > TOO_SMALL_THRESH) {
    return;
  }
  let minLevel = root.deepest - box.level;
  if (box.rows.length !== 0) {
    minLevel --;
  }
  setZoom(zoom, root, -ZOOM_LEVEL_PIXELS * minLevel, touch);
};

const zoomOut = function (zoom, root) {
  recalculateDeepest(zoom, root);
  setZoom(zoom, root, -ZOOM_LEVEL_PIXELS * root.deepest - 1, null);
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

const setTextAttributes = function (cnv) {
  cnv.context.textAlign = 'center';
  cnv.context.textBaseline = 'middle';
  cnv.context.font = FONT_SIZE + 'px serif';
};

const requestDraw = function () {
  if (!DRAW_REQUEST_IN_FLIGHT) {
    DRAW_REQUEST_IN_FLIGHT = window.requestAnimationFrame(draw);
  }
};

const draw = function () {
  DRAW_REQUEST_IN_FLIGHT = false;

  // TODO: we could get here with boxes in a bad state before updateAllBoxes,
  // everything before that should be made to expect it
  let zoomTargetDim = null;
  let rootDim = null;

  if (BOXES.length > 0) {
    rootDim = convertToAbsoluteXY(BOXES[0], {x: BOXES[0].w/2, y: BOXES[0].h/2});
  }

  if (ZOOM_STATS.changed && ZOOM_STATS.lastCoords) {
    // collect information about where the zoom is focused before it updates,
    // so we can center the zoom there

    if (ZOOM_TARGET &&
        typeof ZOOM_TARGET.w === 'number' &&
        typeof ZOOM_TARGET.h === 'number') {
      zoomTargetDim = convertToAbsoluteXY(ZOOM_TARGET, {x: 0, y: 0});
      zoomTargetDim.w = ZOOM_TARGET.w;
      zoomTargetDim.h = ZOOM_TARGET.h;
    }
  }

  // so much easier to just always do this
  if (BOX_CHANGED || ZOOM_STATS.changed) {
    updateAllBoxes();
  }
  BOX_CHANGED = false;
  ZOOM_STATS.changed = false;

  if (zoomTargetDim) {
    // adjust pan to center on the zoom focus
    const {x: oldx, y: oldy, w: oldw, h: oldh} = zoomTargetDim;
    const {x: newx, y: newy} = convertToAbsoluteXY(ZOOM_TARGET, {x: 0, y: 0});
    const {w: neww, h: newh} = ZOOM_TARGET;
    const {x: zx, y: zy}  = ZOOM_STATS.lastCoords;
    PAN_TRANSLATE.x += zx - ((zx - oldx) / oldw * neww + newx);
    PAN_TRANSLATE.y += zy - ((zy - oldy) / oldh * newh + newy);
  } else if (rootDim) {
    const rootNow = convertToAbsoluteXY(BOXES[0], {x: BOXES[0].w/2, y: BOXES[0].h/2});
    PAN_TRANSLATE.x += rootDim.x - rootNow.x;
    PAN_TRANSLATE.y += rootDim.y - rootNow.y;
  }

  // setup canvas context for drawing
  CNV.clear();

  setTextAttributes(CNV);
  CNV.enterRel({x: PAN_TRANSLATE.x + TEMP_PAN_TRANSLATE.x,
                y: PAN_TRANSLATE.y + TEMP_PAN_TRANSLATE.y});

  // draw boxes
  BOXES.forEach(b => drawBox(CNV, ZOOM_STATS, b));

  // draw cursor (except for inside cursor, done below with selection box)
  if (CURSOR_BEFORE_BOX || CURSOR_AFTER_BOX) {
    let box, cursorAttrs;
    if (CURSOR_BEFORE_BOX) {
      box = CURSOR_BEFORE_BOX;
      cursorAttrs = convertToAbsoluteXY(box, {x: 0, y: 0});
    } else {
      box = CURSOR_AFTER_BOX;
      cursorAttrs = convertToAbsoluteXY(box, {x: box.w, y: 0});
    }
    cursorAttrs.w = BOX_BORDER;
    cursorAttrs.h = box.h;
    if (box.under) {
      const cells = box.under.rows[box.rowIdx].cells;
      if (CURSOR_BEFORE_BOX && box.idx > 0) {
        const prevBox = cells[box.idx-1];
        cursorAttrs.h = Math.max(prevBox.h, cursorAttrs.h);
      }
    }

    cursorAttrs.stroke = SELECTION_LINE_COLOR;
    CNV.context.lineWidth = BOX_BORDER;

    // TODO: should just be a drawline
    CNV.drawRect(cursorAttrs);
  }

  // draw selection box (shows where deletion or insertion will take place,
  // when this coincides with an existing box)
  if (CURSOR_BEFORE_BOX) {
    const box = CURSOR_BEFORE_BOX;
    const attrs = convertToAbsoluteXY(box, {x: BOX_BORDER, y: 0});
    attrs.w = box.w - BOX_BORDER;
    attrs.h = box.h;
    attrs.stroke = SELECTION_LINE_COLOR;
    CNV.context.lineWidth = SELECTED_LINE_WIDTH;
    CNV.drawRect(attrs);
  } else if (CURSOR_INSIDE_BOX) {
    // TODO: should be a line
    const box = CURSOR_INSIDE_BOX;
    const cursorAttrs = convertToAbsoluteXY(box,
      {x: box.w / 2, y: BOX_BORDER});
    cursorAttrs.w = BOX_BORDER;
    cursorAttrs.h = box.h - BOX_BORDER * 2;
    cursorAttrs.stroke = SELECTION_LINE_COLOR;
    CNV.context.lineWidth = BOX_BORDER; 
    CNV.drawRect(cursorAttrs);
  }


  CNV.exitRel();
};

const drawClipboard = function (clipboard, cnv) {
  const positions = [];

  setTextAttributes(cnv);

  const w = cnv.element.width;
  let y = cnv.element.height - CLIPBOARD_SPACING;

  for (let i = clipboard.length - 1; i >= 0; i --) {
    const str = clipboard[i];
    const {box} = boxFromString(str, 0, 0);
    const clipZoom = {}

    zoomOut(clipZoom, box);
    setZoom(clipZoom, box, clipZoom.zoom + ZOOM_LEVEL_PIXELS);
    updateAllBoxesInner(clipZoom, box);

    box.x = (w - box.w) / 2;
    box.y = y - box.h;

    positions.push({miny: box.y, maxy: y, box: box});

    drawBox(cnv, clipZoom, box);

    y -= box.h + CLIPBOARD_SPACING;

    if (y < 0) {
      break;
    }
  }

  return positions;
};

const drawBox = function (cnv, zoom, box) {
  cnv.enterRel({x: box.x, y: box.y});

  // TODO: detection of clipping, should be easy with rects to see if
  // they are fully clipped

  const levelHue = LEVEL_HUES[box.level % LEVEL_HUES.length];
  let levelLum = roundLerp(92, 80, getHandleShrinkage(zoom, box), 1, 0, 4);

  const levelHSL = `hsl(${levelHue},80%,${levelLum}%)`;

  const rectAttrs = {x: BOX_BORDER, y: 0, w: box.w-BOX_BORDER, h: box.h, fill: levelHSL};

  cnv.drawRect(rectAttrs);

  // draw rows, containing cells
  box.rows.forEach(function (row) {
    cnv.enterRel({x: row.x, y: row.y});
    row.cells.forEach(c => drawBox(cnv, zoom, c));
    cnv.exitRel();
  });

  // draw text
  if (isTaggedBox(box)) {
    const scale = getTextShrinkage(zoom, box);
    if (scale > MIN_SHRINK) {
      // TODO: document this, I've already forgotten how it works
      const adj = (1-scale)/2/scale;
      // TODO: CNVR should support this without two levels, probably just
      // do saving manually
      cnv.enterRel({zoom: scale});
      cnv.enterRel({x: (box.w+BOX_BORDER)*adj, y: box.h*adj});
      cnv.drawText({x: (box.w+BOX_BORDER)/2, y: box.h/2,
                  msg: box.text, fill: TEXT_COLOR});
      cnv.exitRel();
      cnv.exitRel();
    }
  }

  cnv.exitRel();
};

const cursorBeforeOrAfter = function () {
  return CURSOR_BEFORE_BOX ? CURSOR_BEFORE_BOX : CURSOR_AFTER_BOX;
};

const cursorBeforeOrAfterOrInside = function () {
  return CURSOR_INSIDE_BOX ? CURSOR_INSIDE_BOX : cursorBeforeOrAfter();
};

const setCursorBeforeBox = function (box) {
  CURSOR_BEFORE_BOX = box;
  CURSOR_AFTER_BOX = null;
  CURSOR_INSIDE_BOX = null;

  updateKeyboard();
  
  requestDraw();
};

const setCursorAfterBox = function (box) {
  CURSOR_AFTER_BOX = box;
  CURSOR_BEFORE_BOX = null;
  CURSOR_INSIDE_BOX = null;

  let changedToBefore = false;

  if (box && box.under) {
    const cells = box.under.rows[box.rowIdx].cells;
    if (box.idx + 1 < cells.length) {
      setCursorBeforeBox(cells[box.idx + 1]);
      changedToBefore = true;
    }
  }

  if (!changedToBefore) {
    updateKeyboard();

    requestDraw();
  }
};

const setCursorInsideBox = function (box) {
  CURSOR_INSIDE_BOX = box;
  CURSOR_BEFORE_BOX = null;
  CURSOR_AFTER_BOX = null;

  updateKeyboard();

  requestDraw();
}

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
        zoomOut(ZOOM_STATS, box);
        setZoom(ZOOM_STATS, box, ZOOM_STATS.zoom + ZOOM_LEVEL_PIXELS);
        updateAllBoxes();
        box.x = (CNV.element.width - box.w)/2;
        box.y = (CNV.element.height - box.h)/2;

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
  if (isTaggedBox(box)) {
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

const save = function () {
  updateSaveHash();
  window.history.replaceState(undefined, undefined, SAVE_HASH);
};

const storeCut = function (box) {
  const str = stringFromBox(box)

  CLIPBOARD.push(str);
  while (CLIPBOARD.length > CLIPBOARD_MAX_LENGTH) {
    CLIPBOARD.shift();
  }
};

const promptText = function (init, msg, cb, cbc) {
  if (typeof init !== 'string') {
    init = '';
  }

  if (CANCEL_PROMPT) {
    CANCEL_PROMPT();
  }

  PROMPT_MSG.textContent = msg;
  PROMPT.style.visibility = 'visible';

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

  CANCEL_PROMPT = function () {
    cancelPromptText(submitHandler);
    if (!!cbc) {
      cbc();
    }
  };
};

const cancelPromptText = function (submitHandler) {
  PROMPT_INPUT.blur();
  PROMPT_INPUT.value = '';
  PROMPT.style.visibility = 'hidden'
  PROMPT_FORM.removeEventListener('submit', submitHandler);
  CANCEL_PROMPT = null;
};

const isTaggedBox = function (box) {
  return typeof box.text === 'string' && box.text !== '';
}

const tagBox = function (box, text) {
  if (typeof text === 'string' && text !== '') {
    box.text = text;
    setTextAttributes(CNV);
    box.textWidth = Math.max(MIN_TEXT_WIDTH, CNV.context.measureText(text).width);
  } else {
    delete box.text;
    delete box.textWidth;
  }
  BOX_CHANGED = true;
  requestDraw();
};

const insertTaggedBox = function (text) {
  if (CURSOR_INSIDE_BOX) {
    const box = CURSOR_INSIDE_BOX;
    if (box.rows.length !== 0) {
      throw 'should only be inside empty box';
    }
    const newBox = createBox(null, box);
    tagBox(newBox, text);

    const newRow = {cells: [newBox]}
    box.rows.push(newRow);
    newBox.rowIdx = 0;
    newBox.idx = 0;

    setCursorAfterBox(newBox);
    return;
  }

  const box = cursorBeforeOrAfter();
  const newBox = createBox(null, box.under);
  const cells = box.under.rows[box.rowIdx].cells;
  tagBox(newBox, text);
      
  if (CURSOR_BEFORE_BOX) {
    cells.splice(box.idx, 0, newBox);
  } else {
    cells.splice(box.idx + 1, 0, newBox);
  }
  newBox.rowIdx = box.rowIdx;
  reindexBoxes(cells);

  setCursorAfterBox(newBox);
};

const keyNewBox = function () {
  if (CURSOR_INSIDE_BOX) {
    const box = CURSOR_INSIDE_BOX;
    if (box.rows.length !== 0) {
      throw 'should only be inside empty box';
    }
    const newBox = createBox(null, box);

    const newRow = {cells: [newBox]};
    box.rows.push(newRow);
    newBox.rowIdx = 0;
    newBox.idx = 0;

    setCursorInsideBox(newBox);
    return;
  }

  const box = cursorBeforeOrAfter();
  if (!box || !box.under) {
    return;
  }

  const newBox = createBox(null, box.under);
  const cells = box.under.rows[box.rowIdx].cells;

  if (CURSOR_BEFORE_BOX) {
    cells.splice(box.idx, 0, newBox);
  } else {
    cells.splice(box.idx + 1, 0, newBox);
  }
  newBox.rowIdx = box.rowIdx
  reindexBoxes(cells);

  setCursorInsideBox(newBox);
};

const keyType = function () {
  let box = cursorBeforeOrAfterOrInside();
  if (!box || (!CURSOR_INSIDE_BOX && !box.under)) {
    return;
  }

  if (CURSOR_INSIDE_BOX && isTaggedBox(box)) {
      promptText(box.text, 'Edit text', function (text) {
        tagBox(box, text);
        setCursorInsideBox(box);
      });
      return;
  }

  promptText('', 'Enter text', function (text) {
    insertTaggedBox(text);
  });
};

const keyTypeWords = function () {
  const box = cursorBeforeOrAfterOrInside();
  if (!box) {
    return;
  }
  if (CURSOR_INSIDE_BOX && isTaggedBox(box)) {
    return;
  }
  if (!CURSOR_INSIDE_BOX && !box.under) {
    return;
  }

  promptText('', 'Enter text, space separated', function (text) {
    text.split(' ').forEach(insertTaggedBox);
  });
};

const keyNewRow = function () {
  const box = cursorBeforeOrAfter();
  if (!box || !box.under) {
    return;
  }

  const cells = box.under.rows[box.rowIdx].cells;
  if (CURSOR_AFTER_BOX || box.idx === 0) {
    // create a new row with one empty node
    const newBox = createBox(null, box.under);
    const newRow = {cells: [newBox]};

    if (CURSOR_AFTER_BOX) {
      // new row is now after cursor row
      box.under.rows.splice(box.rowIdx + 1, 0, newRow);
    } else {
      // new row is now before cursor row
      box.under.rows.splice(box.rowIdx, 0, newRow);
    }

    reindexRows(box.under.rows);
    if (CURSOR_AFTER_BOX) {
      setCursorBeforeBox(newBox);
    } else {
      setCursorBeforeBox(box);
    }

    BOX_CHANGED = true;
    return;
  }

  let split = box.idx;

  const first = cells.slice(0, split);
  const second = cells.slice(split);

  box.under.rows[box.rowIdx] = {cells: first};
  box.under.rows.splice(box.rowIdx + 1, 0, {cells: second});

  reindexRows(box.under.rows);

  setCursorBeforeBox(box);

  BOX_CHANGED = true;

  requestDraw();

};

const handleDepthChangeForDelete = function (box) {
  // assume here we can't delete BOXES[0]
  if (box.deepest === BOXES[0].deepest) {
    recalculateDeepestInner(BOXES[0], 0);
    if (box.deepest > BOXES[0].deepest) {
      // deleted deepest

      setZoom(ZOOM_STATS, BOXES[0], ZOOM_STATS.zoom +
                ZOOM_LEVEL_PIXELS * (box.deepest - BOXES[0].deepest));
    }
  }
}

const keyDel = function () {
  const box = cursorBeforeOrAfterOrInside();
  if (!box || !box.under) {
    return;
  }

  const cells = box.under.rows[box.rowIdx].cells;
  if (CURSOR_AFTER_BOX) {
    // delete a row break if possible
    if (box.rowIdx === box.under.rows.length - 1) {
      // nothing after the last row
      return;
    }

    const cells2 = box.under.rows[box.rowIdx+1].cells;
    box.under.rows.splice(box.rowIdx, 2, {cells: cells.concat(cells2)});

    reindexRows(box.under.rows);
    setCursorAfterBox(CURSOR_AFTER_BOX);
    BOX_CHANGED = true;
    requestDraw();

    return;
  }

  if (cells.length === 1) {
    // deleting the only cell in this row, rows can't be empty so delete row
    box.under.rows.splice(box.rowIdx, 1);

    reindexRows(box.under.rows);

    storeCut(box);

    if (box.under.rows.length > box.rowIdx) {
      setCursorBeforeBox(box.under.rows[box.rowIdx].cells[0]);
    } else {
      setCursorBeforeBox(null);
    }

    handleDepthChangeForDelete(box);

    BOX_CHANGED = true;

    requestDraw();

    return;
  }

  // normal deletion
  cells.splice(box.idx, 1);

  reindexBoxes(cells);

  storeCut(box);

  if (box.idx < cells.length) {
    setCursorBeforeBox(cells[box.idx]);
  } else {
    setCursorAfterBox(cells[cells.length - 1]);
  }

  handleDepthChangeForDelete(box);

  BOX_CHANGED = true;

  requestDraw();
  return;
};

const keyPaste = function () {
  CLIPBOARD_CNV = CNVR(document.getElementById('clipboard'));
  const cnv = CLIPBOARD_CNV;
  cnv.element.style.visibility = 'visible';
  cnv.drawRect({x:0, y:0, w: cnv.element.width, h: cnv.element.height, fill: 'white'});

  const positions = drawClipboard(CLIPBOARD, cnv);

  cnv.element.addEventListener('click',function clickListener (e) {
    CLIPBOARD_CNV = null;
    cnv.element.removeEventListener('click', clickListener);
    cnv.element.style.visibility = 'hidden';


    let pasteBox = null;
    for (let j = 0; !pasteBox && j < positions.length; j ++) {
      if (e.pageY >= positions[j].miny && e.pageY < positions[j].maxy) {
        pasteBox = positions[j].box;
      }
    }

    if (pasteBox) {
      if (CURSOR_INSIDE_BOX && !isTaggedBox(CURSOR_INSIDE_BOX)) {
        pasteBox.under = CURSOR_INSIDE_BOX;
        const newRow = {cells: [pasteBox]};
        CURSOR_INSIDE_BOX.rows.push(newRow);
        pasteBox.rowIdx = 0;
        pasteBox.idx = 0;

        BOX_CHANGED = true;

        setCursorAfterBox(pasteBox);
      } else {
        const box = cursorBeforeOrAfter();
        if (!box || !box.under) {
          return;
        }

        const cells = box.under.rows[box.rowIdx].cells;

        if (CURSOR_BEFORE_BOX) {
          cells.splice(box.idx, 0, pasteBox);
        } else {
          cells.splice(box.idx + 1, 0, pasteBox);
        }
        pasteBox.under = box.under;
        pasteBox.rowIdx = box.rowIdx;
        reindexBoxes(cells);

        BOX_CHANGED = true;

        setCursorAfterBox(pasteBox);
      }
    }

  });
};

const menuCallbacks = {
  newBox: keyNewBox,
  type: keyType,
  typeWords: keyTypeWords,
  newRow: keyNewRow,
  del: keyDel,
  paste: keyPaste,
  save,

};

const MENU = MENUR(menuCallbacks);

const updateKeyboard = function () {
  const baBox = cursorBeforeOrAfter();
  const baiBox = cursorBeforeOrAfterOrInside();

  const nonRootBABox = !(!baBox || !baBox.under);
  const nonRootBAIBox = !(!baiBox || !baiBox.under);

  const active = []
  let baCells = null;
  if (baBox && baBox.under) {
    baCells = baBox.under.rows[baBox.rowIdx].cells;
  }

  active.push('save');
  if (nonRootBABox ||
      (CURSOR_INSIDE_BOX && CURSOR_INSIDE_BOX.rows.length === 0 &&
       !isTaggedBox(baiBox))) {
    active.push('newBox');
  }
  if (CLIPBOARD.length > 0 && (nonRootBABox ||
      (CURSOR_INSIDE_BOX && CURSOR_INSIDE_BOX.rows.length === 0 &&
       !isTaggedBox(CURSOR_INSIDE_BOX)))) {
    active.push('paste');
  }
  if (nonRootBAIBox || CURSOR_INSIDE_BOX) {
    active.push('type');
  }
  if ((nonRootBAIBox || CURSOR_INSIDE_BOX) &&
      !(CURSOR_INSIDE_BOX && isTaggedBox(baiBox))) {
    active.push('typeWords');
  }
  if (nonRootBABox) {
    active.push('newRow');
  }
  if (nonRootBAIBox &&
      (!CURSOR_AFTER_BOX || baBox.rowIdx != baBox.under.rows.length - 1)) {
    active.push('del');
  }

  MENU.setButtonsActive(active);

};

// main code starts here

resetGlobals();
loadFromHash();
MENU.show();
setCursorBeforeBox(null);

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
      if (getHandleShrinkage(ZOOM_STATS, TARGET_BOX) < TOO_SMALL_THRESH) {
        ZOOMING_BOX = TARGET_BOX;
        TARGET_BOX = null;
      }
    }

    requestDraw();
  },
  touchMove: function (p) {
    const dist = Math.sqrt(
      Math.pow(TOUCH_ORIGIN.x - p.x, 2) + Math.pow(TOUCH_ORIGIN.y - p.y, 2));

    if (!PANNING && dist >= PAN_DIST) {
      PANNING = true;

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
    } else if (ZOOMING_BOX) {
      if (ZOOMING_BOX.under) {
        zoomToBox(ZOOM_STATS, BOXES[0], ZOOMING_BOX, TOUCH_ORIGIN);
        setCursorBeforeBox(ZOOMING_BOX);
      }
      ZOOMING_BOX = null;
    } else if (!TARGET_BOX) {
      if (BOXES.length === 0) {
        // create initial box
        // TODO: maybe we should always just init to one box
        // but what if you delete it? maybe disallow that
        const newBox = createBox(adjustForPanAndZoom(p));
        setCursorInsideBox(newBox);
        TARGET_BOX = null;
      } else {
        setCursorBeforeBox(null);
      }
    } else {
      const sp =
        convertToBoxXY(TARGET_BOX, adjustForPanAndZoom(TOUCH_ORIGIN));
      // if the box is empty, and the click is in the middle
      // third (or this is root), place cursor inside
      if (TARGET_BOX.rows.length === 0 &&
          (!TARGET_BOX.under ||
           (sp.x > TARGET_BOX.w/3 && sp.x < TARGET_BOX.w*2/3))) {
        setCursorInsideBox(TARGET_BOX);
      } else if (TARGET_BOX.under) {
        // otherwise place the cursor at nearest end of the box
        if (sp.x > TARGET_BOX.w/2) {
          setCursorAfterBox(TARGET_BOX);
        } else {
          setCursorBeforeBox(TARGET_BOX);
        }
      }
    }

    TARGET_BOX = null;

    requestDraw();
  },
  touchCancel: function () {
    if (PANNING) {
      PAN_TRANSLATE.x += TEMP_PAN_TRANSLATE.x;
      PAN_TRANSLATE.y += TEMP_PAN_TRANSLATE.y;

      TEMP_PAN_TRANSLATE.x = 0;
      TEMP_PAN_TRANSLATE.y = 0;

      PANNING = false;
    } else if (ZOOMING_BOX) {
      ZOOMING_BOX = null;
    }

  },

  pinchStart: function (touch1, touch2) {
    let x = (touch1.x + touch2.x) / 2;
    let y = (touch1.y + touch2.y) / 2;
    PINCH_DISTANCE =
      Math.sqrt(Math.pow(touch1.x - touch2.x, 2) +
                Math.pow(touch1.y - touch2.y, 2));
    TOUCH_ORIGIN = {x, y};
    ZOOM_TARGET = findIntersectingBox(TOUCH_ORIGIN);
  },

  pinchMove: function (touch1, touch2) {
    let dist =
      Math.sqrt(Math.pow(touch1.x - touch2.x, 2) +
                Math.pow(touch1.y - touch2.y, 2));
    let delta = dist - PINCH_DISTANCE;
    setZoom(ZOOM_STATS, BOXES[0], ZOOM_STATS.zoom + delta, TOUCH_ORIGIN);

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

  if (BOXES.length > 0) {
    ZOOM_TARGET = findIntersectingBox({x: mx, y: my});
    setZoom(ZOOM_STATS, BOXES[0], ZOOM_STATS.zoom - delta, {x: mx, y: my});
  }
});

window.addEventListener('hashchange', function () {
  updateSaveHash();
  if (window.location.hash !== SAVE_HASH) {
    loadFromHash();
  }
});

})();
