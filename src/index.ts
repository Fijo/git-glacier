
const fs = require('fs').promises;
const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const glob = promisify(require('glob'));
const isDir = promisify(require('is-directory'));
const path = require('path');
const cron = require('cron').CronJob;

const loadConfig = async (args: string[]): Promise<{repos: {[name: string]: string}, cron: string, baseDir: string }> => {
    const usageInfo = "Usage git-glacier base_dir myconfig.json.";
    if (args.length <= 0) {
        console.error(`${usageInfo} No argument was supplied.`);
        process.exit(-1);
    }
    const baseDir = args[0];
    const configPath = path.join(baseDir, args[1]);
    try {
        return { ...JSON.parse(await fs.readFile(configPath, 'utf8')), baseDir };
    }
    catch (ex) {
        console.error(`${usageInfo} Failed to read or parse config file '${configPath}'.`);
        process.exit(-1);
    }
};

const main = async () => {
    const config = await loadConfig(process.argv.slice(2));

    const repoPath = path.join(config.baseDir, './repos');
    const cwd = path.join(process.cwd(), repoPath);

    if (!await isDir(repoPath))
        await fs.mkdir(repoPath);

    const repoDirs: string[] = await glob("*", { cwd });

    for (const repoName in config.repos) {
        if (repoDirs.indexOf(repoName) !== -1)
            continue;
        const repoUrl = config.repos[repoName];
        const test = await exec(`git clone --mirror ${repoUrl} ${repoName}`, { cwd });
        console.log(test);
    }

    for (const repoDir of repoDirs)
        if (!(repoDir in config.repos))
            console.log(await fs.rmdir(path.join(cwd, repoDir), { recursive: true }));

    const schedule = new cron(config.cron, async () => {
        for (const repoName in config.repos)
            console.log(await exec(`git remote update`, { cwd: path.join(cwd, repoName) }));
        console.log("cron ran");
    });
    schedule.start();
};

main().then();
