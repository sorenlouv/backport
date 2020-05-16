//@ts-ignore
import { MultiSelect, Select } from '@sqren/enquirer';
import chalk from 'chalk';
import { HandledError } from '../services/HandledError';

type Choice<T> = {
  name: string;
  displayShort: string;
  displayLong: string;
  enabled: boolean | undefined;
  original: T;
};

export async function selectPrompt<T>({
  message,
  choices,
  isMultiple,
}: {
  message: string;
  choices: Choice<T>[];
  isMultiple: boolean;
}): Promise<Array<T>> {
  const promptChoices = choices.map((c) => ({
    name: c.name,
    displayLong: c.displayLong,
    displayShort: c.displayShort,
    original: c.original,
  }));

  type PromptChoice = typeof promptChoices[0];

  // styles for focues item
  // blue and bold (instead of cyan and underline)
  const styles = {
    em: chalk.cyan.bold,
  };

  if (!isMultiple) {
    const prompt = new Select({
      styles,
      message,
      choices,
      result() {
        return this.selected.original;
      },
    });

    try {
      const answer: T = await prompt.run();
      return [answer];
    } catch (e) {
      if (!e) {
        throw new HandledError('Aborted');
      }
      throw e;
    }
  }

  const prompt = new MultiSelect({
    pointer: `❯ `,
    styles,
    message,
    choices: promptChoices,
    initial: choices.filter((c) => c.enabled).map((c) => c.name),
    validate(items: PromptChoice[]) {
      if (items.length === 0) {
        return 'Please use <space> to select at least one option';
      }

      return true;
    },
    format() {
      if (!this.state.submitted) {
        return '';
      }

      // no items selected
      if (this.selected.length === 0) {
        return;
      }

      // 1 item selected
      if (this.selected.length === 1) {
        return chalk.cyan(this.selected[0].displayLong);
      }

      // multiple items selected
      return this.selected
        .map((c: PromptChoice) => chalk.cyan(c.displayShort))
        .join(', ');
    },
    result() {
      return this.selected.map((c: PromptChoice) => c.original);
    },
  });

  try {
    const answers = await prompt.run();
    return answers;
  } catch (e) {
    if (!e) {
      throw new HandledError('Aborted');
    }
    throw e;
  }
}
