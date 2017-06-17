(function () {
'use strict';

const CNV = CNVR();
const BOXES = [];

let PANNING = false;
let PAN_TRANSLATE = {x: 0, y: 0};
let TEMP_PAN_TRANSLATE = {x: 0, y: 0};
let LAST_ADDED_BOX = null;
let NEW_BOX = null;
let DRAW_REQUEST_IN_FLIGHT = false;
let TOUCH_ORIGIN = {x: 0, y: 0};
let HOLD_TIMEOUT1_ID = null;
let HOLD_TIMEOUT2_ID = null;
let TARGET_BOX = null;
let TARGET_REGION = null;
let WARN_HOLD = false;

const TARGET_LINE_WIDTH = 15;
const HOLD_TIMEOUT1_MS = 500;
const HOLD_TIMEOUT2_MS = 750;
const PAN_DIST = 20;
const BOX_PAD = 30;
const PAREN_X = 10;
const PAREN_Y = 14;
const LEVEL_COLORS = ['#f0f0ff', '#fff0f0', '#f0fff0'];
const ROW_COLORS = ['#e8e8ff', '#ffe8e8', '#e8ffe8'];
const LAST_ADDED_COLOR = '#808080';
const TARGET_COLOR = '#000000';
const WARN_COLOR = '#ff0000';

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

const chooseTarget = function (p, under) {
  let targetRow = null;
  let targetRowIdx = -1;
  let targetIdx = -1;
  let region;

  const {x: lx, y: ly} = convertToBoxXY(under, p.x, p.y);

  if (under.rows.length === 0) {
    // always add first row on top
    targetRowIdx = 0;
    targetIdx = 0;
    region = {x: 0, y: 0, w: under.w, h: under.h};
  } else if (ly < under.rows[0].y) {
    // add new row to top
    targetRowIdx = 0;
    targetIdx = 0;
    region = {x: 0, y: 0, w: under.w, h: under.rows[0].y};
  } else {
    for (let ri = 0; ri < under.rows.length; ri ++) {
      const row = under.rows[ri];
      if (ly >= row.y && ly < row.y + row.h) {
        // add to existing row
        targetRow = row;
        targetRowIdx = ri;

        if (lx < row.cells[0].x) {
          // add at start of row
          targetIdx = 0;
          region = {x: 0, y: row.y, w: BOX_PAD, h: row.h};
        } else {
          for (let i = 0; i < row.cells.length - 1; i ++) {
            const cell = row.cells[i];
            const nextCell = row.cells[i+1];
            if (lx >= cell.x + cell.w && lx < nextCell.x) {
              // add between cells
              targetIdx = i+1;
              region = {x: cell.x + cell.w, y: row.y,
                        w: nextCell.x - (cell.x + cell.w), h: row.h};
              break;
            }
          }

          if (targetIdx === -1) {
            // add at end of row
            targetIdx = row.cells.length;
            const lastCell = row.cells[row.cells.length-1];
            region = {x: lastCell.x + lastCell.w, y: row.y,
                      w: BOX_PAD, h: row.h};
          }
        }
        break;
      } else if (ri < under.rows.length - 1) {
        const nextRow = under.rows[ri+1];
        if (ly >= row.y + row.h && ly < nextRow.y) {
          // add new row in the middle
          targetRowIdx = ri + 1;
          targetIdx = 0;
          region = {x: 0, y: row.y + row.h, w: under.w, h: BOX_PAD};
          break;
        }
      }
    }
    if (targetRowIdx === -1) {
      // add new row to bottom
      targetRowIdx = under.rows.length;
      targetIdx = 0;
      const lastRow = under.rows[under.rows.length-1];
      region = {x: 0, y: lastRow.y + lastRow.h, w: under.w, h: BOX_PAD};
    }
  }

  return {targetRow, targetRowIdx, targetIdx, region};
}

const createNewBox = function (p, under = null) {
  const newBox = {x: p.x - BOX_PAD, y: p.y - BOX_PAD,
                  w: BOX_PAD*2, h: BOX_PAD*2,
                  finished: false, rows: [], under, level: 0};

  if (under) {
    newBox.level = under.level + 1;

    let {targetRow, targetRowIdx, targetIdx} = chooseTarget(p, under);

    if (!targetRow) {
      targetRow = {cells: []};
      under.rows.splice(targetRowIdx, 0, targetRow);
    }
    targetRow.cells.splice(targetIdx, 0, newBox);

    reindexRows(under.rows);
    updateRowCells(targetRow);
    updateBoxRows(under);
  } else {
    BOXES.push(newBox);
    newBox.idx = BOXES.indexOf(newBox);
  }

  return newBox;
};

const finishNewBox = function (newBox, p, cancelled) {
    newBox.finished = true;

    if (cancelled) {
      removeBox(newBox);
    }
};

const removeBox = function (box) {
  const idx = box.idx;
  box.idx = -1;

  let removed;

  if (box.under) {
    const under = box.under;
    const rowIdx = box.rowIdx;
    const row = under.rows[rowIdx];
    const removed = row.cells.splice(idx, 1)[0];
    box.rowIdx = -1;
    if (row.cells.length === 0) {
      under.rows.splice(rowIdx, 1);
      reindexRows(under.rows);
    } else {
      reindexBoxes(row.cells);
      updateRowCells(row);
    }

    updateBoxRows(under);
  } else {
    removed = BOXES.splice(idx, 1)[0];
    reindexBoxes();
  }

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

const updateBoxRows = function (box) {
  let w = 0;
  let h = 0;

  box.rows.forEach(function (row) {
    row.x = 0;
    row.y = BOX_PAD + h;

    w = Math.max(w, row.w);
    h += row.h + BOX_PAD;
  });

  if (box.rows.length === 0) {
    box.w = BOX_PAD * 2;
    box.h = BOX_PAD * 2;
  } else {
    box.w = w;
    box.h = h + BOX_PAD;
  }

  if (box.under) {
    updateRowCells(box.under.rows[box.rowIdx]);
    updateBoxRows(box.under);
  }
};

const updateRowCells = function (row) {
  let h = 0;
  let w = BOX_PAD;

  row.cells.forEach(function (cell, idx) {
    cell.x = w;
    cell.y = 0;

    w += cell.w + BOX_PAD;
    h = Math.max(h, cell.h);
  });

  row.w = w;
  row.h = h;
};

const adjustForPan = function ({x,y}) {
  return {x: x - PAN_TRANSLATE.x,
          y: y - PAN_TRANSLATE.y};
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

  CNV.enterRel({x: .5 + PAN_TRANSLATE.x + TEMP_PAN_TRANSLATE.x,
                y: .5 + PAN_TRANSLATE.y + TEMP_PAN_TRANSLATE.y});

  BOXES.forEach(drawBox);

  CNV.exitRel();
};

const drawBox = function (box, idx) {
  CNV.enterRel({x: box.x, y: box.y});

  const rectAttrs = {x: 0, y: 0, w: box.w, h: box.h,
                     fill: LEVEL_COLORS[box.level % LEVEL_COLORS.length]};

  if (!NEW_BOX && !TARGET_BOX && box === LAST_ADDED_BOX) {
    rectAttrs.stroke = LAST_ADDED_COLOR;
  }

  CNV.drawRect(rectAttrs);

  const openParenAttrs = {x: PAREN_X, y: box.h/2,
                          msg: '(', fill: '#000000'};
 
  const closeParenAttrs = {x: box.w - 1 - PAREN_X, y: box.h/2,
                           msg: ')', fill: '#000000'}

  if (box.rows.length > 0) {
    openParenAttrs.y = PAREN_Y;
    closeParenAttrs.y = box.h - PAREN_Y;
  }

  CNV.drawText(openParenAttrs);
  CNV.drawText(closeParenAttrs);

  box.rows.forEach(function (row) {
    CNV.enterRel({x: row.x, y: row.y});
    CNV.drawRect({x: 0, y: 0, w: row.w, h: row.h,
                  fill: ROW_COLORS[box.level % ROW_COLORS.length]});

    row.cells.forEach(drawBox);
    CNV.exitRel();
  });

  if (box === TARGET_BOX) {
    CNV.context.lineWidth = TARGET_LINE_WIDTH;

    if (WARN_HOLD) {
      CNV.drawRect(
        {x: 0, y: 0, w: box.w, h: box.h, stroke: WARN_COLOR});
    } else {
      const {x,y,w,h} = TARGET_REGION;
      CNV.drawRect({x,y,w,h, stroke: TARGET_COLOR});
    }
  }

  CNV.exitRel();
};

const startHoldTimeout1 = function () {
  HOLD_TIMEOUT1_ID = window.setTimeout(handleHoldTimeout1, HOLD_TIMEOUT1_MS);
};

const startHoldTimeout2 = function () {
  HOLD_TIMEOUT2_ID = window.setTimeout(handleHoldTimeout2, HOLD_TIMEOUT2_MS);
};

const cancelHoldTimeout = function () {
  WARN_HOLD = false;

  if (typeof HOLD_TIMEOUT1_ID === 'number') {
    clearTimeout(HOLD_TIMEOUT1_ID)
    HOLD_TIMEOUT1_ID =   null;
  }
  if (typeof HOLD_TIMEOUT2_ID === 'number') {
    clearTimeout(HOLD_TIMEOUT2_ID)
    HOLD_TIMEOUT2_ID =   null;
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

GET_TOUCHY(CNV.element, {
  touchStart (p) {
    p = adjustForPan(p);
    TOUCH_ORIGIN = {x: p.x, y: p.y};

    if (!NEW_BOX) {
      TARGET_BOX = findIntersectingBox({x: p.x, y: p.y});


      if (TARGET_BOX) {
        ({region: TARGET_REGION} = chooseTarget(p, TARGET_BOX));
        startHoldTimeout1();
      } else if (BOXES.length === 0) {
        NEW_BOX = createNewBox(p);
      }
    }

    requestDraw();
  },
  touchMove (p) {
    p = adjustForPan(p);
    const dist = Math.sqrt(
      Math.pow(TOUCH_ORIGIN.x - p.x, 2) + Math.pow(TOUCH_ORIGIN.y - p.y, 2));

    if (!PANNING && dist >= PAN_DIST) {
      PANNING = true;
      cancelHoldTimeout();
    }

    if (NEW_BOX) {
      if (PANNING) {
        finishNewBox(NEW_BOX, p, true);
        NEW_BOX = null;
      }
    }
    if (TARGET_BOX) {
      if (PANNING) {
        TARGET_BOX = null;
        TARGET_REGION = null;
      }
    }

    if (PANNING) {
      TEMP_PAN_TRANSLATE.x = p.x - TOUCH_ORIGIN.x;
      TEMP_PAN_TRANSLATE.y = p.y - TOUCH_ORIGIN.y;
    }
    requestDraw();
  },
  touchEnd (p, cancelled) {
    p = adjustForPan(p);
    if (!PANNING) {
      if (TARGET_BOX) {
        if (!WARN_HOLD) {
          NEW_BOX = createNewBox(TOUCH_ORIGIN, TARGET_BOX);

          const {x, y} = convertToAbsoluteXY(NEW_BOX, NEW_BOX.w/2, NEW_BOX.h/2)
          PAN_TRANSLATE.x += TOUCH_ORIGIN.x - Math.round(x);
          PAN_TRANSLATE.y += TOUCH_ORIGIN.y - Math.round(y);
        }

        TARGET_BOX = null;
        TARGET_REGION = null;
      }
      if (NEW_BOX) {
        finishNewBox(NEW_BOX, p, cancelled);
        if (!cancelled) {
          LAST_ADDED_BOX = NEW_BOX;
        }
        NEW_BOX = null;
      }

    } else {
      TEMP_PAN_TRANSLATE.x = p.x - TOUCH_ORIGIN.x;
      TEMP_PAN_TRANSLATE.y = p.y - TOUCH_ORIGIN.y;

      PAN_TRANSLATE.x += TEMP_PAN_TRANSLATE.x;
      PAN_TRANSLATE.y += TEMP_PAN_TRANSLATE.y;

      TEMP_PAN_TRANSLATE.x = 0;
      TEMP_PAN_TRANSLATE.y = 0;

      PANNING = false;
    }
    cancelHoldTimeout();
    requestDraw();
  },
});

window.addEventListener('resize', function () {
  CNV.setupCanvas();
  requestDraw();
});

})();
