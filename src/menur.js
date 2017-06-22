/* exported MENU */
'use strict';

const MENUR = (function (cb) {
  let FOR_DISMISS;

  const addCmd = function({text, prev, row}) {
    return function () {
      return cb.add(text, prev, row);
    };
  }
  const MENU_ROOT = [
    [
      {t: 'SAVE all to hash', cmd: cb.save},
      {},
      {},
      {t: 'ENCLOSE in an outer node', cmd: cb.enclose},
    ],
    [{},{},{},{}],
    [{},{},{},{}],
    [
      {},
      {},
      {},
      {t: 'DELETE', cmd: cb.deleteNode},
    ]
  ];
  const MENU_BUTTONS = [
    [
      {t: 'SAVE all to hash', cmd: cb.save},
      {t: 'add TEXT above', cmd: addCmd({text: true, prev: true, row: true})},
      {t: 'add NODE above', cmd: addCmd({text: false,prev: true, row: true})},
      {},
    ],
    [
      {t: 'add TEXT left', cmd: addCmd({text: true, prev: true, row: false})},
      {t: 'EDIT text', cmd: cb.edit},
      {},
      {t: 'add TEXT right', cmd:addCmd({text: true, prev: false,row: false})},
    ],
    [
      {t: 'add NODE left', cmd: addCmd({text: false, prev: true, row: false})},
      {},
      {t: 'ENCLOSE in an outer node', cmd: cb.enclose},
      {t: 'add NODE right', cmd:addCmd({text: false, prev: false,row: false})},
    ],
    [
      {},
      {t: 'add TEXT below', cmd: addCmd({text: true, prev: false, row: true})},
      {t: 'add NODE below', cmd: addCmd({text: false,prev: false, row: true})},
      {t: 'DELETE', cmd: cb.deleteNode},
    ]
  ];
  return {
    show: function (box) {
      const div = document.getElementById('menu');
      div.style.visibility = 'visible';

      const table = document.createElement('table');
      table.id = 'menu-table';

      let menuArray;
      if (!box.under) {
        menuArray = MENU_ROOT;
      } else {
        menuArray = MENU_BUTTONS;
      }

      for (let i = 0; i < 4; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < 4; j++) {
          const td = document.createElement('td');

          const button = menuArray[i][j];

          if (!!button.cmd) {
            let text = '';
            if (!!button.t) {
              text = button.t;
            }

            if (text !== '') {
              td.textContent = text;
              td.className = 'mb-filled';
            }

            td.addEventListener('click', function (e) {
              FOR_DISMISS = button.cmd();
            });
          }

          tr.appendChild(td);
        }
        table.appendChild(tr);
      }

      div.appendChild(table);

      div.addEventListener('click', function click () {
        div.style.visibility = 'hidden';
        div.removeEventListener('click', click);
        div.removeChild(table);
        cb.menuDismissed(FOR_DISMISS);
      });
    },
    hide: function () {
    },
  };
});
