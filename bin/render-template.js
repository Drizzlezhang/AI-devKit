#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MARKERS = {
  all: 0,
  'S+': 1,
  'M+': 2,
  L: 3,
};

const SIZES = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const template = fs.readFileSync(args.templatePath, 'utf8');
  const rendered = renderTemplate(template, args.size);

  if (args.outPath) {
    fs.writeFileSync(args.outPath, rendered, 'utf8');
    return;
  }

  process.stdout.write(rendered);
}

function parseArgs(argv) {
  if (argv.length === 0) {
    throw new Error('Usage: node bin/render-template.js <template_path> --size <XS|S|M|L> [--out <output_path>]');
  }

  const args = {
    templatePath: path.resolve(argv[0]),
    size: '',
    outPath: '',
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--size') {
      const value = argv[i + 1];
      if (!value || !SIZES[value]) {
        if (value !== 'XS') {
          throw new Error('Missing or invalid value for --size');
        }
      }
      args.size = value;
      i += 1;
      continue;
    }

    if (arg === '--out') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --out');
      }
      args.outPath = path.resolve(value);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.size || !(args.size in SIZES)) {
    throw new Error('Missing or invalid value for --size');
  }

  return args;
}

function renderTemplate(template, size) {
  const lines = template.split(/\r?\n/);
  const stack = [];
  const output = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const openMatch = line.match(/^\s*<!--\s*size:(all|S\+|M\+|L)\s*-->\s*$/);
    if (openMatch) {
      stack.push({ marker: openMatch[1], line: i + 1 });
      continue;
    }

    const closeMatch = line.match(/^\s*<!--\s*\/size:(all|S\+|M\+|L)\s*-->\s*$/);
    if (closeMatch) {
      const current = stack.pop();
      if (!current || current.marker !== closeMatch[1]) {
        throw new Error(`Unpaired size marker at line ${i + 1}`);
      }
      continue;
    }

    if (stack.length === 0) {
      output.push(line);
      continue;
    }

    const current = stack[stack.length - 1];
    if (SIZES[size] >= MARKERS[current.marker]) {
      output.push(line);
    }
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed size marker at line ${stack[stack.length - 1].line}`);
  }

  return `${output.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

main();
