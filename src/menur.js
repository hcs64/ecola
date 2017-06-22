/* exported MENU */
'use strict';

const MENUR = (function (cb) {
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
          td.textContent = `${i},${j}`;

          {
            const myi = i, myj = j;
            td.addEventListener('click', function (e) {
              console.log(myi, myj);
              e.stopPropagation();
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
        cb.menuDismissed();
      });
    },
    hide: function () {
    },
  };
});
