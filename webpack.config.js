const path = require('path'); // Required to resolve absolute system paths
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const BUILD_META_PATH = path.resolve(__dirname, 'build', 'build-info.json');

const PLATFORM_SDK_SCRIPTS = {
	poki: [{ src: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js' }],
	crazygames: [{ src: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' }],
};

const getBuildChannel = () => {
	try {
		const buildInfo = JSON.parse(fs.readFileSync(BUILD_META_PATH, 'utf8'));
		return buildInfo.channel ?? 'local';
	} catch {
		return process.env.BUILD_CHANNEL ?? 'local';
	}
};

const channel = getBuildChannel();
const platformSdkScripts = PLATFORM_SDK_SCRIPTS[channel] ?? [];

module.exports = (_env, argv) => ({
	entry: './src/index.ts', // Entry point (main source file)
	mode: argv.mode ?? 'development',
	devtool: argv.mode === 'production' ? false : 'inline-source-map',
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.m?js$/,
				resolve: {
					fullySpecified: false,
				},
			},
		],
	},
	resolve: {
		alias: {
			'pixi.js': path.resolve(__dirname, 'node_modules/pixi.js/lib/index.mjs'),
		},
		extensions: ['.ts', '.js'],
		fullySpecified: false,
	},
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist'),
		clean: true, // Cleans the dist folder before each build
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: 'src/index.html',
			title: 'Fairy Blob',
			favicon: 'src/favicon.ico',
			platformChannel: channel,
			platformSdkScripts,
		}),
		new CopyPlugin({ // Copies static asset files to the build directory
			patterns: [
				{
					from: path.resolve(__dirname, 'src/assets'),
					to: path.resolve(__dirname, 'dist/assets'),
					noErrorOnMissing: true, // Prevents crashes if the assets folder is empty
				},
			],
		}),
	],
	devServer: {
		static: [
			{
				directory: path.resolve(__dirname, 'dist'), // Serves files from the virtual dist folder
			},
		],
		hot: true, // Enables Hot Module Replacement (HMR) on code changes
		host: '0.0.0.0',
		port: 3000,
		allowedHosts: 'all',
	},
});
