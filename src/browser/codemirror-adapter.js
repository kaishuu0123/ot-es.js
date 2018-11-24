import TextOperation from '../common/text-operation';
import Selection from '../common/selection';

export default class CodeMirror {
  constructor(cm) {
    this.cm = cm;
    this.ignoreNextChange = false;
    this.changeInProgress = false;
    this.selectionChanged = false;

    // use addStyleRule
    this.addedStyle = {};
    this.styleElement = document.createElement('style');
    document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement);
    this.styleSheet = this.styleElement.sheet;

    this._bind(this, 'onChanges');
    this._bind(this, 'onChange');
    this._bind(this, 'onCursorActivity');
    this._bind(this, 'onFocus');
    this._bind(this, 'onBlur');

    cm.on('changes', this.onChanges);
    cm.on('change', this.onChange);
    cm.on('cursorActivity', this.onCursorActivity);
    cm.on('focus', this.onFocus);
    cm.on('blur', this.onBlur);
  }

  // Removes all event listeners from the CodeMirror instance.
  detach () {
    this.cm.off('changes', this.onChanges);
    this.cm.off('change', this.onChange);
    this.cm.off('cursorActivity', this.onCursorActivity);
    this.cm.off('focus', this.onFocus);
    this.cm.off('blur', this.onBlur);
  };

  // Converts a CodeMirror change array (as obtained from the 'changes' event
  // in CodeMirror v4) or single change or linked list of changes (as returned
  // by the 'change' event in CodeMirror prior to version 4) into a
  // TextOperation and its inverse and returns them as a two-element array.
  static operationFromCodeMirrorChanges = (changes, doc) => {
    // Approach: Replay the changes, beginning with the most recent one, and
    // construct the operation and its inverse. We have to convert the position
    // in the pre-change coordinate system to an index. We have a method to
    // convert a position in the coordinate system after all changes to an index,
    // namely CodeMirror's `indexFromPos` method. We can use the information of
    // a single change object to convert a post-change coordinate system to a
    // pre-change coordinate system. We can now proceed inductively to get a
    // pre-change coordinate system for all changes in the linked list.
    // A disadvantage of this approach is its complexity `O(n^2)` in the length
    // of the linked list of changes.

    var docEndLength = this._codemirrorDocLength(doc);
    var operation    = new TextOperation().retain(docEndLength);
    var inverse      = new TextOperation().retain(docEndLength);

    var indexFromPos = function (pos) {
      return doc.indexFromPos(pos);
    };

    function last (arr) { return arr[arr.length - 1]; }

    function sumLengths (strArr) {
      if (strArr.length === 0) { return 0; }
      var sum = 0;
      for (var i = 0; i < strArr.length; i++) { sum += strArr[i].length; }
      return sum + strArr.length - 1;
    }

    function updateIndexFromPos (indexFromPos, change) {
      return function (pos) {
        if (posLe(pos, change.from)) { return indexFromPos(pos); }
        if (posLe(change.to, pos)) {
          return indexFromPos({
            line: pos.line + change.text.length - 1 - (change.to.line - change.from.line),
            ch: (change.to.line < pos.line) ?
              pos.ch :
              (change.text.length <= 1) ?
                pos.ch - (change.to.ch - change.from.ch) + sumLengths(change.text) :
                pos.ch - change.to.ch + last(change.text).length
          }) + sumLengths(change.removed) - sumLengths(change.text);
        }
        if (change.from.line === pos.line) {
          return indexFromPos(change.from) + pos.ch - change.from.ch;
        }
        return indexFromPos(change.from) +
          sumLengths(change.removed.slice(0, pos.line - change.from.line)) +
          1 + pos.ch;
      };
    }

    for (var i = changes.length - 1; i >= 0; i--) {
      var change = changes[i];
      indexFromPos = updateIndexFromPos(indexFromPos, change);

      var fromIndex = indexFromPos(change.from);
      var restLength = docEndLength - fromIndex - sumLengths(change.text);

      operation = new TextOperation()
        .retain(fromIndex)
        ['delete'](sumLengths(change.removed))
        .insert(change.text.join('\n'))
        .retain(restLength)
        .compose(operation);

      inverse = inverse.compose(new TextOperation()
        .retain(fromIndex)
        ['delete'](sumLengths(change.text))
        .insert(change.removed.join('\n'))
        .retain(restLength)
      );

      docEndLength += sumLengths(change.removed) - sumLengths(change.text);
    }

    return [operation, inverse];
  };

  // Singular form for backwards compatibility.
  static operationFromCodeMirrorChange =
    operationFromCodeMirrorChanges;

  // Apply an operation to a CodeMirror instance.
  static applyOperationToCodeMirror = function (operation, cm) {
    cm.operation(function () {
      var ops = operation.ops;
      var index = 0; // holds the current index into CodeMirror's content
      for (var i = 0, l = ops.length; i < l; i++) {
        var op = ops[i];
        if (TextOperation.isRetain(op)) {
          index += op;
        } else if (TextOperation.isInsert(op)) {
          var position = cm.getCursor();
          var indexPos = cm.posFromIndex(index);
          cm.replaceRange(op, indexPos, null, 'ignoreHistory');
          if (position.line === indexPos.line && position.ch === indexPos.ch) {
            cm.setCursor(position);
          }
          index += op.length;
        } else if (TextOperation.isDelete(op)) {
          var from = cm.posFromIndex(index);
          var to   = cm.posFromIndex(index - op);
          cm.replaceRange('', from, to, 'ignoreHistory');
        }
      }
    });
  };

  registerCallbacks (cb) {
    this.callbacks = cb;
  };

  onChange () {
    // By default, CodeMirror's event order is the following:
    // 1. 'change', 2. 'cursorActivity', 3. 'changes'.
    // We want to fire the 'selectionChange' event after the 'change' event,
    // but need the information from the 'changes' event. Therefore, we detect
    // when a change is in progress by listening to the change event, setting
    // a flag that makes this adapter defer all 'cursorActivity' events.
    this.changeInProgress = true;
  };

  onChanges (_, changes) {
    if (!this.ignoreNextChange) {
      var pair = CodeMirrorAdapter.operationFromCodeMirrorChanges(changes, this.cm);
      this.trigger('change', pair[0], pair[1]);
    }
    if (this.selectionChanged) { this.trigger('selectionChange'); }
    this.changeInProgress = false;
    this.ignoreNextChange = false;
  };

  onFocus () {
    if (this.changeInProgress) {
      this.selectionChanged = true;
    } else {
      this.trigger('selectionChange');
    }
  };

  onCursorActivity () {
    if (this.changeInProgress) {
      this.selectionChanged = true;
    } else {
      this.trigger('selectionChange');
    }
  }

  onBlur () {
    if (!this.cm.somethingSelected()) { this.trigger('blur'); }
  };

  getValue () {
    return this.cm.getValue();
  };

  getSelection () {
    var cm = this.cm;

    var selectionList = cm.listSelections();
    var ranges = [];
    for (var i = 0; i < selectionList.length; i++) {
      ranges[i] = new Selection.Range(
        cm.indexFromPos(selectionList[i].anchor),
        cm.indexFromPos(selectionList[i].head)
      );
    }

    return new Selection(ranges);
  };

  setSelection (selection) {
    var ranges = [];
    for (var i = 0; selection && i < selection.ranges.length; i++) {
      var range = selection.ranges[i];
      ranges[i] = {
        anchor: this.cm.posFromIndex(range.anchor),
        head:   this.cm.posFromIndex(range.head)
      };
    }
    this.cm.setSelections(ranges);
  };

  addStyleRule () {
    if (this.addedStyle[css]) { return; }
    this.addedStyle[css] = true;
    this.styleSheet.insertRule(css, (this.styleSheet.cssRules || this.styleSheet.rules).length);
  }

  // var addStyleRule = (function () {
  //   var added = {};
  //   var styleElement = document.createElement('style');
  //   document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement);
  //   var styleSheet = styleElement.sheet;

  //   return function (css) {
  //     if (added[css]) { return; }
  //     added[css] = true;
  //     styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length);
  //   };
  // }());

  setOtherCursor (position, color, clientId) {
    var cursorPos = this.cm.posFromIndex(position);
    var cursorCoords = this.cm.cursorCoords(cursorPos);
    var cursorEl = document.createElement('span');
    cursorEl.className = 'other-client';
    cursorEl.style.display = 'none';
    /*
    cursorEl.style.padding = '0';
    cursorEl.style.marginLeft = cursorEl.style.marginRight = '-1px';
    cursorEl.style.borderLeftWidth = '2px';
    cursorEl.style.borderLeftStyle = 'solid';
    cursorEl.style.borderLeftColor = color;
    cursorEl.style.height = (cursorCoords.bottom - cursorCoords.top) * 0.9 + 'px';
    cursorEl.style.zIndex = 0;
    */
    cursorEl.setAttribute('data-clientid', clientId);
    return this.cm.setBookmark(cursorPos, { widget: cursorEl, insertLeft: true });
  };

  setOtherSelectionRange (range, color, clientId) {
    var match = /^#([0-9a-fA-F]{6})$/.exec(color);
    if (!match) { throw new Error("only six-digit hex colors are allowed."); }
    var selectionClassName = 'selection-' + match[1];
    var rgbcolor = this._hex2rgb(color);
    var rule = '.' + selectionClassName + ' { background: rgba(' + rgbcolor.red + ',' + rgbcolor.green + ',' + rgbcolor.blue + ',0.2); }';
    // XXX: Right way? (by kaishuu0123)
    this.addStyleRule(rule);

    var anchorPos = this.cm.posFromIndex(range.anchor);
    var headPos   = this.cm.posFromIndex(range.head);

    return this.cm.markText(
      minPos(anchorPos, headPos),
      maxPos(anchorPos, headPos),
      { className: selectionClassName }
    );
  };

  setOtherSelection (selection, color, clientId) {
    var selectionObjects = [];
    for (var i = 0; i < selection.ranges.length; i++) {
      var range = selection.ranges[i];
      if (range.isEmpty()) {
        //selectionObjects[i] = this.setOtherCursor(range.head, color, clientId);
      } else {
        selectionObjects[i] = this.setOtherSelectionRange(range, color, clientId);
      }
    }
    return {
      clear: function () {
        for (var i = 0; i < selectionObjects.length; i++) {
          if (selectionObjects[i]) { selectionObjects[i].clear(); }
        }
      }
    };
  };

  trigger (event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var action = this.callbacks && this.callbacks[event];
    if (action) { action.apply(this, args); }
  };

  applyOperation (operation) {
    if (!operation.isNoop()) {
      this.ignoreNextChange = true;
    }
    CodeMirrorAdapter.applyOperationToCodeMirror(operation, this.cm);
  };

  registerUndo (undoFn) {
    this.cm.undo = undoFn;
  };

  registerRedo (redoFn) {
    this.cm.redo = redoFn;
  };

  // Throws an error if the first argument is falsy. Useful for debugging.
  _assert (b, msg) {
    if (!b) {
      throw new Error(msg || "assertion error");
    }
  }

  // Bind a method to an object, so it doesn't matter whether you call
  // object.method() directly or pass object.method as a reference to another
  // function.
  _bind (obj, method) {
    var fn = obj[method];
    obj[method] = function () {
      fn.apply(obj, arguments);
    };
  }

  _cmpPos (a, b) {
    if (a.line < b.line) { return -1; }
    if (a.line > b.line) { return 1; }
    if (a.ch < b.ch)     { return -1; }
    if (a.ch > b.ch)     { return 1; }
    return 0;
  }

  _hex2rgb(hex) {
    if (hex[0] === "#") { hex = hex.substr(1); }
    if (hex.length === 3) {
      var temp = hex;
      hex = '';
      temp = /^([a-f0-9])([a-f0-9])([a-f0-9])$/i.exec(temp).slice(1);
      for (var i = 0; i < 3; i++) { hex += temp[i] + temp[i]; }
    }
    var triplets = /^([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex).slice(1);
    return {
      red: parseInt(triplets[0], 16),
      green: parseInt(triplets[1], 16),
      blue: parseInt(triplets[2], 16)
    };
  }

  _posEq (a, b) { return this._cmpPos(a, b) === 0; }
  _posLe (a, b) { return this._cmpPos(a, b) <= 0; }

  _minPos (a, b) { return this._posLe(a, b) ? a : b; }
  _maxPos (a, b) { return this._posLe(a, b) ? b : a; }

  _codemirrorDocLength (doc) {
    return doc.indexFromPos({ line: doc.lastLine(), ch: 0 }) +
      doc.getLine(doc.lastLine()).length;
  }
}