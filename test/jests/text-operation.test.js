import TextOperation from 'common/text-operation';
import h from '../helpers';

var n = 500;

test('Constructor', () => {
  let o = new TextOperation();
  expect(o.constructor).toStrictEqual(TextOperation);
});

test('Lengths', () => {
  let o = new TextOperation();
  expect(o.baseLength).toStrictEqual(0);
  expect(o.targetLength).toStrictEqual(0);
  o.retain(5);
  expect(o.baseLength).toStrictEqual(5);
  expect(o.targetLength).toStrictEqual(5);
  o.insert("abc");
  expect(o.baseLength).toStrictEqual(5);
  expect(o.targetLength).toStrictEqual(8);
  o.retain(2);
  expect(o.baseLength).toStrictEqual(7);
  expect(o.targetLength).toStrictEqual(10);
  o['delete'](2);
  expect(o.baseLength).toStrictEqual(9);
  expect(o.targetLength).toStrictEqual(10);
});

test('Chaining', () => {
  let o = new TextOperation()
    .retain(5)
    .retain(0)
    .insert("lorem")
    .insert("")
    ['delete']("abc")
    ['delete'](3)
    ['delete'](0)
    ['delete']("");
  expect(o.ops.length).toStrictEqual(3);
});

describe('Random Apply', () => {
  for (let i = 1; i <= n; i++) {
    let str = h.randomString(50);
    let o = h.randomOperation(str);
    expect(o.baseLength).toStrictEqual(str.length);
    expect(o.targetLength).toStrictEqual(o.apply(str).length);
  }
});

describe('Random Invert', () => {
  for (let i = 1; i <= n; i++) {
    let str = h.randomString(50);
    let o = h.randomOperation(str);
    let p = o.invert(str);
    expect(o.baseLength).toStrictEqual(p.targetLength);
    expect(o.targetLength).toStrictEqual(p.baseLength);
    expect(p.apply(o.apply(str))).toStrictEqual(str);
  }
});

test('EmptyOps', () => {
  let o = new TextOperation();
  o.retain(0);
  o.insert('');
  o['delete']('');
  expect(o.ops.length).toStrictEqual(0);
});

test('Equals', () => {
  let op1 = new TextOperation()['delete'](1).insert("lo").retain(2).retain(3);
  let op2 = new TextOperation()['delete'](-1).insert("l").insert("o").retain(5);
  expect(op1.equals(op2)).toBe(true);

  op1['delete'](1);
  op2.retain(1);
  expect(op1.equals(op2)).toBe(false);
});

test('OpsMerging', () => {
  let last = (arr) => { return arr[arr.length-1]; }
  let o = new TextOperation();
  expect(o.ops.length).toStrictEqual(0);

  o.retain(2);
  expect(o.ops.length).toStrictEqual(1);
  expect(last(o.ops)).toStrictEqual(2);

  o.retain(3);
  expect(o.ops.length).toStrictEqual(1);
  expect(last(o.ops)).toStrictEqual(5);

  o.insert("abc");
  expect(o.ops.length).toStrictEqual(2);
  expect(last(o.ops)).toStrictEqual("abc");

  o.insert("xyz");
  expect(o.ops.length).toStrictEqual(2);
  expect(last(o.ops)).toStrictEqual("abcxyz");

  o['delete']("d");
  expect(o.ops.length).toStrictEqual(3);
  expect(last(o.ops)).toStrictEqual(-1);

  o['delete']("d");
  expect(o.ops.length).toStrictEqual(3);
  expect(last(o.ops)).toStrictEqual(-2);
});

test('IsNoop', () => {
  let o = new TextOperation();
  expect(o.isNoop()).toBe(true);

  o.retain(5);
  expect(o.isNoop()).toBe(true);

  o.retain(3);
  expect(o.isNoop()).toBe(true);

  o.insert("lorem");
  expect(o.isNoop()).toBe(false);
});

test('ToString', () => {
  let o = new TextOperation();
  o.retain(2);
  o.insert('lorem');
  o['delete']('ipsum');
  o.retain(5);

  expect(o.toString()).toStrictEqual("retain 2, insert 'lorem', delete 5, retain 5");
});

describe('IdJSON', () => {
  for (let i = 1; i <= n; i++) {
    test(`IdJSON ${i}`, () => {
      let doc = h.randomString(50);
      let operation = h.randomOperation(doc);
      expect(operation.equals(TextOperation.fromJSON(operation.toJSON()))).toBe(true);
    });
  }
});

test('FromJSON', () => {
  let ops = [2, -1, -1, 'cde'];
  let o = TextOperation.fromJSON(ops);
  expect(o.ops.length).toStrictEqual(3);
  expect(o.baseLength).toStrictEqual(4);
  expect(o.targetLength).toStrictEqual(5);

  let assertIncorrectAfter = (fn) => {
    var ops2 = ops.slice(0);
    fn(ops2);
    expect(() => {
      TextOperation.fromJSON(ops2);
    }).toThrow("unknown operation:");
  }

  assertIncorrectAfter(function (ops2) { ops2.push({ insert: 'x' }); });
  assertIncorrectAfter(function (ops2) { ops2.push(null); });
});

test('ShouldBeComposedWith', () => {
  let make = () => { return new TextOperation(); }
  let a, b;

  a = make().retain(3);
  b = make().retain(1).insert("tag").retain(2);
  expect(a.shouldBeComposedWith(b)).toBe(true);
  expect(b.shouldBeComposedWith(a)).toBe(true);

  a = make().retain(1).insert("a").retain(2);
  b = make().retain(2).insert("b").retain(2);
  expect(a.shouldBeComposedWith(b)).toBe(true);
  a['delete'](3);
  expect(a.shouldBeComposedWith(b)).toBe(false);

  a = make().retain(1).insert("b").retain(2);
  b = make().retain(1).insert("a").retain(3);
  expect(a.shouldBeComposedWith(b)).toBe(false);

  a = make().retain(4)['delete'](3).retain(10);
  b = make().retain(2)['delete'](2).retain(10);
  expect(a.shouldBeComposedWith(b)).toBe(true);

  b = make().retain(4)['delete'](7).retain(3);
  expect(a.shouldBeComposedWith(b)).toBe(true);

  b = make().retain(2)['delete'](9).retain(3);
  expect(a.shouldBeComposedWith(b)).toBe(false);
});

describe('ShouldBeComposedWithInverted', () => {
  for(let i = 1; i <= n; i++) {
    test(`ShouldBeComposedWithInverted ${i}`, () => {
      // invariant: shouldBeComposedWith(a, b) = shouldBeComposedWithInverted(b^{-1}, a^{-1})
      let str = h.randomString();
      let a = h.randomOperation(str);
      let aInv = a.invert(str);
      let afterA = a.apply(str);
      let b = h.randomOperation(afterA);
      let bInv = b.invert(afterA);
      expect(a.shouldBeComposedWith(b)).toStrictEqual(bInv.shouldBeComposedWithInverted(aInv));
    })
  }
});

describe('Compose', () => {
  for(let i = 1; i <= n; i++) {
    test(`Compose ${i}`, () => {
      // invariant: apply(str, compose(a, b)) === apply(apply(str, a), b)
      let str = h.randomString(20);
      let a = h.randomOperation(str);
      let afterA = a.apply(str);
      expect(afterA.length).toStrictEqual(a.targetLength);

      let b = h.randomOperation(afterA);
      let afterB = b.apply(afterA);
      expect(afterB.length).toStrictEqual(b.targetLength);

      let ab = a.compose(b);
      expect(ab.meta).toStrictEqual(a.meta);
      expect(ab.targetLength).toStrictEqual(b.targetLength);

      let afterAB = ab.apply(str);
      expect(afterAB).toStrictEqual(afterB);
    })
  }
});

describe('Transform', () => {
  for(let i = 1; i <= n; i++) {
    test(`Transform ${i}`, () => {
      // invariant: compose(a, b') = compose(b, a')
      // where (a', b') = transform(a, b)
      let str = h.randomString(20);
      let a = h.randomOperation(str);
      let b = h.randomOperation(str);
      let primes = TextOperation.transform(a, b);
      let aPrime = primes[0];
      let bPrime = primes[1];
      let abPrime = a.compose(bPrime);
      let baPrime = b.compose(aPrime);
      let afterAbPrime = abPrime.apply(str);
      let afterBaPrime = baPrime.apply(str);
      expect(abPrime.equals(baPrime)).toBe(true);
      expect(afterBaPrime).toStrictEqual(afterAbPrime);
    })
  }
});
