// import ot from '../dist/ot-es';
let ot = require('../dist/ot-es');
import express from 'express';
import serveStatic from 'serve-static';
import socketio from 'socket.io';
import path from 'path';
import http from 'http';

let app = express();
let appServer = http.createServer(app);

app.use('/', serveStatic(path.join(__dirname, './public')));

let io = socketio.listen(appServer);

let str = "# This is a Markdown heading\n\n"
        + "1. un\n"
        + "2. deux\n"
        + "3. trois\n\n"
        + "Lorem *ipsum* dolor **sit** amet.\n\n"
        + "    $ touch test.txt";

let socketIOServer = new ot.EditorSocketIOServer(str, [], 'demo', function (socket, cb) {
  cb(!!socket.mayEdit);
});

io.sockets.on('connection', function (socket) {
  socketIOServer.addClient(socket);
  socket.on('login', function (obj) {
    if (typeof obj.name !== 'string') {
      console.error('obj.name is not a string');
      return;
    }
    socket.mayEdit = true;
    socketIOServer.setName(socket, obj.name);
    socket.emit('logged_in', {});
  });
});

var port = process.env.PORT || 3000;
appServer.listen(port, function () {
  console.log("Listening on port " + port);
});

process.on('uncaughtException', function (exc) {
  console.error(exc);
});
