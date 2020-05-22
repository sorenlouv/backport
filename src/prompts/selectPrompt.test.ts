import { selectPrompt, _currentPrompt } from './selectPrompt';

describe('selectPrompt', () => {
  const choices = [
    {
      name: 'black',
      displayLong: 'black as the night',
      displayShort: 'b',
      enabled: false,
    },
    {
      name: 'yellow',
      displayLong: 'yellow as the sun',
      displayShort: 'y',
      enabled: false,
    },
    {
      name: 'red',
      displayLong: 'red as a rose',
      displayShort: 'r',
      enabled: false,
    },
  ];

  it('should return a single answer', async () => {
    const promise = selectPrompt({
      isMultiple: false,
      message: 'Pick ONE color',
      choices,
    });

    const spy = mockPromptWrite();

    _currentPrompt.on('run', async () => {
      await _currentPrompt.keypress(null, { name: 'down' });
      _currentPrompt.submit();
    });

    const answers = await promise;
    expect(answers).toEqual([
      {
        name: 'yellow',
        displayLong: 'yellow as the sun',
        displayShort: 'y',
        enabled: false,
      },
    ]);

    expect(spy.mock.calls).toMatchSnapshot();
  });

  it('should return multiple answers', async () => {
    const promise = selectPrompt({
      isMultiple: true,
      message: 'Pick one or more colors',
      choices,
    });

    const spy = mockPromptWrite();

    _currentPrompt.on('run', async () => {
      await _currentPrompt.keypress(' ');
      await _currentPrompt.keypress(null, { name: 'down' });
      await _currentPrompt.keypress(' ');
      _currentPrompt.submit();
    });

    const answers = await promise;
    expect(answers).toEqual([
      {
        name: 'black',
        displayLong: 'black as the night',
        displayShort: 'b',
        enabled: false,
      },
      {
        name: 'yellow',
        displayLong: 'yellow as the sun',
        displayShort: 'y',
        enabled: false,
      },
    ]);
    expect(spy.mock.calls).toMatchSnapshot();
  });
});

function mockPromptWrite() {
  return jest.spyOn(_currentPrompt, 'write').mockImplementation(() => '');
}
