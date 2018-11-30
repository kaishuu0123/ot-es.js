import Client from 'browser/client';
import Selection from 'common/selection';
import UndoManager from 'browser/undo-manager';
import TextOperation from 'common/text-operation';
import WrappedOperation from 'common/wrapped-operation';

class OtherClient {
  constructor (id, listEl, editorAdapter, name, color, selection) {
    this.id = id;
    this.listEl = listEl;
    this.editorAdapter = editorAdapter;
    this.name = name;
    this.color = color;

    this.li = document.createElement('li');
    if (name) {
      this.li.textContent = name;
      this.listEl.appendChild(this.li);
    }

    if(!color) {
      this.setColor(name ? this._hueFromName(name) : Math.random());
    } else {
      this.setForceColor(color);
    }
    if (selection) { this.updateSelection(selection); }
  }

  setColor (hue) {
    this.hue = hue;
    this.color = this._hsl2hex(hue, 0.75, 0.5);
    this.lightColor = this._hsl2hex(hue, 0.5, 0.9);
    if (this.li) { this.li.style.color = this.color; }
  };

  setForceColor (color) {
    this.hue = null;
    this.color = color;
    this.lightColor = color;
    if (this.li) { this.li.style.color = this.color; }
  };

  setName (name) {
    if (this.name === name) { return; }
    this.name = name;

    this.li.textContent = name;
    if (!this.li.parentNode) {
      this.listEl.appendChild(this.li);
    }

    this.setColor(this._hueFromName(name));
  };

  updateSelection (selection) {
    this.removeSelection();
    this.selection = selection;
    this.mark = this.editorAdapter.setOtherSelection(
      selection,
      selection.position === selection.selectionEnd ? this.color : this.lightColor,
      this.id
    );
  };

  remove () {
    if (this.li) { this._removeElement(this.li); }
    this.removeSelection();
  };

  removeSelection () {
    if (this.mark) {
      this.mark.clear();
      this.mark = null;
    }
  };

  _rgb2hex (r, g, b) {
    function digits (n) {
      var m = Math.round(255*n).toString(16);
      return m.length === 1 ? '0'+m : m;
    }
    return '#' + digits(r) + digits(g) + digits(b);
  }

  _hsl2hex (h, s, l) {
    if (s === 0) { return this._rgb2hex(l, l, l); }
    var var2 = l < 0.5 ? l * (1+s) : (l+s) - (s*l);
    var var1 = 2 * l - var2;
    var hue2rgb = function (hue) {
      if (hue < 0) { hue += 1; }
      if (hue > 1) { hue -= 1; }
      if (6*hue < 1) { return var1 + (var2-var1)*6*hue; }
      if (2*hue < 1) { return var2; }
      if (3*hue < 2) { return var1 + (var2-var1)*6*(2/3 - hue); }
      return var1;
    };
    return this._rgb2hex(hue2rgb(h+1/3), hue2rgb(h), hue2rgb(h-1/3));
  }

  _hueFromName (name) {
    var a = 1;
    for (var i = 0; i < name.length; i++) {
      a = 17 * (a+name.charCodeAt(i)) % 360;
    }
    return a/360;
  }

  _removeElement (el) {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }
}

class OtherMeta {
  constructor (clientId, selection) {
    this.clientId  = clientId;
    this.selection = selection;
  }

  static fromJSON = function (obj) {
    return new OtherMeta(
      obj.clientId,
      obj.selection && Selection.fromJSON(obj.selection)
    );
  };

  transform (operation) {
    return new OtherMeta(
      this.clientId,
      this.selection && this.selection.transform(operation)
    );
  };
}

class SelfMeta {
  constructor (selectionBefore, selectionAfter) {
    this.selectionBefore = selectionBefore;
    this.selectionAfter  = selectionAfter;
  }

  invert () {
    return new SelfMeta(this.selectionAfter, this.selectionBefore);
  };

  compose (other) {
    return new SelfMeta(this.selectionBefore, other.selectionAfter);
  };

  transform (operation) {
    return new SelfMeta(
      (this.selectionBefore ? this.selectionBefore.transform(operation) : null),
      (this.selectionAfter ? this.selectionAfter.transform(operation) : null)
    );
  };
}

export default class EditorClient extends Client {
  constructor (revision, clients, serverAdapter, editorAdapter) {
    super(revision);

    this.serverAdapter = serverAdapter;
    this.editorAdapter = editorAdapter;
    this.undoManager = new UndoManager();

    this.initializeClientList();
    this.initializeClients(clients);

    var self = this;

    this.editorAdapter.registerCallbacks({
      change: function (operation, inverse) { self.onChange(operation, inverse); },
      selectionChange: function () { self.onSelectionChange(); },
      blur: function () { self.onBlur(); }
    });
    this.editorAdapter.registerUndo(function () { self.undo(); });
    this.editorAdapter.registerRedo(function () { self.redo(); });

    this.serverAdapter.registerCallbacks({
      client_left: function (clientId) { self.onClientLeft(clientId); },
      set_name: function (clientId, name) { self.getClientObject(clientId).setName(name); },
      set_color: function (clientId, color) { self.getClientObject(clientId).setForceColor(color); },
      ack: function (revision) { self.serverAck(revision); },
      operation: function (revision, operation) {
        self.applyServer(revision, TextOperation.fromJSON(operation));
      },
      operations: function (head, operations) {
        self.applyOperations(head, operations);
      },
      selection: function (clientId, selection) {
        if (selection) {
          self.getClientObject(clientId).updateSelection(
            self.transformSelection(Selection.fromJSON(selection))
          );
        } else {
          self.getClientObject(clientId).removeSelection();
        }
      },
      clients: function (clients) {
        var clientId;
        for (clientId in self.clients) {
          if (self.clients.hasOwnProperty(clientId) && !clients.hasOwnProperty(clientId)) {
            self.onClientLeft(clientId);
          }
        }

        for (clientId in clients) {
          if (clients.hasOwnProperty(clientId)) {
            var clientObject = self.getClientObject(clientId);

            if (clients[clientId].name) {
              clientObject.setName(clients[clientId].name);
            }

            var selection = clients[clientId].selection;
            if (selection) {
              self.clients[clientId].updateSelection(
                self.transformSelection(Selection.fromJSON(selection))
              );
            } else {
              self.clients[clientId].removeSelection();
            }
          }
        }
      },
      reconnect: function () { self.serverReconnect(); }
    });
  }

  addClient (clientId, clientObj) {
    this.clients[clientId] = new OtherClient(
      clientId,
      this.clientListEl,
      this.editorAdapter,
      clientObj.name || clientId,
      clientObj.color || null,
      clientObj.selection ? Selection.fromJSON(clientObj.selection) : null
    );
  };

  initializeClients (clients) {
    this.clients = {};
    for (var clientId in clients) {
      if (clients.hasOwnProperty(clientId)) {
        this.addClient(clientId, clients[clientId]);
      }
    }
  };

  getClientObject (clientId) {
    var client = this.clients[clientId];
    if (client) { return client; }
    return this.clients[clientId] = new OtherClient(
      clientId,
      this.clientListEl,
      this.editorAdapter
    );
  };

  onClientLeft (clientId) {
    var client = this.clients[clientId];
    if (!client) { return; }
    client.remove();
    delete this.clients[clientId];
  };

  initializeClientList () {
    this.clientListEl = document.createElement('ul');
  };

  applyUnredo (operation) {
    this.undoManager.add(operation.invert(this.editorAdapter.getValue()));
    this.editorAdapter.applyOperation(operation.wrapped);
    this.selection = operation.meta.selectionAfter;
    this.editorAdapter.setSelection(this.selection);
    this.applyClient(operation.wrapped);
  };

  undo () {
    var self = this;
    if (!this.undoManager.canUndo()) { return; }
    this.undoManager.performUndo(function (o) { self.applyUnredo(o); });
  };

  redo () {
    var self = this;
    if (!this.undoManager.canRedo()) { return; }
    this.undoManager.performRedo(function (o) { self.applyUnredo(o); });
  };

  onChange (textOperation, inverse) {
    var selectionBefore = this.selection;
    this.updateSelection();
    var meta = new SelfMeta(selectionBefore, this.selection);
    var operation = new WrappedOperation(textOperation, meta);

    var compose = this.undoManager.undoStack.length > 0 &&
      inverse.shouldBeComposedWithInverted(this._last(this.undoManager.undoStack).wrapped);
    var inverseMeta = new SelfMeta(this.selection, selectionBefore);
    this.undoManager.add(new WrappedOperation(inverse, inverseMeta), compose);
    this.applyClient(textOperation);
  };

  updateSelection () {
    this.selection = this.editorAdapter.getSelection();
  };

  onSelectionChange () {
    var oldSelection = this.selection;
    this.updateSelection();
    if (oldSelection && this.selection.equals(oldSelection)) { return; }
    this.sendSelection(this.selection);
  };

  onBlur () {
    this.selection = null;
    this.sendSelection(null);
  };

  sendSelection (selection) {
    if (this.state instanceof Client.AwaitingWithBuffer) { return; }
    this.serverAdapter.sendSelection(selection);
  };

  sendOperation (revision, operation) {
    this.serverAdapter.sendOperation(revision, operation.toJSON(), this.selection);
  };

  getOperations (base, head) {
    this.serverAdapter.getOperations(base, head);
  };

  applyOperation (operation) {
    this.editorAdapter.applyOperation(operation);
    this.updateSelection();
    this.undoManager.transform(new WrappedOperation(operation, null));
  };

  _last (arr) {
    return arr[arr.length - 1];
  }
}