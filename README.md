# ecola
Just an experiment in creating tree structures with a touch screen, very early.

Try it out at https://gashlin.net/tests/ecola/babel/

![ecola in action, colored rectangles](/ecola-screen.png?raw=true)

Nodes can contain other nodes, and nodes at the same level can be organized into rows to avoid extending too far horizontally. The colors are meant to contrast between levels of the hierarchy, while being subtle to not distract from the (eventual) contents of the nodes.  The variations in shading within a color indicate the borders of the different touch targets.

* Tap above or below a row to add a node in a new row there
* Tap to the left or right of a node to add a new node in that position
* Long press on a node to delete it (first a red outline appears as a warning, keep holding)
* Drag to pan

A light grey outline indicates the most recently added node, this currently has no meaning.

The Save link will update the page location with a link that will restore the
current state (except for panning).
