# 🎮 3D Sky Defender

A 3D shooting game with hand gesture controls using MediaPipe.

## 🥽 VR Version Available!

Play in **Meta Quest** or **Apple Vision Pro**! See the `vr/` folder for the WebXR version.

## 📁 Project Structure

```
sky-defender/
├── frontend/           # Client-side files (2D browser version)
│   ├── index.html      # Main HTML file
│   ├── manifest.json   # PWA manifest
│   ├── sw.js           # Service worker
│   ├── css/
│   │   └── styles.css  # Game styles
│   └── js/
│       └── game3d.js   # Game engine
├── vr/                 # VR version (Meta Quest & Vision Pro)
│   ├── index.html      # VR game page
│   ├── js/
│   │   └── vr-game.js  # WebXR game engine
│   ├── manifest.json   # VR PWA manifest
│   └── sw.js           # Service worker
├── services/           # Server-side files
│   └── server.js       # Node.js server
├── START.bat           # Start local server
├── STOP.bat            # Stop local server
├── DEPLOY_ONLINE.bat   # Deploy instructions
├── package.json        # Node.js config
└── README.md           # This file
```

## 🚀 Quick Start

### Option 1: One-Click Deploy (Windows)
Double-click `deploy.bat` - Opens game at http://localhost:3000

### Option 2: Command Line
```bash
npm start
```
Then open http://localhost:3000

### Option 3: Direct File
Open `frontend/index.html` directly in browser (camera may not work without HTTPS)

## 🎯 Controls

| Input | Action |
|-------|--------|
| ✋ Move hand | Aim crosshair |
| 👆 Open index finger | Auto-fire |
| ✊ Close finger | Stop firing |
| 🖱️ Mouse move | Aim (fallback) |
| 🖱️ Mouse hold | Fire (fallback) |
| P / Esc | Pause |

## 🌐 Deploy Online

### Netlify (Free)
1. Go to [netlify.com](https://netlify.com)
2. Drag & drop the `frontend` folder
3. Get your public URL!

### Vercel (Free)
```bash
npx vercel frontend
```

### GitHub Pages
1. Push `frontend` folder to GitHub
2. Enable Pages in repo settings
3. Access via `username.github.io/repo`

## 📱 Access on Any Device

Once deployed online, share the URL to play on:
- Desktop browsers
- Mobile phones
- Tablets

Camera/hand tracking requires HTTPS (automatic on Netlify/Vercel).

## 🎮 Game Features

- 8 enemy types: Fighter, Bomber, Rocket, Missile, Eagle, Hawk, Drone, UFO
- Progressive difficulty over 5 minutes
- Leaderboard with player names
- Combo scoring system
- Works offline (PWA)

## 🥽 VR Mode (Meta Quest / Apple Vision Pro)

### How to Access VR Version
1. Deploy the project to HTTPS (Netlify/Vercel)
2. Open `https://your-domain.com/vr/` in headset browser
3. Click "Enter VR" or "Enter AR"

### VR Controls
| Device | Aim | Shoot |
|--------|-----|-------|
| Quest Controllers | Point controller | Pull trigger |
| Quest Hand Tracking | Point finger | Pinch gesture |
| Vision Pro | Point finger | Pinch gesture |

### Supported Headsets
- Meta Quest 2, 3, Pro
- Apple Vision Pro
- Any WebXR-compatible headset