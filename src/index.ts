
import { collectDefaultMetrics, Registry } from "prom-client";
import express  from "express";
import { CliConfigReader } from "./CliConfigReader";
import { GlacierService } from "./GlacierService";

const main = async () => {
    const cliConfigReader = new CliConfigReader();
    const config = await cliConfigReader.readConfig(process.argv.slice(2));

    const register = new Registry();
    collectDefaultMetrics({ register });

    const glacierService = new GlacierService(config, register);

    const app = express();
    app.get('/metrics', async (_, res) => {
        res.status(200).set('Content-Type', 'text/plain');
        res.send(await register.metrics());
    });
    app.listen(config.metricsPort);

    await glacierService.init();
    glacierService.createCron().start();
};

main().then();
