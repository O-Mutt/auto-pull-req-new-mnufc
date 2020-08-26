import start from './src/AutoPuller';
import { Logger } from "tslog";

require('dotenv').config();
const log: Logger = new Logger({ name: "Index Logger" });

log.info(`Starting the auto puller`);
start();
