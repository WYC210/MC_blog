# Homecraft — Wyc Home

[中文](README.md) · **English**

## About

A personal website built as an explorable 3D world with Homecraft and Three.js. Its Minecraft-inspired islands bring the site content into the world: wander the sandy home island, swim along the coast, and visit Qin Island, inspired by Qinhuangdao's maritime quest-for-immortality heritage. Explore its palace, Great Wall gallery and seaside scenery. Day, night and changing weather keep the world in motion; switch between normal and HD materials when you like. Projects, profile and guestbook pages remain accessible in-world, on desktop and mobile.

## In-game screenshots · [Visit Wyc Home](https://www.wyc21.com/)

### Normal materials

| Home island | Qin Island | Piano room |
| :---: | :---: | :---: |
| <img src="docs/images/main-island-normal.webp" width="260" alt="Home island with normal materials"> | <img src="docs/images/qin-island-normal.webp" width="260" alt="Qin Island with normal materials"> | <img src="docs/images/piano-normal.webp" width="260" alt="Piano room with normal materials"> |

### HD materials

| Day | Dusk | Night |
| :---: | :---: | :---: |
| <img src="docs/images/main-island-hd-day.webp" width="260" alt="Home island in daylight with HD materials"> | <img src="docs/images/main-island-hd-dusk.webp" width="260" alt="Home island at dusk with HD materials"> | <img src="docs/images/main-island-hd-night.webp" width="260" alt="Home island at night with HD materials"> |

| Night view | Rain | Snow |
| :---: | :---: | :---: |
| <img src="docs/images/main-island-hd-night-view.webp" width="260" alt="HD night view of the home island"> | <img src="docs/images/main-island-hd-rain.webp" width="260" alt="Home island in rain with HD materials"> | <img src="docs/images/main-island-hd-snow.webp" width="260" alt="Home island in snow with HD materials"> |

<p align="center"><img src="docs/images/main-island-hd-selfie.webp" width="320" alt="Selfie view with HD materials"></p>

### Run locally

No build step is required. From the project directory, run:

```sh
python3 tools/serve.py
```

On Windows, use `python tools/serve.py`. The script finds an available port and opens the site in your browser. Main customization points are `world/`, `index.html`, `home.config.js` and `homecraft.json`.


## Links

- [Visit Wyc Home](https://www.wyc21.com/)
- [Homecraft project and listing requests](https://github.com/terryHu7/homecraft)
- [LINUX DO](https://linux.do)
