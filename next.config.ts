new TraceMap(parsed, mapUrl);
  }
  const mappings = [];
  const sources = [];
  const sourcesContent = [];
  const names = [];
  const ignoreList = [];
  recurse(
    parsed,
    mapUrl,
    mappings,
    sources,
    sourcesContent,
    names,
    ignoreList,
    0,
    0,
    Infinity,
    Infinity
  );
  const joined = {
    version: 3,
    file: parsed.file,
    names,
    sources,
    sourcesContent,
    mappings,
    ignoreList
  };
  return presortedDecodedMap(joined);
};
function recurse(input, mapUrl, mappings, sources, sourcesContent, names, ignoreList, lineOffset, columnOffset, stopLine, stopColumn) {
  const { sections } = input;
  for (let i = 0; i < sections.length; i++) {
    const { map, offset } = sections[i];
    let sl = stopLine;
    let sc = stopColumn;
    if (i + 1 < sections.length) {
      const nextOffset = sections[i + 1].offset;
      sl = Math.min(stopLine, lineOffset + nextOffset.line);
      if (sl === stopLine) {
        sc = Math.min(stopColumn, columnOffset + nextOffset.column);
      } else if (sl < stopLine) {
        sc = columnOffset + nextOffset.column;
      }
    }
    addSection(
      map,
      mapUrl,
      mappings,
      sources,
      sourcesContent,
      names,
      ignoreList,
      lineOffset + offset.line,
      columnOffset + offset.column,
      sl,
      sc
    );
  }
}
function addSection(input, mapUrl, mappings, sources, sourcesContent, names, ignoreList, lineOffset, columnOffset, stopLine, stopColumn) {
  const parsed = parse(input);
  if ("sec