(function () {
'use strict';

const CNV = CNVR();

let BOXES;
let PANNING;
let PAN_TRANSLATE;
let TEMP_PAN_TRANSLATE;
let DRAW_REQUEST_IN_FLIGHT;
let TOUCH_ORIGIN;
let HOLD_TIMEOUT1_ID;
let HOLD_TIMEOUT2_ID;
let TARGET_BOX;
let TARGET_REGION;
let WARN_HOLD;
let SAVE_HASH;
let CANCEL_PROMPT;

const resetGlobals = function () {
  BOXES = [];
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
  TARGET_REGION = null;
  WARN_HOLD = false;
  SAVE_HASH = '#';
  CANCEL_PROMPT = null;
};

const TARGET_LINE_WIDTH = 15;
const HOLD_TIMEOUT1_MS = 500;
const HOLD_TIMEOUT2_MS = 500;
const PAN_DIST = 20;
const BOX_PAD = 30;
const ROW_COLORS = ['#f0f0ff', '#fff0f0', '#f0fff0'];
const LEVEL_COLORS = ['#e8e8ff', '#ffe8e8', '#e0ffe0'];
const TARGET_COLOR = '#000000';
const WARN_COLOR = '#ff0000';

const SAVE_LINK = document.getElementById('save-link');
const PROMPT_INPUT = document.getElementById('prompt-input');
const PROMPT_FORM = document.getElementById('prompt-form');

const OPEN_SYM = '(';
const CLOSE_SYM = ')';
const ROW_SYM = ',';
const ID_SYM = "'";
const ESC_SYM = '~';

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
  let region = null;

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
  const newBox = {x: 0, y: 0,
                  w: BOX_PAD*2, h: BOX_PAD,
                  rows: [], under, level: 0};

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
    newBox.x = p.x - BOX_PAD;
    newBox.y = p.y - Math.round(BOX_PAD/2);

    BOXES.push(newBox);
    newBox.idx = BOXES.indexOf(newBox);
  }

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
  // Set position for the rows of this box based on the sizes of the boxes
  // they contain, then set the size of this box from that.
  // Also calls up to update the parent box since this box's size could
  // have changed (updateRowCells on the row this box is in and updateBoxRows
  // on the parent box)
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
    box.h = BOX_PAD;
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
  // Set the position of each cell (box) based on the size of previous boxes,
  // and update the size of the row.
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
    DRAW_REQUEST_IN_FLIGHT = window.requestAnimationFrame(draw);
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

  CNV.drawRect(rectAttrs);

  box.rows.forEach(function (row) {
    CNV.enterRel({x: row.x, y: row.y});
    CNV.drawRect({x: 0, y: 0, w: box.w, h: row.h,
                  fill: ROW_COLORS[box.level % ROW_COLORS.length]});

    row.cells.forEach(drawBox);
    CNV.exitRel();
  });

  if (typeof box.text === 'string') {
    CNV.drawText({x: Math.round(box.w/2),
                  y: Math.round(box.h/2),
                  msg: box.text, fill: '#000000'});
  }

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

const boxFromString = function (str, level, i) {
  if (i >= str.length) {
    throw 'expected object at end of string';
  }

  const box = {rows:[], level};

  if (str[i] === ID_SYM) {
    // .id
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

  // ()
  i++;

  let curRow = null;

  while (i < str.length) {
    switch (str[i]) {
      case CLOSE_SYM:
        i++;
        if (curRow && curRow.cells.length === 0) {
          throw 'empty last row';
        }
        if (box.rows.length === 0) {
          // size of an empty box
          box.w = BOX_PAD * 2;
          box.h = BOX_PAD;
        } else {
          // row and cell indexes
          reindexRows(box.rows);
          // set sizes of rows and relative position of children
          box.rows.forEach(updateRowCells);
          // set positions of rows and size of this box,
          // won't call up as box.under isn't set yet
          updateBoxRows(box);
        }
        return {box, i};
      case ROW_SYM:
        i++;
        if (curRow === null) {
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
  const hash = window.location.hash;

  if (typeof hash === 'string' && hash.length > 1 && hash[0] === '#') {
    let box = null;
    let i = 1;
    try {
      ({i, box} = boxFromString(hash, 0, i));
    } catch (e) {
      console.log('boxFromString threw ' + e);
    }
    if (box) {
      resetGlobals();
      if (i !== hash.length) {
        console.log('hash error: trailing characters')
      } else {
        box.x = BOX_PAD;
        box.y = BOX_PAD;
        BOXES = [box];
        reindexBoxes();

        updateSaveHash();

        requestDraw();
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

  SAVE_HASH = '#' + str;
};


const promptText = function (init, cb) {
  if (typeof init !== 'string') {
    init = '';
  }

  if (CANCEL_PROMPT) {
    CANCEL_PROMPT();
    CANCEL_PROMPT = null;
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
};

const tagBox = function (box, text) {
  if (typeof text === 'string' && text !== '') {
    box.text = text;
    const width = CNV.context.measureText(text).width;
    box.w = width + BOX_PAD;
    box.h = BOX_PAD;
    if (box.under) {
      updateRowCells(box.under.rows[box.rowIdx]);
      updateBoxRows(box.under);
    }
  } else {
    delete box.text;
  }
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
    p = adjustForPan(p);
    TOUCH_ORIGIN = {x: p.x, y: p.y};

    TARGET_BOX = findIntersectingBox({x: p.x, y: p.y});

    if (TARGET_BOX) {
      ({region: TARGET_REGION} = chooseTarget(p, TARGET_BOX));
      startHoldTimeout1();
    }

    requestDraw();
  },
  touchMove: function (p) {
    p = adjustForPan(p);
    const dist = Math.sqrt(
      Math.pow(TOUCH_ORIGIN.x - p.x, 2) + Math.pow(TOUCH_ORIGIN.y - p.y, 2));

    if (!PANNING && dist >= PAN_DIST) {
      PANNING = true;
      cancelHoldTimeout();
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
  touchEnd: function (p, cancelled) {
    p = adjustForPan(p);
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
          createNewBox(TOUCH_ORIGIN, TARGET_BOX);
        }

      } else if (BOXES.length === 0) {
        // nothing targeted, no existing boxes, make a top level box
        if (!WARN_HOLD) {
          createNewBox(TOUCH_ORIGIN);
        }
      }
      // do nothing if a click lands nowhere when there are alredy boxes
    }

    TARGET_BOX = null;
    TARGET_REGION = null;

    cancelHoldTimeout();
    requestDraw();
  },
});

window.addEventListener('resize', function () {
  CNV.setupCanvas();
  requestDraw();
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
