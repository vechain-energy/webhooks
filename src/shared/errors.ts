export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class DeliveryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DeliveryError';
  }
}
