export function replaceStringAndLinebreaks({
  haystack,
  stringBefore,
  stringAfter,
}: {
  haystack: string;
  stringBefore: string;
  stringAfter: string;
}) {
  const regex = [...stringBefore].join(String.raw`\s?`);
  return haystack.replaceAll(new RegExp(regex, 'g'), stringAfter);
}

export function removeLinesBreaksInConflictingFiles(str: string) {
  return str.replaceAll(
    /(Conflicting files:[\s\S]*?)(\n\nPress ENTER when the conflicts are resolved and files are staged)/g,
    (match, start, end) => {
      return start.replaceAll('\n', '') + end;
    },
  );
}
