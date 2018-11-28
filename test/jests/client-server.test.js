import Client from 'browser/client';
import Server from 'server/server';
import h from '../helpers';

class MyClient extends Client {
  constructor (userId, document, revision, channel) {
    super(revision);
    this.userId = userId;
    this.document = document;
    this.channel = channel;
  }

  sendOperation (revision, operation) {
    this.channel.write({
      userId: this.userId,
      revision: revision,
      operation: operation
    });
  };

  applyOperation (operation) {
    this.document = operation.apply(this.document);
  };

  performOperation () {
    let operation = h.randomOperation(this.document);
    this.document = operation.apply(this.document);
    this.applyClient(operation);
  };
}

class NetworkChannel {
  constructor (onReceive) {
    this.buffer = [];
    this.onReceive = onReceive;
  }

  isEmpty () {
    return this.buffer.length === 0;
  };

  write (val) {
    this.buffer.push(val);
  };

  read () {
    return this.buffer.shift();
  };

  receive () {
    this.onReceive.call(null, this.read());
  };
}

describe('ClientServerInteraction', () => {
  for(let i = 1; i <= 1; i++) {
    test('ClientServerInteraction', () => {
      let document = h.randomString();
      let userId;
      let server = new Server(document);

      let serverReceive = (msg) => {
        userId = msg.userId;
        let operationP = server.receiveOperation(msg.revision, msg.operation);
        let broadcast = { userId: userId, revision: server.operations.length, operation: operationP };
        client1ReceiveChannel.write(broadcast);
        client2ReceiveChannel.write(broadcast);
      }

      let clientReceive = (client) => {
        return (obj) => {
          if (obj.userId === client.userId) {
            client.serverAck(obj.revision);
          } else {
            client.applyServer(obj.revision, obj.operation);
          }
        };
      }

      let client1SendChannel = new NetworkChannel(serverReceive);
      let client1 = new MyClient('alice', document, 0, client1SendChannel);
      let client1ReceiveChannel = new NetworkChannel(clientReceive(client1));

      let client2SendChannel = new NetworkChannel(serverReceive);
      let client2 = new MyClient('bob', document, 0, client2SendChannel);
      let client2ReceiveChannel = new NetworkChannel(clientReceive(client2));

      let channels = [client1SendChannel, client1ReceiveChannel, client2SendChannel, client2ReceiveChannel];

      let canReceive = () => {
        for (let i = 0; i < channels.length; i++) {
          if (!channels[i].isEmpty()) { return true; }
        }
        return false;
      }

      let receiveRandom = () => {
        let channel = h.randomElement(channels.filter(function (c) {
          return !c.isEmpty();
        }));
        channel.receive();
      }

      let n = 50;
      while (n--) {
        if (!canReceive() || Math.random() < 0.75) {
          let client = Math.random() < 0.5 ? client1 : client2;
          client.performOperation();
        } else {
          receiveRandom();
        }
      }

      while (canReceive()) {
        receiveRandom();
      }

      expect(server.document).toStrictEqual(client1.document);
      expect(client1.document).toStrictEqual(client2.document);
    });
  }
});
