export interface ConnectorRunResult {
  ok: boolean;
  rowsWritten: number;
  error?: string;
}

export interface ConnectorContext {
  destinationId: string;
  destinationSlug: string;
  lat: number;
  lng: number;
}

export interface Connector {
  key: string;
  name: string;
  organisation: string;
  dataType: string;
  run(ctx: ConnectorContext): Promise<ConnectorRunResult>;
}
