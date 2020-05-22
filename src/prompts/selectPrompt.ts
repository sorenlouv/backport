//@ts-ignore
import { MultiSelect, Select, Prompt } from '@sqren/enquirer';
import chalk from 'chalk';
import { HandledError } from '../services/HandledError';

type Choice = {
  name: string;
  displayShort: string;
  displayLong: string;
  enabled: boolean | undefined;
};

export let _currentPrompt: Prompt;

export async function selectPrompt<T extends Choice>({
  message,
  choices,
  isMultiple,
}: {
  message: string;
  choices: T[];
  isMultiple: boolean;
}): Promise<T[]> {
  const promptChoices = [
    ...choices.map((c) => ({
      ...c,
      original: c,
    })),
    { role: 'separator' } as any,
  ];

  type PromptChoice = typeof promptChoices[0];

  // styles for focused item: bold (instead of underlined)
  const styles = {
    em: chalk.cyan.bold,
  };

  if (!isMultiple) {
    const prompt = new Select({
      limit: 20,
      styles,
      message,
      choices: promptChoices,
      format() {
        return chalk.cyan(this.selected.displayLong);
      },
      result() {
        return this.selected.original;
      },
    });

    _currentPrompt = prompt;

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
    limit: 20,
    pointer: `❯ `,
    styles,
    message,
    choices: promptChoices,
    initial: promptChoices.filter((c) => c.enabled).map((c) => c.name),
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

  _currentPrompt = prompt;

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
