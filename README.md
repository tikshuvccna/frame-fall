# Frame Fall (working title: "המרוץ לכתר")

A browser obstacle-course party game for the Tikshuv 11th-grade course, units 4 and 5 (physical layer, cables, wireless, number systems).
Twelve rounds with twenty runners (races, survival rounds, seesaws and a coin hunt), and five short lessons between them (lesson, checks, quiz and an answer-door mini-game with three levels).

Also: coins to collect and spend in the locker (hats, paints), prize characters won by learning and playing, a hidden knowledge card in every round (album), personal records, settings, credits. Music and sound are synthesised in code (`src/music.ts`, `src/sfx.ts`).

Play: https://tikshuvccna.github.io/frame-fall/

## Run locally
    npm install
    npm run dev      # http://localhost:5212/

Keyboard: arrows or WASD to run, Space to jump, Shift to dive. Touch: stick on the left, two buttons on the right.
Add `?all` to the address to open every round and lesson. Test hooks: `?lv=N`, `?auto`, `?lesson=9`, `?mini=9`, `?screen=locker|prizes|album|records|settings|credits`.

Built with Three.js, TypeScript and Vite. Characters and stage props were modelled in Blender (`art/blender`).
