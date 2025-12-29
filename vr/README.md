# Sky Defender VR 🥽

VR-optimized version of Sky Defender for Meta Quest and Apple Vision Pro headsets.

## Supported Devices

| Device | Mode | Controls |
|--------|------|----------|
| Meta Quest 2/3/Pro | Immersive VR | Controllers or Hand Tracking |
| Apple Vision Pro | Immersive AR | Hand Tracking (Pinch to shoot) |
| Desktop Browser | 2D Mode | Mouse/Keyboard |
| Mobile Browser | 2D Mode | Touch |

## How to Play

### VR Mode (Quest/Vision Pro)
1. Open the game URL in your headset's browser
2. Click "Enter VR" or "Enter AR" button
3. Use controllers or hands to aim
4. Pull trigger or pinch to shoot

### Hand Tracking Controls
- **Point** with your index finger to aim
- **Pinch** (thumb + index) to fire
- Aim at enemies flying toward you

### Controller Controls
- **Point** controller to aim
- **Trigger** to fire continuously

## Deployment

### For Meta Quest
1. Deploy to any HTTPS server (required for WebXR)
2. Open in Quest Browser: `https://your-domain.com/vr/`
3. Click "Enter VR" button

### For Apple Vision Pro
1. Deploy to HTTPS server
2. Open in Safari on Vision Pro
3. Click "Enter AR" button
4. Game runs in mixed reality mode

### Quick Deploy Options
- **Netlify**: Drag & drop the entire project folder
- **Vercel**: Connect GitHub repo
- **GitHub Pages**: Enable in repo settings

## Technical Details

- **Engine**: Three.js with WebXR
- **Hand Tracking**: WebXR Hand Input API
- **Compatibility**: WebXR Polyfill included for broader support
- **PWA**: Installable as app on supported devices

## File Structure
```
vr/
├── index.html      # Main VR game page
├── js/
│   └── vr-game.js  # VR game engine
├── manifest.json   # PWA manifest
├── sw.js          # Service worker
└── README.md      # This file
```

## Requirements

- HTTPS connection (required for WebXR)
- WebXR-compatible browser
- For VR: Meta Quest Browser or similar
- For AR: Safari on Vision Pro
