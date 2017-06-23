/* exported MENU */
'use strict';

// pronounced "manure"

const MENUR = (function (cb) {
  let TABLE = null;

  const MENU_BUTTONS = [
    [
      {t: 'Save', cmd: cb.save, name: 'save'},
      {t: 'New Empty', cmd: cb.newBox, name: 'newBox'},
      {t: 'New Text', cmd: cb.type, name: 'type'},
      {t: 'New Words', cmd: cb.typeWords, name: 'typeWords'},
      {t: 'Return', cmd: cb.newRow, name: 'newRow'},
      {t: 'Delete >', cmd: cb.del, name: 'del'},
    ],
  ];
  return {
    show: function () {
      const div = document.getElementById('keyboard');

      TABLE = document.createElement('table');
      TABLE.id = 'menu-table';

      let menuArray = MENU_BUTTONS;

      for (let i = 0; i < 1; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < 6; j++) {
          const td = document.createElement('td');

          const button = menuArray[i][j];

          if (!!button.cmd) {
            let text = '';
            if (!!button.t) {
              text = button.t;
            }

            if (text !== '') {
              td.textContent = text;
              td.className = 'filled';
              td.id = "key-" + button.name
            }

            td.addEventListener('click', function (e) {
              button.cmd();
            });
          }

          tr.appendChild(td);
        }
        TABLE.appendChild(tr);
      }

      div.appendChild(TABLE);
    },
  };
});
