export default class WrappedOperation {
  // A WrappedOperation contains an operation and corresponing metadata.
  constructor (operation, meta) {
    this.wrapped = operation;
    this.meta    = meta;
  }

  apply () {
    return this.wrapped.apply.apply(this.wrapped, arguments);
  };

  invert () {
    var meta = this.meta;
    return new WrappedOperation(
      this.wrapped.invert.apply(this.wrapped, arguments),
      meta && typeof meta === 'object' && typeof meta.invert === 'function' ?
        meta.invert.apply(meta, arguments) : meta
    );
  };

  // Copy all properties from source to target.
  _copy (source, target) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key];
      }
    }
  }

  _composeMeta (a, b) {
    if (a && typeof a === 'object') {
      if (typeof a.compose === 'function') { return a.compose(b); }
      var meta = {};
      this._copy(a, meta);
      this._copy(b, meta);
      return meta;
    }
    return b;
  }

  compose (other) {
    return new WrappedOperation(
      this.wrapped.compose(other.wrapped),
      this._composeMeta(this.meta, other.meta)
    );
  };

  _transformMeta (meta, operation) {
    if (meta && typeof meta === 'object') {
      if (typeof meta.transform === 'function') {
        return meta.transform(operation);
      }
    }
    return meta;
  }

  static transform = (a, b) => {
    var transform = a.wrapped.constructor.transform;
    var pair = transform(a.wrapped, b.wrapped);
    return [
      new WrappedOperation(pair[0], this._transformMeta(a.meta, b.wrapped)),
      new WrappedOperation(pair[1], this._transformMeta(b.meta, a.wrapped))
    ];
  };
}