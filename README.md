# ecola
An experiment in creating tree structures with a touch screen. This project in an early prototype stage.

![once upon a time there was a little editor](/ecola-screen.png?raw=true)


## Demos 
* [A video of the zooming behavior](https://gashlin.net/tests/ecola/zoom.mp4)
* Pre-populated
  * [Once upon a time...](https://gashlin.net/tests/ecola/babel/#%28'once'upon'a'time%28'there'was%29%2C%28'a%28'little%29'editor%29%28'for%2C'tree%2C'structured%2C'data%29%29)
  * [Fibonacci](https://gashlin.net/tests/ecola/babel/#%28%27defun%27fib%28%27n%29%2C%28%27if%28%27lt%27n%272%29%2C%28%27n%29%2C%28%27%2B%28%27fib%2C%28%27-%27n%271%29%29%28%27fib%2C%28%27-%27n%272%29%29%29%29%29)
* [Blank sheet](https://gashlin.net/tests/ecola/babel/)

## Structure

Nodes can contain other nodes, and nodes at the same level can be organized into rows to avoid extending too far horizontally. The colors show contrast between levels of the hierarchy. A cursor is controlled by tapping and it determines where editing actions will take place.

## How to use
* In an empty document, tap to create an initial node. The grey cursor will be positioned in the middle of this node.
* Pan and zoom in the standard way with one and two finger gestures
* Tap in the vacinity of where you want to move the cursor to position it
* Edit the graph using the buttons along the bottom
  * Node creates a new node at the cursor
  * Text prompts for new text and creates a new text box at the cursor, or edits the text if the cursor is inside a text box
  * Words creates a text box for each word entered
  * Row inserts a row break at the cursor
  * Cut removes the object at the cursor
  * Paste presents a menu of recently cut nodes, choose one and it will be inserted at the cursor. The same node can be pasted multiple times to copy
  * Save updates the location of the document, you can copy this from your browser's location bar to save or share it
