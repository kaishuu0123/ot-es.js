import ot from '../../dist/ot-es';

import io from 'socket.io-client';
import CodeMirror from 'codemirror';
// Bootstrapのスタイルシート側の機能を読み込む
import 'bootstrap/dist/css/bootstrap.min.css';
// BootstrapのJavaScript側の機能を読み込む
import 'bootstrap';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/gfm/gfm.js';
import 'codemirror/addon/edit/continuelist.js';
import 'codemirror/addon/display/placeholder.js';
import 'font-awesome/css/font-awesome.css';

document.addEventListener('DOMContentLoaded', () => {
  let EditorClient = ot.EditorClient;
  let SocketIOAdapter = ot.SocketIOAdapter;
  let AjaxAdapter = ot.AjaxAdapter;
  let CodeMirrorAdapter = ot.CodeMirrorAdapter;

  let socket;
  let disabledRegex = /(^|\s+)disabled($|\s+)/;

  let login = (username, callback) => {
    socket
      .emit('login', { name: username })
      .on('logged_in', callback);
  }

  let enable = (el) => {
    el.className = el.className.replace(disabledRegex, ' ');
  }

  let disable = (el) => {
    if (!disabledRegex.test(el.className)) {
      el.className += ' disabled';
    }
  }

  let preventDefault = (e) => {
    if (e.preventDefault) { e.preventDefault(); }
  }

  let stopPropagation = (e) => {
    if (e.stopPropagation) { e.stopPropagation(); }
  }

  let stopEvent = (e) => {
    preventDefault(e);
    stopPropagation(e);
  }

  let removeElement = (el) => {
    el.parentNode.removeChild(el);
  }

  let beginsWith = (a, b) => { return a.slice(0, b.length) === b; }
  let endsWith = (a, b) => { return a.slice(a.length - b.length, a.length) === b; }

  let wrap = (chars) => {
    cm.operation(() => {
      if (cm.somethingSelected()) {
        cm.replaceSelections(cm.getSelections().map((selection) => {
          if (beginsWith(selection, chars) && endsWith(selection, chars)) {
            return selection.slice(chars.length, selection.length - chars.length);
          }
          return chars + selection + chars;
        }), 'around');
      } else {
        let index = cm.indexFromPos(cm.getCursor());
        cm.replaceSelection(chars + chars);
        cm.setCursor(cm.posFromIndex(index + 2));
      }
    });
    cm.focus();
  }

  let bold = () => { wrap('**'); }
  let italic = () => { wrap('*'); }
  let code = () => { wrap('`'); }

  let editorWrapper = document.getElementById('editor-wrapper');
  let cm = window.cm = new CodeMirror(editorWrapper, {
    lineNumbers: true,
    lineWrapping: true,
    mode: 'markdown',
    readOnly: 'nocursor'
  });

  let undoBtn = document.getElementById('undo-btn');
  undoBtn.onclick = function (e) { cm.undo(); cm.focus(); stopEvent(e); };
  disable(undoBtn);
  let redoBtn = document.getElementById('redo-btn');
  redoBtn.onclick = function (e) { cm.redo(); cm.focus(); stopEvent(e); };
  disable(redoBtn);

  let boldBtn = document.getElementById('bold-btn');
  boldBtn.onclick = function (e) { bold(); stopEvent(e); };
  disable(boldBtn);
  let italicBtn = document.getElementById('italic-btn');
  italicBtn.onclick = function (e) { italic(); stopEvent(e); };
  disable(italicBtn);
  let codeBtn = document.getElementById('code-btn');
  disable(codeBtn);
  codeBtn.onclick = function (e) { code(); stopEvent(e); };

  let loginForm = document.getElementById('login-form');
  loginForm.onsubmit = function (e) {
    preventDefault(e);
    let username = document.getElementById('username').value;
    login(username, function () {
      let li = document.createElement('li');
      li.appendChild(document.createTextNode(username + " (that's you!)"));
      cmClient.clientListEl.appendChild(li);
      cmClient.serverAdapter.ownUserName = username;

      enable(boldBtn);
      enable(italicBtn);
      enable(codeBtn);

      cm.setOption('readOnly', false);
      removeElement(overlay);
      removeElement(loginForm);
    });
  };

  let overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.onclick = stopPropagation;
  overlay.onmousedown = stopPropagation;
  overlay.onmouseup = stopPropagation;
  let cmWrapper = cm.getWrapperElement();
  cmWrapper.appendChild(overlay);

  let cmClient;
  socket = io.connect('/');
  socket.on('doc', function (obj) {
    init(obj.str, obj.revision, obj.clients, new SocketIOAdapter(socket));
  });

  // uncomment to simulate more latency
  // (function () {
  //   let emit = socket.emit;
  //   let queue = [];
  //   socket.emit = function () {
  //     queue.push(arguments);
  //     return socket;
  //   };
  //   setInterval(function () {
  //     if (queue.length) {
  //       emit.apply(socket, queue.shift());
  //     }
  //   }, 800);
  // })();

  function init (str, revision, clients, serverAdapter) {
    cm.setValue(str);
    cmClient = window.cmClient = new EditorClient(
      revision, clients,
      serverAdapter, new CodeMirrorAdapter(cm)
    );

    let userListWrapper = document.getElementById('userlist-wrapper');
    userListWrapper.appendChild(cmClient.clientListEl);

    cm.on('change', function () {
      if (!cmClient) { return; }
      (cmClient.undoManager.canUndo() ? enable : disable)(undoBtn);
      (cmClient.undoManager.canRedo() ? enable : disable)(redoBtn);
    });
  }
});