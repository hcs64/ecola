/* exported MENU */
'use strict';

const MENUR = (function (cb) {
  let FOR_DISMISS;

  const addCmd = function({text, prev, row}) {
    return function () {
      return cb.add(text, prev, row);
    };
  }
  const MENU_BUTTONS = [
    [
      {t: 'SAVE', cmd: cb.save},
      {t: 'add TEXT above', cmd: addCmd({text: true, prev: true, row: true})},
      {t: 'add NODE above', cmd: addCmd({text: false,prev: true, row: true})},
      {t: 'EDIT text', cmd: cb.edit},
    ],
    [
      {t: 'add TEXT left', cmd: addCmd({text: true, prev: true, row: false})},
      {t: 'CUT', cmd: cb.cut},
      {t: 'COPY', cmd: cb.copy},
      {t: 'add TEXT right', cmd:addCmd({text: true, prev: false,row: false})},
    ],
    [
      {t: 'add NODE left', cmd: addCmd({text: false, prev: true, row: false})},
      // TODO: paste where inside?
      {t: 'PASTE inside', cmd: cb.paste},
      {t: 'ENCLOSE', cmd: cb.enclose},
      {t: 'add NODE right', cmd:addCmd({text: false, prev: false,row: false})},
    ],
    [
      {},
      {t: 'add TEXT below', cmd: addCmd({text: false,prev: false, row: true})},
      {t: 'add NODE below', cmd: addCmd({text: true, prev: false, row: true})},
      {}
    ]
  ];
  return {
    show: function () {
      const div = document.getElementById('menu');
      div.style.visibility = 'visible';

      const table = document.createElement('table');
      table.id = 'menu-table';
      for (let i = 0; i < 4; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < 4; j++) {
          const td = document.createElement('td');

          let text = '';

          if (!!MENU_BUTTONS[i][j].t) {
            text = MENU_BUTTONS[i][j].t;
          }

          if (text !== '') {
            td.textContent = text;
            td.className = 'mb-filled';
          }

          {
            const myi = i, myj = j;
            td.addEventListener('click', function (e) {
              if (!!MENU_BUTTONS[myi][myj].cmd) {
                FOR_DISMISS = MENU_BUTTONS[myi][myj].cmd();
              }
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
