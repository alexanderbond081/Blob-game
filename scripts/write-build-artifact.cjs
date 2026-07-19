const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BUILD_META_PATH = path.join(ROOT_DIR, 'build', 'build-info.json');
const DIST_BUILD_PATH = path.join(ROOT_DIR, 'dist', 'BUILD.txt');

if (!fs.existsSync(BUILD_META_PATH)) {
	console.error('Missing build/build-info.json. Run generate-build-info first.');
	process.exit(1);
}

const buildInfo = JSON.parse(fs.readFileSync(BUILD_META_PATH, 'utf8'));
const dirtySuffix = buildInfo.gitDirty ? ' (uncommitted changes)' : '';

const uploadHints = {
	itch: 'Upload the whole dist/ folder to itch.io (HTML zip or butler).',
	poki: 'Upload the whole dist/ folder via Poki for Developers (after acceptance).',
	crazygames: 'Upload the whole dist/ folder via CrazyGames developer portal.',
	release: 'Generic production build — pick a platform-specific npm script before upload.',
	local: 'Local / non-release build.',
};

const uploadHint = uploadHints[buildInfo.channel] ?? uploadHints.release;

const buildText = [
	'Fairy Blob build',
	'================',
	`Version:  ${buildInfo.version}`,
	`Channel:  ${buildInfo.channel}`,
	`Mode:     ${buildInfo.mode}`,
	`Git:      ${buildInfo.gitSha}${dirtySuffix}`,
	`Build ID: ${buildInfo.buildId}`,
	`Built at: ${buildInfo.builtAt}`,
	'',
	uploadHint,
].join('\n');

fs.writeFileSync(DIST_BUILD_PATH, `${buildText}\n`);
console.log(`Wrote ${path.relative(ROOT_DIR, DIST_BUILD_PATH)}`);
