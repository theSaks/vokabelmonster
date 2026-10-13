// Erzeugt vokabeln-data.js (Kopie von vokabeln.txt) – nur Fallback, wenn der Browser die Datei nicht lesen darf (Doppelklick auf index.html)
const fs = require('fs'), p = require('path'), d = p.join(__dirname, '..');
fs.writeFileSync(p.join(d, 'vokabeln-data.js'), '// automatisch erzeugt aus vokabeln.txt – nicht bearbeiten (npm run bundle)\nwindow.BUNDLED_VOCAB = ' + JSON.stringify(fs.readFileSync(p.join(d, 'vokabeln.txt'), 'utf8')) + ';\n');
