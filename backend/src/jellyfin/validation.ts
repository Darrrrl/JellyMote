export const PLAYSTATE_ACTIONS = ['play', 'pause', 'stop', 'next', 'previous'] as const;
export type PlaystateAction = typeof PLAYSTATE_ACTIONS[number];

export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(value);
}

export function isPlaystateAction(value: unknown): value is PlaystateAction {
  return typeof value === 'string' && PLAYSTATE_ACTIONS.includes(value as PlaystateAction);
}

export function isPositionTicks(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

export function isBoolean(value: unknown): value is boolean { return typeof value === 'boolean'; }

export const PLAY_COMMANDS = ['PlayNow'] as const;
export type PlayCommand = typeof PLAY_COMMANDS[number];
export const isItemId = isSessionId;
export function isItemIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(isItemId);
}
export function isPlayCommand(value: unknown): value is PlayCommand {
  return typeof value === 'string' && PLAY_COMMANDS.includes(value as PlayCommand);
}
