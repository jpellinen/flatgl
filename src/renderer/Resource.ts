import { RenderContext } from './RenderContext';

export abstract class Resource {
  protected readonly gl: WebGL2RenderingContext;

  constructor(context: RenderContext) {
    this.gl = context.gl;
  }
}
