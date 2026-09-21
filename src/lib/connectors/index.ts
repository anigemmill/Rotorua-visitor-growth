import { weatherConnector } from "./weather";
import { holidaysConnector } from "./holidays";
import type { Connector } from "./types";

export const connectors: Connector[] = [weatherConnector, holidaysConnector];
export type { Connector, ConnectorContext, ConnectorRunResult } from "./types";
