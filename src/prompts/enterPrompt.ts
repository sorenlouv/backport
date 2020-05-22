import { Prompt, PromptOptions } from '@sqren/enquirer';
import chalk from 'chalk';
import cliSpinners from 'cli-spinners';
import { HandledError } from '../services/HandledError';

class EnterPrompt extends Prompt {
  inProgressPromise?:
    | string
    | boolean
    | Promise<boolean>
    | Promise<string>
    | null;
  pressEnterText: string;
  errorMessage: string;
  _validate?: PromptOptions['validate'];

  constructor({
    pressEnterText = `Press ${chalk.bold('<ENTER>')} to continue`,
    errorMessage = '',
    validate,
    ...options
  }: PromptOptions & { errorMessage?: string; pressEnterText?: string }) {
    super(options);
    this.pressEnterText = pressEnterText;
    this._validate = validate;
    this.errorMessage = errorMessage;
    this.cursorHide();
  }

  // @ts-ignore
  message() {
    // @ts-ignore
    return this.element('message');
  }

  async validate() {
    // no validation
    if (!this._validate) {
      return true;
    }

    // validation in progress
    if (this.inProgressPromise) {
      return this.inProgressPromise;
    }

    // initiate validation
    this.inProgressPromise = this._validate('TODO');

    // show spinner
    const message = await this.message();
    const spinner = cliSpinners.dots;
    let i = 0;
    const id = setInterval(() => {
      const { size } = this.state;
      const { frames } = spinner;
      const spin = frames[(i = ++i % frames.length)];

      this.clear(size);
      this.write(`${spin} ${message}`);
      this.restore();
    }, spinner.interval);

    const value = await this.inProgressPromise;
    clearInterval(id);
    this.inProgressPromise = null;

    // validation failed: set error message
    if (typeof value === 'string') {
      this.errorMessage = value;
    }

    // validations passed
    return value === true;
  }

  async render() {
    const { submitted } = this.state;

    const prefix = await this.prefix();
    const message = await this.message();

    const { size } = this.state;
    this.clear(size);

    // pending
    if (!submitted) {
      this.write(
        `${prefix} ${message}\n\n${this.errorMessage}\n\n${this.pressEnterText}`
      );

      // succeeded or failed
    } else {
      this.write(`${prefix} ${message}`);
    }
    this.restore();
  }
}

export interface EnterPromptOptions {
  message: string;
  pressEnterText?: string;
  errorMessage?: string;
  validate?: (value?: string) => boolean | string | Promise<string | boolean>;
}

// exposed for testing purposes
export let _currentPrompt: EnterPrompt;

export async function enterPrompt(
  options: EnterPromptOptions
): Promise<undefined> {
  const prompt = new EnterPrompt(options as PromptOptions);

  _currentPrompt = prompt;
  try {
    return await prompt.run();
  } catch (e) {
    if (!e) {
      throw new HandledError('Aborted');
    }
    throw e;
  }
}
