# Raasta: UPES campus wayfinder

A Gestalt principles web assignment. Plain HTML, CSS and JavaScript. No build step.

## Run it on your computer (VS Code)
1. Open this folder in VS Code.
2. Install the "Live Server" extension and click "Go Live" (or just double-click index.html).

## Deploy on Vercel
1. Put this folder in a GitHub repo (git init, git add ., git commit, push).
2. On vercel.com choose "Add New > Project", pick the repo, and press Deploy. No settings needed.

## Files
- index.html: Home
- wayfinder.html: the main flow (choose A and B, route, steps)
- gestalt.html: the 8 principles with live demos
- process.html: design process (fill in the sketches section yourself)
- js/data.js: ALL campus data (places, roads). Edit this to fix positions.
- js/route-core.js: shortest-path routing and written directions
- js/wayfinder.js: route finder page behaviour
- js/site.js: shared helpers, home page, Gestalt demos
- css/styles.css: the design system

## Fix a wrong place
Open js/data.js. Each place has x and y (pixels on the 1045 x 756 map) and a "node" (the road junction it connects to).
Change x/y to move the pin. Road names are descriptive labels; rename them if you know the real ones.

## Before you submit
- Add your own sketches (process.html section 4).
- Add screenshots of the site to your PDF.
- Be ready to explain every decision in your own words.
