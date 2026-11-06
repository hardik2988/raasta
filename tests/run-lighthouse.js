const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const CDP_PORT = 9222;
const ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function ensureServer() {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}/index.html`, res => {
      console.log(`Server already active on port ${PORT}`);
      resolve(null);
    }).on('error', () => {
      const server = http.createServer((req, res) => {
        let reqPath = decodeURI(req.url.split('?')[0]);
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
        const filePath = path.join(ROOT, reqPath);

        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          fs.createReadStream(filePath).pipe(res);
        });
      });

      server.listen(PORT, '127.0.0.1', () => {
        console.log(`Server started at http://127.0.0.1:${PORT}`);
        resolve(server);
      });
    });
  });
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function main() {
  const server = await ensureServer();

  console.log('Launching Chrome on port 9222...');
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  await wait(2000);

  const pages = [
    { url: `http://127.0.0.1:${PORT}/index.html`, name: 'Home' },
    { url: `http://127.0.0.1:${PORT}/wayfinder.html`, name: 'Wayfinder' },
    { url: `http://127.0.0.1:${PORT}/places.html`, name: 'Places' },
    { url: `http://127.0.0.1:${PORT}/gestalt.html`, name: 'Gestalt' },
    { url: `http://127.0.0.1:${PORT}/process.html`, name: 'Process' }
  ];

  const allResults = [];

  for (const page of pages) {
    const outputPath = path.resolve(ROOT, 'tests', `lh-${page.name.toLowerCase()}.report.json`);
    const cmd = `npx lighthouse "${page.url}" --port=${CDP_PORT} --quiet "--only-categories=performance" "--only-categories=accessibility" "--only-categories=best-practices" "--only-categories=seo" --output=json --output-path="${outputPath}"`;

    console.log(`\nAuditing ${page.name} (${page.url})...`);
    try {
      execSync(cmd, { stdio: 'pipe' });
      const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const categories = report.categories;

      const scores = {
        performance: categories.performance ? Math.round(categories.performance.score * 100) : 'N/A',
        accessibility: categories.accessibility ? Math.round(categories.accessibility.score * 100) : 'N/A',
        bestPractices: categories['best-practices'] ? Math.round(categories['best-practices'].score * 100) : 'N/A',
        seo: categories.seo ? Math.round(categories.seo.score * 100) : 'N/A'
      };

      console.log(`  Performance:    ${scores.performance}`);
      console.log(`  Accessibility:  ${scores.accessibility}`);
      console.log(`  Best Practices: ${scores.bestPractices}`);
      console.log(`  SEO:            ${scores.seo}`);

      allResults.push({ name: page.name, scores });
    } catch (err) {
      console.error(`Error on ${page.name}:`, err.message);
      if (err.stderr) console.error(err.stderr.toString());
    }
  }

  chrome.kill();
  if (server) server.close();

  console.log('\n======================================================');
  console.log('              LIGHTHOUSE AUDIT SUMMARY                ');
  console.log('======================================================');
  console.table(allResults.map(r => ({
    Page: r.name,
    Performance: r.scores.performance,
    Accessibility: r.scores.accessibility,
    'Best Practices': r.scores.bestPractices,
    SEO: r.scores.seo
  })));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
