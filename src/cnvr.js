/* exported CNVR */
'use strict';

const CNVR = function (element) {

let cnv = element;
let ctx = null;

const makeCanvas = function () {
  ctx = cnv.getContext('2d');

 setupCanvas();
};

const setupCanvas = function () {
  cnv.width = cnv.offsetWidth;
  cnv.height = cnv.offsetHeight;
};

const clear = function () {
  ctx.clearRect(0, 0, cnv.width, cnv.height);
};

const drawRect = function ({x, y, w, h, stroke, fill}) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.strokeRect(x, y, w, h);
  }

};

const drawText = function ({x, y, msg, fill}) {
  if (fill) {
    ctx.fillStyle = fill;
  }

  ctx.fillText(msg, x, y);
};

const enterRel = function ({x, y, zoom}) {
  ctx.save();
  if (typeof x === 'number' && typeof y === 'number') {
    ctx.translate(x, y);
  }
  if (typeof zoom === 'number') {
    ctx.scale(zoom, zoom);
  }

};

const exitRel = function () {
  ctx.restore();
};

makeCanvas();

return {
  setupCanvas,

  element: cnv,
  context: ctx,
  clear,

  drawRect,

  drawText,

  enterRel,
  exitRel,
};
};

