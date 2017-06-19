# ecola
Just an experiment in creating tree structures with a touch screen, very early.

Try it out at https://gashlin.net/tests/ecola/babel/

![once upon a time there was a little editor](/ecola-screen.png?raw=true)

Nodes can contain other nodes, and nodes at the same level can be organized into rows to avoid extending too far horizontally. The colors show contrast between levels of the hierarchy.  The variations in shading within a color indicate the different touch targets.

## How to use
* First tap creates a new node
* Tap inside an empty node to add text
  * or submit with no text to add a child node
* Tap above or below a row to add a node in a new row there
* Tap to the left or right of a node to add a new node in that position
* Tap inside a text node to edit
* Drag to pan
* Long press on a node to delete it
  * first a red outline appears as a warning, keep holding

* The Save link will update the location bar with a link that will restore the current state (except for panning).
