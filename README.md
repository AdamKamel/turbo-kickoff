# Turbo Kickoff

3D car football in the browser. Play against bots, or make a private match and send friends a 5-letter code. Works on Mac (keyboard), iPad (touch) and with game controllers.

## Put it online for free (Render)

1. Make a new GitHub repository (for example `turbo-kickoff`) and upload everything in this folder to it.
2. Go to [render.com](https://render.com), choose **New → Web Service**, and pick the repository.
3. Use these settings:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `node server.js`
   - Instance type: **Free**
4. Click **Create Web Service**. After a minute or two you get a link like `https://turbo-kickoff.onrender.com`. That's your website.

On the free plan the server goes to sleep after about 15 minutes with nobody on it. The first visit after that takes around 30–60 seconds to load, then it's fast again.

## Run it on your Mac

```
npm install
npm start
```

Then open http://localhost:3000.

## Add it to the iPad home screen

Open the website in Safari, tap the Share button, then **Add to Home Screen**. It then opens full screen like an app.

## Files

- `public/index.html` – the whole game (graphics, physics, bots, controls)
- `server.js` – serves the game and passes messages between players in the same match
- `render.yaml` – optional Render settings (Render can read these automatically)
