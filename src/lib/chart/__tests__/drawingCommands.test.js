import { describe, it, expect } from 'vitest';
import { DrawingCommandStack } from '../drawingCommands.js';
import { createMockChart } from './helpers/chartHarness.js';

function makeSyncCommand() {
  const executed = { value: false };
  const undone = { value: false };
  const redone = { value: false };
  return {
    execute: () => { executed.value = true; },
    undo: () => { undone.value = true; },
    redo: () => { redone.value = true; },
    executed,
    undone,
    redone,
  };
}

describe('DrawingCommandStack', () => {
  it('undo() moves command from undoStack to redoStack', async () => {
    const chart = createMockChart();
    const stack = new DrawingCommandStack();
    const cmd = makeSyncCommand();
    stack.execute(cmd);

    expect(stack.undoStack).toHaveLength(1);
    expect(stack.redoStack).toHaveLength(0);

    await stack.undo();

    expect(stack.undoStack).toHaveLength(0);
    expect(stack.redoStack).toHaveLength(1);
    expect(cmd.undone.value).toBe(true);
  });

  it('redo() moves command from redoStack to undoStack', async () => {
    const chart = createMockChart();
    const stack = new DrawingCommandStack();
    const cmd = makeSyncCommand();
    stack.execute(cmd);
    await stack.undo();

    await stack.redo();

    expect(stack.undoStack).toHaveLength(1);
    expect(stack.redoStack).toHaveLength(0);
  });

  it('undo() does NOT move command to redoStack when undo throws', async () => {
    const stack = new DrawingCommandStack();
    const throwingCmd = {
      execute() {},
      undo() { throw new Error('undo failed'); },
    };
    stack.execute(throwingCmd);

    expect(stack.undoStack).toHaveLength(1);
    expect(stack.redoStack).toHaveLength(0);

    await expect(stack.undo()).rejects.toThrow('undo failed');

    // Command stays in undoStack, not moved to redoStack
    expect(stack.undoStack).toHaveLength(1);
    expect(stack.redoStack).toHaveLength(0);
  });

  it('redo() does NOT move command to undoStack when redo throws', async () => {
    const stack = new DrawingCommandStack();
    const throwingCmd = {
      execute() {
        throwingCmd.execute.count++;
        if (throwingCmd.execute.count > 1) throw new Error('redo execute failed');
      },
      undo() {},
    };
    throwingCmd.execute.count = 0;
    stack.execute(throwingCmd);
    await stack.undo();

    expect(stack.undoStack).toHaveLength(0);
    expect(stack.redoStack).toHaveLength(1);

    await expect(stack.redo()).rejects.toThrow('redo execute failed');

    // Command stays in redoStack, not moved to undoStack
    expect(stack.undoStack).toHaveLength(0);
    expect(stack.redoStack).toHaveLength(1);
  });

  it('evicts oldest command when maxDepth is exceeded on push', () => {
    const stack = new DrawingCommandStack(3);
    const cmds = [makeSyncCommand(), makeSyncCommand(), makeSyncCommand(), makeSyncCommand()];

    for (const cmd of cmds) {
      stack.execute(cmd);
    }

    expect(stack.undoStack).toHaveLength(3);
    // First command should have been evicted
    expect(stack.undoStack).not.toContain(cmds[0]);
    // Last 3 commands remain
    expect(stack.undoStack).toContain(cmds[1]);
    expect(stack.undoStack).toContain(cmds[2]);
    expect(stack.undoStack).toContain(cmds[3]);
  });

  it('clear() empties both stacks', async () => {
    const stack = new DrawingCommandStack();
    const cmd1 = makeSyncCommand();
    const cmd2 = makeSyncCommand();
    stack.execute(cmd1);
    stack.execute(cmd2);
    await stack.undo();

    expect(stack.undoStack).toHaveLength(1);
    expect(stack.redoStack).toHaveLength(1);

    stack.clear();

    expect(stack.undoStack).toHaveLength(0);
    expect(stack.redoStack).toHaveLength(0);
  });
});
