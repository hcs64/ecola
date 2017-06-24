# ecola
This is an experiment in creating tree structures with a touch screen.

![once upon a time there was a little editor](/ecola-screen.png?raw=true)

## Demos 
* [A video of zooming](https://gashlin.net/tests/ecola/zoom.mp4)
* Pre-populated trees
  * [Once upon a time...](https://gashlin.net/tests/ecola/babel/#%28'once'upon'a'time%28'there'was%29%2C%28'a%28'little%29'editor%29%28'for%2C'tree%2C'structured%2C'data%29%29)
  * [Fibonacci](https://gashlin.net/tests/ecola/babel/#%28%27defun%27fib%28%27n%29%2C%28%27if%28%27lt%27n%272%29%2C%28%27n%29%2C%28%27%2B%28%27fib%2C%28%27-%27n%271%29%29%28%27fib%2C%28%27-%27n%272%29%29%29%29%29)
* [Empty document](https://gashlin.net/tests/ecola/babel/)

## Structure

* A document contains a single root node.
* Nodes can contain text or other nodes.
* Colors show contrast between levels of the hierarchy.
* Zoom is hierarchical: more deeply nested nodes appear smaller the more the document is zoomed out.
* A row of nodes can be broken into multiple rows to reduce horizontal sprawl.
* A cursor is controlled by tapping; it determines where editing actions will take place.
* A clipboard saves recently removed nodes.

## How to use
* In an empty document, tap to create a root node. The grey cursor will be positioned in the middle of this node.
* Pan and zoom in the standard way with one and two finger gestures.
* Tap to move the cursor, it can be placed inside nodes or at their left or right edges.
* Edit the graph using the buttons along the bottom:
  * **Node** creates a new node at the cursor.
  * **Text** presents a text prompt and creates a new text node at the cursor. Enter several words (separated by spaces) to create several nodes at once.
  * **Edit** replaces Text when the cursor is inside of a text node, use this to edit existing text.
  * **Row** breaks up a row at the cursor, like pressing Return/Enter.
  * **Cut** removes the node at the cursor, placing it on the clipboard.
  * **Paste** presents the nodes on the clipboard (most recent at the bottom), choose one and it will be inserted at the cursor. The same node can be pasted multiple times to copy.
  * **Save** updates the location of the document, you can copy this from your browser's location bar to save or share it.

## Name
It's named after [Ecola State Park](https://en.wikipedia.org/wiki/Lewis_and_Clark_National_and_State_Historical_Parks#Ecola_State_Park) on the Oregon coast.
