/* exported MENU */
'use strict';

// pronounced "manure"

const MENUR = (function (cb) {
  let TABLE = null;

  const MENU_BUTTONS = [
    [
      {t: 'Save', cmd: cb.save, name: 'save'},
      {t: 'Paste', cmd: cb.paste, name: 'paste'},
      {t: 'Node', cmd: cb.newBox, name: 'newBox'},
      {t: 'Text', cmd: cb.type, name: 'type'},
      {t: 'Words', cmd: cb.typeWords, name: 'typeWords'},
      {t: 'Row', cmd: cb.newRow, name: 'newRow'},
      {t: 'Cut', cmd: cb.del, name: 'del'},
    ],
  ];
  return {
    show: function () {
      const div = document.getElementById('keyboard');

      TABLE = document.createElement('table');
      TABLE.id = 'menu-table';

      const menuArray = MENU_BUTTONS;

      for (let i = 0; i < menuArray.length; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < menuArray[i].length; j++) {
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
              if (!button.ignore) {
                button.cmd();
              }
            });
          }

          tr.appendChild(td);
        }
        TABLE.appendChild(tr);
      }

      div.appendChild(TABLE);
    },
    setButtonsActive: function (active) {
      const menuArray = MENU_BUTTONS;

      menuArray.forEach(row => row.forEach(function (button) {
        if (button.cmd) {
          const id = 'key-' + button.name;
          const td = document.getElementById(id);
          if (active.indexOf(button.name) !== -1) {
            td.className = 'filled';
            button.ignore = false;
          } else {
            td.className = 'filled inactive';
            button.ignore = true;
          }
        }
      }));
    }
  };
});
