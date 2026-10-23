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
  function audioFor(answer) {
    const index = answers.indexOf(answer);
    return index < 0 ? null : `assets/audio/answer-${String(index + 1).padStart(2, '0')}.mp3`;
  }
  const api = Object.freeze({ answers, chooseAnswer, audioFor });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ConchAnswers = api;
})(globalThis);
