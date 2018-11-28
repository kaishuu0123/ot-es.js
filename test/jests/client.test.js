import TextOperation from 'common/text-operation';
import Client from 'browser/client';

test('Client', () => {
  let client = new Client(1);
  expect(client.revision).toStrictEqual(1);
  console.log(Client.Synchronized)
  expect(client.state).toBeInstanceOf(Client.Synchronized);

  let sentRevision = null;
  let sentOperation = null;

  let getSentOperation = () =>{
    let a = sentOperation;
    if (!a) { throw new Error("sendOperation wasn't called"); }
    sentOperation = null;
    return a;
  }

  let getSentRevision = () => {
    let a = sentRevision;
    if (typeof a !== 'number') { throw new Error("sendOperation wasn't called"); }
    sentRevision = null;
    return a;
  }

  client.sendOperation = (revision, operation) => {
    sentRevision = revision;
    sentOperation = operation;
  };

  let doc = "lorem dolor";
  let appliedOperation = null;
  let getAppliedOperation = () => {
    let a = appliedOperation;
    if (!a) { throw new Error("applyOperation wasn't called"); }
    appliedOperation = null;
    return a;
  }
  client.applyOperation = (operation) => {
    doc = operation.apply(doc);
    appliedOperation = operation;
  };

  let applyClient = (operation) => {
    doc = operation.apply(doc);
    client.applyClient(operation);
  }

  client.applyServer(client.revision + 1, new TextOperation().retain(6)['delete'](1).insert("D").retain(4));
  expect(doc).toStrictEqual("lorem Dolor");
  expect(client.state).toBeInstanceOf(Client.Synchronized);
  expect(client.revision).toStrictEqual(2);

  applyClient(new TextOperation().retain(11).insert(" "));
  expect(doc).toStrictEqual("lorem Dolor ");
  expect(client.state).toBeInstanceOf(Client.AwaitingConfirm);
  expect(getSentRevision()).toStrictEqual(2);
  expect(
    client.state.outstanding.equals(new TextOperation().retain(11).insert(" "))
  ).toBe(true);
  expect(
    getSentOperation().equals(new TextOperation().retain(11).insert(" "))
  ).toBe(true);

  client.applyServer(client.revision + 1, new TextOperation().retain(5).insert(" ").retain(6));
  expect(doc).toStrictEqual("lorem  Dolor ");
  expect(client.revision).toStrictEqual(3);
  expect(client.state).toBeInstanceOf(Client.AwaitingConfirm);
  expect(
    client.state.outstanding.equals(new TextOperation().retain(12).insert(" "))
  ).toBe(true);

  applyClient(new TextOperation().retain(13).insert("S"));
  expect(client.state).toBeInstanceOf(Client.AwaitingWithBuffer);

  applyClient(new TextOperation().retain(14).insert("i"));
  applyClient(new TextOperation().retain(15).insert("t"));
  expect(!sentRevision && !sentOperation).toBe(true);
  expect(doc).toStrictEqual("lorem  Dolor Sit");
  expect(
    client.state.outstanding.equals(new TextOperation().retain(12).insert(" "))
  ).toBe(true);
  expect(
    client.state.buffer.equals(new TextOperation().retain(13).insert("Sit"))
  ).toBe(true);

  client.applyServer(client.revision + 1, new TextOperation().retain(6).insert("Ipsum").retain(6));
  expect(client.revision).toStrictEqual(4);
  expect(doc).toStrictEqual("lorem Ipsum Dolor Sit");
  expect(client.state).toBeInstanceOf(Client.AwaitingWithBuffer);
  expect(
    client.state.outstanding.equals(new TextOperation().retain(17).insert(" "))
  ).toBe(true);
  expect(
    client.state.buffer.equals(new TextOperation().retain(18).insert("Sit"))
  ).toBe(true);

  client.serverAck(client.revision + 1);
  expect(getSentRevision()).toStrictEqual(5);
  expect(
    getSentOperation().equals(new TextOperation().retain(18).insert("Sit"))
  ).toBe(true);
  expect(client.revision).toStrictEqual(5);
  expect(client.state).toBeInstanceOf(Client.AwaitingConfirm);
  expect(
    client.state.outstanding.equals(new TextOperation().retain(18).insert("Sit"))
  ).toBe(true);

  client.serverAck(client.revision + 1);
  expect(client.revision).toStrictEqual(6);
  expect(typeof sentRevision !== 'number').toBe(true);
  expect(client.state).toBeInstanceOf(Client.Synchronized);
  expect(doc).toStrictEqual("lorem Ipsum Dolor Sit");

  // Test AwaitingConfirm and AwaitingWithBuffer resend operation.
  client.applyClient(new TextOperation().retain(21).insert("a"));
  expect(client.state).toBeInstanceOf(Client.AwaitingConfirm);
  expect(!!client.state.resend).toBe(true);

  client.applyClient(new TextOperation().retain(22).insert("m"));
  expect(client.state).toBeInstanceOf(Client.AwaitingWithBuffer);
  expect(!!client.state.resend).toBe(true);

  client.state.resend(client);
  expect(
    sentOperation.equals(new TextOperation().retain(21).insert('a'))
  ).toBe(true);

  client.serverAck(client.revision + 1);
  expect(
    sentOperation.equals(new TextOperation().retain(22).insert('m'))
  ).toBe(true);
});