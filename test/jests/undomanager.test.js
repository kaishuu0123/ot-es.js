import UndoManager from 'browser/undo-manager';
import TextOperation from 'common/text-operation';
import h from '../helpers';

class Editor {
  constructor(doc) {
    this.doc = doc;
    this.undoManager = new UndoManager();
  }

  doEdit(operation, dontCompose) {
    let last = (arr) => { return arr[arr.length - 1]; }
    let compose = !dontCompose && this.undoManager.undoStack.length > 0 &&
      last(this.undoManager.undoStack).invert(this.doc).shouldBeComposedWith(operation);
    this.undoManager.add(operation.invert(this.doc), compose);
    this.doc = operation.apply(this.doc);
  }

  serverEdit(operation) {
    this.doc = operation.apply(this.doc);
    this.undoManager.transform(operation);
  }
}

test('UndoManager', () => {
  let editor = new Editor("Looremipsum");
  let undoManager = editor.undoManager;

  editor.undo = () => {
    expect(undoManager.isUndoing()).toBe(false);
    undoManager.performUndo((operation) => {
      expect(undoManager.isUndoing()).toBe(true);
      editor.doEdit(operation);
    });
    expect(undoManager.isUndoing()).toBe(false);
  };
  editor.redo = () => {
    expect(undoManager.isRedoing()).toBe(false);
    undoManager.performRedo(function (operation) {
      expect(undoManager.isRedoing()).toBe(true);
      editor.doEdit(operation);
    });
    expect(undoManager.isRedoing()).toBe(false);
  };

  expect(undoManager.canUndo()).toBe(false);
  expect(undoManager.canRedo()).toBe(false);

  editor.doEdit(new TextOperation().retain(2)['delete'](1).retain(8));
  expect(editor.doc).toStrictEqual("Loremipsum");
  expect(undoManager.canUndo()).toBe(true);
  expect(undoManager.canRedo()).toBe(false);

  editor.doEdit(new TextOperation().retain(5).insert(" ").retain(5));
  expect(editor.doc).toStrictEqual("Lorem ipsum");

  editor.serverEdit(new TextOperation().retain(6)['delete'](1).insert("I").retain(4));
  expect(editor.doc).toStrictEqual("Lorem Ipsum");

  editor.undo();
  expect(editor.doc).toStrictEqual("LoremIpsum");
  expect(undoManager.canUndo()).toBe(true);
  expect(undoManager.canRedo()).toBe(true);
  expect(undoManager.undoStack.length).toStrictEqual(1);
  expect(undoManager.redoStack.length).toStrictEqual(1);

  editor.undo();
  expect(undoManager.canUndo()).toBe(false);
  expect(undoManager.canRedo()).toBe(true);
  expect(editor.doc).toStrictEqual("LooremIpsum");

  editor.redo();
  expect(editor.doc).toStrictEqual("LoremIpsum");

  editor.doEdit(new TextOperation().retain(10).insert("D"));
  expect(editor.doc).toStrictEqual("LoremIpsumD");
  expect(undoManager.canRedo()).toBe(false);

  editor.doEdit(new TextOperation().retain(11).insert("o"));
  editor.doEdit(new TextOperation().retain(12).insert("l"));
  editor.undo();
  expect(editor.doc).toStrictEqual("LoremIpsum");

  editor.redo();
  expect(editor.doc).toStrictEqual("LoremIpsumDol");

  editor.doEdit(new TextOperation().retain(13).insert("o"));
  editor.undo();
  expect(editor.doc).toStrictEqual("LoremIpsumDol");

  editor.doEdit(new TextOperation().retain(13).insert("o"));
  editor.doEdit(new TextOperation().retain(14).insert("r"), true);
  editor.undo();
  expect(editor.doc).toStrictEqual("LoremIpsumDolo");
  expect(undoManager.canRedo()).toBe(true);

  editor.serverEdit(new TextOperation().retain(10)['delete'](4));
  editor.redo();
  expect(editor.doc).toStrictEqual("LoremIpsumr");

  editor.undo();
  editor.undo();
  expect(editor.doc).toStrictEqual("LooremIpsum");
});

test('UndoManagerMaxItems', () => {
  let doc = h.randomString(50);
  let undoManager = new UndoManager(42);
  let operation;
  for (var i = 0; i < 100; i++) {
    operation = h.randomOperation(doc);
    doc = operation.apply(doc);
    undoManager.add(operation);
  }
  expect(undoManager.undoStack.length).toStrictEqual(42);
});
