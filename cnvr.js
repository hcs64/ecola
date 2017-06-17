/* exported CNVR */
'use strict';

const CNVR = function () {

let cnv = null;
let ctx = null;

const setup = function () {
  cnv = document.createElement('canvas');
  document.body.appendChild(cnv);
  cnv.width = window.innerWidth;
  cnv.height = window.innerHeight;
  ctx = cnv.getContext('2d');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '18px Arial';
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

const enterRel = function ({x, y}) {
  ctx.save();
  ctx.translate(x, y);
};

const exitRel = function () {
  ctx.restore();
};

setup();

return {
  element: cnv,
  clear,

  drawRect,

  drawText,

  enterRel,
  exitRel,
};
};

