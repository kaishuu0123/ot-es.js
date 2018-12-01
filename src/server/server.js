import EventEmitter from 'events';

export default class Server extends EventEmitter {
  constructor (document, operations) {
    super();

    this.document = document;
    this.operations = operations || [];
    this.setDocumentMaxLength(null);
  }

  setDocumentMaxLength (maxLength) {
    this.documentMaxLength = maxLength;
  };

  // Call this method whenever you receive an operation from a client.
  receiveOperation (revision, operation) {
    if (revision < 0 || this.operations.length < revision) {
      throw new Error("operation revision not in history");
    }
    // Find all operations that the client didn't know of when it sent the
    // operation ...
    let concurrentOperations = this.operations.slice(revision);

    // ... and transform the operation against all these operations ...
    let transform = operation.constructor.transform;
    for (var i = 0; i < concurrentOperations.length; i++) {
      operation = transform(operation, concurrentOperations[i])[0];
    }

    // ... and apply that on the document.
    let newDocument = operation.apply(this.document);
    // ignore if exceed the max length of document
    if(typeof this.documentMaxLength === 'number' &&
        newDocument.length > this.documentMaxLength &&
        newDocument.length > this.document.length) {
      return;
    }
    this.document = newDocument;
    // Store operation in history.
    this.operations.push(operation);

    // It's the caller's responsibility to send the operation to all connected
    // clients and an acknowledgement to the creator.
    return operation;
  };
}