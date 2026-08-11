// split.lab — multi-video comparison tool with mask-line wipes + ffmpeg export
// Zero-dependency Node server. Run: node server.js  →  http://localhost:8165

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 8165;
const PUBLIC = path.join(__dirname, 'public');
const WORK = path.join(os.tmpdir(), 'split-lab-export');
const FRAMES = path.join(WORK, 'frames');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function ffmpegArgs(fps, format, outFile, audioFiles) {
  const args = ['-y', '-framerate', String(fps), '-i', path.join(FRAMES, '%06d.png')];
  audioFiles.forEach(f => args.push('-i', f));

  const scale = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const isMp4 = format === 'mp4';
  const vcodec = format === 'prores'
    ? ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le']
    : format === 'prores4444'
      ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
      : ['-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  const acodec = isMp4 ? ['-c:a', 'aac', '-b:a', '320k'] : ['-c:a', 'pcm_s16le'];

  if (audioFiles.length > 1) {
    // mix all enabled audio tracks; scale must live in the same filtergraph for mp4
    const amix = audioFiles.map((_, i) => `[${i + 1}:a]`).join('')
      + `amix=inputs=${audioFiles.length}:duration=longest[aout]`;
    const fc = isMp4 ? `[0:v]${scale}[vout];${amix}` : amix;
    args.push('-filter_complex', fc, '-map', isMp4 ? '[vout]' : '0:v:0', '-map', '[aout]');
  } else {
    if (isMp4) args.push('-vf', scale);
    if (audioFiles.length === 1) args.push('-map', '0:v:0', '-map', '1:a:0');
  }

  args.push(...vcodec);
  if (audioFiles.length) args.push(...acodec, '-shortest');
  args.push(outFile);
  return args;
}

function runFFmpeg(args) {
  return new Promise(resolve => {
    const ff = spawn('ffmpeg', args);
    let stderr = '';
    ff.stderr.on('data', d => { stderr += d; });
    ff.on('close', code => resolve({ code, stderr }));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'POST' && url.pathname === '/api/start') {
      fs.rmSync(WORK, { recursive: true, force: true });
      fs.mkdirSync(FRAMES, { recursive: true });
      res.writeHead(200).end('ok');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/frame') {
      const i = parseInt(url.searchParams.get('i'), 10);
      if (!Number.isInteger(i) || i < 0) { res.writeHead(400).end('bad index'); return; }
      const body = await collectBody(req);
      fs.writeFileSync(path.join(FRAMES, String(i).padStart(6, '0') + '.png'), body);
      res.writeHead(200).end('ok');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/audio') {
      const i = parseInt(url.searchParams.get('i'), 10);
      const ext = (url.searchParams.get('ext') || 'mp4').replace(/[^a-z0-9]/gi, '') || 'mp4';
      if (!Number.isInteger(i) || i < 0) { res.writeHead(400).end('bad index'); return; }
      const body = await collectBody(req);
      fs.writeFileSync(path.join(WORK, `audio_${String(i).padStart(2, '0')}.${ext}`), body);
      res.writeHead(200).end('ok');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/render') {
      const fps = parseFloat(url.searchParams.get('fps')) || 25;
      const format = url.searchParams.get('format') || 'mp4';
      const ext = format === 'mp4' ? 'mp4' : 'mov';
      const outFile = path.join(WORK, `out.${ext}`);

      const audioFiles = fs.readdirSync(WORK)
        .filter(f => f.startsWith('audio_')).sort()
        .map(f => path.join(WORK, f));

      let result = await runFFmpeg(ffmpegArgs(fps, format, outFile, audioFiles));
      if (result.code !== 0 && audioFiles.length) {
        // a source may have no audio track — fall back to video-only rather than failing
        result = await runFFmpeg(ffmpegArgs(fps, format, outFile, []));
      }
      if (result.code !== 0) {
        res.writeHead(500, { 'Content-Type': 'text/plain' }).end(result.stderr.slice(-2000));
        return;
      }
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
      res.writeHead(200, {
        'Content-Type': format === 'mp4' ? 'video/mp4' : 'video/quicktime',
        'Content-Disposition': `attachment; filename="split-lab_${stamp}.${ext}"`,
        'Content-Length': fs.statSync(outFile).size,
      });
      fs.createReadStream(outFile).pipe(res);
      return;
    }

    // static
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(PUBLIC, path.normalize(file));
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, () => console.log(`split.lab → http://localhost:${PORT}`));
