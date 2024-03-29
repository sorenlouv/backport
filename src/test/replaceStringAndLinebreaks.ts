export function replaceStringAndLinebreaks({
  haystack,
  stringBefore,
  stringAfter,
}: {
  haystack: string;
  stringBefore: string;
  stringAfter: string;
}) {
  const regex = stringBefore.split('').join('\\s?');
  return haystack.replace(new RegExp(regex, 'g'), stringAfter);
}
