'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

childProcess.spawnSync = () => ({ status: 1, stdout: '' });

const init = require('../src/init');
const uninstall = require('../src/uninstall');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function yasakaniCommands(settings) {
  const runOnSave = settings['emeraldwalk.runonsave'];
  return (runOnSave.commands || []).filter(command => command.cmd && command.cmd.includes('.yasakani/scan.js'));
}

const originalCwd = process.cwd();
const root = path.join(originalCwd, '.tmp', `init-uninstall-test-${process.pid}`);
const settingsPath = path.join(root, '.vscode', 'settings.json');

try {
  const oldYasakaniRunOnSave = {
    commands: [
      {
        match: '\\.(js|ts|py|json|env|yml|yaml|md|mdx)$',
        cmd: 'node "${workspaceFolder}/.yasakani/scan.js" "${file}"',
      },
    ],
  };
  assert.strictEqual(init.hasYasakaniRunOnSave(oldYasakaniRunOnSave), true, 'detects existing Yasakani command');
  assert.strictEqual(init.hasCurrentYasakaniRunOnSave(oldYasakaniRunOnSave), false, 'detects stale Yasakani command');
  const normalized = init.mergeRunOnSave({
    commands: oldYasakaniRunOnSave.commands,
  });
  assert.strictEqual(normalized.commands.length, 1, 'normalizes existing Yasakani command without duplication');
  assert(normalized.commands[0].match.includes('env(?:'), 'normalizes old match to include .env variants');
  assert.strictEqual(init.hasCurrentYasakaniRunOnSave(normalized), true, 'normalization makes Yasakani command current');

  const linuxCode = path.join('/usr/local/bin', 'code');
  assert.strictEqual(init.findEditorCli('code', {
    platform: 'linux',
    env: { PATH: '/usr/bin:/usr/local/bin' },
    existsSync: candidate => candidate === linuxCode,
  }), linuxCode, 'finds editor CLI on POSIX PATH without shell builtins');

  const winCode = path.join('C:\\tools', 'code.cmd');
  assert.strictEqual(init.findEditorCli('code', {
    platform: 'win32',
    env: { PATH: 'C:\\other;C:\\tools' },
    existsSync: candidate => candidate === winCode,
  }), winCode, 'finds code.cmd on Windows PATH');

  assert.strictEqual(init.findEditorCli('cursor', {
    platform: 'linux',
    env: { PATH: '/usr/bin:/usr/local/bin' },
    existsSync: () => false,
  }), null, 'returns null when editor CLI is not found');

  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({
    'editor.formatOnSave': true,
    'emeraldwalk.runonsave': {
      commands: [
        { match: '\\.txt$', cmd: 'echo user-command' },
      ],
    },
  }, null, 2) + '\n');

  process.chdir(root);
  init.run();

  let settings = readJson(settingsPath);
  assert.strictEqual(settings['editor.formatOnSave'], true, 'keeps unrelated VS Code settings');
  assert.strictEqual(settings['emeraldwalk.runonsave'].commands.length, 2, 'adds Yasakani command without deleting user command');
  assert(settings['emeraldwalk.runonsave'].commands.some(command => command.cmd === 'echo user-command'), 'keeps user Run on Save command');
  assert.strictEqual(yasakaniCommands(settings).length, 1, 'adds one Yasakani command');
  assert(yasakaniCommands(settings)[0].match.includes('env(?:'), 'matches .env variants on save');

  init.run();
  settings = readJson(settingsPath);
  assert.strictEqual(settings['emeraldwalk.runonsave'].commands.length, 2, 'does not duplicate commands on repeated init');
  assert.strictEqual(yasakaniCommands(settings).length, 1, 'keeps one Yasakani command after repeated init');

  uninstall.run();
  settings = readJson(settingsPath);
  assert.strictEqual(settings['editor.formatOnSave'], true, 'uninstall keeps unrelated VS Code settings');
  assert.deepStrictEqual(settings['emeraldwalk.runonsave'].commands, [
    { match: '\\.txt$', cmd: 'echo user-command' },
  ], 'uninstall removes only Yasakani command');

  console.log('init/uninstall merge tests passed');
} finally {
  process.chdir(originalCwd);
  fs.rmSync(root, { recursive: true, force: true });
}
