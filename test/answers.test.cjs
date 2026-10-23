const { test } = require('node:test');
const assert = require('node:assert/strict');
const { answers, chooseAnswer } = require('../src/answers.js');

test('answers are unique and include the requested phrases', () => {
  assert.equal(new Set(answers).size, answers.length);
  for (const phrase of ['Да.', 'Нет.', 'Не знаю.', 'Подумай сам.', 'Ничего.']) assert.ok(answers.includes(phrase));
});
test('every answer can be selected and an immediate repeat is excluded', () => {
  for (const previous of [null, ...answers]) {
    const available = answers.filter(answer => answer !== previous);
    available.forEach((expected, index) => {
      assert.equal(chooseAnswer(previous, () => (index + .5) / available.length), expected);
    });
    assert.ok(available.includes(chooseAnswer(previous, () => 0)));
    assert.ok(available.includes(chooseAnswer(previous, () => 1)));
  }
});
