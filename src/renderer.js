'use strict';
const $ = id => document.getElementById(id);
const widget = document.querySelector('.widget');
const ring = $('ring');
let busy = false;
let previous = null;
let sound = true;
let pulling = null;
let pull = 0;
let audio;

function tone() {
  if (!sound) return;
  try {
    audio ||= new AudioContext();
    void audio.resume();
    const now = audio.currentTime;
    [523.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * .08);
      gain.gain.linearRampToValueAtTime(.055, now + index * .08 + .015);
      gain.gain.exponentialRampToValueAtTime(.001, now + index * .08 + .4);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(now + index * .08); oscillator.stop(now + index * .08 + .42);
    });
  } catch {}
}
function speak(text) {
  if (!sound || !window.speechSynthesis) return;
  const voice = speechSynthesis.getVoices().find(v => /^ru\b/i.test(v.lang) && v.localService);
  if (!voice) { $('hint').textContent = 'Для озвучки нужен русский голос Windows'; return; }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice; utterance.lang = 'ru-RU'; utterance.rate = .88; utterance.pitch = .9;
  speechSynthesis.cancel(); speechSynthesis.speak(utterance);
}
function ask() {
  if (busy || pulling) return;
  busy = true;
  widget.classList.add('thinking');
  $('bubble').classList.remove('reveal');
  $('eyebrow').textContent = 'РАКУШКА ДУМАЕТ';
  $('answer').textContent = 'М-м-м…';
  $('shell').setAttribute('aria-busy', 'true');
  tone();
  setTimeout(() => {
    previous = ConchAnswers.chooseAnswer(previous);
    $('answer').textContent = previous;
    $('eyebrow').textContent = 'РАКУШКА СКАЗАЛА';
    $('hint').textContent = 'Ещё вопрос? Нажми или потяни колечко.';
    widget.classList.remove('thinking'); $('bubble').classList.add('reveal');
    $('shell').setAttribute('aria-busy', 'false');
    busy = false;
    speak(previous);
  }, 780);
}
function drawPull(distance) {
  ring.style.transform = `translateY(${-distance}px)`;
  const end = 82 - distance;
  const curve = `M 266 125 Q 284 ${112 - distance * .35} 294 ${end}`;
  $('cord-outline').setAttribute('d', curve); $('cord-core').setAttribute('d', curve);
  $('pull-hint').textContent = distance >= 42 ? 'отпусти ✦' : '↑ потяни';
}
ring.addEventListener('pointerdown', event => {
  if (busy || event.button !== 0 || pulling) return;
  pulling = { id: event.pointerId, y: event.clientY };
  pull = 0;
  ring.setPointerCapture(event.pointerId);
});
ring.addEventListener('pointermove', event => {
  if (!pulling || event.pointerId !== pulling.id) return;
  pull = Math.min(80, Math.max(0, pulling.y - event.clientY));
  drawPull(pull);
});
function release(event, cancelled = false) {
  if (!pulling || (event && event.pointerId !== pulling.id)) return;
  const shouldAsk = pull >= 42 && !cancelled;
  const id = pulling.id;
  pulling = null; pull = 0;
  if (ring.hasPointerCapture(id)) ring.releasePointerCapture(id);
  ring.style.transition = 'transform 250ms cubic-bezier(.22,1.5,.5,1)';
  drawPull(0);
  setTimeout(() => { ring.style.transition = ''; }, 260);
  if (shouldAsk) ask();
}
ring.addEventListener('pointerup', event => release(event));
ring.addEventListener('pointercancel', event => release(event, true));
ring.addEventListener('lostpointercapture', event => release(event, true));
window.addEventListener('blur', () => release(null, true));
ring.addEventListener('click', event => { if (event.detail === 0) ask(); });
$('shell').addEventListener('click', ask);
$('sound').addEventListener('click', async () => {
  sound = !sound;
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').textContent = sound ? '♫' : '♪';
  $('sound').title = sound ? 'Звуки и голос Windows включены' : 'Звук выключен';
  if (!sound) speechSynthesis?.cancel();
  await window.conch?.setPreference('sound', sound);
});
$('pin').addEventListener('click', async () => {
  const value = $('pin').getAttribute('aria-pressed') !== 'true';
  const actual = window.conch ? await window.conch.setPreference('alwaysOnTop', value) : value;
  $('pin').setAttribute('aria-pressed', String(actual));
  if (value && !actual) $('hint').textContent = 'Windows не дала закрепить окно поверх других';
});
$('minimize').addEventListener('click', () => window.conch?.minimize());
$('close').addEventListener('click', () => window.conch?.close());
if (window.conch) window.conch.getPreferences().then(preferences => {
  sound = preferences.sound;
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').textContent = sound ? '♫' : '♪';
  $('pin').setAttribute('aria-pressed', String(preferences.alwaysOnTop));
});
