import fs from 'fs';
if (!fs.existsSync('public')) fs.mkdirSync('public');
const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
fs.writeFileSync('public/fallback-tile.png', Buffer.from(base64, 'base64'));
