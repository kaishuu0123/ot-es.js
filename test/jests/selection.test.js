import Selection from 'common/selection';
import TextOperation from 'common/text-operation';

let Range = Selection.Range;

test('createCursor', () => {
  expect(Selection.createCursor(5)).toEqual(new Selection([new Range(5, 5)]));
});

test('fromJSON', () => {
  let selection = Selection.fromJSON({ ranges: [{ anchor: 3, head: 5 }, { anchor: 11, head: 23 }] });
  expect(selection).toBeInstanceOf(Selection);
  expect(selection.ranges.length).toStrictEqual(2);
  expect(selection.ranges[0]).toEqual(new Range(3, 5));
  expect(selection.ranges[1]).toEqual(new Range(11, 23));
});

test('Something Selected', () => {
  let selection = new Selection([new Range(7, 7), new Range(10,10)]);
  expect(selection.somethingSelected()).toBe(false);
  selection = new Selection([new Range(7, 10)]);
  expect(selection.somethingSelected()).toBe(true);
});

test('Transform', () => {
  let selection = new Selection([new Range(3, 7), new Range(19, 21)]);
  selection.transform
  expect(selection
    .transform(
      new TextOperation()
        .retain(3)
        .insert('lorem')['delete'](2)
        .retain(42)
    )
  ).toEqual(new Selection([new Range(8, 10), new Range(22,24)]));

  expect(selection
    .transform(
      new TextOperation()['delete'](45)
    )
  ).toEqual(new Selection([new Range(0,0), new Range(0,0)]));
});

test('Compose', () => {
  let a = new Selection([new Range(3, 7)]);
  let b = Selection.createCursor(4);
  expect(a.compose(b)).toStrictEqual(b);
});
