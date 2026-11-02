// Every refusal the domain can make. The API maps `code` to an HTTP status and
// the client shows `message`, so messages are written for the applicant.
export class DomainError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function refuse(code, message, details) {
  throw new DomainError(code, message, details);
}
