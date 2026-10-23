# Разработка

Нужны Node.js 24+, стабильный Rust и [зависимости Tauri](https://v2.tauri.app/start/prerequisites/).
Для Windows нужны C++ Build Tools и WebView2, для Mac нужны Xcode Command Line Tools.

```sh
npm ci
npm start
```

`npm run build` собирает приложение для текущей системы. Сборка Mac выполняется на Mac.
Для универсальной версии установи Rust targets `aarch64-apple-darwin` и `x86_64-apple-darwin`:

```sh
npm run build -- --target universal-apple-darwin --bundles app,dmg
```

Готовые файлы находятся в `src-tauri/target/release/bundle/`, а при выборе target в соответствующей подпапке target.
В GitHub Actions есть сборка Windows x64 и macOS Universal.

## Проверка

```sh
npx playwright install chromium webkit
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

`CONCH_BROWSER=webkit node test/widget.browser.cjs` проверяет интерфейс в WebKit.
В Windows `CONCH_EXECUTABLE=<путь к exe> npm run test:native` проверяет собранное приложение.
На Windows эти переменные задаются через `$env:ИМЯ = 'значение'` в PowerShell.

Тесты проверяют ответы, все 12 аудиозаписей, воспроизведение и выключение звука,
нажатие, порог и отмену тяги, клавиатуру. Нативный тест проверяет также настройки и перезапуск.

## Файлы

- `src/`: интерфейс, ответы и проигрывание звука.
- `src-tauri/`: окно приложения, настройки и установщики.
- `assets/audio/`: готовые записи и их контрольные суммы.
- `scripts/generate-voice.py`: повторная генерация записей через `edge-tts==7.3.1`.

Python, Rust, Node.js и онлайн-синтез пользователям готового приложения не нужны.
Записи входят в сборку. Для генерации записей разработчику нужен интернет.
В тестах `CONCH_TEST_DATA` задаёт отдельную папку настроек.
