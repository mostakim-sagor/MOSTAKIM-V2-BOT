try {
	var { existsSync, writeFileSync, removeSync, mkdirSync, copySync, readdirSync, createWriteStream } = require("fs-extra"),
			axios = require("axios"),
			extract = require("extract-zip"),
			exec = require('child_process').exec;
} catch { return console.error("[!] Required packages for the update are not installed. Run this command in cmd/terminal: 'npm install --save fs-extra axios extract-zip child_process'"); }

try {
	var configValue = require("./config.json");
	console.log("Config file found");
}
catch (error) {
if (error) return console.log("Bot config file not found!");
}

(async () => {
	try {
		console.log("====== PLEASE DO NOT CLOSE THIS CMD/TERMINAL UNTIL THE UPDATE IS COMPLETED ======");
		await backup(configValue);
		await clone();
		await clean();
        await unzip();
		await install();
		await modules();
		await finish(configValue);
	} catch (e) { console.log(e) }
})();

async function backup(configValue) {
	console.log('-> Removing old backup');
	removeSync(process.cwd() + '/tmp');
	console.log('-> Backing up data');
	mkdirSync(process.cwd() + '/tmp');
    mkdirSync(process.cwd() + "/tmp/main")
	if (existsSync('./modules')) copySync('./modules', './tmp/modules');
	if (existsSync(`./${configValue.APPSTATEPATH}`)) copySync(`./${configValue.APPSTATEPATH}`, `./tmp/${configValue.APPSTATEPATH}`);
	if (existsSync('./config.json')) copySync('./config.json', './tmp/config.json');
	if (existsSync(`./includes/${configValue.DATABASE.sqlite.storage}`)) copySync(`./includes/${configValue.DATABASE.sqlite.storage}`, `./tmp/${configValue.DATABASE.sqlite.storage}`);
}

async function clean() {
	console.log('-> Removing old version');
	readdirSync('.').forEach(item => { if (item != 'tmp') removeSync(item); });
}

async function clone() {
	console.log('-> Downloading latest update');
	const response = await axios({
		method: 'GET',
		url: "https://github.com/miraiPr0ject/miraiv2/archive/refs/heads/main.zip",
		responseType: "stream"
	});

	const writer = createWriteStream("./tmp/main.zip");

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on('finish', resolve);
		writer.on('error', (e) => reject('[!] Failed to download the update [!] ' + e));
	});
}

function unzip() {
	console.log('-> Extracting latest update');
	return extract("./tmp/main.zip", { dir: process.cwd() + "/tmp/main" }, (error) => {
		console.log(error);
        if (error) throw new Error(error);
        else return;
	});
}

function install () {
    console.log('-> Installing latest update');
    copySync(process.cwd() + '/tmp/main/miraiv2-main/', './');
    return;
}

function modules() {
	return new Promise(function (resolve, reject) {
		console.log('-> Installing modules');
		let child = exec('npm install');
		child.stdout.on('end', resolve);
		child.stderr.on('data', data => {
			if (data.toLowerCase().includes('error')) {
				console.error('[!] An error occurred. Please create an issue and send the updateError.log file on Github [!]');
				data = data.replace(/\r?\n|\r/g, '');
				writeFileSync('updateError.log', data);
				console.log("[!] Module installation process stopped due to an error. Please install the modules manually. Continuing the final steps [!]");
				resolve();
			}
		});
	});
}

async function finish(configValue) {
	console.log('-> Finishing update');
	if (existsSync(`./tmp/${configValue.APPSTATEPATH}`)) copySync(`./tmp/${configValue.APPSTATEPATH}`, `./${configValue.APPSTATEPATH}`);
	if (existsSync(`./tmp/${configValue.DATABASE.sqlite.storage}`)) copySync(`./tmp/${configValue.DATABASE.sqlite.storage}`, `./includes/${configValue.DATABASE.sqlite.storage}`);
	if (existsSync("./tmp/newVersion")) removeSync("./tmp/newVersion");
	console.log('>> Update completed successfully <<');
	console.log('>> ALL IMPORTANT DATA HAS BEEN BACKED UP INSIDE THE "tmp" FOLDER <<');
	return process.exit(0);
}