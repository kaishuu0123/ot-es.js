export default class SocketIOAdapter {
  constructor (socket) {
    this.socket = socket;

    var self = this;
    socket
      .on('client_left', function (clientId) {
        self.trigger('client_left', clientId);
      })
      .on('set_name', function (clientId, name) {
        self.trigger('set_name', clientId, name);
      })
      .on('set_color', function (clientId, color) {
        self.trigger('set_color', clientId, color);
      })
      .on('ack', function (revision) {
        self.trigger('ack', revision);
      })
      .on('operation', function (clientId, revision, operation, selection) {
        self.trigger('operation', revision, operation);
        self.trigger('selection', clientId, selection);
      })
      .on('operations', function (head, operations) {
        self.trigger('operations', head, operations);
      })
      .on('selection', function (clientId, selection) {
        self.trigger('selection', clientId, selection);
      })
      .on('reconnect', function () {
        self.trigger('reconnect');
      });
  }

  sendOperation (revision, operation, selection) {
    this.socket.emit('operation', revision, operation, selection);
  };

  sendSelection (selection) {
    this.socket.emit('selection', selection);
  };

  getOperations (base, head) {
    this.socket.emit('get_operations', base, head);
  };

  registerCallbacks (cb) {
    this.callbacks = cb;
  };

  trigger (event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var action = this.callbacks && this.callbacks[event];
    if (action) { action.apply(this, args); }
  };
}