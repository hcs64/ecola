/* exported SVGR */
'use strict';

const SVGR = function () {
const svgNS = 'http://www.w3.org/2000/svg';
const svgID = 'main-svg';

const UNDF = 'undefined';

let svg = null;

const removeElement = function (c) {
  c.parentNode.removeChild(c);
};

const makeGroup = function ({p = svg}) {
  const group = document.createElementNS(svgNS, 'g');

  p.appendChild(group);

  return group;
}

const makeRect = function ({x, y, w, h, rx, ry, stroke, fill, p=svg}) {
  const rect = document.createElementNS(svgNS, 'rect');

  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  if (typeof rx !== UNDF) {
    rect.setAttribute('rx', rx);
  }
  if (typeof ry !== UNDF) {
    rect.setAttribute('ry', ry);
  }
  if (typeof stroke !== UNDF) {
    rect.setAttribute('stroke', stroke);
  }
  if (typeof fill !== UNDF) {
    rect.setAttribute('fill', fill);
  }

  p.appendChild(rect);

  return rect;
};

const moveRect = function(rect, {x, y, w, h}) {
  if (typeof x !== UNDF) {
    rect.setAttribute('x', x);
  }
  if (typeof y !== UNDF) {
    rect.setAttribute('y', y);
  }
  if (typeof w !== UNDF) {
    rect.setAttribute('width', w);
  }
  if (typeof h !== UNDF) {
    rect.setAttribute('height', h);
  }
}

const makeText = function ({x, y, anchor, msg, fill, p=svg}) {
  const text = document.createElementNS(svgNS, 'text');

  moveText(text, {x, y});

  if (typeof anchor !== UNDF) {
    //text.setAttribute('alignment-baseline', 'central');
    text.setAttribute('text-anchor', anchor);
  }

  if (typeof fill !== UNDF) {
    text.setAttribute('fill', fill);
  }

  text.appendChild(document.createTextNode(msg));

  p.appendChild(text);

  return text;
};

const moveText = function (text, {x, y}) {
  text.setAttribute('x', x);
  text.setAttribute('y', y);
};

const setup = function () {
  svg = document.createElementNS(svgNS, 'svg');
  svg.id = svgID;

  document.body.appendChild(svg);
};

setup();

const o = {
  NS: svgNS,
  ID: svgID,

  element: svg,

  makeGroup,

  makeRect,
  moveRect,

  makeText,
  moveText,

  removeElement
};

return o;

};
