(function (root) {
  'use strict';
  const answers = Object.freeze([
    'Да.', 'Нет.', 'Не знаю.', 'Подумай сам.', 'Ничего.',
    'Возможно, когда-нибудь.', 'Спроси ещё раз.', 'Не думаю.',
    'Ни то ни другое.', 'Определённо да.', 'Лучше подожди.',
    'Следуй за морским коньком.'
  ]);
  function chooseAnswer(previous, random = Math.random) {
    const available = answers.filter(answer => answer !== previous);
    return available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))];
  }
  const api = Object.freeze({ answers, chooseAnswer });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ConchAnswers = api;
})(globalThis);
