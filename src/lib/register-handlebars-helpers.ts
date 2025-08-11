import Handlebars from 'handlebars';
import { getShortSha } from './github/commit-formatters';

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper('shortSha', getShortSha);
  Handlebars.registerHelper('raw', (options) => options.fn());
}
