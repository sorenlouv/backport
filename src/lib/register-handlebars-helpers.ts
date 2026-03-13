import Handlebars from 'handlebars';
import { getShortSha } from './github/commit-formatters.js';

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper('shortSha', getShortSha);
  Handlebars.registerHelper('raw', (options) => options.fn());
}
