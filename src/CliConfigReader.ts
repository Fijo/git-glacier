import path from "path";
import { promises as fs } from "fs";
import { Config } from "./Config";
import { CliArgs } from "./CliArgs";

const usageInfo = "Usage git-glacier base_dir myconfig.json.";

export class CliConfigReader {
    public async readConfig(args: string[]): Promise<Config> {
        const configArgs = this.parseArgs(args);
        const configPath = path.join(configArgs.baseDir, configArgs.configPath);
        try {
            return { atomicTimeout: 300000, metricsPort: 9300, ...JSON.parse(await fs.readFile(configPath, 'utf8')), baseDir: configArgs.baseDir };
        }
        catch (ex) {
            console.error(`${usageInfo} Failed to read or parse config file '${configPath}'.`);
            process.exit(-1);
        }
    }

    private parseArgs(args: string[]): CliArgs {
        if (args.length <= 0) {
            console.error(`${usageInfo} No argument was supplied.`);
            process.exit(-1);
        }
        return { baseDir: args[0], configPath: args[1] };
    }
}