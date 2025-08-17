## Air Draw — Hand-Tracking Camera App

Modern, minimal browser app to draw in the air using your hand and webcam.

### Tech
- React + Vite + TypeScript
- Tailwind CSS
- MediaPipe Tasks (Hand Landmarker)
- Framer Motion (optional)

### Local Development
```bash
npm install
npm run dev
```

Open `http://localhost:5173` and allow camera access.

### Build
```bash
npm run build
npm run preview
```

### Deploy to Vercel
- Push this `webapp` folder to a Git repo and import it on Vercel.
- Framework preset: Vite. Build command: `npm run build`. Output: `dist`.

### Features
- Start/Stop camera, Clear canvas
- Change stroke color and size
- Optional pinch-to-draw (index + thumb)
