/** An expected model-domain or convergence failure, safe to show as an input error. */
export class SolverInputError extends Error {
  constructor(message, field = 'project') {
    super(message);
    this.name = 'SolverInputError';
    this.field = field;
  }
}
