export interface Config {
    repos: { [name: string]: string };
    cron: string;
    baseDir: string;
    atomicTimeout: number;
    metricsPort: number;
}