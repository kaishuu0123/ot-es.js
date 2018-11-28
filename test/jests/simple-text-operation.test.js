import SimpleTextOperation from 'common/simple-text-operation';
import h from '../helpers';

let Insert = SimpleTextOperation.Insert;
let Delete = SimpleTextOperation.Delete;
let Noop   = SimpleTextOperation.Noop;

let randomSimpleTextOperation = (doc) => {
  if (Math.random() < 0.5) {
    return new Insert(
      h.randomString(1 + h.randomInt(10)),
      h.randomInt(doc.length + 1)
    );
  }

  if (doc.length === 0 || Math.random() < 0.2) { return new Noop(); }

  let position = h.randomInt(doc.length);
  let count = 1 + h.randomInt(Math.min(10, doc.length - position));
  return new Delete(count, position);
}

test('Apply', () => {
  expect(new Insert("Weit", 6).apply("Hallo !")).toStrictEqual("Hallo Weit!");
  expect(new Delete(4, 6).apply("Hallo Weit!")).toStrictEqual("Hallo !");
  expect(new Noop().apply("Hallo Welt!")).toStrictEqual("Hallo Welt!");
});

let n = 500;

describe('Random Transform', () => {
  for (let i = 1; i <= n; i++) {
    it(`Random Transform ${i}`, () => {
      let doc = h.randomString(15);
      let a = randomSimpleTextOperation(doc);
      let b = randomSimpleTextOperation(doc);
      let abPrime = SimpleTextOperation.transform(a, b);
      if (abPrime[0].apply(b.apply(doc)) !== abPrime[1].apply(a.apply(doc))) {
        console.log("------------------------");
        console.log(doc);
        console.log(a.toString());
        console.log(b.toString());
        console.log(abPrime[0].toString());
        console.log(abPrime[1].toString());
      }
      expect(abPrime[0].apply(b.apply(doc))).toStrictEqual(abPrime[1].apply(a.apply(doc)));
    });
  }
});

describe('Random FromTextOperation', () => {
  for (let i = 1; i <= n; i++) {
    it(`Random FromTextOperation ${i}`, () => {
      let doc = h.randomString(40);
      let operation = h.randomOperation(doc);
      let doc1 = operation.apply(doc);
      let simpleOperations = SimpleTextOperation.fromTextOperation(operation);
      for (let j = 0; j < simpleOperations.length; j++) {
        doc = simpleOperations[j].apply(doc);
      }
      expect(doc1).toStrictEqual(doc);
    })
  }
});
