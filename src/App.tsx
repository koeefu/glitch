import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, RotateCcw } from 'lucide-react';

const GlitchSynthesizer = () => {
  // --- STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  
  // Effect Parameters
  const [params, setParams] = useState({
    threshold: 200,      // Contrast level (0-255)
    brightness: 100,     // Brightness baseline
    chaos: 0.5,          // Probability of glitch
    slices: 5,           // Slice count
    displacement: 50,    // Max pixel offset
    feedback: 0.1,       // Trail effect
    invertChance: 0.1,   // Color inversion chance
    scale: 1.0,          // Base scale
    zoomGlitch: 0.1,     // Random zoom
  });

  // --- REFS ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const containerRef = useRef(null);

  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // record video
  const startRecording = () => {
    setIsRecording(true);   // ← NEW

    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30);

    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp9"
    });

    recordedChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      setIsRecording(false);   // ← NEW

      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "glitch_effect.webm";
      a.click();
    };

    recorder.start();
    recorderRef.current = recorder;
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
    }
  };



  // --- HANDLERS ---

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.error(e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const resetParams = () => {
    setParams({
      threshold: 200,
      brightness: 100,
      chaos: 0.5,
      slices: 5,
      displacement: 50,
      feedback: 0.1,
      invertChance: 0.1,
      scale: 1.0,
      zoomGlitch: 0.1,
    });
  };

  // --- RENDER LOOP ---
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    
    // Resize handling
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
        canvas.width = clientWidth;
        canvas.height = clientHeight;
      }
    }

    const w = canvas.width;
    const h = canvas.height;

    // 1. Feedback / Trails
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - params.feedback})`;
    ctx.fillRect(0, 0, w, h);

    if (video.readyState < 2) {
      // If no video, draw static noise for "cool factor"
      if (!videoSrc) {
        const idata = ctx.createImageData(w, h);
        const buffer32 = new Uint32Array(idata.data.buffer);
        for (let i = 0; i < buffer32.length; i++) {
           if (Math.random() < 0.1) buffer32[i] = 0xff1a1a1a;
        }
        ctx.putImageData(idata, 0, 0);
      }
      animationRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    // 2. Base Video Draw
    ctx.save();
    ctx.filter = `contrast(${params.threshold}%) brightness(${params.brightness}%) grayscale(100%)`;
    
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(w / vw, h / vh) * params.scale;
    const drawW = vw * scale;
    const drawH = vh * scale;
    const offsetX = (w - drawW) / 2;
    const offsetY = (h - drawH) / 2;

    ctx.globalCompositeOperation = 'screen'; 
    ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    // 3. Glitch Slices
    const r = (min, max) => Math.random() * (max - min) + min;

    for (let i = 0; i < params.slices; i++) {
      if (Math.random() > (1 - params.chaos)) {
        ctx.save();
        
        // Random Color Inversion
        if (Math.random() < params.invertChance) {
          ctx.filter = `invert(100%) contrast(${params.threshold}%) grayscale(100%)`;
          ctx.globalCompositeOperation = 'difference';
        } else {
          ctx.filter = `contrast(${params.threshold}%) brightness(${params.brightness}%) grayscale(100%)`;
          ctx.globalCompositeOperation = 'source-over';
        }

        const sx = Math.random() * vw;
        const sy = Math.random() * vh;
        const sWidth = Math.random() * (vw / 2);
        const sHeight = Math.random() * (vh / 2);

        const dx = (sx * scale) + offsetX + r(-params.displacement, params.displacement);
        const dy = (sy * scale) + offsetY + r(-params.displacement, params.displacement);
        
        const z = 1 + (Math.random() * params.zoomGlitch);
        const dWidth = (sWidth * scale) * z;
        const dHeight = (sHeight * scale) * z;

        ctx.drawImage(video, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        
        // Scanlines
        if (Math.random() < 0.3) {
           ctx.strokeStyle = 'rgba(255,255,255,1)';
           ctx.lineWidth = 2;
           ctx.strokeRect(dx, dy, dWidth, dHeight);
        }

        ctx.restore();
      }
    }

    animationRef.current = requestAnimationFrame(renderLoop);
  }, [params, videoSrc]);

  // --- EFFECTS ---

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(renderLoop);
    } else {
      cancelAnimationFrame(animationRef.current);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, renderLoop]);

  useEffect(() => {
    if (videoSrc && videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [videoSrc]);


  // --- STYLED COMPONENTS HELPERS ---
  
  const Slider = ({ label, value, min, max, step, onChange, desc }) => (
    <div className="control-group">
      <div className="control-label-row">
        <span>{label}</span>
        <span className="control-value">{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {desc && <div className="control-desc">{desc}</div>}
    </div>
  );

  return (
    <div className="glitch-wrapper">
      {/* --- INJECTED STYLES --- */}
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      <style>{`
        :root {
            --bg-color: #050505;
            --panel-bg: #000000;
            --text-main: #e0e0e0;
            --text-muted: #888;
            --accent: #fff;
            --border: #333;
            --font-stack: 'Space Mono', monospace;
        }

        
        .glitch-wrapper {
            display: flex;
            width: 100vw;
            height: 100vh;
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: var(--font-stack);
            overflow: hidden;
        }

        /* SIDEBAR */
        .sidebar {
            width: 320px;
            min-width: 320px;
            background: var(--panel-bg);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            height: 100%;
            z-index: 10;
        }
        .sidebar-header {
            padding: 1.5rem;
            border-bottom: 2px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logo {
            font-size: 1.2rem;
            font-weight: 700;
            letter-spacing: 1px;
            color: var(--accent);
            margin: 0;
        }
        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 1.5rem;
        }
        /* Custom Scrollbar */
        .sidebar-content::-webkit-scrollbar { width: 6px; }
        .sidebar-content::-webkit-scrollbar-track { background: #111; }
        .sidebar-content::-webkit-scrollbar-thumb { background: #333; }
        .sidebar-content::-webkit-scrollbar-thumb:hover { background: #555; }

        .section-title {
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            margin-bottom: 1rem;
            margin-top: 1.5rem;
            letter-spacing: 0.5px;
        }
        .section-title:first-of-type { margin-top: 0; }

        /* CONTROLS */
        .control-group {
            border-left: 2px solid var(--border);
            padding-left: 1rem;
            margin-bottom: 1.5rem;
            transition: border-color 0.3s;
        }
        .control-group:hover { border-left-color: var(--accent); }

        .control-label-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 0.25rem;
        }
        .control-value { color: var(--text-muted); font-size: 0.75rem; }
        .control-desc { font-size: 0.65rem; color: #555; margin-top: 0.25rem; }

        input[type=range] {
            -webkit-appearance: none;
            width: 100%;
            background: transparent;
            margin-top: 0.5rem;
            display: block;
            cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 16px;
            width: 16px;
            background: var(--accent);
            margin-top: -6px;
            border-radius: 0;
            transition: transform 0.1s;
        }

        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }
        input[type=range]::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            background: #333;
        }
        input[type=range]:focus { outline: none; }

        /* UPLOAD & BUTTONS */
        .file-upload-container {
            border: 1px dashed var(--border);
            padding: 1rem;
            text-align: center;
            margin-bottom: 1rem;
            cursor: pointer;
            transition: border-color 0.2s;
            position: relative;
        }
        .file-upload-container:hover { border-color: var(--text-muted); }
        .file-upload-text { font-size: 0.75rem; color: var(--text-muted); }
        .file-input-hidden {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            opacity: 0;
            cursor: pointer;
        }

        .btn-group { display: flex; gap: 10px; margin-bottom: 1.5rem; }
        .btn {
            flex: 1;
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 10px;
            font-family: var(--font-stack);
            font-size: 0.75rem;
            text-transform: uppercase;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 5px;
            transition: all 0.2s;
        }
        .btn:hover { border-color: var(--accent); background: rgba(255,255,255,0.05); }
        .btn.active { background: var(--accent); color: #000; border-color: var(--accent); }
        .btn-icon { width: 14px; height: 14px; }
        .btn.recording {
          background: white !important;
          color: black !important;
          border-color: white !important;
        }


        /* MAIN VIEW */
        .main-view {
            flex: 1;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #080808;
            background-image: 
                radial-gradient(#222 1px, transparent 1px), 
                radial-gradient(#222 1px, transparent 1px);
            background-size: 30px 30px;
            background-position: 0 0, 15px 15px;
            overflow: hidden;
        }
        .crt-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), 
                        linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
            z-index: 20;
        }
        .no-signal {
            position: absolute;
            text-align: center;
            pointer-events: none;
            z-index: 5;
        }
        .no-signal h1 { font-size: 2rem; margin: 0 0 1rem 0; letter-spacing: 4px; }
        .no-signal p { font-size: 0.8rem; color: #666; }
        
        .meta-info {
            position: absolute;
            bottom: 1rem;
            left: 1rem;
            font-size: 0.6rem;
            color: #444;
            z-index: 10;
        }

        #glitch-canvas {
            max-width: 90%;
            max-height: 90%;
            box-shadow: 0 0 50px rgba(0,0,0,0.8);
            border: 1px solid #222;
            background: #000;
        }
      `}</style>

      {/* --- HIDDEN VIDEO --- */}
      <video
        ref={videoRef}
        src={videoSrc}
        loop
        muted
        playsInline
        className="hidden" // Tailwind utility still works if you have it, but standard CSS handles hidden if not
        style={{ display: 'none' }}
        crossOrigin="anonymous"
      />

      {/* --- SIDEBAR --- */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Glitch Synthesizer</h1>
          <button onClick={resetParams} className="btn" style={{ padding: '5px', flex: '0 0 auto' }} title="Reset">
             <RotateCcw size={14} />
          </button>
        </div>

        <div className="sidebar-content">
          <div className="section-title">Source Input</div>
          
          <div className="file-upload-container">
            <span className="file-upload-text">DRAG VIDEO OR CLICK TO UPLOAD</span>
            <input 
                type="file" 
                accept="video/*" 
                onChange={handleFileUpload} 
                className="file-input-hidden"
            />
          </div>

          <div className="btn-group">
            <button 
                className={`btn ${isPlaying ? 'active' : ''}`} 
                onClick={() => { if(!isPlaying) togglePlay(); }}
                disabled={!videoSrc}
            >
                <Play className="btn-icon" /> PLAY
            </button>
            <button 
                className={`btn ${!isPlaying ? 'active' : ''}`} 
                onClick={() => { if(isPlaying) togglePlay(); }}
                disabled={!videoSrc}
            >
                <Pause className="btn-icon" /> PAUSE
            </button>
          </div>

          <div className="btn-group">
           <button
              className={`btn ${isRecording ? "recording" : ""}`}
              onClick={() => {
                if (isRecording) stopRecording();
                else startRecording();
              }}
            >
              {isRecording ? "Recording..." : "Record"}
            </button>

            <button className="btn" onClick={stopRecording}>Stop & Download</button>
          </div>


          <div className="section-title">Signal Processing</div>
          <Slider label="Threshold" value={params.threshold} min={0} max={500} step={10} onChange={v => setParams(p => ({ ...p, threshold: v }))} desc="B&W cutoff point" />
          <Slider label="Gain (Brightness)" value={params.brightness} min={0} max={300} step={10} onChange={v => setParams(p => ({ ...p, brightness: v }))} />
          <Slider label="Invert Chance" value={params.invertChance} min={0} max={1} step={0.05} onChange={v => setParams(p => ({ ...p, invertChance: v }))} />

          <div className="section-title">Entropy / Glitch</div>
          <Slider label="Chaos Prob." value={params.chaos} min={0} max={1} step={0.01} onChange={v => setParams(p => ({ ...p, chaos: v }))} />
          <Slider label="Slice Count" value={params.slices} min={0} max={50} step={1} onChange={v => setParams(p => ({ ...p, slices: v }))} desc="Height of glitch strips" />
          <Slider label="Displacement" value={params.displacement} min={0} max={300} step={5} onChange={v => setParams(p => ({ ...p, displacement: v }))} />
          <Slider label="Zoom Jitter" value={params.zoomGlitch} min={0} max={2} step={0.1} onChange={v => setParams(p => ({ ...p, zoomGlitch: v }))} />

          <div className="section-title">Temporal Feedback</div>
          <Slider label="Ghosting" value={params.feedback} min={0.01} max={0.99} step={0.01} onChange={v => setParams(p => ({ ...p, feedback: v }))} desc="Trail retention" />
          <Slider label="Global Scale" value={params.scale} min={0.5} max={3} step={0.1} onChange={v => setParams(p => ({ ...p, scale: v }))} />

        </div>
      </aside>

      {/* --- MAIN VIEW --- */}
      <main className="main-view" ref={containerRef}>
        <div className="crt-overlay"></div>
        
        {!videoSrc && (
            <div className="no-signal">
                <h1>NO SIGNAL</h1>
                <p>Upload a video to begin simulation.</p>
            </div>
        )}

        <div className="meta-info">
            RENDERER: CANVAS 2D <br />
            RES: {containerRef.current ? `${containerRef.current.clientWidth}x${containerRef.current.clientHeight}` : 'INIT'}
        </div>

        <canvas id="glitch-canvas" ref={canvasRef} />
      </main>
    </div>
  );
};

export default GlitchSynthesizer;