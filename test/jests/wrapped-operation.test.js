import WrappedOperation from 'common/wrapped-operation';
import TextOperation from 'common/text-operation';
import Selection from 'common/selection';
import h from '../helpers';

let n = 20;

describe('Apply', () => {
  for (let i = 1; i <= n; i++) {
    test(`Apply ${i}`, () => {
      let str = h.randomString(50);
      let operation = h.randomOperation(str);
      let wrapped = new WrappedOperation(operation, { lorem: 42 });
      expect(wrapped.meta.lorem).toStrictEqual(42);
      expect(wrapped.apply(str)).toStrictEqual(operation.apply(str));
    });
  }
});

describe('Invert', () => {
  for (let i = 1; i <= n; i++) {
    test(`Invert ${i}`, () => {
      let str = h.randomString(50);
      let operation = h.randomOperation(str);
      let payload = { lorem: 'ipsum' };
      let wrapped = new WrappedOperation(operation, payload);
      let wrappedInverted = wrapped.invert(str);

      expect(wrappedInverted.meta).toStrictEqual(payload);
      expect(wrappedInverted.apply(operation.apply(str))).toStrictEqual(str);
    });
  }
});

describe('InvertMethod', () => {
  for (let i = 1; i <= n; i++) {
    test(`InvertMethod ${i}`, () => {
      let str = h.randomString(50);
      let operation = h.randomOperation(str);
      let meta = { invert: function (doc) { return doc; } };
      let wrapped = new WrappedOperation(operation, meta);

      expect(wrapped.invert(str).meta).toStrictEqual(str);
    });
  }
});

describe('Compose', () => {
  for (let i = 1; i <= n; i++) {
    test(`Compose ${i}`, () => {
      let str = h.randomString(50);
      let a = new WrappedOperation(h.randomOperation(str), { a: 1, b: 2 });
      let strN = a.apply(str);
      let b = new WrappedOperation(h.randomOperation(strN), { a: 3, c: 4 });
      let ab = a.compose(b);

      expect(ab.meta.a).toStrictEqual(3);
      expect(ab.meta.b).toStrictEqual(2);
      expect(ab.meta.c).toStrictEqual(4);
      expect(ab.apply(str)).toStrictEqual(b.apply(strN));
    });
  }
});

describe('ComposeMethod', () => {
  for (let i = 1; i <= n; i++) {
    test(`ComposeMethod ${i}`, () => {
      let meta = {
        timesComposed: 0,
        compose: function (other) {
          return {
            timesComposed: this.timesComposed + other.timesComposed + 1,
            compose: meta.compose
          };
        }
      };
      let str = h.randomString(50);
      let a = new WrappedOperation(h.randomOperation(str), meta);
      let strN = a.apply(str);
      let b = new WrappedOperation(h.randomOperation(strN), meta);
      let ab = a.compose(b);

      expect(ab.meta.timesComposed).toStrictEqual(1);
    });
  }
});

describe('Transform', () => {
  for (let i = 1; i <= n; i++) {
    test(`Transform ${i}`, () => {
      let str = h.randomString(50);
      let metaA = {};
      let a = new WrappedOperation(h.randomOperation(str), metaA);
      let metaB = {};
      let b = new WrappedOperation(h.randomOperation(str), metaB);
      let pair = WrappedOperation.transform(a, b);
      let aPrime = pair[0];
      let bPrime = pair[1];

      expect(aPrime.meta).toStrictEqual(metaA);
      expect(bPrime.meta).toStrictEqual(metaB);
      expect(aPrime.apply(b.apply(str))).toStrictEqual(bPrime.apply(a.apply(str)));
    });
  }
});

test('TransformMethod', () => {
  let str = 'Loorem ipsum';
  let a = new WrappedOperation(
    new TextOperation().retain(1)['delete'](1).retain(10),
    Selection.createCursor(1)
  );
  let b = new WrappedOperation(
    new TextOperation().retain(7)['delete'](1).insert("I").retain(4),
    Selection.createCursor(8)
  );
  let pair = WrappedOperation.transform(a, b);
  let aPrime = pair[0];
  let bPrime = pair[1];

  expect(bPrime.apply(a.apply(str))).toStrictEqual("Lorem Ipsum");
  expect(
    aPrime.meta.equals(Selection.createCursor(1))
  ).toBe(true);
  expect(
    bPrime.meta.equals(Selection.createCursor(7))
  ).toBe(true);
});
