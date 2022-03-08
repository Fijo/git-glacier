import path from "path";
import { promises as fs } from "fs";
import { promisify } from "util";
import { CronJob } from "cron";
import { exec as execCb, CommonOptions } from "child_process";
import globCb from "glob";
import { Registry, Counter, Gauge } from "prom-client";
import { Config } from "./Config";

const exec = promisify(execCb);
const glob = promisify(globCb);
const isDir = promisify(require("is-directory"));

export class GlacierService {
    private _repoPath: string;
    private _active: Gauge<string>;
    private _begin: Counter<string>;
    private _success: Counter<string>;
    private _error: Counter<string>;

    constructor(private _config: Config, registry: Registry) {
        this._repoPath = path.join(process.cwd(), _config.baseDir, './repos');
        this._active = new Gauge<string>({
            name: 'git_glacier_active',
            help: 'git_glacier_active',
            registers: [ registry ]
        });
        const labelNames = ['repoName', 'action'];
        this._begin = new Counter<string>({
            name: 'git_glacier_git_begin',
            help: 'git_glacier_git_begin',
            registers: [ registry ],
            labelNames
        });
        this._success = new Counter<string>({
            name: 'git_glacier_git_success',
            help: 'git_glacier_git_success',
            registers: [ registry ],
            labelNames
        });
        this._error = new Counter<string>({
            name: 'git_glacier_git_error',
            help: 'git_glacier_git_error',
            registers: [ registry ],
            labelNames
        });
    }

    public async init(): Promise<void> {
        this._active.inc();
        try {
            if (!await isDir(this._repoPath))
                await fs.mkdir(this._repoPath);

            const repoDirs: string[] = await glob("*", { cwd: this._repoPath });
            const repos = this._config.repos;
            for (const repoName in repos) {
                if (repoDirs.indexOf(repoName) !== -1)
                    continue;
                const repoUrl = repos[repoName];
                await this.git(`clone --mirror ${repoUrl} ${repoName}`, repoName, "clone", { cwd: this._repoPath });
            }

            for (const repoDir of repoDirs)
                if (!(repoDir in repos)){
                    await fs.rmdir(path.join(this._repoPath, repoDir), { recursive: true });
                    console.log(`removed ${repoDir}`);
                }
        }
        finally {
            this._active.dec();
        }
    }

    public createCron(): CronJob {
        return new CronJob(this._config.cron, async () => {
            this._active.inc();
            try {
                for (const repoName in this._config.repos) {
                    const o = { cwd: path.join(this._repoPath, repoName) };
                    await this.git(`remote update`, repoName, "update", o);
                    await this.git(`gc`, repoName, "gc", o);
                }
            }
            finally {
                this._active.dec();
            }
        });
    }

    private async git(args: string, repoName: string, action: string, options: CommonOptions) {
        const labels = { repoName: repoName, action: action };
        this._begin.inc(labels);
        try {
            const { stdout, stderr } = await exec(`git ${args}`, options);
            if (stdout != undefined)
                console.log(`${repoName} ${action}: ${stdout}`);
            if (stderr != undefined)
                console.warn(`${repoName} ${action}: ${stderr}`);
            this._success.inc(labels);
        }
        catch (ex) {
            this._error.inc(labels);
            console.warn(`${repoName} ${action}: Error ${ex}`);
        }
    }
}