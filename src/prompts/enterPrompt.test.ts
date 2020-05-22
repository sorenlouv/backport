import stripAnsi from 'strip-ansi';
import { enterPrompt, _currentPrompt } from './enterPrompt';

describe('enterPrompt', () => {
  it('should run async validation when submitting', async () => {
    expect.assertions(8);

    let i = 0;
    const promise = enterPrompt({
      message: 'Stage and commit files',
      errorMessage: 'Validation: Please fix the errors before continuing',
      validate: async () => {
        const isFinished = ++i > 1;
        return isFinished
          ? true
          : 'Validation: You continued without fixing errors!';
      },
    });

    const writeSpy = mockPromptWrite();

    expect(writeSpy).toHaveBeenCalledTimes(0);
    _currentPrompt.on('run', async () => {
      expect(writeSpy).toHaveBeenCalledTimes(1);
      await _currentPrompt.submit();
      expect(writeSpy).toHaveBeenCalledTimes(2);
      await _currentPrompt.submit();
      expect(writeSpy).toHaveBeenCalledTimes(5);
    });

    const answer = await promise;
    expect(answer).toBe(undefined);

    // first write
    expect(stripAnsi(writeSpy.mock.calls[0][0])).toMatchInlineSnapshot(`
      "? Stage and commit files

      Validation: Please fix the errors before continuing

      Press <ENTER> to continue"
    `);

    // second write
    expect(stripAnsi(writeSpy.mock.calls[1][0])).toMatchInlineSnapshot(`
      "? Stage and commit files

      Validation: You continued without fixing errors!

      Press <ENTER> to continue"
    `);

    // third write
    expect(stripAnsi(writeSpy.mock.calls[2][0])).toMatchInlineSnapshot(
      `"✔ Stage and commit files"`
    );
  });

  it('should return immediately after submitting', async () => {
    expect.assertions(6);

    const promise = enterPrompt({
      message: 'Stage and commit files',
      errorMessage: 'Some error message to display initially',
    });

    const writeSpy = mockPromptWrite();

    expect(writeSpy).toHaveBeenCalledTimes(0);

    _currentPrompt.on('run', async () => {
      expect(writeSpy).toHaveBeenCalledTimes(1);
      await _currentPrompt.submit();
    });

    const answer = await promise;
    expect(answer).toBe(undefined);

    expect(writeSpy).toHaveBeenCalledTimes(4);

    // first write
    expect(stripAnsi(writeSpy.mock.calls[0][0])).toMatchInlineSnapshot(`
      "? Stage and commit files

      Some error message to display initially

      Press <ENTER> to continue"
    `);

    // second write
    expect(stripAnsi(writeSpy.mock.calls[1][0])).toMatchInlineSnapshot(
      `"✔ Stage and commit files"`
    );
  });
});

function mockPromptWrite() {
  return jest.spyOn(_currentPrompt, 'write').mockImplementation(() => '');
}
